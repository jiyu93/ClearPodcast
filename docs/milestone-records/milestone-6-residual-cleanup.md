# Milestone 6: Residual Cleanup

Milestone 6 establishes the clean post-MVP baseline for the proven one-file
restoration workflow. It aligns product language, diagnostics, compatibility
entry points, original-preview playback, generated-resource hygiene, and current
documentation without starting the full UI/UX redesign owned by Milestone 7.

Complete as of June 3, 2026.

## Product Surface

The primary desktop surface now presents ClearPodcast as offline speech
restoration. The main workflow uses product-facing restoration language for
source input, processing status, result state, and WAV export.

Developer-only runtime and model path overrides moved into the collapsed
Diagnostics panel. Diagnostics also owns raw paths, job ids, preview/export
paths, runtime details, and device-detection details. The primary status panel
shows concise user-facing summaries and points to Diagnostics for technical
detail.

The advanced enhancement settings remain available as a secondary surface with
the public-demo-aligned defaults:

- Solver: `midpoint`.
- CFM steps: `64`.
- Prior temperature: `0.50`.
- Denoising strength: `0.10`.

## Playback And Preview Copies

Original playback now uses an app-managed temporary preview copy prepared by the
Rust backend. The selected source path remains the processing input, while the
preview copy lives under the app temp preview root so normal user-selected files
play through the existing Tauri asset-protocol scope.

Preview cleanup is best effort from the UI and is safety-checked in Rust:
cleanup rejects unmanaged paths and only removes a single managed preview
directory under the ClearPodcast temp preview root.

Enhanced playback still uses the completed job preview WAV owned by the job
manager. Failed and cancelled jobs do not expose successful-looking enhanced
preview output.

## Diagnostics And Errors

The React surface maps common backend and sidecar failures to concise
user-facing messages:

- Unsupported input.
- Missing selected input.
- Corrupt or unreadable audio.
- Missing packaged/local Python runtime.
- Missing or incomplete model files.
- Sidecar launch or inference failure.
- Cancellation.
- Device-detection failure.
- Non-WAV export destination.

Raw command output, stderr, tracebacks, paths, ids, and sidecar internals live
in diagnostic detail.

The sidecar help and validation errors describe the current internal WAV handoff
boundary. Rust comments clarify that `enhance_audio_command`,
`enhance_wav_command`, and the `enhance_wav` binary are diagnostic and
release-smoke compatibility entry points aligned with the current WAV/MP3/M4A
input contract.

## Generated-Resource Hygiene

The generated-resource boundary is documented in `README.md` and
`docs/release-workflow.md`:

- Private samples, runtimes, model weights, release zips, extracted artifacts,
  smoke outputs, and experiments belong under `localfiles/`.
- `src-tauri/resources/clearpodcast/` is generated staging output except for
  `.gitkeep`.
- `dist/`, `node_modules/`, `src-tauri/target/`, and staged resource subtrees are
  not required for ordinary checks and remain ignored.
- macOS and Windows staging scripts intentionally share the same manifest,
  resource-root, directory-digest, model-validation, and license-notice shape
  while keeping platform-specific Python runtime copying separate.

## Verification

Completed verification:

- `npm run check`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `git diff --check`
- Browser smoke against `http://127.0.0.1:15621/`
  - product-language eyebrow and restoration panel present
  - Diagnostics owns runtime/model overrides
  - primary workflow shows restoration controls and status
  - Diagnostics expands and shows override fields plus raw detail rows
  - Advanced settings expands and shows solver guide plus defaults
  - Restore and Export are disabled before input/result
- Developer override smoke CLI:
  - `cargo run --manifest-path src-tauri/Cargo.toml --bin enhance_wav -- --python localfiles/runtime/macos-arm64/bin/python3 --model-dir localfiles/models/resemble-enhance/enhancer_stage2 --input localfiles/samples/low_quality_voice_sample_1.wav --output localfiles/outputs/milestone-6-override-smoke.wav --expected-checkpoint-sha256 f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6`
  - output metadata: WAV, 44.1 kHz, mono, 9.216 seconds
  - selected device metadata: CPU on the macOS development machine
- `git status --ignored --short`
  - ignored generated/private roots include `.DS_Store`, `dist/`,
    `localfiles/`, `node_modules/`, staged `src-tauri/resources/clearpodcast/`
    subtrees, and `src-tauri/target/`

Release packaging was not run because Milestone 6 explicitly reserves release
packaging for explicit release-artifact requests.

Milestone 6 has no deferred exit criteria.

## Notes For Milestone 7

Milestone 7 can start from a cleaner baseline:

- Keep Diagnostics as the secondary home for developer overrides and raw
  backend/device detail.
- Preserve the app-managed original preview-copy lifecycle unless the redesign
  introduces a broader asset-protocol or playback strategy.
- Preserve the exact advanced model-control surface and defaults while improving
  layout, accessibility, and desktop ergonomics.
- Use Browser smoke for frontend-only redesign checks. Reserve real Tauri GUI
  smoke for native dialogs, drag/drop, asset protocol, packaged resource lookup,
  and explicitly requested GUI behavior.
