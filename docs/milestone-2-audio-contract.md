# Milestone 2 Audio Contract

Milestone 2 turns the runtime spine into a production-shaped audio boundary:

```text
WAV, MP3, or M4A input
-> Rust probe/decode
-> mono f32 PCM
-> temporary mono float WAV sidecar handoff
-> Python Resemble Enhance sidecar
-> Rust reads sidecar WAV
-> Rust writes final 44.1 kHz mono WAV
```

## Rust Audio Boundary

The audio contract lives in `src-tauri/src/audio.rs`.

Responsibilities:

- Detect supported input extensions: `.wav`, `.mp3`, and `.m4a`.
- Extract source metadata: format, sample rate, channel count, frame count, and
  duration when available.
- Decode WAV through `hound`.
- Decode MP3 and M4A through `symphonia`.
- Convert mono or stereo input into mono `f32` PCM.
- Write the sidecar handoff as mono 32-bit float WAV.
- Read the sidecar WAV output back through the same Rust audio boundary.
- Resample final output to 44.1 kHz when needed.
- Write product output as standard mono PCM16 WAV at 44.1 kHz.

The Python sidecar remains WAV-only. It no longer owns user-facing MP3 or M4A
compatibility.

## Temporary Files

`src-tauri/src/runtime.rs` creates one temporary directory per enhancement job.
The directory contains:

- `input-handoff.wav`
- `sidecar-output.wav`

The temp directory is owned by Rust and is dropped after success or failure. The
current milestone has no cancellation API yet; cancellation cleanup becomes a
Milestone 3 job-manager responsibility when cancellation is introduced.

## Commands

The existing smoke binary is still named `enhance_wav`, but its `--input` flag is
now generic audio input:

```sh
cargo run --manifest-path src-tauri/Cargo.toml --bin enhance_wav -- \
  --python localfiles/runtime/macos-arm64/bin/python3 \
  --model-dir localfiles/models/resemble-enhance/enhancer_stage2 \
  --input localfiles/samples/low_quality_voice_sample_1.mp3 \
  --output localfiles/outputs/low_quality_voice_sample_1.mp3.enhanced.wav \
  --expected-checkpoint-sha256 f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6
```

The Tauri backend exposes:

- `probe_audio_command`
- `enhance_audio_command`
- `enhance_wav_command` as a compatibility wrapper

## Verification Notes

As of June 2, 2026:

- Unit tests cover stereo-to-mono conversion and linear resampling.
- Integration-style Rust tests cover:
  - WAV decode/write.
  - MP3 decode.
  - M4A/AAC decode.
  - Unsupported input extension errors.
  - Corrupt compressed input errors.
  - WAV -> sidecar handoff -> final WAV.
  - MP3 -> sidecar handoff -> final WAV.
  - M4A -> sidecar handoff -> final WAV.
  - Temporary handoff cleanup after success and sidecar failure.
- The compressed test fixtures are synthetic generated tone files, not private
  `localfiles/` samples.
- Passing check:

```sh
cargo test --manifest-path src-tauri/Cargo.toml
```

- Full local model smoke checks pass with:
  - `localfiles/samples/low_quality_voice_sample_1.wav`
  - `localfiles/samples/low_quality_voice_sample_1.mp3`
  - `localfiles/samples/low_quality_voice_sample_1.m4a`
- The smoke outputs are 44.1 kHz mono PCM16 WAV files with standard PCM
  headers.

## Notes For Milestone 3

Milestone 3 can start from the generic backend commands and does not need to
rebuild codec support. It should focus on the user-facing workflow: file picker,
drag/drop, metadata display, job states, cancellation, playback, and export.

When cancellation is added, keep temporary handoff ownership in the job manager
so cancellation cannot leave a successful-looking partial output.
