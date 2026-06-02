# Milestone 4: macOS Portable Release And Packaging Contract

Milestone 4 establishes the first portable packaging contract and produces a
self-contained macOS arm64 CPU artifact.

## Status

Complete as of June 3, 2026.

The first macOS wrapper is a zip archive containing `ClearPodcast.app`. DMG is
deferred because the Milestone 3 DMG path reached the generated `.app` but timed
out in Finder AppleScript with AppleEvent `-1712`. Zip satisfies the
portable-first goal without depending on Finder automation.

## Resource Layout

Packaged resources live under:

```text
ClearPodcast.app/Contents/Resources/clearpodcast/
  runtimes/macos-arm64-cpu/
    bin/python3
    lib/python3.12/
  sidecars/resemble/
    clearpodcast_resemble.py
    requirements-macos-cpu.txt
  models/resemble-enhance/enhancer_stage2/
    hparams.yaml
    ds/G/latest
    ds/G/default/mp_rank_00_model_states.pt
  licenses/
    THIRD_PARTY_NOTICES.txt
  manifests/
    artifacts.json
```

The Rust desktop job path resolves these packaged paths by default through the
Tauri resource directory. Developer overrides remain available: the UI sends
`python`, `model_dir`, or `sidecar` only when an override is explicitly filled,
and the smoke CLI still accepts explicit paths.

## Staging

The committed manifest is:

```text
packaging/artifacts.macos-arm64-cpu.json
```

Stage resources into Tauri's resource layout:

```sh
npm run package:stage:macos-cpu
```

Build the app and portable zip:

```sh
npm run package:macos-cpu
```

The build script writes:

```text
localfiles/releases/ClearPodcast-0.1.0-macos-arm64-cpu.zip
```

Large runtime/model files stay out of git. A clean checkout needs:

- `localfiles/runtime/macos-arm64/` from the documented macOS CPU bootstrap.
- `localfiles/models/resemble-enhance/enhancer_stage2/` with the expected
  checkpoint.

Optional source overrides:

```sh
CLEARPODCAST_MACOS_RUNTIME_SOURCE=/path/to/venv \
CLEARPODCAST_MACOS_PYTHON_BASE_SOURCE=/path/to/python-prefix \
CLEARPODCAST_RESEMBLE_MODEL_SOURCE=/path/to/enhancer_stage2 \
npm run package:macos-cpu
```

The staging script copies a relocatable base Python runtime, overlays the
project venv's `site-packages`, rejects absolute symlink leaks, validates the
Resemble checkpoint SHA256, stages license notices, and generates
`clearpodcast/manifests/artifacts.json` with directory-tree SHA256 metadata.

## Artifact Sizes

Observed local Milestone 4 sizes:

- Staged resource tree: 1.6 GB.
- Runtime resource: 957 MB.
- Model resource: 688 MB.
- Built `.app`: 1.6 GB.
- Zip archive: 886 MB.

The extracted app runs without user-installed Python, Conda, FFmpeg, CUDA
Toolkit, network downloads, or first-launch model downloads.

## Verification

Completed local checks:

- `npm run package:stage:macos-cpu`
- staged Python import check for `torch`, `soundfile`, and `resemble_enhance`
- staged-resource WAV smoke:
  `localfiles/outputs/milestone4-packaged-resource-smoke.wav`
- `npm run package:macos-cpu`
- fresh zip extraction into `localfiles/releases/extracted-macos-arm64-cpu/`
- fresh-extracted WAV smoke:
  `localfiles/outputs/milestone4-extracted-wav.enhanced.wav`
- fresh-extracted MP3 smoke:
  `localfiles/outputs/milestone4-extracted-mp3.enhanced.wav`
- fresh-extracted M4A smoke:
  `localfiles/outputs/milestone4-extracted-m4a.enhanced.wav`
- no-network smoke using `sandbox-exec -p '(version 1) (allow default) (deny network*)'`:
  `localfiles/outputs/milestone4-no-network-sandbox.enhanced.wav`

All smoke outputs are 44.1 kHz mono WAV files.

## Asset Protocol Scope

The packaged Tauri asset protocol scope remains:

```json
["$HOME/**", "$TEMP/**"]
```

This supports typical user-selected files under the user's home directory and
job-managed enhanced previews under the system temp directory. Files selected
from external volumes or other system locations can still be decoded and
processed by Rust, but original-audio playback may require expanding the asset
scope or copying selected originals into an app-managed temp preview location.
That is the preferred future direction if external-drive preview support becomes
a release blocker.

## Windows Handoff For Milestone 5

Windows should reuse the same resource contract:

```text
<portable folder>/
  ClearPodcast.exe
  resources-or-tauri-resource-dir/
    clearpodcast/
      runtimes/windows-x64/
        python.exe
        Lib/
        site-packages/
      sidecars/resemble/
      models/resemble-enhance/enhancer_stage2/
      licenses/
      manifests/
```

Milestone 5 should add a Windows manifest for the single CUDA-capable artifact
with the same fields used by the macOS manifest: source, artifact path, version,
platform, and SHA256 metadata.

Windows staging needs local sources for:

- CUDA-capable Python/PyTorch runtime selected for the RTX 5070 Ti validation
  machine, staged at `clearpodcast/runtimes/windows-x64/`.
- Resemble Enhance model files with the expected checkpoint SHA256.
- Third-party notices.

Expected Windows smoke checklist:

- Confirm resource lookup finds bundled `python.exe`, sidecar, model, notices,
  and generated artifact manifest.
- Run WAV, MP3, and M4A input to WAV output from the fresh portable folder.
- Run with network disabled or blocked.
- Verify CPU fallback behavior by disabling CUDA for the same artifact.
- Verify CUDA device selection and capture evidence that inference ran on the
  NVIDIA GPU.
- Verify cancellation while a sidecar process is running.

Milestone 5 completed this handoff with the platform-specific Windows runtime
path `runtimes/windows-x64/` while preserving the macOS runtime path
`runtimes/macos-arm64-cpu/`. See
`docs/milestone-5-windows-portable-cuda.md`.
