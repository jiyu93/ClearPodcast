use crate::{audio, runtime};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};
use thiserror::Error;

static PREVIEW_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PreparedAudioPreview {
    pub input_audio: PathBuf,
    pub preview_audio: PathBuf,
    pub metadata: audio::AudioMetadata,
}

#[derive(Debug, Error)]
pub enum PreviewError {
    #[error("failed to read selected audio: {0}")]
    Audio(#[from] audio::AudioError),
    #[error("failed to create original preview directory {path}: {source}")]
    PreviewDirectory {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to clean original preview directory {path}: {source}")]
    CleanupDirectory {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to copy original preview from {source_path} to {destination}: {source}")]
    PreviewCopy {
        source_path: PathBuf,
        destination: PathBuf,
        source: std::io::Error,
    },
    #[error("refusing to clean preview path outside ClearPodcast preview storage: {0}")]
    UnsafeCleanup(PathBuf),
}

pub fn prepare_audio_preview(path: PathBuf) -> Result<PreparedAudioPreview, PreviewError> {
    let input_audio = runtime::resolve_repo_relative_path(path);
    let metadata = audio::probe_audio(&input_audio)?;
    let preview_dir = preview_root().join(format!(
        "{}-{}",
        timestamp_ms(),
        PREVIEW_COUNTER.fetch_add(1, Ordering::SeqCst)
    ));
    fs::create_dir_all(&preview_dir).map_err(|source| PreviewError::PreviewDirectory {
        path: preview_dir.clone(),
        source,
    })?;

    let preview_audio = preview_dir.join(preview_file_name(&input_audio));
    fs::copy(&input_audio, &preview_audio).map_err(|source| PreviewError::PreviewCopy {
        source_path: input_audio.clone(),
        destination: preview_audio.clone(),
        source,
    })?;

    Ok(PreparedAudioPreview {
        input_audio,
        preview_audio,
        metadata,
    })
}

pub fn cleanup_audio_preview(preview_audio: PathBuf) -> Result<(), PreviewError> {
    let preview_dir = preview_audio
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| PreviewError::UnsafeCleanup(preview_audio.clone()))?;
    if !is_managed_preview_dir(&preview_dir) {
        return Err(PreviewError::UnsafeCleanup(preview_audio));
    }

    match fs::remove_dir_all(&preview_dir) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(source) => Err(PreviewError::CleanupDirectory {
            path: preview_dir,
            source,
        }),
    }
}

fn preview_file_name(path: &Path) -> String {
    let stem = safe_file_stem(path);
    let extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .unwrap_or_else(|| "wav".to_string());
    format!("{stem}.{extension}")
}

fn safe_file_stem(path: &Path) -> String {
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("original");
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
        "original".to_string()
    } else {
        output.to_string()
    }
}

fn is_managed_preview_dir(path: &Path) -> bool {
    path.parent()
        .map(|parent| parent == preview_root())
        .unwrap_or(false)
}

fn preview_root() -> PathBuf {
    std::env::temp_dir().join("clearpodcast").join("previews")
}

fn timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::AudioBuffer;

    #[test]
    fn prepare_audio_preview_copies_supported_audio_into_managed_temp() {
        let dir = tempfile::tempdir().expect("tempdir");
        let input = dir.path().join("Meeting Audio 01.wav");
        audio::write_handoff_wav(&input, &synthetic_audio()).expect("write input");

        let preview = prepare_audio_preview(input.clone()).expect("prepare preview");

        assert_eq!(preview.input_audio, input);
        assert_eq!(preview.metadata.format, audio::AudioFormat::Wav);
        assert!(preview.preview_audio.is_file());
        assert_eq!(
            preview
                .preview_audio
                .file_name()
                .and_then(|name| name.to_str()),
            Some("Meeting-Audio-01.wav")
        );
        assert!(is_managed_preview_dir(
            preview.preview_audio.parent().expect("preview parent")
        ));

        cleanup_audio_preview(preview.preview_audio).expect("cleanup preview");
    }

    #[test]
    fn cleanup_audio_preview_removes_managed_preview_directory() {
        let root = preview_root();
        let preview_dir = root.join(format!(
            "cleanup-test-{}",
            PREVIEW_COUNTER.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&preview_dir).expect("preview dir");
        let preview_audio = preview_dir.join("input.wav");
        fs::write(&preview_audio, b"fake").expect("preview file");

        cleanup_audio_preview(preview_audio).expect("cleanup preview");

        assert!(!preview_dir.exists());
    }

    #[test]
    fn cleanup_audio_preview_rejects_unmanaged_paths() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("input.wav");
        fs::write(&path, b"fake").expect("fake input");

        assert!(matches!(
            cleanup_audio_preview(path),
            Err(PreviewError::UnsafeCleanup(_))
        ));
    }

    fn synthetic_audio() -> AudioBuffer {
        let sample_rate = 16_000;
        let samples = (0..800)
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
}
