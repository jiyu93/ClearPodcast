use crate::audio::{self, AudioMetadata};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use thiserror::Error;

const EXPECTED_LATEST_FILE: &str = "default";
const SIDE_CAR_POLL_INTERVAL: Duration = Duration::from_millis(100);
const DEVICE_DETECTION_SCRIPT: &str = r#"
import json
import torch

cuda_available = bool(torch.cuda.is_available())
cuda_device_name = None
if cuda_available:
    try:
        cuda_device_name = torch.cuda.get_device_name(0)
    except Exception:
        cuda_device_name = None

print(json.dumps({
    "device": "cuda" if cuda_available else "cpu",
    "cuda_available": cuda_available,
    "torch_cuda_version": getattr(torch.version, "cuda", None),
    "cuda_device_name": cuda_device_name,
}))
"#;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EnhanceRequest {
    pub python: PathBuf,
    pub model_dir: PathBuf,
    #[serde(alias = "input_wav")]
    pub input_audio: PathBuf,
    pub output_wav: PathBuf,
    pub sidecar: Option<PathBuf>,
    pub device: Option<String>,
    pub nfe: Option<u16>,
    pub solver: Option<String>,
    pub lambd: Option<f32>,
    pub tau: Option<f32>,
    pub expected_checkpoint_sha256: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EnhancementResult {
    pub output_wav: PathBuf,
    pub input_metadata: AudioMetadata,
    pub output_metadata: AudioMetadata,
    pub device_info: Option<EnhancementDeviceInfo>,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct EnhancementDeviceInfo {
    pub selected_device: String,
    pub cuda_available: Option<bool>,
    pub torch_cuda_version: Option<String>,
    pub cuda_device_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DeviceDetectionRequest {
    pub python: Option<PathBuf>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SidecarRunResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Error)]
pub enum RuntimeError {
    #[error("local Python runtime was not found at {0}")]
    MissingRuntime(PathBuf),
    #[error("sidecar entrypoint was not found at {0}")]
    MissingSidecar(PathBuf),
    #[error("input audio file was not found at {0}")]
    MissingInput(PathBuf),
    #[error("model directory was not found at {0}")]
    MissingModelDirectory(PathBuf),
    #[error("required model file is missing: {0}")]
    MissingModelFile(PathBuf),
    #[error("model latest file at {path} contained {actual:?}; expected {expected:?}")]
    ModelLatestMismatch {
        path: PathBuf,
        actual: String,
        expected: &'static str,
    },
    #[error("audio contract failed: {0}")]
    Audio(#[from] audio::AudioError),
    #[error("failed to create temporary audio handoff directory: {0}")]
    TemporaryDirectory(std::io::Error),
    #[error("failed to capture sidecar output: {0}")]
    SidecarOutputCapture(std::io::Error),
    #[error("sidecar did not write the expected enhanced WAV at {0}")]
    MissingSidecarOutput(PathBuf),
    #[error("failed to launch sidecar with runtime {runtime}: {source}")]
    Launch {
        runtime: PathBuf,
        source: std::io::Error,
    },
    #[error("sidecar failed with exit code {exit_code}; stderr: {stderr}; stdout: {stdout}")]
    SidecarFailed {
        exit_code: i32,
        stdout: String,
        stderr: String,
    },
    #[error("processing device detection failed with exit code {exit_code}; stderr: {stderr}; stdout: {stdout}")]
    DeviceDetectionFailed {
        exit_code: i32,
        stdout: String,
        stderr: String,
    },
    #[error("processing device detection did not return device metadata; stderr: {stderr}; stdout: {stdout}")]
    DeviceDetectionOutput { stdout: String, stderr: String },
    #[error("enhancement job was cancelled")]
    Cancelled,
}

#[derive(Clone, Default)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
    child: Arc<Mutex<Option<Child>>>,
}

impl CancellationToken {
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        if let Ok(mut child) = self.child.lock() {
            if let Some(child) = child.as_mut() {
                let _ = child.kill();
            }
        }
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    fn set_child(&self, child: Child) {
        *self.child.lock().expect("sidecar child lock") = Some(child);
    }

    fn take_child(&self) -> Option<Child> {
        self.child.lock().expect("sidecar child lock").take()
    }
}

pub trait SidecarRunner {
    fn run_sidecar(
        &self,
        request: &EnhanceRequest,
        input_wav: &Path,
        output_wav: &Path,
        cancellation: Option<&CancellationToken>,
    ) -> Result<SidecarRunResult, RuntimeError>;
}

#[derive(Debug, Clone, Copy, Default)]
pub struct PythonSidecarRunner;

pub fn enhance_audio(request: EnhanceRequest) -> Result<EnhancementResult, RuntimeError> {
    enhance_audio_with_runner(request, &PythonSidecarRunner)
}

pub fn enhance_wav(request: EnhanceRequest) -> Result<EnhancementResult, RuntimeError> {
    enhance_audio(request)
}

pub fn detect_processing_device(
    python: impl Into<PathBuf>,
) -> Result<EnhancementDeviceInfo, RuntimeError> {
    let python = resolve_repo_relative_path(python.into());
    if !python.is_file() {
        return Err(RuntimeError::MissingRuntime(python));
    }

    let mut command = Command::new(&python);
    command
        .arg("-c")
        .arg(DEVICE_DETECTION_SCRIPT)
        .env("PYTHONNOUSERSITE", "1")
        .env("PYTHONUNBUFFERED", "1")
        .env("HF_HUB_OFFLINE", "1")
        .env("TRANSFORMERS_OFFLINE", "1");
    prepare_child_command(&mut command);

    let output = command.output().map_err(|source| RuntimeError::Launch {
        runtime: python.clone(),
        source,
    })?;
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    if !output.status.success() {
        return Err(RuntimeError::DeviceDetectionFailed {
            exit_code: output.status.code().unwrap_or(-1),
            stdout,
            stderr,
        });
    }

    parse_device_info_from_logs(&format!("{stdout}\n{stderr}"))
        .ok_or(RuntimeError::DeviceDetectionOutput { stdout, stderr })
}

pub fn enhance_audio_with_runner<R: SidecarRunner>(
    request: EnhanceRequest,
    runner: &R,
) -> Result<EnhancementResult, RuntimeError> {
    enhance_audio_with_runner_and_cancellation(request, runner, None)
}

pub fn enhance_audio_with_cancellation(
    request: EnhanceRequest,
    cancellation: &CancellationToken,
) -> Result<EnhancementResult, RuntimeError> {
    enhance_audio_with_runner_and_cancellation(request, &PythonSidecarRunner, Some(cancellation))
}

pub fn enhance_audio_with_runner_and_cancellation<R: SidecarRunner>(
    request: EnhanceRequest,
    runner: &R,
    cancellation: Option<&CancellationToken>,
) -> Result<EnhancementResult, RuntimeError> {
    let request = request.with_resolved_paths();
    validate_request(&request)?;
    fail_if_cancelled(cancellation)?;

    let decoded_input = audio::decode_audio(&request.input_audio)?;
    fail_if_cancelled(cancellation)?;

    let temp_dir = tempfile::Builder::new()
        .prefix("clearpodcast-audio-")
        .tempdir()
        .map_err(RuntimeError::TemporaryDirectory)?;
    let handoff_input = temp_dir.path().join("input-handoff.wav");
    let sidecar_output = temp_dir.path().join("sidecar-output.wav");

    audio::write_handoff_wav(&handoff_input, &decoded_input.pcm)?;
    fail_if_cancelled(cancellation)?;
    let sidecar_result =
        runner.run_sidecar(&request, &handoff_input, &sidecar_output, cancellation)?;
    fail_if_cancelled(cancellation)?;

    if !sidecar_output.is_file() {
        return Err(RuntimeError::MissingSidecarOutput(sidecar_output));
    }

    let enhanced = audio::decode_audio(&sidecar_output)?;
    fail_if_cancelled(cancellation)?;
    let output_metadata = audio::write_final_wav(&request.output_wav, &enhanced.pcm)?;
    let device_info = parse_sidecar_device_info(&sidecar_result.stderr);

    Ok(EnhancementResult {
        output_wav: request.output_wav,
        input_metadata: decoded_input.metadata,
        output_metadata,
        device_info,
        exit_code: sidecar_result.exit_code,
        stdout: sidecar_result.stdout,
        stderr: sidecar_result.stderr,
    })
}

impl SidecarRunner for PythonSidecarRunner {
    fn run_sidecar(
        &self,
        request: &EnhanceRequest,
        input_wav: &Path,
        output_wav: &Path,
        cancellation: Option<&CancellationToken>,
    ) -> Result<SidecarRunResult, RuntimeError> {
        let sidecar = request.sidecar.clone().unwrap_or_else(default_sidecar_path);
        let mut command = Command::new(&request.python);
        command
            .arg(&sidecar)
            .arg("--model-dir")
            .arg(&request.model_dir)
            .arg("--input-wav")
            .arg(input_wav)
            .arg("--output-wav")
            .arg(output_wav)
            .arg("--device")
            .arg(request.device.as_deref().unwrap_or("auto"))
            .arg("--nfe")
            .arg(request.nfe.unwrap_or(64).to_string())
            .arg("--solver")
            .arg(request.solver.as_deref().unwrap_or("midpoint"))
            .arg("--lambd")
            .arg(request.lambd.unwrap_or(0.1).to_string())
            .arg("--tau")
            .arg(request.tau.unwrap_or(0.5).to_string())
            .env("PYTHONNOUSERSITE", "1")
            .env("PYTHONUNBUFFERED", "1")
            .env("HF_HUB_OFFLINE", "1")
            .env("TRANSFORMERS_OFFLINE", "1");

        if let Some(expected_sha256) = &request.expected_checkpoint_sha256 {
            command
                .arg("--expected-checkpoint-sha256")
                .arg(expected_sha256);
        }

        run_sidecar_command(command, request, cancellation)
    }
}

impl EnhanceRequest {
    fn with_resolved_paths(mut self) -> Self {
        self.python = resolve_repo_relative_path(self.python);
        self.model_dir = resolve_repo_relative_path(self.model_dir);
        self.input_audio = resolve_repo_relative_path(self.input_audio);
        self.output_wav = resolve_repo_relative_path(self.output_wav);
        self.sidecar = self.sidecar.map(resolve_repo_relative_path);
        self
    }
}

fn validate_request(request: &EnhanceRequest) -> Result<(), RuntimeError> {
    if !request.python.is_file() {
        return Err(RuntimeError::MissingRuntime(request.python.clone()));
    }

    let sidecar = request.sidecar.clone().unwrap_or_else(default_sidecar_path);
    if !sidecar.is_file() {
        return Err(RuntimeError::MissingSidecar(sidecar));
    }

    if !request.input_audio.is_file() {
        return Err(RuntimeError::MissingInput(request.input_audio.clone()));
    }

    ensure_local_model(&request.model_dir)?;
    Ok(())
}

fn ensure_local_model(model_dir: &Path) -> Result<(), RuntimeError> {
    if !model_dir.is_dir() {
        return Err(RuntimeError::MissingModelDirectory(model_dir.to_path_buf()));
    }

    for relpath in [
        "hparams.yaml",
        "ds/G/latest",
        "ds/G/default/mp_rank_00_model_states.pt",
    ] {
        let path = model_dir.join(relpath);
        if !path.is_file() {
            return Err(RuntimeError::MissingModelFile(path));
        }
    }

    let latest_path = model_dir.join("ds/G/latest");
    let latest = fs::read_to_string(&latest_path).unwrap_or_default();
    let actual = latest.trim();
    if actual != EXPECTED_LATEST_FILE {
        return Err(RuntimeError::ModelLatestMismatch {
            path: latest_path,
            actual: actual.to_string(),
            expected: EXPECTED_LATEST_FILE,
        });
    }

    Ok(())
}

pub fn default_sidecar_path() -> PathBuf {
    repository_root()
        .join("sidecars")
        .join("resemble")
        .join("clearpodcast_resemble.py")
}

pub fn resolve_repo_relative_path(path: PathBuf) -> PathBuf {
    if path.is_absolute() {
        path
    } else {
        repository_root().join(path)
    }
}

fn run_sidecar_command(
    command: Command,
    request: &EnhanceRequest,
    cancellation: Option<&CancellationToken>,
) -> Result<SidecarRunResult, RuntimeError> {
    match cancellation {
        Some(cancellation) => run_cancellable_sidecar(command, request, cancellation),
        None => run_blocking_sidecar(command, request),
    }
}

fn run_blocking_sidecar(
    mut command: Command,
    request: &EnhanceRequest,
) -> Result<SidecarRunResult, RuntimeError> {
    prepare_child_command(&mut command);
    let output = command.output().map_err(|source| RuntimeError::Launch {
        runtime: request.python.clone(),
        source,
    })?;

    sidecar_result_from_parts(
        output.status.success(),
        output.status.code().unwrap_or(-1),
        String::from_utf8_lossy(&output.stdout).into_owned(),
        String::from_utf8_lossy(&output.stderr).into_owned(),
    )
}

fn run_cancellable_sidecar(
    mut command: Command,
    request: &EnhanceRequest,
    cancellation: &CancellationToken,
) -> Result<SidecarRunResult, RuntimeError> {
    fail_if_cancelled(Some(cancellation))?;

    let log_dir = tempfile::Builder::new()
        .prefix("clearpodcast-sidecar-log-")
        .tempdir()
        .map_err(RuntimeError::TemporaryDirectory)?;
    let stdout_path = log_dir.path().join("stdout.txt");
    let stderr_path = log_dir.path().join("stderr.txt");
    let stdout = fs::File::create(&stdout_path).map_err(RuntimeError::SidecarOutputCapture)?;
    let stderr = fs::File::create(&stderr_path).map_err(RuntimeError::SidecarOutputCapture)?;
    command
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));
    prepare_child_command(&mut command);

    let child = command.spawn().map_err(|source| RuntimeError::Launch {
        runtime: request.python.clone(),
        source,
    })?;
    cancellation.set_child(child);

    let status = loop {
        if cancellation.is_cancelled() {
            if let Some(mut child) = cancellation.take_child() {
                let _ = child.kill();
                let _ = child.wait();
            }
            return Err(RuntimeError::Cancelled);
        }

        let maybe_status = {
            let mut child = cancellation.child.lock().expect("sidecar child lock");
            match child.as_mut() {
                Some(child) => child
                    .try_wait()
                    .map_err(RuntimeError::SidecarOutputCapture)?,
                None => return Err(RuntimeError::Cancelled),
            }
        };

        if let Some(status) = maybe_status {
            cancellation.take_child();
            break status;
        }

        thread::sleep(SIDE_CAR_POLL_INTERVAL);
    };

    let stdout = read_sidecar_log(&stdout_path)?;
    let stderr = read_sidecar_log(&stderr_path)?;
    fail_if_cancelled(Some(cancellation))?;

    sidecar_result_from_parts(
        status.success(),
        status.code().unwrap_or(-1),
        stdout,
        stderr,
    )
}

