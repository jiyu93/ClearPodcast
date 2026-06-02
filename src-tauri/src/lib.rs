pub mod runtime;

use runtime::{EnhanceRequest, EnhancementResult};

#[tauri::command]
fn enhance_wav_command(request: EnhanceRequest) -> Result<EnhancementResult, String> {
    runtime::enhance_wav(request).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![enhance_wav_command])
        .run(tauri::generate_context!())
        .expect("error while running ClearPodcast");
}
