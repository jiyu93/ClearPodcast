pub mod audio;
pub mod dialogs;
pub mod jobs;
pub mod packaging;
pub mod runtime;

use audio::AudioMetadata;
use jobs::{
    EnhancementJobManager, EnhancementJobSnapshot, ExportResult, StartEnhancementJobRequest,
};
use packaging::PackagedResourcePaths;
use runtime::{DeviceDetectionRequest, EnhanceRequest, EnhancementDeviceInfo, EnhancementResult};
use std::path::PathBuf;
use tauri::{Manager, State};

#[tauri::command]
fn enhance_audio_command(request: EnhanceRequest) -> Result<EnhancementResult, String> {
    runtime::enhance_audio(request).map_err(|error| error.to_string())
}

#[tauri::command]
fn enhance_wav_command(request: EnhanceRequest) -> Result<EnhancementResult, String> {
    enhance_audio_command(request)
}

#[tauri::command]
fn probe_audio_command(path: PathBuf) -> Result<AudioMetadata, String> {
    audio::probe_audio(runtime::resolve_repo_relative_path(path)).map_err(|error| error.to_string())
}

#[tauri::command]
fn start_enhancement_job_command(
    manager: State<EnhancementJobManager>,
    packaged_resources: State<PackagedResourcePaths>,
    request: StartEnhancementJobRequest,
) -> Result<EnhancementJobSnapshot, String> {
    manager
        .start_job(request, packaged_resources.inner().clone())
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
    request: DeviceDetectionRequest,
) -> Result<EnhancementDeviceInfo, String> {
    let python = request
        .python
        .map(runtime::resolve_repo_relative_path)
        .unwrap_or_else(|| packaged_resources.python.clone());

    tauri::async_runtime::spawn_blocking(move || runtime::detect_processing_device(python))
        .await
        .map_err(|error| format!("processing device detection task failed: {error}"))?
        .map_err(|error| error.to_string())
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
    job_id: String,
) -> Result<EnhancementJobSnapshot, String> {
    manager
        .cancel_job(&job_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn export_enhanced_wav_command(
    manager: State<EnhancementJobManager>,
    job_id: String,
    destination: PathBuf,
) -> Result<ExportResult, String> {
    manager
        .export_job(&job_id, destination)
        .map_err(|error| error.to_string())
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
            app.manage(PackagedResourcePaths::from_resource_dir(resource_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            enhance_audio_command,
            enhance_wav_command,
            probe_audio_command,
            start_enhancement_job_command,
            get_enhancement_job_command,
            cancel_enhancement_job_command,
            export_enhanced_wav_command,
            packaged_resource_paths_command,
            detect_processing_device_command,
            pick_audio_file_command,
            pick_export_wav_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClearPodcast");
}
