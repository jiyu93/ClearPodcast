use std::path::PathBuf;

pub fn pick_audio_file() -> Option<PathBuf> {
    rfd::FileDialog::new()
        .add_filter("Supported audio", &["wav", "mp3", "m4a"])
        .add_filter("WAV", &["wav"])
        .add_filter("MP3", &["mp3"])
        .add_filter("M4A", &["m4a"])
        .pick_file()
}

pub fn pick_export_wav(suggested_file_name: Option<String>) -> Option<PathBuf> {
    let mut dialog = rfd::FileDialog::new().add_filter("WAV", &["wav"]);
    if let Some(file_name) = suggested_file_name.filter(|name| !name.trim().is_empty()) {
        dialog = dialog.set_file_name(file_name);
    }
    dialog.save_file().map(ensure_wav_extension)
}

fn ensure_wav_extension(path: PathBuf) -> PathBuf {
    if path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("wav"))
        .unwrap_or(false)
    {
        path
    } else {
        path.with_extension("wav")
    }
}
