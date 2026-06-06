# ClearPodcast Development

This document owns local development setup, runtime inputs, smoke commands,
visual fixtures, and generated-file hygiene. Release packaging lives in
`docs/release-workflow.md`.

## Prerequisites

- Node.js and npm for the React/Tauri frontend toolchain.
- Rust and Cargo for the Tauri backend and smoke-test CLI.
- Python 3.10+ for bootstrapping the local macOS CPU runtime.
- `uv` when creating the local Windows Python runtime described below.

The repository does not commit `node_modules/`, Python runtimes, model weights,
private audio samples, release zips, extracted apps, or smoke outputs.

## Install Dependencies

```sh
npm install
```

## Local Runtime And Model Inputs

Private runtime and model files belong under `localfiles/`.

Expected local model location:

```text
localfiles/models/resemble-enhance/enhancer_stage2/
```

Required model files:

```text
localfiles/models/resemble-enhance/enhancer_stage2/hparams.yaml
localfiles/models/resemble-enhance/enhancer_stage2/ds/G/latest
localfiles/models/resemble-enhance/enhancer_stage2/ds/G/default/mp_rank_00_model_states.pt
```

The expected `latest` file content is:

```text
default
```

Expected model checkpoint SHA256:

```text
f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6
```

The app and sidecar treat missing or mismatched model files as setup errors.
They should not download model replacements during normal app runtime.

## macOS CPU Runtime

Bootstrap the local macOS arm64 CPU Python runtime with a Python 3.10+
interpreter:

```sh
PYTHON_BIN=/path/to/python3.12 scripts/bootstrap-macos-cpu-runtime.sh
```

By default, the runtime is written to:

```text
localfiles/runtime/macos-arm64/
```

Set `CLEARPODCAST_RUNTIME_DIR` when you need to write it somewhere else.

## Windows X64 Runtime

Create a local CUDA-capable Windows runtime for Windows smoke tests, packaging,
or the desktop app's developer override:

```powershell
uv venv --python 3.12 localfiles\runtime\windows-x64
localfiles\runtime\windows-x64\Scripts\python.exe -m ensurepip --upgrade
localfiles\runtime\windows-x64\Scripts\python.exe -m pip install --upgrade pip
localfiles\runtime\windows-x64\Scripts\python.exe -m pip install -r sidecars\resemble\requirements-windows-x64-cuda.txt
localfiles\runtime\windows-x64\Scripts\python.exe -m pip install --no-deps resemble-enhance==0.0.1
```

The packaged Windows app defaults to GPU Mode when CUDA is available and falls
back to CPU when CUDA is unavailable or disabled. When CUDA is available, the
header processing-mode capsule can switch future runs between GPU Mode and CPU
Mode while no enhancement is preparing or running. Users do not need the CUDA
Toolkit installed; CUDA acceleration requires a compatible NVIDIA driver.

As of June 3, 2026, the Windows CUDA runtime uses the PyTorch CUDA 13.0
(`cu130`) wheel line for RTX 5070 Ti validation.

## Smoke CLI

The `enhance_wav` binary name is kept for compatibility, but `--input` accepts
`.wav`, `.mp3`, and `.m4a`.

```sh
cargo run --manifest-path src-tauri/Cargo.toml --bin enhance_wav -- \
  --python localfiles/runtime/macos-arm64/bin/python3 \
  --model-dir localfiles/models/resemble-enhance/enhancer_stage2 \
  --input localfiles/samples/low_quality_voice_sample_1.mp3 \
  --output localfiles/outputs/low_quality_voice_sample_1.mp3.enhanced.wav \
  --expected-checkpoint-sha256 f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6
```

Baseline local sample paths:

```text
localfiles/samples/low_quality_voice_sample_1.wav
localfiles/samples/low_quality_voice_sample_1.mp3
localfiles/samples/low_quality_voice_sample_1.m4a
```

These private samples should represent the same short low-quality spoken voice
recording in each supported input format.

## Desktop Development

Start the Tauri desktop app:

```sh
npm run tauri dev
```

Development launches intentionally do not bundle or mirror the staged
`src-tauri/resources/clearpodcast/` tree. The debug app resolves its default
runtime and model paths from `localfiles/runtime/<platform>/`,
`localfiles/models/resemble-enhance/enhancer_stage2/`, and the repository
sidecar source so Windows does not spend seconds walking the multi-GB packaged
resource tree before rendering the first screen.

The Vite dev server warms the first-screen module graph so Windows WebView2
launches do not pay a slow cold transform waterfall before showing the
workspace.

The desktop workflow is the product runtime for native file dialogs, drag/drop,
audio playback, enhancement, cancellation, export, runtime diagnostics, and app
logs.

Original playback uses an app-managed temporary preview copy prepared by Rust.
Enhanced playback uses the completed job preview WAV. The Tauri asset protocol
is scoped to `$TEMP/**`, while processing continues to use the selected source
path directly.

App logs are appended to `clearpodcast.log` in the platform app log directory.
The in-app Log view shows only entries written during the current app session,
polls while open, and leaves the persistent file as plain text. The active log
rotates at 500KB and keeps up to three historical files.

## Browser Visual Fixtures

For browser-only visual QA of the React surface, run the Vite dev server:

```sh
npm run dev
```

Fixture states:

- `http://localhost:5173/?fixture=empty`
- `http://localhost:5173/?fixture=running`
- `http://localhost:5173/?fixture=completed`

Fixture mode is for frontend visual inspection only.

## UI Iconography

Prefer `lucide-react` for in-app utility icons. When a screen or control needs
an icon, first look for a suitable Lucide icon and use it with the shared button
icon styles. Only use a hand-drawn SVG when Lucide has no fitting option; ask
the developer before adding AI-drawn or custom SVG icon artwork.

## Checks

Run the normal source checks before handing off code or docs changes:

```sh
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

Frontend build checks use:

```sh
npm run build
```

Audio playback and waveform timing checks are available when the changed surface
needs them:

```sh
npm run check:audio-playback
npm run check:audio-waveform
```

## Local Files And Generated Resources

Private samples, runtimes, model weights, release zips, extracted artifacts,
smoke outputs, and runtime experiments belong under `localfiles/`.

The staged Tauri resource tree under `src-tauri/resources/clearpodcast/` is
generated by the packaging scripts and remains ignored except for `.gitkeep`.
It is used only by release builds that pass `src-tauri/tauri.release.conf.json`,
not by the default `tauri dev` path.

Ordinary development checks run from source code and committed manifests.
Staged runtimes, model weights, `dist/`, `node_modules/`, and
`src-tauri/target/` stay private or generated.
