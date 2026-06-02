use serde::{Deserialize, Serialize};
use std::{
    fs,
    fs::File,
    io::ErrorKind,
    path::{Path, PathBuf},
};
use symphonia::{
    core::{
        audio::SampleBuffer,
        codecs::{DecoderOptions, CODEC_TYPE_NULL},
        errors::Error as SymphoniaError,
        formats::FormatOptions,
        io::{MediaSourceStream, MediaSourceStreamOptions},
        meta::MetadataOptions,
        probe::Hint,
    },
    default::{get_codecs, get_probe},
};
use tempfile::PathPersistError;
use thiserror::Error;

pub const FINAL_SAMPLE_RATE: u32 = 44_100;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AudioFormat {
    Wav,
    Mp3,
    M4a,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct AudioMetadata {
    pub format: AudioFormat,
    pub source_sample_rate: u32,
    pub channels: u16,
    pub frame_count: Option<u64>,
    pub duration_seconds: Option<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AudioBuffer {
    pub sample_rate: u32,
    pub samples: Vec<f32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DecodedAudio {
    pub metadata: AudioMetadata,
    pub pcm: AudioBuffer,
}

#[derive(Debug, Error)]
pub enum AudioError {
    #[error("audio file was not found at {0}")]
    MissingInput(PathBuf),
    #[error("unsupported audio input extension {extension:?} for {path}; supported formats are wav, mp3, and m4a")]
    UnsupportedInputExtension {
        path: PathBuf,
        extension: Option<String>,
    },
    #[error("output path must end in .wav: {0}")]
    OutputMustBeWav(PathBuf),
    #[error("failed to open audio file {path}: {source}")]
    Open {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to read WAV file {path}: {source}")]
    ReadWav { path: PathBuf, source: hound::Error },
    #[error("failed to write WAV file {path}: {source}")]
    WriteWav { path: PathBuf, source: hound::Error },
    #[error("failed to probe audio file {path}: {source}")]
    Probe {
        path: PathBuf,
        source: SymphoniaError,
    },
    #[error("audio file has no default audio track: {0}")]
    MissingAudioTrack(PathBuf),
    #[error("audio file has no usable sample-rate metadata: {0}")]
    MissingSampleRate(PathBuf),
    #[error("audio file has no usable channel metadata: {0}")]
    MissingChannels(PathBuf),
    #[error("failed to create decoder for {path}: {source}")]
    CreateDecoder {
        path: PathBuf,
        source: SymphoniaError,
    },
    #[error("failed to decode audio file {path}: {source}")]
    Decode {
        path: PathBuf,
        source: SymphoniaError,
    },
    #[error("audio file decoded to no samples: {0}")]
    EmptyAudio(PathBuf),
    #[error("failed to prepare output directory {path}: {source}")]
    OutputDirectory {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to create temporary output WAV next to {path}: {source}")]
    TempOutput {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to move temporary WAV into {path}: {source}")]
    PersistOutput {
        path: PathBuf,
        source: std::io::Error,
    },
}

pub fn probe_audio(path: impl AsRef<Path>) -> Result<AudioMetadata, AudioError> {
    let path = path.as_ref();
    let format = AudioFormat::from_path(path)?;

    match format {
        AudioFormat::Wav => probe_wav(path),
        AudioFormat::Mp3 | AudioFormat::M4a => probe_symphonia(path, format),
    }
}

pub fn decode_audio(path: impl AsRef<Path>) -> Result<DecodedAudio, AudioError> {
    let path = path.as_ref();
    let format = AudioFormat::from_path(path)?;

    match format {
        AudioFormat::Wav => decode_wav(path),
        AudioFormat::Mp3 | AudioFormat::M4a => decode_symphonia(path, format),
    }
}

pub fn write_handoff_wav(path: impl AsRef<Path>, audio: &AudioBuffer) -> Result<(), AudioError> {
    let path = path.as_ref();
    ensure_wav_output(path)?;
    ensure_parent_directory(path)?;

    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: audio.sample_rate,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };
    let mut writer =
        hound::WavWriter::create(path, spec).map_err(|source| AudioError::WriteWav {
            path: path.to_path_buf(),
            source,
        })?;

    for sample in &audio.samples {
        writer
            .write_sample(clamp_sample(*sample))
            .map_err(|source| AudioError::WriteWav {
                path: path.to_path_buf(),
                source,
            })?;
    }

    writer.finalize().map_err(|source| AudioError::WriteWav {
        path: path.to_path_buf(),
        source,
    })
}

pub fn write_final_wav(
    path: impl AsRef<Path>,
    audio: &AudioBuffer,
) -> Result<AudioMetadata, AudioError> {
    let path = path.as_ref();
    ensure_wav_output(path)?;
    let parent = parent_directory(path);
    fs::create_dir_all(parent).map_err(|source| AudioError::OutputDirectory {
        path: parent.to_path_buf(),
        source,
    })?;

    let final_audio = resample_linear(audio, FINAL_SAMPLE_RATE);
    let temp = tempfile::Builder::new()
        .prefix(".clearpodcast-output-")
        .suffix(".wav")
        .tempfile_in(parent)
        .map_err(|source| AudioError::TempOutput {
            path: path.to_path_buf(),
            source,
        })?;
    let temp_path = temp.into_temp_path();
    write_pcm16_wav(&temp_path, &final_audio)?;
    persist_temp_output(temp_path.persist(path), path)?;

    probe_audio(path)
}

pub fn resample_linear(audio: &AudioBuffer, target_sample_rate: u32) -> AudioBuffer {
    if audio.sample_rate == target_sample_rate || audio.samples.is_empty() {
        return AudioBuffer {
            sample_rate: target_sample_rate,
            samples: audio.samples.clone(),
        };
    }

    let source_rate = audio.sample_rate as f64;
    let target_rate = target_sample_rate as f64;
    let output_len = ((audio.samples.len() as f64) * target_rate / source_rate)
        .round()
        .max(1.0) as usize;
    let mut samples = Vec::with_capacity(output_len);

    for index in 0..output_len {
        let source_position = (index as f64) * source_rate / target_rate;
        let left_index = source_position.floor() as usize;
        let right_index = left_index.saturating_add(1).min(audio.samples.len() - 1);
        let fraction = (source_position - left_index as f64) as f32;
        let left = audio.samples[left_index.min(audio.samples.len() - 1)];
        let right = audio.samples[right_index];
        samples.push(left + (right - left) * fraction);
    }

    AudioBuffer {
        sample_rate: target_sample_rate,
        samples,
    }
}

pub fn interleaved_to_mono(interleaved: &[f32], channels: u16) -> Vec<f32> {
    if channels <= 1 {
        return interleaved.to_vec();
    }

    let channels = channels as usize;
    interleaved
        .chunks_exact(channels)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect()
}

impl AudioFormat {
    fn from_path(path: &Path) -> Result<Self, AudioError> {
        if !path.is_file() {
            return Err(AudioError::MissingInput(path.to_path_buf()));
        }

        let extension = path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase());

        match extension.as_deref() {
            Some("wav") => Ok(AudioFormat::Wav),
            Some("mp3") => Ok(AudioFormat::Mp3),
            Some("m4a") => Ok(AudioFormat::M4a),
            _ => Err(AudioError::UnsupportedInputExtension {
                path: path.to_path_buf(),
                extension,
            }),
        }
    }
}

fn probe_wav(path: &Path) -> Result<AudioMetadata, AudioError> {
    let reader = hound::WavReader::open(path).map_err(|source| AudioError::ReadWav {
        path: path.to_path_buf(),
        source,
    })?;
    let spec = reader.spec();
    if spec.channels == 0 {
        return Err(AudioError::MissingChannels(path.to_path_buf()));
    }

    let frame_count = reader.duration() as u64 / spec.channels as u64;
    Ok(AudioMetadata {
        format: AudioFormat::Wav,
        source_sample_rate: spec.sample_rate,
        channels: spec.channels,
        frame_count: Some(frame_count),
        duration_seconds: Some(frame_count as f64 / spec.sample_rate as f64),
    })
}

fn decode_wav(path: &Path) -> Result<DecodedAudio, AudioError> {
    let mut reader = hound::WavReader::open(path).map_err(|source| AudioError::ReadWav {
        path: path.to_path_buf(),
        source,
    })?;
    let spec = reader.spec();
    if spec.channels == 0 {
        return Err(AudioError::MissingChannels(path.to_path_buf()));
    }

    let interleaved = match spec.sample_format {
        hound::SampleFormat::Float => reader
            .samples::<f32>()
            .map(|sample| {
                sample
                    .map(clamp_sample)
                    .map_err(|source| AudioError::ReadWav {
                        path: path.to_path_buf(),
                        source,
                    })
            })
            .collect::<Result<Vec<_>, _>>()?,
        hound::SampleFormat::Int => {
            decode_wav_int_samples(&mut reader, path, spec.bits_per_sample)?
        }
    };
    let samples = interleaved_to_mono(&interleaved, spec.channels);
    if samples.is_empty() {
        return Err(AudioError::EmptyAudio(path.to_path_buf()));
    }

    let frame_count = samples.len() as u64;
    Ok(DecodedAudio {
        metadata: AudioMetadata {
            format: AudioFormat::Wav,
            source_sample_rate: spec.sample_rate,
            channels: spec.channels,
            frame_count: Some(frame_count),
            duration_seconds: Some(frame_count as f64 / spec.sample_rate as f64),
        },
        pcm: AudioBuffer {
            sample_rate: spec.sample_rate,
            samples,
        },
    })
}

fn decode_wav_int_samples(
    reader: &mut hound::WavReader<std::io::BufReader<File>>,
    path: &Path,
    bits_per_sample: u16,
) -> Result<Vec<f32>, AudioError> {
    let scale = if bits_per_sample == 0 {
        1.0
    } else {
        (1_i64 << (bits_per_sample.saturating_sub(1) as u32)) as f32
    };

    reader
        .samples::<i32>()
        .map(|sample| {
            sample
                .map(|sample| clamp_sample(sample as f32 / scale))
                .map_err(|source| AudioError::ReadWav {
                    path: path.to_path_buf(),
                    source,
                })
        })
        .collect()
}

fn probe_symphonia(path: &Path, format: AudioFormat) -> Result<AudioMetadata, AudioError> {
    let mut reader = open_symphonia(path)?;
    let (track_id, codec_params) = {
        let track = default_track(&reader.format, path)?;
        (track.id, track.codec_params.clone())
    };
    match metadata_from_codec_params(path, format, &codec_params) {
        Ok(metadata) => Ok(metadata),
        Err(AudioError::MissingChannels(_)) => {
            metadata_from_first_decoded_frame(path, format, &mut reader, track_id, &codec_params)
        }
        Err(error) => Err(error),
    }
}

fn decode_symphonia(path: &Path, format: AudioFormat) -> Result<DecodedAudio, AudioError> {
    let mut reader = open_symphonia(path)?;
    let (track_id, codec_params) = {
        let track = default_track(&reader.format, path)?;
        (track.id, track.codec_params.clone())
    };
    let source_sample_rate = codec_params
        .sample_rate
        .ok_or_else(|| AudioError::MissingSampleRate(path.to_path_buf()))?;
    let codec_channels = codec_params
        .channels
        .map(|channels| channels.count() as u16);
    let mut decoder = get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|source| AudioError::CreateDecoder {
            path: path.to_path_buf(),
            source,
        })?;
    let mut samples = Vec::new();
    let mut decoded_channels = None;

    loop {
        let packet = match reader.format.next_packet() {
            Ok(packet) => packet,
            Err(error) if is_end_of_stream(&error) => break,
            Err(source) => {
                return Err(AudioError::Decode {
                    path: path.to_path_buf(),
                    source,
                })
            }
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(source) if !samples.is_empty() && is_recoverable_decode_eof(&source) => break,
            Err(source) => {
                return Err(AudioError::Decode {
                    path: path.to_path_buf(),
                    source,
                })
            }
        };
        let channels = decoded.spec().channels.count() as u16;
        if channels > 0 && decoded_channels.is_none() {
            decoded_channels = Some(channels);
        }
        let mut buffer = SampleBuffer::<f32>::new(decoded.capacity() as u64, *decoded.spec());
        buffer.copy_interleaved_ref(decoded);
        samples.extend(interleaved_to_mono(buffer.samples(), channels));
    }

    if samples.is_empty() {
        return Err(AudioError::EmptyAudio(path.to_path_buf()));
    }

    let frame_count = samples.len() as u64;
    let channels = codec_channels
        .or(decoded_channels)
        .ok_or_else(|| AudioError::MissingChannels(path.to_path_buf()))?;
    Ok(DecodedAudio {
        metadata: AudioMetadata {
            format,
            source_sample_rate,
            channels,
            frame_count: Some(frame_count),
            duration_seconds: Some(frame_count as f64 / source_sample_rate as f64),
        },
        pcm: AudioBuffer {
            sample_rate: source_sample_rate,
            samples,
        },
    })
}

fn metadata_from_first_decoded_frame(
    path: &Path,
    format: AudioFormat,
    reader: &mut SymphoniaReader,
    track_id: u32,
    codec_params: &symphonia::core::codecs::CodecParameters,
) -> Result<AudioMetadata, AudioError> {
    let source_sample_rate = codec_params
        .sample_rate
        .ok_or_else(|| AudioError::MissingSampleRate(path.to_path_buf()))?;
    let mut decoder = get_codecs()
        .make(codec_params, &DecoderOptions::default())
        .map_err(|source| AudioError::CreateDecoder {
            path: path.to_path_buf(),
            source,
        })?;

    loop {
        let packet = match reader.format.next_packet() {
            Ok(packet) => packet,
            Err(error) if is_end_of_stream(&error) => {
                return Err(AudioError::MissingChannels(path.to_path_buf()));
            }
            Err(source) => {
                return Err(AudioError::Decode {
                    path: path.to_path_buf(),
                    source,
                });
            }
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = decoder
            .decode(&packet)
            .map_err(|source| AudioError::Decode {
                path: path.to_path_buf(),
                source,
            })?;
        let channels = decoded.spec().channels.count() as u16;
        if channels == 0 {
            return Err(AudioError::MissingChannels(path.to_path_buf()));
        }

        let frame_count = codec_params.n_frames;
        return Ok(AudioMetadata {
            format,
            source_sample_rate,
            channels,
            frame_count,
            duration_seconds: frame_count.map(|frames| frames as f64 / source_sample_rate as f64),
        });
    }
}

struct SymphoniaReader {
    format: Box<dyn symphonia::core::formats::FormatReader>,
}

fn open_symphonia(path: &Path) -> Result<SymphoniaReader, AudioError> {
    let file = File::open(path).map_err(|source| AudioError::Open {
        path: path.to_path_buf(),
        source,
    })?;
    let media_source = MediaSourceStream::new(Box::new(file), MediaSourceStreamOptions::default());
    let mut hint = Hint::new();
    if let Some(extension) = path.extension().and_then(|extension| extension.to_str()) {
        hint.with_extension(extension);
    }

    let probed = get_probe()
        .format(
            &hint,
            media_source,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|source| AudioError::Probe {
            path: path.to_path_buf(),
            source,
        })?;

    Ok(SymphoniaReader {
        format: probed.format,
    })
}

fn default_track<'a>(
    format: &'a Box<dyn symphonia::core::formats::FormatReader>,
    path: &Path,
) -> Result<&'a symphonia::core::formats::Track, AudioError> {
    format
        .default_track()
        .filter(|track| track.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| AudioError::MissingAudioTrack(path.to_path_buf()))
}

fn metadata_from_codec_params(
    path: &Path,
    format: AudioFormat,
    codec_params: &symphonia::core::codecs::CodecParameters,
) -> Result<AudioMetadata, AudioError> {
    let source_sample_rate = codec_params
        .sample_rate
        .ok_or_else(|| AudioError::MissingSampleRate(path.to_path_buf()))?;
    let channels = codec_params
        .channels
        .ok_or_else(|| AudioError::MissingChannels(path.to_path_buf()))?
        .count() as u16;
    if channels == 0 {
        return Err(AudioError::MissingChannels(path.to_path_buf()));
    }

    let frame_count = codec_params.n_frames;
    Ok(AudioMetadata {
        format,
        source_sample_rate,
        channels,
        frame_count,
        duration_seconds: frame_count.map(|frames| frames as f64 / source_sample_rate as f64),
    })
}

fn write_pcm16_wav(path: impl AsRef<Path>, audio: &AudioBuffer) -> Result<(), AudioError> {
    let path = path.as_ref();
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: audio.sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer =
        hound::WavWriter::create(path, spec).map_err(|source| AudioError::WriteWav {
            path: path.to_path_buf(),
            source,
        })?;

    for sample in &audio.samples {
        let quantized = (clamp_sample(*sample) * i16::MAX as f32).round() as i16;
        writer
            .write_sample(quantized)
            .map_err(|source| AudioError::WriteWav {
                path: path.to_path_buf(),
                source,
            })?;
    }

    writer.finalize().map_err(|source| AudioError::WriteWav {
        path: path.to_path_buf(),
        source,
    })
}

fn ensure_wav_output(path: &Path) -> Result<(), AudioError> {
    if path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("wav"))
        .unwrap_or(false)
    {
        Ok(())
    } else {
        Err(AudioError::OutputMustBeWav(path.to_path_buf()))
    }
}

fn ensure_parent_directory(path: &Path) -> Result<(), AudioError> {
    let parent = parent_directory(path);
    fs::create_dir_all(parent).map_err(|source| AudioError::OutputDirectory {
        path: parent.to_path_buf(),
        source,
    })
}

fn parent_directory(path: &Path) -> &Path {
    path.parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."))
}

fn persist_temp_output(
    result: Result<(), PathPersistError>,
    path: &Path,
) -> Result<(), AudioError> {
    result.map_err(|source| AudioError::PersistOutput {
        path: path.to_path_buf(),
        source: source.error,
    })
}

fn is_end_of_stream(error: &SymphoniaError) -> bool {
    matches!(error, SymphoniaError::IoError(error) if error.kind() == ErrorKind::UnexpectedEof)
}

fn is_recoverable_decode_eof(error: &SymphoniaError) -> bool {
    match error {
        SymphoniaError::IoError(error) if error.kind() == ErrorKind::UnexpectedEof => true,
        SymphoniaError::IoError(error) => error.to_string().contains("end of bitstream"),
        _ => false,
    }
}

fn clamp_sample(sample: f32) -> f32 {
    sample.clamp(-1.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stereo_to_mono_averages_each_frame() {
        let mono = interleaved_to_mono(&[1.0, -1.0, 0.25, 0.75], 2);
        assert_eq!(mono, vec![0.0, 0.5]);
    }

    #[test]
    fn resample_linear_outputs_target_rate() {
        let audio = AudioBuffer {
            sample_rate: 2,
            samples: vec![0.0, 1.0],
        };
        let resampled = resample_linear(&audio, 4);
        assert_eq!(resampled.sample_rate, 4);
        assert_eq!(resampled.samples.len(), 4);
        assert_eq!(resampled.samples[0], 0.0);
        assert!(resampled.samples[1] > 0.0);
    }
}
