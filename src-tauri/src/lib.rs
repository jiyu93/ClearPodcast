pub mod audio;
pub mod runtime;

use audio::AudioMetadata;
use runtime::{EnhanceRequest, EnhancementResult};
use std::path::PathBuf;

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
    audio::probe_audio(path).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            enhance_audio_command,
            enhance_wav_command,
            probe_audio_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClearPodcast");
}