fn read_sidecar_log(path: &Path) -> Result<String, RuntimeError> {
    let bytes = fs::read(path).map_err(RuntimeError::SidecarOutputCapture)?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn sidecar_result_from_parts(
    success: bool,
    exit_code: i32,
    stdout: String,
    stderr: String,
) -> Result<SidecarRunResult, RuntimeError> {
    if !success {
        return Err(RuntimeError::SidecarFailed {
            exit_code,
            stdout,
            stderr,
        });
    }

    Ok(SidecarRunResult {
        exit_code,
        stdout,
        stderr,
    })
}

fn parse_sidecar_device_info(stderr: &str) -> Option<EnhancementDeviceInfo> {
    parse_device_info_from_logs(stderr)
}

fn parse_device_info_from_logs(logs: &str) -> Option<EnhancementDeviceInfo> {
    parse_device_info_from_json_lines(logs.lines())
}

fn parse_device_info_from_json_lines<'a>(
    lines: impl IntoIterator<Item = &'a str>,
) -> Option<EnhancementDeviceInfo> {
    lines
        .into_iter()
        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
        .find_map(|event| {
            let selected_device = event.get("device")?.as_str()?.to_string();
            Some(EnhancementDeviceInfo {
                selected_device,
                cuda_available: event
                    .get("cuda_available")
                    .and_then(|value| value.as_bool()),
                torch_cuda_version: event
                    .get("torch_cuda_version")
                    .and_then(|value| value.as_str())
                    .map(String::from),
                cuda_device_name: event
                    .get("cuda_device_name")
                    .and_then(|value| value.as_str())
                    .map(String::from),
            })
        })
}

