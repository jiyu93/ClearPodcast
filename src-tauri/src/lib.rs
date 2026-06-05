pub mod app_log;
pub mod audio;
pub mod dialogs;
pub mod jobs;
pub mod packaging;
pub mod previews;
pub mod runtime;

use app_log::{AppLog, AppLogSnapshot};
use audio::AudioMetadata;
use jobs::{
    EnhancementJobManager, EnhancementJobSnapshot, ExportResult, StartEnhancementJobRequest,
};
use packaging::PackagedResourcePaths;
use previews::PreparedAudioPreview;
use runtime::{DeviceDetectionRequest, EnhanceRequest, EnhancementDeviceInfo, EnhancementResult};
use std::path::PathBuf;
use tauri::{Manager, State};

/// Diagnostic and release-smoke entry point for the current WAV/MP3/M4A input
/// contract.
#[tauri::command]
fn enhance_audio_command(request: EnhanceRequest) -> Result<EnhancementResult, String> {
    runtime::enhance_audio(request).map_err(|error| error.to_string())
}

/// Compatibility wrapper for the `enhance_wav` smoke command surface.
#[tauri::command]
fn enhance_wav_command(request: EnhanceRequest) -> Result<EnhancementResult, String> {
    enhance_audio_command(request)
}

#[tauri::command]
fn probe_audio_command(path: PathBuf) -> Result<AudioMetadata, String> {
    audio::probe_audio(runtime::resolve_repo_relative_path(path)).map_err(|error| error.to_string())
}

#[tauri::command]
fn prepare_audio_preview_command(
    app_log: State<AppLog>,
    path: PathBuf,
) -> Result<PreparedAudioPreview, String> {
    app_log.info_fields(
        "prepare_audio_preview_start",
        &[("input", path.display().to_string())],
    );
    match previews::prepare_audio_preview(path) {
        Ok(preview) => {
            app_log.info_fields(
                "prepare_audio_preview_completed",
                &[
                    ("input", preview.input_audio.display().to_string()),
                    ("preview", preview.preview_audio.display().to_string()),
                    ("format", format!("{:?}", preview.metadata.format)),
                    (
                        "sample_rate",
                        preview.metadata.source_sample_rate.to_string(),
                    ),
                    ("channels", preview.metadata.channels.to_string()),
                    (
                        "duration_seconds",
                        preview
                            .metadata
                            .duration_seconds
                            .map(|duration| format!("{duration:.3}"))
                            .unwrap_or_default(),
                    ),
                ],
            );
            Ok(preview)
        }
        Err(error) => {
            app_log.error("prepare_audio_preview_failed", error.to_string());
            Err(error.to_string())
        }
    }
}

#[tauri::command]
fn cleanup_audio_preview_command(
    app_log: State<AppLog>,
    preview_audio: PathBuf,
) -> Result<(), String> {
    match previews::cleanup_audio_preview(preview_audio.clone()) {
        Ok(()) => {
            app_log.info_fields(
                "cleanup_audio_preview_completed",
                &[("preview", preview_audio.display().to_string())],
            );
            Ok(())
        }
        Err(error) => {
            app_log.warn_fields(
                "cleanup_audio_preview_failed",
                &[
                    ("preview", preview_audio.display().to_string()),
                    ("error", error.to_string()),
                ],
            );
            Err(error.to_string())
        }
    }
}

