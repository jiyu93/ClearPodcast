use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use thiserror::Error;

const EXPECTED_LATEST_FILE: &str = "default";

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EnhanceRequest {
    pub python: PathBuf,
    pub model_dir: PathBuf,
    pub input_wav: PathBuf,
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
    #[error("input WAV was not found at {0}")]
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
    #[error("failed to prepare output directory {path}: {source}")]
    OutputDirectory {
        path: PathBuf,
        source: std::io::Error,
    },
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
}

pub fn enhance_wav(request: EnhanceRequest) -> Result<EnhancementResult, RuntimeError> {
    let request = request.with_resolved_paths();
    validate_request(&request)?;

    if let Some(parent) = request.output_wav.parent() {
        fs::create_dir_all(parent).map_err(|source| RuntimeError::OutputDirectory {
            path: parent.to_path_buf(),
            source,
        })?;
    }

    let sidecar = request.sidecar.clone().unwrap_or_else(default_sidecar_path);
    let mut command = Command::new(&request.python);
    command
        .arg(&sidecar)
        .arg("--model-dir")
        .arg(&request.model_dir)
        .arg("--input-wav")
        .arg(&request.input_wav)
        .arg("--output-wav")
        .arg(&request.output_wav)
        .arg("--device")
        .arg(request.device.as_deref().unwrap_or("cpu"))
        .arg("--nfe")
        .arg(request.nfe.unwrap_or(64).to_string())
        .arg("--solver")
        .arg(request.solver.as_deref().unwrap_or("midpoint"))
        .arg("--lambd")
        .arg(request.lambd.unwrap_or(1.0).to_string())
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

    let output = command.output().map_err(|source| RuntimeError::Launch {
        runtime: request.python.clone(),
        source,
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    let exit_code = output.status.code().unwrap_or(-1);

    if !output.status.success() {
        return Err(RuntimeError::SidecarFailed {
            exit_code,
            stdout,
            stderr,
        });
    }

    Ok(EnhancementResult {
        output_wav: request.output_wav,
        exit_code,
        stdout,
        stderr,
    })
}

impl EnhanceRequest {
    fn with_resolved_paths(mut self) -> Self {
        self.python = resolve_repo_relative(self.python);
        self.model_dir = resolve_repo_relative(self.model_dir);
        self.input_wav = resolve_repo_relative(self.input_wav);
        self.output_wav = resolve_repo_relative(self.output_wav);
        self.sidecar = self.sidecar.map(resolve_repo_relative);
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

    if !request.input_wav.is_file() {
        return Err(RuntimeError::MissingInput(request.input_wav.clone()));
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

fn resolve_repo_relative(path: PathBuf) -> PathBuf {
    if path.is_absolute() {
        path
    } else {
        repository_root().join(path)
    }
}

fn repository_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.parent().unwrap_or(&manifest_dir).to_path_buf()
}
