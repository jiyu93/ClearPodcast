# Milestone 1 Runtime Spine

Milestone 1 proves the smallest ClearPodcast desktop-to-model path:

```text
React UI or Rust smoke CLI
-> Tauri/Rust command path
-> repository-owned Python sidecar
-> explicit local Resemble Enhance model directory
-> enhanced WAV output
```

## Local Paths

The development runtime and model are intentionally outside repository history:

- Python runtime: `localfiles/runtime/macos-arm64/bin/python3`
- Resemble Enhance model: `localfiles/models/resemble-enhance/enhancer_stage2/`
- Sample WAV: `localfiles/samples/low_quality_voice_sample_1.wav`
- Smoke output: `localfiles/outputs/low_quality_voice_sample_1.enhanced.wav`

Required model files:

- `hparams.yaml`
- `ds/G/latest`
- `ds/G/default/mp_rank_00_model_states.pt`

The `ds/G/latest` file must contain `default`. To verify the large checkpoint
hash during a smoke test, pass:

```sh
--expected-checkpoint-sha256 f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6
```

## Bootstrap

Create the local macOS CPU runtime with a Python 3.10+ interpreter:

```sh
PYTHON_BIN=/path/to/python3.12 scripts/bootstrap-macos-cpu-runtime.sh
```

The bootstrap creates `localfiles/runtime/macos-arm64`, installs the minimal
runtime dependencies pinned in `sidecars/resemble/requirements-macos-cpu.txt`,
and installs `resemble-enhance` with `--no-deps` so the app sidecar does not pull
in the upstream demo, Gradio, or Deepspeed training dependency set.

The pins are deliberate. Resemble Enhance 0.0.1 currently breaks with NumPy 2.x
in the CFM solver path, so the local macOS CPU runtime keeps the scientific stack
on the verified NumPy 1.26 / SciPy 1.11 line while using the newer PyTorch wheels
available for the Python 3.12 seed runtime.

## Smoke Command

Run the Rust smoke CLI from the repository root:

```sh
cargo run --manifest-path src-tauri/Cargo.toml --bin enhance_wav -- \
  --python localfiles/runtime/macos-arm64/bin/python3 \
  --model-dir localfiles/models/resemble-enhance/enhancer_stage2 \
  --input localfiles/samples/low_quality_voice_sample_1.wav \
  --output localfiles/outputs/low_quality_voice_sample_1.enhanced.wav \
  --expected-checkpoint-sha256 f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6
```

The Rust layer validates the local Python runtime, sidecar entrypoint, input WAV,
model directory, required model files, and `ds/G/latest` content before launching
the sidecar. It captures sidecar stdout, stderr, exit code, and returns
actionable errors for missing runtime, missing model, failed CUDA selection, or
missing inference dependencies. Relative paths are resolved from the repository
root during development, so the CLI and Tauri dev app use the same local path
shape.

## Desktop Dev Flow

Install JavaScript dependencies and start the Tauri dev app:

```sh
npm install
npm run tauri dev
```

The current UI is intentionally plain. It exposes the same runtime, model, input,
and output paths used by the CLI so milestone 1 can verify the desktop command
path without waiting for the polished Desktop MVP workflow.

## Verification Notes

As of June 2, 2026:

- The repository contains the Tauri v2, React, TypeScript, and Rust scaffold.
- The Rust command and CLI path launch only an explicit local Python runtime.
- The repository-owned sidecar avoids the upstream demo server and uses a custom
  inference loader to avoid importing Deepspeed training helpers.
- The local model files and WAV fixture exist in `localfiles/`.
- Full WAV -> enhanced WAV smoke verification passes on macOS CPU with
  `localfiles/runtime/macos-arm64/bin/python3`.
- The smoke fixture is `localfiles/samples/low_quality_voice_sample_1.wav`:
  16 kHz mono PCM16, 9.216 seconds.
- The smoke output is
  `localfiles/outputs/low_quality_voice_sample_1.enhanced.wav`: 44.1 kHz mono
  PCM16, 9.216 seconds.
- The observed CPU enhancement time for that fixture was about 39 seconds.
- Passing checks:
  - `npm run check`
  - `npm run build`
  - `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `env PYTHONPYCACHEPREFIX=/private/tmp/clearpodcast-pycache localfiles/runtime/macos-arm64/bin/python3 -m py_compile sidecars/resemble/clearpodcast_resemble.py`
  - `git diff --check`
- Error-path smoke checks:
  - Missing local runtime reports `local Python runtime was not found`.
  - Missing model directory reports `model directory was not found`.

## Milestone 2 Follow-Up

Milestone 2 is complete. See
[`docs/milestone-records/milestone-2-audio-contract.md`](milestone-2-audio-contract.md) for the
current WAV/MP3/M4A input contract, temporary sidecar handoff behavior, Rust WAV
output writer, and audio-contract tests.
