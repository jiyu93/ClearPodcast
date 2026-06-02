# ClearPodcast

ClearPodcast is an offline desktop audio restoration application for podcasters
who already have low-quality recordings from Bluetooth headsets, meeting apps,
remote calls, or ordinary computer microphones.

The product goal is not generic audio editing. It is a focused one-click workflow
that turns damaged spoken-word recordings into publishable podcast WAV files.

First-release input formats are WAV, MP3, and M4A. Output is WAV.

The first supported desktop platforms are Windows and macOS. macOS arm64 is the
daily development baseline; Windows 11 x64 is the NVIDIA CUDA validation and
performance target.

Distribution is portable-first: Windows ships as a self-contained folder
archive, and macOS ships as a self-contained `.app` bundle wrapped in a DMG or
zip.

Start here:

- [Implementation plan](docs/implementation-plan.md)
- [Milestone 1 runtime spine](docs/milestone-1-runtime-spine.md)
- [Milestone 2 audio contract](docs/milestone-2-audio-contract.md)
- [Milestone 3 desktop MVP](docs/milestone-3-desktop-mvp.md)
- [Domain context](CONTEXT.md)
- [Architecture decisions](docs/adr/)

## Local Development

Install the desktop scaffold dependencies:

```sh
npm install
```

Bootstrap the local macOS CPU Python runtime with a Python 3.10+ interpreter:

```sh
PYTHON_BIN=/path/to/python3.12 scripts/bootstrap-macos-cpu-runtime.sh
```

Run the documented audio -> enhanced WAV smoke path. The `enhance_wav` binary
name is kept for compatibility, but `--input` accepts `.wav`, `.mp3`, and
`.m4a`:

```sh
cargo run --manifest-path src-tauri/Cargo.toml --bin enhance_wav -- \
  --python localfiles/runtime/macos-arm64/bin/python3 \
  --model-dir localfiles/models/resemble-enhance/enhancer_stage2 \
  --input localfiles/samples/low_quality_voice_sample_1.mp3 \
  --output localfiles/outputs/low_quality_voice_sample_1.mp3.enhanced.wav \
  --expected-checkpoint-sha256 f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6
```

Start the Tauri dev app:

```sh
npm run tauri dev
```

Milestone 3 adds the desktop MVP workflow: choose or drop a WAV/MP3/M4A file,
run a cancellable enhancement job through the default offline restoration path,
compare original/enhanced audio, and export the enhanced WAV.
