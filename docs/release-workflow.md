# ClearPodcast Release Workflow

This is the stable release entry point for routine packaging work. Users and
agents should not need to mention historical implementation milestones when
asking for a release build.

## Release Command Guard

Release builds are intentionally separate from development checks. Do not run
`npm run package:macos-cpu`, future Windows package commands, fresh-extract
smoke tests, or no-network release smoke tests unless the user explicitly asks
for a release artifact, portable archive, zip, or packaged app.

During ordinary development, UI iteration, debugging, review, or commit prep,
use normal checks such as `npm run check`, `cargo test`, and `git diff --check`
instead of release packaging.

## Release Matrix

| Artifact | Status | Command |
| --- | --- | --- |
| macOS arm64 CPU zip | Available | `npm run package:macos-cpu` |
| Windows x64 CUDA-capable portable zip | Available | `npm run package:windows-x64` |

## Versioning

For a versioned release, keep these files in sync before building:

```text
package.json
src-tauri/tauri.conf.json
```

Generated archives use the version from `package.json`; app bundle metadata uses
the version from `src-tauri/tauri.conf.json`.

## macOS Arm64 CPU Zip

Use this workflow when asked to build a new macOS release zip, portable macOS
artifact, or packaged app for the current UI/backend state.

Required local inputs:

```text
localfiles/runtime/macos-arm64/
localfiles/models/resemble-enhance/enhancer_stage2/
```

Build and verify:

```sh
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
npm run package:macos-cpu
```

The zip is written to:

```text
localfiles/releases/ClearPodcast-<version>-macos-arm64-cpu.zip
```

The macOS artifact is a zip containing `ClearPodcast.app`. The app resolves its
bundled Python runtime, Resemble sidecar, model files, license notices, and
artifact manifest from:

```text
ClearPodcast.app/Contents/Resources/clearpodcast/
```

## macOS Smoke Verification

After building, extract the zip into a fresh local directory and verify WAV,
MP3, and M4A inputs produce 44.1 kHz mono WAV outputs using packaged resource
paths inside the extracted `.app`.

Run a no-network smoke test when practical. On macOS, use `sandbox-exec`:

```sh
sandbox-exec -p '(version 1) (allow default) (deny network*)' \
  src-tauri/target/debug/enhance_wav \
  --python localfiles/releases/extracted-macos-arm64-cpu/ClearPodcast.app/Contents/Resources/clearpodcast/runtimes/macos-arm64-cpu/bin/python3 \
  --model-dir localfiles/releases/extracted-macos-arm64-cpu/ClearPodcast.app/Contents/Resources/clearpodcast/models/resemble-enhance/enhancer_stage2 \
  --sidecar localfiles/releases/extracted-macos-arm64-cpu/ClearPodcast.app/Contents/Resources/clearpodcast/sidecars/resemble/clearpodcast_resemble.py \
  --input localfiles/samples/low_quality_voice_sample_1.wav \
  --output localfiles/outputs/release-no-network-smoke.wav \
  --expected-checkpoint-sha256 f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6
```

## Windows X64 CUDA-Capable Portable Zip

Use this workflow when asked to build a new Windows release zip or portable
Windows artifact for the current UI/backend state. Windows ships as one
CUDA-capable portable archive with automatic CPU fallback.

Required local inputs:

```text
localfiles/runtime/windows-x64/
localfiles/models/resemble-enhance/enhancer_stage2/
```

Build and verify:

```powershell
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
npm run package:windows-x64
```

The zip is written to:

```text
localfiles/releases/ClearPodcast-<version>-windows-x64.zip
```

Windows should reuse the resource contract established by macOS packaging:

```text
clearpodcast/
  runtimes/<platform-runtime>/
  sidecars/resemble/
  models/resemble-enhance/enhancer_stage2/
  licenses/
  manifests/
```

The Windows runtime directory is `clearpodcast/runtimes/windows-x64/`. The
committed Windows artifact manifest is `packaging/artifacts.windows-x64.json`.

## Windows Smoke Verification

After building, extract the zip into a fresh local directory and verify WAV,
MP3, and M4A inputs produce 44.1 kHz mono WAV outputs using packaged resource
paths inside the extracted portable folder.

Run both device paths with the same artifact:

- CUDA smoke on an NVIDIA machine with the default `device=auto` path.
- CPU fallback smoke with `CUDA_VISIBLE_DEVICES=-1`.
- Explicit `device=cuda` with CUDA disabled should fail clearly with
  `cuda_unavailable`.

Run a no-network smoke test when practical. A Windows Firewall block rule is
preferred when the shell has administrator rights. In non-admin shells, use a
temporary Python `sitecustomize.py` on `PYTHONPATH` that blocks socket connects
for the sidecar process, then run the packaged-resource smoke CLI.

Review the emitted sidecar device JSON or the desktop job panel after each run.
CUDA runs should report `selected_device: cuda` and the NVIDIA device name; CPU
fallback runs should report `selected_device: cpu`.

## Release Hygiene

- Keep large generated artifacts under `localfiles/` or the ignored staged
  resource tree.
- Do not commit staged runtimes, model weights, generated zips, extracted apps,
  smoke outputs, or private samples.
- Keep third-party license notices in the packaged artifact.
- Use `docs/milestone-4-macos-portable-release.md` for deeper macOS packaging
  context and the original portable packaging contract.
- Use `docs/milestone-5-windows-portable-cuda.md` for deeper Windows CUDA,
  CPU-fallback, size, and validation context.
