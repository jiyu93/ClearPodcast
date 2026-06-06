# ClearPodcast Release Workflow

This is the stable release entry point for routine packaging work. Users and
agents should not need to mention historical implementation milestones when
asking for a release build.

## Release Command Guard

Release builds are intentionally separate from development checks. Do not run
`npm run package:macos-cpu`, `npm run package:windows-x64`, fresh-extract
smoke tests, or no-network release smoke tests unless the user explicitly asks
for a release artifact, portable archive, zip, or packaged app.

During ordinary development, UI iteration, debugging, review, or commit prep,
use normal checks such as `npm run check`, `cargo test`, and `git diff --check`
instead of release packaging.

The desktop app resolves packaged runtime and model paths by default.
Diagnostics provides Python runtime and model directory overrides for local
smoke testing.

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
src-tauri/tauri.release.conf.json
```

Generated archives use the version from `package.json`; app bundle metadata uses
the version from `src-tauri/tauri.conf.json`. Release-only resource bundling
lives in `src-tauri/tauri.release.conf.json` so development launches do not load
the staged multi-GB resource tree.

## Desktop Icon Assets

`src-tauri/icons/app-icon.svg` is the source artwork for both the app header and
the Tauri desktop icons. After changing it, regenerate the desktop icon assets:

```sh
npm run tauri icon src-tauri/icons/app-icon.svg
```

Keep the committed desktop icon set aligned with `src-tauri/tauri.conf.json`:
`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`,
`icon.png`, and the source SVG. Remove Appx, iOS, and Android icon files emitted
by the Tauri icon command unless the bundle config starts using them.

During `npm run tauri dev`, the Dock icon comes from rebuilt Cargo/Tauri package
outputs. If it is stale after regenerating icons, quit the dev app and clean
this package before rerunning:

```sh
cargo clean --manifest-path src-tauri/Cargo.toml -p clearpodcast-tauri
```

For dev icon mismatches, use the package clean path above. LaunchServices
registration is only relevant to an actual `.app` bundle, not the normal
`tauri dev` refresh path.

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

The Windows staging step generates
`packaging/licenses/windows-x64/THIRD_PARTY_NOTICES.txt` from the current
Windows Python runtime metadata, `package-lock.json`, and Cargo metadata before
copying it into the portable artifact.

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

When validating the Windows GUI artifact, also confirm that app startup, device
preflight, and enhancement do not open a separate console window, and that the
window stays responsive while the startup device preflight is detecting the
runtime.

## Release Hygiene

- Keep large generated artifacts under `localfiles/` or the ignored staged
  resource tree.
- Treat `src-tauri/resources/clearpodcast/` as generated staging output except
  for `.gitkeep`.
- Do not commit staged runtimes, model weights, generated zips, extracted apps,
  smoke outputs, or private samples.
- Keep third-party license notices in the packaged artifact.
- macOS zip creation omits resource forks and AppleDouble metadata so the
  bundled Python runtime contains only real runtime files.
- The macOS and Windows staging scripts intentionally share the same manifest,
  resource-root, directory digest, model validation, and license-notice shape,
  while keeping platform-specific Python runtime copying separate.
- Use `docs/milestone-records/milestone-4-macos-portable-release.md` for deeper
  macOS packaging context and the original portable packaging contract.
- Use `docs/milestone-records/milestone-5-windows-portable-cuda.md` for deeper
  Windows CUDA, CPU-fallback, size, and validation context.
