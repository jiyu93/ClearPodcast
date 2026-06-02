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
archive, and macOS currently ships as a self-contained `.app` bundle wrapped in
a zip archive.

Start here:

- [Implementation plan](docs/implementation-plan.md)
- [Milestone 1 runtime spine](docs/milestone-1-runtime-spine.md)
- [Milestone 2 audio contract](docs/milestone-2-audio-contract.md)
- [Milestone 3 desktop MVP](docs/milestone-3-desktop-mvp.md)
- [Milestone 4 macOS portable release](docs/milestone-4-macos-portable-release.md)
- [Milestone 5 Windows portable CUDA release](docs/milestone-5-windows-portable-cuda.md)
- [Release workflow](docs/release-workflow.md)
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

On Windows, create a local CUDA-capable Python runtime for smoke tests,
packaging, or the desktop MVP's optional Python override. The packaged app uses
CUDA automatically when available and falls back to CPU when CUDA is unavailable
or disabled:

```powershell
uv venv --python 3.12 localfiles\runtime\windows-x64
localfiles\runtime\windows-x64\Scripts\python.exe -m ensurepip --upgrade
localfiles\runtime\windows-x64\Scripts\python.exe -m pip install --upgrade pip
localfiles\runtime\windows-x64\Scripts\python.exe -m pip install -r sidecars\resemble\requirements-windows-x64-cuda.txt
localfiles\runtime\windows-x64\Scripts\python.exe -m pip install --no-deps resemble-enhance==0.0.1
```

As of June 3, 2026, the Windows CUDA runtime pins the PyTorch CUDA 13.0
(`cu130`) wheel line for RTX 5070 Ti validation. Users do not need the CUDA
Toolkit installed; CUDA acceleration requires a compatible NVIDIA driver.

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
use official-demo-aligned enhancement defaults, run a cancellable enhancement
job, compare original/enhanced audio, and export the enhanced WAV.

## macOS Portable Packaging

Stage the macOS arm64 CPU runtime, sidecar, model, and license notices into the
Tauri resource layout:

```sh
npm run package:stage:macos-cpu
```

Build the self-contained `.app` and zip artifact:

```sh
npm run package:macos-cpu
```

The local artifact is written to `localfiles/releases/`. Use the
[release workflow](docs/release-workflow.md) for routine release builds; see the
Milestone 4 document for the original macOS packaging contract and deeper
resource-layout details.

## Windows Portable Packaging

Build the single Windows x64 CUDA-capable portable archive with CPU fallback:

```powershell
npm run package:windows-x64
```

The local artifact is written to `localfiles/releases/`. The Windows package
bundles PyTorch CUDA runtime files and selects CUDA automatically when a
compatible NVIDIA GPU is available; otherwise the same app runs on CPU. See the
Milestone 5 document for the validation record and Windows resource layout.
