use crate::{
    app_log::{truncate_log_field, AppLog},
    audio::{self, AudioMetadata},
    packaging::PackagedResourcePaths,
    runtime::{
        self, CancellationToken, EnhanceRequest, EnhancementDeviceInfo, EnhancementResult,
        RuntimeError,
    },
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use thiserror::Error;

static JOB_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EnhancementJobState {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct StartEnhancementJobRequest {
    pub python: Option<PathBuf>,
    pub model_dir: Option<PathBuf>,
    pub input_audio: PathBuf,
    pub sidecar: Option<PathBuf>,
    pub device: Option<String>,
    pub nfe: Option<u16>,
    pub solver: Option<String>,
    pub lambd: Option<f32>,
    pub tau: Option<f32>,
    pub expected_checkpoint_sha256: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EnhancementJobSnapshot {
    pub job_id: String,
    pub state: EnhancementJobState,
    pub input_audio: PathBuf,
    pub preview_wav: Option<PathBuf>,
    pub exported_wav: Option<PathBuf>,
    pub input_metadata: Option<AudioMetadata>,
    pub output_metadata: Option<AudioMetadata>,
    pub device_info: Option<EnhancementDeviceInfo>,
    pub message: String,
    pub error: Option<String>,
    pub created_at_ms: u128,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at_ms: Option<u128>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at_ms: Option<u128>,
    pub updated_at_ms: u128,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ExportResult {
    pub exported_wav: PathBuf,
    pub output_metadata: AudioMetadata,
}

#[derive(Debug, Error)]
pub enum JobError {
    #[error("enhancement job was not found: {0}")]
    MissingJob(String),
    #[error("enhancement job {job_id} is {state:?} and cannot be cancelled")]
    CannotCancel {
        job_id: String,
        state: EnhancementJobState,
    },
    #[error("enhancement job {job_id} is {state:?}; export requires completed")]
    CannotExport {
        job_id: String,
        state: EnhancementJobState,
    },
    #[error("enhancement job {0} has no completed preview WAV")]
    MissingPreview(String),
    #[error("export path must end in .wav: {0}")]
    ExportMustBeWav(PathBuf),
    #[error("failed to prepare export directory {path}: {source}")]
    ExportDirectory {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to copy enhanced WAV from {source_path} to {destination}: {source}")]
    ExportCopy {
        source_path: PathBuf,
        destination: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to read exported WAV metadata at {path}: {source}")]
    ExportProbe {
        path: PathBuf,
        source: audio::AudioError,
    },
    #[error("failed to create enhancement preview directory {path}: {source}")]
    PreviewDirectory {
        path: PathBuf,
        source: std::io::Error,
    },
}

#[derive(Clone, Default)]
pub struct EnhancementJobManager {
    jobs: Arc<Mutex<HashMap<String, EnhancementJobRecord>>>,
}

#[derive(Clone)]
struct EnhancementJobRecord {
    snapshot: EnhancementJobSnapshot,
    cancellation: CancellationToken,
}

impl EnhancementJobManager {
    pub fn start_job(
        &self,
        request: StartEnhancementJobRequest,
        packaged_resources: PackagedResourcePaths,
        app_log: AppLog,
    ) -> Result<EnhancementJobSnapshot, JobError> {
        let job_id = next_job_id();
        let job_dir = std::env::temp_dir()
            .join("clearpodcast")
            .join("jobs")
            .join(&job_id);
        fs::create_dir_all(&job_dir).map_err(|source| JobError::PreviewDirectory {
            path: job_dir.clone(),
            source,
        })?;

        let preview_wav = job_dir.join(format!(
            "{}.enhanced.wav",
            safe_file_stem(&request.input_audio)
        ));
        let cancellation = CancellationToken::default();
        let now = timestamp_ms();
        let snapshot = EnhancementJobSnapshot {
            job_id: job_id.clone(),
            state: EnhancementJobState::Queued,
            input_audio: runtime::resolve_repo_relative_path(request.input_audio.clone()),
            preview_wav: None,
            exported_wav: None,
            input_metadata: None,
            output_metadata: None,
            device_info: None,
            message: "Queued".to_string(),
            error: None,
            created_at_ms: now,
            started_at_ms: None,
            finished_at_ms: None,
            updated_at_ms: now,
        };

        {
            let mut jobs = self.jobs.lock().expect("job manager lock");
            jobs.insert(
                job_id.clone(),
                EnhancementJobRecord {
                    snapshot: snapshot.clone(),
                    cancellation: cancellation.clone(),
                },
            );
        }

        app_log.info_fields(
            "job_queued",
            &[
                ("job_id", job_id.clone()),
                (
                    "input",
                    runtime::resolve_repo_relative_path(request.input_audio.clone())
                        .display()
                        .to_string(),
                ),
                ("preview", preview_wav.display().to_string()),
                (
                    "requested_device",
                    request.device.clone().unwrap_or_else(|| "auto".to_string()),
                ),
                (
                    "solver",
                    request
                        .solver
                        .clone()
                        .unwrap_or_else(|| "default".to_string()),
                ),
                (
                    "nfe",
                    request
                        .nfe
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "default".to_string()),
                ),
                (
                    "lambda",
                    request
                        .lambd
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "default".to_string()),
                ),
                (
                    "tau",
                    request
                        .tau
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "default".to_string()),
                ),
            ],
        );

        let manager = self.clone();
        thread::spawn(move || {
            manager.run_job(
                job_id,
                request,
                packaged_resources,
                preview_wav,
                job_dir,
                cancellation,
                app_log,
            );
        });

        Ok(snapshot)
    }

    pub fn snapshot(&self, job_id: &str) -> Result<EnhancementJobSnapshot, JobError> {
        self.jobs
            .lock()
            .expect("job manager lock")
            .get(job_id)
            .map(|record| record.snapshot.clone())
            .ok_or_else(|| JobError::MissingJob(job_id.to_string()))
    }

    pub fn cancel_job(&self, job_id: &str) -> Result<EnhancementJobSnapshot, JobError> {
        let cancellation = {
            let mut jobs = self.jobs.lock().expect("job manager lock");
            let record = jobs
                .get_mut(job_id)
                .ok_or_else(|| JobError::MissingJob(job_id.to_string()))?;

            match record.snapshot.state {
                EnhancementJobState::Queued | EnhancementJobState::Running => {
                    record.snapshot.state = EnhancementJobState::Cancelled;
                    record.snapshot.message = "Cancelling".to_string();
                    record.snapshot.error = None;
                    record.snapshot.finished_at_ms = Some(timestamp_ms());
                    record.snapshot.updated_at_ms = timestamp_ms();
                    record.cancellation.clone()
                }
                state => {
                    return Err(JobError::CannotCancel {
                        job_id: job_id.to_string(),
                        state,
                    });
                }
            }
        };

        cancellation.cancel();
        self.snapshot(job_id)
    }

    pub fn export_job(&self, job_id: &str, destination: PathBuf) -> Result<ExportResult, JobError> {
        ensure_wav_destination(&destination)?;

        let preview_wav = {
            let jobs = self.jobs.lock().expect("job manager lock");
            let record = jobs
                .get(job_id)
                .ok_or_else(|| JobError::MissingJob(job_id.to_string()))?;

            if record.snapshot.state != EnhancementJobState::Completed {
                return Err(JobError::CannotExport {
                    job_id: job_id.to_string(),
                    state: record.snapshot.state,
                });
            }

            record
                .snapshot
                .preview_wav
                .clone()
                .filter(|path| path.is_file())
                .ok_or_else(|| JobError::MissingPreview(job_id.to_string()))?
        };

        if let Some(parent) = destination
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
        {
            fs::create_dir_all(parent).map_err(|source| JobError::ExportDirectory {
                path: parent.to_path_buf(),
                source,
            })?;
        }

        fs::copy(&preview_wav, &destination).map_err(|source| JobError::ExportCopy {
            source_path: preview_wav,
            destination: destination.clone(),
            source,
        })?;
        let output_metadata =
            audio::probe_audio(&destination).map_err(|source| JobError::ExportProbe {
                path: destination.clone(),
                source,
            })?;

        let mut jobs = self.jobs.lock().expect("job manager lock");
        if let Some(record) = jobs.get_mut(job_id) {
            record.snapshot.exported_wav = Some(destination.clone());
            record.snapshot.message = "Exported".to_string();
            record.snapshot.updated_at_ms = timestamp_ms();
        }

        Ok(ExportResult {
            exported_wav: destination,
            output_metadata,
        })
    }

    fn run_job(
        &self,
        job_id: String,
        request: StartEnhancementJobRequest,
        packaged_resources: PackagedResourcePaths,
        preview_wav: PathBuf,
        job_dir: PathBuf,
        cancellation: CancellationToken,
        app_log: AppLog,
    ) {
        if cancellation.is_cancelled() {
            app_log.info_fields("job_cancelled_before_start", &[("job_id", job_id.clone())]);
            self.finish_cancelled(&job_id, &job_dir);
            return;
        }

        let input_metadata = audio::probe_audio(runtime::resolve_repo_relative_path(
            request.input_audio.clone(),
        ))
        .ok();
        self.update_snapshot(&job_id, |snapshot| {
            snapshot.state = EnhancementJobState::Running;
            snapshot.message = "Processing".to_string();
            snapshot.input_metadata = input_metadata;
            if snapshot.started_at_ms.is_none() {
                snapshot.started_at_ms = Some(timestamp_ms());
            }
        });
        let input_metadata = self
            .snapshot(&job_id)
            .ok()
            .and_then(|snapshot| snapshot.input_metadata);
        app_log.info_fields(
            "job_running",
            &[
                ("job_id", job_id.clone()),
                (
                    "input_format",
                    input_metadata
                        .as_ref()
                        .map(|metadata| format!("{:?}", metadata.format))
                        .unwrap_or_default(),
                ),
                (
                    "input_sample_rate",
                    input_metadata
                        .as_ref()
                        .map(|metadata| metadata.source_sample_rate.to_string())
                        .unwrap_or_default(),
                ),
                (
                    "input_channels",
                    input_metadata
                        .as_ref()
                        .map(|metadata| metadata.channels.to_string())
                        .unwrap_or_default(),
                ),
                (
                    "input_duration_seconds",
                    input_metadata
                        .as_ref()
                        .and_then(|metadata| metadata.duration_seconds)
                        .map(|duration| format!("{duration:.3}"))
                        .unwrap_or_default(),
                ),
            ],
        );

        let result = runtime::enhance_audio_with_cancellation(
            request.into_enhance_request(preview_wav.clone(), &packaged_resources),
            &cancellation,
        );

        match result {
            Ok(result) => self.finish_completed(&job_id, result, &app_log),
            Err(RuntimeError::Cancelled) => {
                app_log.info_fields("job_cancelled", &[("job_id", job_id.clone())]);
                self.finish_cancelled(&job_id, &job_dir);
            }
            Err(error) => self.finish_failed(&job_id, &job_dir, error.to_string(), &app_log),
        }
    }

    fn finish_completed(&self, job_id: &str, result: EnhancementResult, app_log: &AppLog) {
        let elapsed_ms = self
            .snapshot(job_id)
            .ok()
            .map(|snapshot| {
                timestamp_ms()
                    .saturating_sub(snapshot.started_at_ms.unwrap_or(snapshot.created_at_ms))
            })
            .unwrap_or_default();
        app_log.info_fields(
            "job_completed",
            &[
                ("job_id", job_id.to_string()),
                ("preview", result.output_wav.display().to_string()),
                (
                    "selected_device",
                    result
                        .device_info
                        .as_ref()
                        .map(|device| device.selected_device.clone())
                        .unwrap_or_else(|| "unknown".to_string()),
                ),
                (
                    "cuda_available",
                    result
                        .device_info
                        .as_ref()
                        .and_then(|device| device.cuda_available)
                        .map(|available| available.to_string())
                        .unwrap_or_default(),
                ),
                ("exit_code", result.exit_code.to_string()),
                ("elapsed_ms", elapsed_ms.to_string()),
                (
                    "output_sample_rate",
                    result.output_metadata.source_sample_rate.to_string(),
                ),
                (
                    "output_channels",
                    result.output_metadata.channels.to_string(),
                ),
                ("sidecar_stderr_bytes", result.stderr.len().to_string()),
            ],
        );
        self.update_snapshot(job_id, |snapshot| {
            snapshot.state = EnhancementJobState::Completed;
            snapshot.preview_wav = Some(result.output_wav);
            snapshot.input_metadata = Some(result.input_metadata);
            snapshot.output_metadata = Some(result.output_metadata);
            snapshot.device_info = result.device_info;
            snapshot.message = "Completed".to_string();
            snapshot.error = None;
            snapshot.finished_at_ms = Some(timestamp_ms());
        });
    }

    fn finish_failed(&self, job_id: &str, job_dir: &Path, error: String, app_log: &AppLog) {
        let elapsed_ms = self
            .snapshot(job_id)
            .ok()
            .map(|snapshot| {
                timestamp_ms()
                    .saturating_sub(snapshot.started_at_ms.unwrap_or(snapshot.created_at_ms))
            })
            .unwrap_or_default();
        app_log.error_fields(
            "job_failed",
            &[
                ("job_id", job_id.to_string()),
                ("elapsed_ms", elapsed_ms.to_string()),
                ("error", truncate_log_field(&error)),
            ],
        );
        let _ = fs::remove_dir_all(job_dir);
        self.update_snapshot(job_id, |snapshot| {
            snapshot.state = EnhancementJobState::Failed;
            snapshot.preview_wav = None;
            snapshot.output_metadata = None;
            snapshot.device_info = None;
            snapshot.message = "Failed".to_string();
            snapshot.error = Some(error);
            snapshot.finished_at_ms = Some(timestamp_ms());
        });
    }

    fn finish_cancelled(&self, job_id: &str, job_dir: &Path) {
        let _ = fs::remove_dir_all(job_dir);
        self.update_snapshot(job_id, |snapshot| {
            snapshot.state = EnhancementJobState::Cancelled;
            snapshot.preview_wav = None;
            snapshot.output_metadata = None;
            snapshot.device_info = None;
            snapshot.message = "Cancelled".to_string();
            snapshot.error = None;
            if snapshot.finished_at_ms.is_none() {
                snapshot.finished_at_ms = Some(timestamp_ms());
            }
        });
    }

    fn update_snapshot(&self, job_id: &str, update: impl FnOnce(&mut EnhancementJobSnapshot)) {
        let mut jobs = self.jobs.lock().expect("job manager lock");
        if let Some(record) = jobs.get_mut(job_id) {
            update(&mut record.snapshot);
            record.snapshot.updated_at_ms = timestamp_ms();
        }
    }
}

impl StartEnhancementJobRequest {
    fn into_enhance_request(
        self,
        output_wav: PathBuf,
        packaged_resources: &PackagedResourcePaths,
    ) -> EnhanceRequest {
        EnhanceRequest {
            python: self
                .python
                .unwrap_or_else(|| packaged_resources.python.clone()),
            model_dir: self
                .model_dir
                .unwrap_or_else(|| packaged_resources.model_dir.clone()),
            input_audio: self.input_audio,
            output_wav,
            sidecar: Some(
                self.sidecar
                    .unwrap_or_else(|| packaged_resources.sidecar.clone()),
            ),
            device: self.device,
            nfe: self.nfe,
            solver: self.solver,
            lambd: self.lambd,
            tau: self.tau,
            expected_checkpoint_sha256: self.expected_checkpoint_sha256,
        }
    }
}

fn next_job_id() -> String {
    let sequence = JOB_COUNTER.fetch_add(1, Ordering::SeqCst);
    format!("job-{}-{sequence}", timestamp_ms())
}

fn timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn safe_file_stem(path: &Path) -> String {
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("clearpodcast-output");
    let mut output = String::new();
    for character in stem.chars() {
        if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
            output.push(character);
        } else if !output.ends_with('-') {
            output.push('-');
        }
    }
    let output = output.trim_matches('-');
    if output.is_empty() {
        "clearpodcast-output".to_string()
    } else {
        output.to_string()
    }
}

fn ensure_wav_destination(path: &Path) -> Result<(), JobError> {
    if path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("wav"))
        .unwrap_or(false)
    {
        Ok(())
    } else {
        Err(JobError::ExportMustBeWav(path.to_path_buf()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::AudioBuffer;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use std::path::Path;
    use std::{
        fs, thread,
        time::{Duration, Instant},
    };
    use tempfile::{tempdir, TempDir};

    #[test]
    fn safe_file_stem_keeps_preview_names_portable() {
        assert_eq!(
            safe_file_stem(Path::new("Meeting Audio 01.m4a")),
            "Meeting-Audio-01"
        );
    }

    #[test]
    fn wav_export_paths_are_required() {
        assert!(ensure_wav_destination(Path::new("episode.wav")).is_ok());
        assert!(matches!(
            ensure_wav_destination(Path::new("episode.mp3")),
            Err(JobError::ExportMustBeWav(_))
        ));
    }

    #[test]
    fn job_manager_completes_and_exports_with_fake_sidecar() {
        let runtime_env = fake_runtime_env(0);
        let input = runtime_env.dir.path().join("input.wav");
        audio::write_handoff_wav(&input, &synthetic_audio()).expect("write input wav");

        let manager = EnhancementJobManager::default();
        let snapshot = manager
            .start_job(
                request_for(&runtime_env, &input),
                runtime_env.packaged_resources(),
                test_log(&runtime_env),
            )
            .expect("start job");
        let completed = wait_for_terminal(&manager, &snapshot.job_id);

        assert_eq!(completed.state, EnhancementJobState::Completed);
        assert_eq!(
            completed
                .device_info
                .as_ref()
                .map(|info| info.selected_device.as_str()),
            Some("cpu")
        );
        assert!(completed
            .preview_wav
            .as_ref()
            .is_some_and(|path| path.is_file()));
        let export_path = runtime_env.dir.path().join("exported.wav");
        let export = manager
            .export_job(&snapshot.job_id, export_path.clone())
            .expect("export completed job");

        assert_eq!(export.exported_wav, export_path);
        assert_eq!(
            export.output_metadata.source_sample_rate,
            audio::FINAL_SAMPLE_RATE
        );
        assert_eq!(export.output_metadata.channels, 1);

        if let Some(preview_wav) = completed.preview_wav {
            if let Some(parent) = preview_wav.parent() {
                let _ = fs::remove_dir_all(parent);
            }
        }
    }

    #[test]
    fn job_manager_cancels_running_sidecar_without_preview_output() {
        let runtime_env = fake_runtime_env(5);
        let input = runtime_env.dir.path().join("input.wav");
        audio::write_handoff_wav(&input, &synthetic_audio()).expect("write input wav");

        let manager = EnhancementJobManager::default();
        let snapshot = manager
            .start_job(
                request_for(&runtime_env, &input),
                runtime_env.packaged_resources(),
                test_log(&runtime_env),
            )
            .expect("start job");
        wait_for_state(&manager, &snapshot.job_id, EnhancementJobState::Running);

        let cancelled = manager
            .cancel_job(&snapshot.job_id)
            .expect("cancel running job");
        assert_eq!(cancelled.state, EnhancementJobState::Cancelled);

        let finished = wait_for_terminal(&manager, &snapshot.job_id);
        assert_eq!(finished.state, EnhancementJobState::Cancelled);
        assert!(finished.preview_wav.is_none());
    }

    #[test]
    fn job_manager_uses_packaged_resource_defaults_when_paths_are_omitted() {
        let runtime_env = fake_runtime_env(0);
        let input = runtime_env.dir.path().join("input.wav");
        audio::write_handoff_wav(&input, &synthetic_audio()).expect("write input wav");

        let mut request = request_for(&runtime_env, &input);
        request.python = None;
        request.model_dir = None;
        request.sidecar = None;

        let manager = EnhancementJobManager::default();
        let snapshot = manager
            .start_job(
                request,
                runtime_env.packaged_resources(),
                test_log(&runtime_env),
            )
            .expect("start job");
        let completed = wait_for_terminal(&manager, &snapshot.job_id);

        assert_eq!(completed.state, EnhancementJobState::Completed);
        assert_eq!(
            completed
                .device_info
                .as_ref()
                .map(|info| info.selected_device.as_str()),
            Some("cpu")
        );
        assert!(completed
            .preview_wav
            .as_ref()
            .is_some_and(|path| path.is_file()));

        if let Some(preview_wav) = completed.preview_wav {
            if let Some(parent) = preview_wav.parent() {
                let _ = fs::remove_dir_all(parent);
            }
        }
    }

    struct FakeRuntimeEnv {
        dir: TempDir,
        python: PathBuf,
        sidecar: PathBuf,
        model_dir: PathBuf,
    }

    impl FakeRuntimeEnv {
        fn packaged_resources(&self) -> PackagedResourcePaths {
            PackagedResourcePaths {
                resource_dir: self.dir.path().to_path_buf(),
                resource_root: self.dir.path().to_path_buf(),
                python: self.python.clone(),
                sidecar: self.sidecar.clone(),
                model_dir: self.model_dir.clone(),
                third_party_notices: self.dir.path().join("THIRD_PARTY_NOTICES.txt"),
                artifact_manifest: self.dir.path().join("artifacts.json"),
            }
        }
    }

    fn fake_runtime_env(sleep_seconds: u64) -> FakeRuntimeEnv {
        let dir = tempdir().expect("tempdir");
        let python = fake_python_path(dir.path());
        let sidecar = fake_sidecar_path(dir.path());
        let model_dir = dir.path().join("model");
        let checkpoint_dir = model_dir.join("ds/G/default");

        prepare_fake_runtime(&python, &sidecar, sleep_seconds);
        fs::create_dir_all(&checkpoint_dir).expect("create fake checkpoint dir");
        fs::write(model_dir.join("hparams.yaml"), b"fake: true\n").expect("write hparams");
        fs::write(model_dir.join("ds/G/latest"), b"default\n").expect("write latest");
        fs::write(
            checkpoint_dir.join("mp_rank_00_model_states.pt"),
            b"fake checkpoint",
        )
        .expect("write checkpoint");

        FakeRuntimeEnv {
            dir,
            python,
            sidecar,
            model_dir,
        }
    }

    #[cfg(unix)]
    fn fake_python_path(dir: &Path) -> PathBuf {
        dir.join("fake-python")
    }

    #[cfg(windows)]
    fn fake_python_path(_dir: &Path) -> PathBuf {
        let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
        PathBuf::from(system_root)
            .join("System32")
            .join("WindowsPowerShell")
            .join("v1.0")
            .join("powershell.exe")
    }

    #[cfg(unix)]
    fn fake_sidecar_path(dir: &Path) -> PathBuf {
        dir.join("sidecar.py")
    }

    #[cfg(windows)]
    fn fake_sidecar_path(dir: &Path) -> PathBuf {
        dir.join("sidecar.ps1")
    }

    #[cfg(unix)]
    fn prepare_fake_runtime(python: &Path, sidecar: &Path, sleep_seconds: u64) {
        fs::write(
            python,
            format!(
                "#!/bin/sh\nprintf '{{\"device\":\"cpu\",\"cuda_available\":false,\"torch_cuda_version\":null,\"cuda_device_name\":null}}\\n' >&2\nsleep {sleep_seconds}\nwhile [ $# -gt 0 ]; do\n  case \"$1\" in\n    --input-wav) shift; input=\"$1\" ;;\n    --output-wav) shift; output=\"$1\" ;;\n  esac\n  shift\ndone\ncp \"$input\" \"$output\"\n"
            ),
        )
        .expect("write fake python");

        let mut permissions = fs::metadata(python)
            .expect("fake python metadata")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(python, permissions).expect("chmod fake python");
        fs::write(sidecar, b"fake sidecar").expect("write fake sidecar");
    }

    #[cfg(windows)]
    fn prepare_fake_runtime(_python: &Path, sidecar: &Path, sleep_seconds: u64) {
        fs::write(
            sidecar,
            format!(
                "[Console]::Error.WriteLine('{{\"device\":\"cpu\",\"cuda_available\":false,\"torch_cuda_version\":null,\"cuda_device_name\":null}}')\r\n$inputWav = $null\r\n$outputWav = $null\r\nfor ($i = 0; $i -lt $args.Count; $i++) {{\r\n  if ($args[$i] -eq '--input-wav') {{ $i++; $inputWav = $args[$i] }}\r\n  elseif ($args[$i] -eq '--output-wav') {{ $i++; $outputWav = $args[$i] }}\r\n}}\r\nStart-Sleep -Seconds {sleep_seconds}\r\nCopy-Item -LiteralPath $inputWav -Destination $outputWav -Force\r\n"
            ),
        )
        .expect("write fake sidecar");
    }

    fn request_for(runtime_env: &FakeRuntimeEnv, input_audio: &Path) -> StartEnhancementJobRequest {
        StartEnhancementJobRequest {
            python: Some(runtime_env.python.clone()),
            model_dir: Some(runtime_env.model_dir.clone()),
            input_audio: input_audio.to_path_buf(),
            sidecar: Some(runtime_env.sidecar.clone()),
            device: Some("cpu".to_string()),
            nfe: None,
            solver: None,
            lambd: None,
            tau: None,
            expected_checkpoint_sha256: None,
        }
    }

    fn test_log(runtime_env: &FakeRuntimeEnv) -> AppLog {
        AppLog::new(runtime_env.dir.path().join("test.log")).expect("create test log")
    }

    fn synthetic_audio() -> AudioBuffer {
        let sample_rate = 16_000;
        let samples = (0..1_600)
            .map(|index| {
                let phase = index as f32 * 220.0 * std::f32::consts::TAU / sample_rate as f32;
                phase.sin() * 0.2
            })
            .collect();

        AudioBuffer {
            sample_rate,
            samples,
        }
    }

    fn wait_for_state(
        manager: &EnhancementJobManager,
        job_id: &str,
        state: EnhancementJobState,
    ) -> EnhancementJobSnapshot {
        wait_for(manager, job_id, |snapshot| snapshot.state == state)
    }

    fn wait_for_terminal(manager: &EnhancementJobManager, job_id: &str) -> EnhancementJobSnapshot {
        wait_for(manager, job_id, |snapshot| {
            matches!(
                snapshot.state,
                EnhancementJobState::Completed
                    | EnhancementJobState::Failed
                    | EnhancementJobState::Cancelled
            )
        })
    }

    fn wait_for(
        manager: &EnhancementJobManager,
        job_id: &str,
        predicate: impl Fn(&EnhancementJobSnapshot) -> bool,
    ) -> EnhancementJobSnapshot {
        let start = Instant::now();
        loop {
            let snapshot = manager.snapshot(job_id).expect("job snapshot");
            if predicate(&snapshot) {
                return snapshot;
            }

            assert!(
                start.elapsed() < Duration::from_secs(8),
                "timed out waiting for job {job_id}; latest snapshot: {snapshot:?}"
            );
            thread::sleep(Duration::from_millis(50));
        }
    }
}