#[tauri::command]
fn start_enhancement_job_command(
    manager: State<EnhancementJobManager>,
    packaged_resources: State<PackagedResourcePaths>,
    app_log: State<AppLog>,
    request: StartEnhancementJobRequest,
) -> Result<EnhancementJobSnapshot, String> {
    manager
        .start_job(
            request,
            packaged_resources.inner().clone(),
            app_log.inner().clone(),
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn packaged_resource_paths_command(
    packaged_resources: State<PackagedResourcePaths>,
) -> PackagedResourcePaths {
    packaged_resources.inner().clone()
}

#[tauri::command]
async fn detect_processing_device_command(
    packaged_resources: State<'_, PackagedResourcePaths>,
    app_log: State<'_, AppLog>,
    request: DeviceDetectionRequest,
) -> Result<EnhancementDeviceInfo, String> {
    let python = request
        .python
        .map(runtime::resolve_repo_relative_path)
        .unwrap_or_else(|| packaged_resources.python.clone());

    app_log.info_fields("device_detection_start", &[]);
    tauri::async_runtime::spawn_blocking(move || runtime::detect_processing_device(python))
        .await
        .map_err(|error| format!("processing device detection task failed: {error}"))?
        .map(|info| {
            app_log.info_fields(
                "device_detection_completed",
                &[
                    ("selected_device", info.selected_device.clone()),
                    (
                        "cuda_available",
                        info.cuda_available
                            .map(|available| available.to_string())
                            .unwrap_or_default(),
                    ),
                    (
                        "torch_cuda_version",
                        info.torch_cuda_version.clone().unwrap_or_default(),
                    ),
                    (
                        "cuda_device_name",
                        info.cuda_device_name.clone().unwrap_or_default(),
                    ),
                ],
            );
            info
        })
        .map_err(|error| {
            app_log.warn("device_detection_failed", error.to_string());
            error.to_string()
        })
}

#[tauri::command]
fn get_enhancement_job_command(
    manager: State<EnhancementJobManager>,
    job_id: String,
) -> Result<EnhancementJobSnapshot, String> {
    manager.snapshot(&job_id).map_err(|error| error.to_string())
}

#[tauri::command]
fn cancel_enhancement_job_command(
    manager: State<EnhancementJobManager>,
    app_log: State<AppLog>,
    job_id: String,
) -> Result<EnhancementJobSnapshot, String> {
    app_log.info_fields("cancel_job_requested", &[("job_id", job_id.clone())]);
    manager
        .cancel_job(&job_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn export_enhanced_wav_command(
    manager: State<EnhancementJobManager>,
    app_log: State<AppLog>,
    job_id: String,
    destination: PathBuf,
) -> Result<ExportResult, String> {
    app_log.info_fields(
        "export_requested",
        &[
            ("job_id", job_id.clone()),
            ("destination", destination.display().to_string()),
        ],
    );
    match manager.export_job(&job_id, destination.clone()) {
        Ok(result) => {
            app_log.info_fields(
                "export_completed",
                &[
                    ("job_id", job_id.clone()),
                    ("destination", result.exported_wav.display().to_string()),
                    (
                        "sample_rate",
                        result.output_metadata.source_sample_rate.to_string(),
                    ),
                    ("channels", result.output_metadata.channels.to_string()),
                ],
            );
            Ok(result)
        }
        Err(error) => {
            app_log.error_fields(
                "export_failed",
                &[
                    ("job_id", job_id),
                    ("destination", destination.display().to_string()),
                    ("error", error.to_string()),
                ],
            );
            Err(error.to_string())
        }
    }
}

#[tauri::command]
fn read_app_log_command(app_log: State<AppLog>) -> AppLogSnapshot {
    app_log.snapshot()
}

#[tauri::command]
fn pick_audio_file_command() -> Option<PathBuf> {
    dialogs::pick_audio_file()
}

#[tauri::command]
fn pick_export_wav_command(suggested_file_name: Option<String>) -> Option<PathBuf> {
    dialogs::pick_export_wav(suggested_file_name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(EnhancementJobManager::default())
        .setup(|app| {
            let resource_dir = app.path().resource_dir()?;
            let app_log = AppLog::new(app.path().app_log_dir()?.join("clearpodcast.log"))?;
            app_log.info_fields(
                "app_started",
                &[
                    ("app", "ClearPodcast".to_string()),
                    ("version", env!("CARGO_PKG_VERSION").to_string()),
                ],
            );
            app.manage(PackagedResourcePaths::from_resource_dir(resource_dir));
            app.manage(app_log);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            enhance_audio_command,
            enhance_wav_command,
            probe_audio_command,
            prepare_audio_preview_command,
            cleanup_audio_preview_command,
            start_enhancement_job_command,
            get_enhancement_job_command,
            cancel_enhancement_job_command,
            export_enhanced_wav_command,
            packaged_resource_paths_command,
            detect_processing_device_command,
            read_app_log_command,
            pick_audio_file_command,
            pick_export_wav_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClearPodcast");
}
