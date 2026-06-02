use clearpodcast_app::{
    audio::{self, AudioBuffer, AudioError, AudioFormat, FINAL_SAMPLE_RATE},
    runtime::{
        enhance_audio_with_runner, EnhanceRequest, EnhancementPreset, RuntimeError,
        SidecarRunResult, SidecarRunner,
    },
};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tempfile::{tempdir, TempDir};

const MP3_FIXTURE: &str = include_str!("fixtures/tone.mp3.b64");
const M4A_FIXTURE: &str = include_str!("fixtures/tone.m4a.b64");

#[test]
fn wav_decode_write_and_stereo_to_mono_contract() {
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("stereo.wav");
    write_stereo_wav(&input);

    let decoded = audio::decode_audio(&input).expect("decode stereo wav");
    assert_eq!(decoded.metadata.format, AudioFormat::Wav);
    assert_eq!(decoded.metadata.source_sample_rate, 16_000);
    assert_eq!(decoded.metadata.channels, 2);
    assert_eq!(decoded.pcm.sample_rate, 16_000);
    assert!((decoded.pcm.samples[0] - 0.0).abs() < 0.0001);
    assert!((decoded.pcm.samples[1] - 0.25).abs() < 0.0001);

    let output = dir.path().join("final.wav");
    let metadata = audio::write_final_wav(&output, &decoded.pcm).expect("write final wav");
    assert_eq!(metadata.source_sample_rate, FINAL_SAMPLE_RATE);
    assert_eq!(metadata.channels, 1);
    assert!(metadata.frame_count.unwrap_or_default() > decoded.pcm.samples.len() as u64);
}

#[test]
fn decodes_mp3_and_m4a_fixtures() {
    let dir = tempdir().expect("tempdir");

    for (format, filename, fixture) in [
        (AudioFormat::Mp3, "tone.mp3", MP3_FIXTURE),
        (AudioFormat::M4a, "tone.m4a", M4A_FIXTURE),
    ] {
        let path = dir.path().join(filename);
        write_base64_fixture(&path, fixture);

        let decoded = audio::decode_audio(&path).expect("decode compressed fixture");
        assert_eq!(decoded.metadata.format, format);
        assert!(decoded.metadata.source_sample_rate > 0);
        assert_eq!(decoded.metadata.channels, 1);
        assert!(!decoded.pcm.samples.is_empty());
    }
}

#[test]
fn unsupported_and_corrupt_inputs_produce_clear_errors() {
    let dir = tempdir().expect("tempdir");
    let unsupported = dir.path().join("not-audio.txt");
    fs::write(&unsupported, b"hello").expect("write unsupported fixture");

    let error = audio::decode_audio(&unsupported).expect_err("txt should be unsupported");
    assert!(matches!(
        error,
        AudioError::UnsupportedInputExtension { .. }
    ));

    for filename in ["corrupt.mp3", "corrupt.m4a"] {
        let corrupt = dir.path().join(filename);
        fs::write(&corrupt, b"not compressed audio").expect("write corrupt fixture");
        let error = audio::decode_audio(&corrupt).expect_err("corrupt input should fail");
        assert!(
            matches!(
                error,
                AudioError::Probe { .. }
                    | AudioError::Decode { .. }
                    | AudioError::MissingAudioTrack(_)
            ),
            "unexpected corrupt error for {filename}: {error}"
        );
    }
}

#[test]
fn wav_mp3_and_m4a_complete_sidecar_handoff_to_final_wav() {
    let runtime_env = fake_runtime_env();
    let dir = tempdir().expect("tempdir");

    let wav = dir.path().join("input.wav");
    audio::write_handoff_wav(&wav, &synthetic_audio()).expect("write wav input");
    let mp3 = dir.path().join("input.mp3");
    write_base64_fixture(&mp3, MP3_FIXTURE);
    let m4a = dir.path().join("input.m4a");
    write_base64_fixture(&m4a, M4A_FIXTURE);

    for input in [&wav, &mp3, &m4a] {
        let runner = CopySidecarRunner::default();
        let output = dir.path().join(format!(
            "{}.enhanced.wav",
            input.file_stem().unwrap().to_string_lossy()
        ));

        let result = enhance_audio_with_runner(request_for(&runtime_env, input, &output), &runner)
            .expect("audio contract enhancement succeeds");

        assert_eq!(result.output_wav, output);
        assert_eq!(result.output_metadata.format, AudioFormat::Wav);
        assert_eq!(result.output_metadata.source_sample_rate, FINAL_SAMPLE_RATE);
        assert_eq!(result.output_metadata.channels, 1);
        assert!(output.is_file());

        let handoff_dir = runner.handoff_dir().expect("runner saw handoff path");
        assert!(
            !handoff_dir.exists(),
            "temporary handoff directory should be removed after success"
        );
    }
}

#[test]
fn temporary_handoff_files_are_cleaned_after_sidecar_failure() {
    let runtime_env = fake_runtime_env();
    let dir = tempdir().expect("tempdir");
    let input = dir.path().join("input.wav");
    audio::write_handoff_wav(&input, &synthetic_audio()).expect("write wav input");
    let output = dir.path().join("failed.wav");
    let runner = FailingSidecarRunner::default();

    let error = enhance_audio_with_runner(request_for(&runtime_env, &input, &output), &runner)
        .expect_err("sidecar failure should propagate");
    assert!(matches!(error, RuntimeError::SidecarFailed { .. }));
    assert!(!output.exists());

    let handoff_dir = runner.handoff_dir().expect("runner saw handoff path");
    assert!(
        !handoff_dir.exists(),
        "temporary handoff directory should be removed after failure"
    );
}