#[cfg(windows)]
fn prepare_child_command(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn prepare_child_command(_command: &mut Command) {}

fn fail_if_cancelled(cancellation: Option<&CancellationToken>) -> Result<(), RuntimeError> {
    if cancellation
        .map(CancellationToken::is_cancelled)
        .unwrap_or(false)
    {
        Err(RuntimeError::Cancelled)
    } else {
        Ok(())
    }
}

fn repository_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.parent().unwrap_or(&manifest_dir).to_path_buf()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancellable_sidecar_tolerates_non_utf8_output() {
        let command = non_utf8_stderr_command();
        let request = EnhanceRequest {
            python: PathBuf::from("test-runtime"),
            model_dir: PathBuf::from("test-model"),
            input_audio: PathBuf::from("test-input.wav"),
            output_wav: PathBuf::from("test-output.wav"),
            sidecar: None,
            device: None,
            nfe: None,
            solver: None,
            lambd: None,
            tau: None,
            expected_checkpoint_sha256: None,
        };

        let result = run_cancellable_sidecar(command, &request, &CancellationToken::default())
            .expect("non-UTF-8 sidecar logs should not fail the job");

        assert!(result.stderr.contains(char::REPLACEMENT_CHARACTER));
    }

    #[test]
    fn parses_selected_device_from_sidecar_json_logs() {
        let stderr = concat!(
            "loading model\n",
            "{\"cuda_available\":true,\"cuda_device_name\":\"NVIDIA GeForce RTX 5070 Ti\",",
            "\"device\":\"cuda\",\"event\":\"progress\",\"torch_cuda_version\":\"13.0\"}\n"
        );

        assert_eq!(
            parse_sidecar_device_info(stderr),
            Some(EnhancementDeviceInfo {
                selected_device: "cuda".to_string(),
                cuda_available: Some(true),
                torch_cuda_version: Some("13.0".to_string()),
                cuda_device_name: Some("NVIDIA GeForce RTX 5070 Ti".to_string()),
            })
        );
    }

    #[test]
    fn parses_selected_device_from_probe_stdout() {
        let stdout = concat!(
            "{\"cuda_available\":false,\"cuda_device_name\":null,",
            "\"device\":\"cpu\",\"torch_cuda_version\":\"13.0\"}\n"
        );

        assert_eq!(
            parse_device_info_from_logs(stdout),
            Some(EnhancementDeviceInfo {
                selected_device: "cpu".to_string(),
                cuda_available: Some(false),
                torch_cuda_version: Some("13.0".to_string()),
                cuda_device_name: None,
            })
        );
    }

    #[cfg(windows)]
    fn non_utf8_stderr_command() -> Command {
        let mut command = Command::new("powershell.exe");
        command.args([
            "-NoLogo",
            "-NoProfile",
            "-Command",
            "[Console]::OpenStandardError().Write([byte[]](0xff), 0, 1)",
        ]);
        command
    }

    #[cfg(unix)]
    fn non_utf8_stderr_command() -> Command {
        let mut command = Command::new("sh");
        command.args(["-c", "printf '\\377' >&2"]);
        command
    }
}