#[derive(Default)]
struct CopySidecarRunner {
    handoff_dir: Arc<Mutex<Option<PathBuf>>>,
}

impl CopySidecarRunner {
    fn handoff_dir(&self) -> Option<PathBuf> {
        self.handoff_dir.lock().expect("handoff lock").clone()
    }
}

impl SidecarRunner for CopySidecarRunner {
    fn run_sidecar(
        &self,
        _request: &EnhanceRequest,
        input_wav: &Path,
        output_wav: &Path,
        _cancellation: Option<&clearpodcast_app::runtime::CancellationToken>,
    ) -> Result<SidecarRunResult, RuntimeError> {
        *self.handoff_dir.lock().expect("handoff lock") = input_wav.parent().map(Path::to_path_buf);
        let decoded = audio::decode_audio(input_wav)?;
        audio::write_handoff_wav(output_wav, &decoded.pcm)?;

        Ok(SidecarRunResult {
            exit_code: 0,
            stdout: "copied handoff audio".to_string(),
            stderr: String::new(),
        })
    }
}

#[derive(Default)]
struct FailingSidecarRunner {
    handoff_dir: Arc<Mutex<Option<PathBuf>>>,
}

impl FailingSidecarRunner {
    fn handoff_dir(&self) -> Option<PathBuf> {
        self.handoff_dir.lock().expect("handoff lock").clone()
    }
}

impl SidecarRunner for FailingSidecarRunner {
    fn run_sidecar(
        &self,
        _request: &EnhanceRequest,
        input_wav: &Path,
        _output_wav: &Path,
        _cancellation: Option<&clearpodcast_app::runtime::CancellationToken>,
    ) -> Result<SidecarRunResult, RuntimeError> {
        *self.handoff_dir.lock().expect("handoff lock") = input_wav.parent().map(Path::to_path_buf);
        Err(RuntimeError::SidecarFailed {
            exit_code: 70,
            stdout: String::new(),
            stderr: "fixture sidecar failed".to_string(),
        })
    }
}

struct FakeRuntimeEnv {
    _dir: TempDir,
    python: PathBuf,
    sidecar: PathBuf,
    model_dir: PathBuf,
}

fn fake_runtime_env() -> FakeRuntimeEnv {
    let dir = tempdir().expect("tempdir");
    let python = dir.path().join("python");
    let sidecar = dir.path().join("sidecar.py");
    let model_dir = dir.path().join("model");
    let checkpoint_dir = model_dir.join("ds/G/default");

    fs::write(&python, b"fake runtime").expect("write fake python");
    fs::write(&sidecar, b"fake sidecar").expect("write fake sidecar");
    fs::create_dir_all(&checkpoint_dir).expect("create fake checkpoint dir");
    fs::write(model_dir.join("hparams.yaml"), b"fake: true\n").expect("write hparams");
    fs::write(model_dir.join("ds/G/latest"), b"default\n").expect("write latest");
    fs::write(
        checkpoint_dir.join("mp_rank_00_model_states.pt"),
        b"fake checkpoint",
    )
    .expect("write checkpoint");

    FakeRuntimeEnv {
        _dir: dir,
        python,
        sidecar,
        model_dir,
    }
}

fn request_for(
    runtime_env: &FakeRuntimeEnv,
    input_audio: &Path,
    output_wav: &Path,
) -> EnhanceRequest {
    EnhanceRequest {
        python: runtime_env.python.clone(),
        model_dir: runtime_env.model_dir.clone(),
        input_audio: input_audio.to_path_buf(),
        output_wav: output_wav.to_path_buf(),
        preset: EnhancementPreset::MeetingRecording,
        sidecar: Some(runtime_env.sidecar.clone()),
        device: Some("cpu".to_string()),
        nfe: None,
        solver: None,
        lambd: None,
        tau: None,
        expected_checkpoint_sha256: None,
    }
}

fn synthetic_audio() -> AudioBuffer {
    let sample_rate = 16_000;
    let samples = (0..1_600)
        .map(|index| {
            let phase = index as f32 * 440.0 * std::f32::consts::TAU / sample_rate as f32;
            phase.sin() * 0.25
        })
        .collect();

    AudioBuffer {
        sample_rate,
        samples,
    }
}

fn write_stereo_wav(path: &Path) {
    let spec = hound::WavSpec {
        channels: 2,
        sample_rate: 16_000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(path, spec).expect("create stereo wav");
    for (left, right) in [(0.5_f32, -0.5_f32), (0.5, 0.0), (-0.25, 0.25), (0.0, 0.0)] {
        writer
            .write_sample((left * i16::MAX as f32) as i16)
            .expect("write left");
        writer
            .write_sample((right * i16::MAX as f32) as i16)
            .expect("write right");
    }
    writer.finalize().expect("finalize stereo wav");
}

fn write_base64_fixture(path: &Path, fixture: &str) {
    fs::write(path, decode_base64(fixture)).expect("write base64 fixture");
}

fn decode_base64(fixture: &str) -> Vec<u8> {
    let mut output = Vec::new();
    let mut buffer = 0_u32;
    let mut bits = 0_u8;

    for byte in fixture.bytes().filter(|byte| !byte.is_ascii_whitespace()) {
        if byte == b'=' {
            break;
        }

        let value = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => panic!("invalid base64 byte {byte}"),
        } as u32;

        buffer = (buffer << 6) | value;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((buffer >> bits) as u8);
            buffer &= (1 << bits) - 1;
        }
    }

    output
}
