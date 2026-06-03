# ClearPodcast Implementation Plan

## Role

This document is the executable milestone plan for ClearPodcast. Use
`docs/roadmap.md` for the broader product phase map and future themes.

Milestones 1 through 5 record the completed MVP and portable packaging
foundation. Milestone 6 and later are post-MVP productization work. Keep each
future milestone scoped enough to execute and verify without absorbing every
future product idea.

## Product Goal

ClearPodcast is an offline desktop application that restores poor spoken-word
podcast recordings captured through Bluetooth headsets, laptop microphones,
meeting software, phone recordings, and remote-call workflows.

The current product path lets a user import a WAV, MP3, or M4A recording,
process it locally with Resemble Enhance, compare the result, and export a WAV
file.

## Fixed Decisions

- Desktop shell: Tauri v2.
- UI: React + TypeScript.
- Native layer: Rust.
- AI model: Resemble Enhance only.
- AI runtime: bundled Python sidecar with a minimal PyTorch inference
  environment.
- Runtime mode: fully offline after extraction and first launch.
- Supported platforms: Windows and macOS.
- Development baseline: macOS arm64.
- GPU validation target: Windows 11 x64 with NVIDIA CUDA.
- Distribution mode: portable-first.
- Input formats: WAV, MP3, and M4A.
- Output format: WAV only.
- FFmpeg: explicitly excluded.

## Why Resemble Enhance

ClearPodcast is aimed at already-damaged speech, not clean studio audio with a
little room noise. Resemble Enhance is a better first model choice than a pure
noise suppressor because its enhancer is designed for speech enhancement,
distortion repair, and bandwidth improvement.

The first implementation should not spend time evaluating multiple model
families. The product decision is to make Resemble Enhance work well as a
packaged offline dependency.

## High-Level Architecture

```text
Desktop UI
  -> Tauri command
  -> Rust job manager
  -> Rust audio input decoder
  -> Python Resemble Enhance sidecar
  -> Rust WAV output writer
  -> UI result preview/export state
```

The Python sidecar should not own general audio file compatibility. It should
receive normalized audio data or a temporary WAV produced by Rust, run model
inference, and return enhanced PCM/WAV output.

## Audio Pipeline

```text
User selects .wav, .mp3, or .m4a
-> Rust validates extension and probes audio metadata
-> Rust decodes to mono f32 PCM
-> Rust writes a temporary normalized WAV or streams PCM to sidecar
-> Python sidecar loads Resemble Enhance model from bundled local path
-> Sidecar enhances speech and returns 44.1 kHz mono audio
-> Rust applies output safety processing if needed
-> Rust writes 44.1 kHz mono WAV
```

For the first implementation, using a temporary WAV as the sidecar boundary is
acceptable because it reduces protocol complexity. A later version can switch to
streaming PCM if performance or disk usage requires it.

## Audio Format Policy

Input:

- WAV: PCM integer or IEEE float, mono or stereo.
- MP3: MPEG Layer III, CBR or VBR, mono or stereo.
- M4A: MPEG-4 audio container with AAC-LC or ALAC audio, mono or stereo.

Internal representation:

- Mono `f32` PCM.
- Preserve enough metadata for duration, source sample rate, and channel count in
  the UI.

Output:

- WAV only.
- Recommended first output: standard 44.1 kHz mono PCM16 WAV.
- Standard PCM16 WAV headers keep mono speech center-routed in native players
  and align with the sidecar's PCM16 output.

## Rust Audio Dependencies

Recommended:

- `symphonia` for MP3 decoding/probing and M4A ISO/MP4, AAC, and ALAC
  decoding/probing.
- `hound` for WAV read/write.

Avoid:

- FFmpeg and FFmpeg wrappers.
- `torchaudio.load/save` as the product format boundary.
- MP3 encoders in the first release.

Rationale:

- FFmpeg creates license and distribution complexity that the product explicitly
  wants to avoid.
- Resemble Enhance should be isolated as an inference engine, not a codec layer.
- WAV output avoids MP3 encoder licensing and avoids another lossy pass.

## Python Sidecar

The sidecar should be a small command-line program owned by this repository,
not the upstream Resemble Enhance CLI.

Expected responsibilities:

- Locate bundled model weights from an explicit path.
- Load the model without network access.
- Select device: CUDA when available and configured, otherwise CPU.
- Run enhancement with product defaults.
- Emit structured progress and errors for the Tauri app.
- Avoid importing demo, training, Gradio, or Deepspeed paths.

The sidecar should fail clearly if model files are missing, if the Python
environment is incomplete, or if GPU initialization fails.

## Runtime And Release Artifacts

Bundle these into each release artifact:

- Tauri app binary.
- Python runtime.
- Minimal Python packages required for Resemble Enhance inference.
- PyTorch and torchaudio.
- Resemble Enhance inference code.
- Resemble Enhance model weights.
- Third-party licenses and notices.

Do not require users to install or download at runtime:

- Python.
- Conda.
- FFmpeg.
- CUDA Toolkit.
- Model downloads at first launch.

First release artifacts:

- macOS arm64 CPU `.app`, wrapped in DMG or zip.
- Windows x64 CUDA-capable portable archive with CPU fallback, validated first
  on Windows 11.

CPU fallback is the compatibility baseline inside the Windows artifact. CUDA is
an acceleration path selected automatically when the bundled runtime can use a
compatible NVIDIA GPU.

Portable-first means the Windows build should be usable after extracting a
folder, without administrator privileges, registry writes, or mandatory system
installation. The extracted folder should contain the app executable, Python
runtime, sidecar, model weights, resources, and license notices.

On macOS, a `.app` bundle inside a DMG or zip is the equivalent first
artifact. Users may drag it to Applications, but the app should not depend on a
package installer.

Traditional installers can be added later only if they solve a concrete problem,
such as auto-updates, file associations, enterprise deployment, or WebView2
runtime provisioning.

## Platform Support

First-class target platforms:

- macOS arm64 for day-to-day development, UI work, Rust audio I/O, CPU sidecar
  integration, and baseline release work.
- Windows 11 x64 for general Windows compatibility, CPU fallback, and NVIDIA
  CUDA acceleration validation on the local RTX 5070 Ti machine.

The Windows artifact should bundle the latest stable PyTorch CUDA wheel that
supports the target GPU generation at packaging time and should run with
`device=auto` by default. As of June 3, 2026, the preferred Windows wheel line is
CUDA 13.0 (`cu130`) for the current PyTorch Windows Python 3.12 runtime after it
is validated against the RTX 5070 Ti. Do not pin the first Windows artifact to an
older CUDA build before validating the current CUDA line against the target GPU.

Windows 10 x64 can be evaluated after the Windows 11 path is stable, but it is
not the first validation target. For portable Windows builds, assume WebView2 is
available on supported machines; revisit bundling or prompting for WebView2 only
if validation shows it is a real support issue.

The current high-performance local test machine is expected to be a Windows PC
with an NVIDIA GeForce RTX 5070 Ti. Treat it as the primary CUDA validation
machine. It should test:

- Sidecar startup and model load on CUDA.
- Fallback to CPU when CUDA is disabled or unavailable.
- Long-file processing stability.
- Portable folder layout and bundled runtime lookup on Windows.
- End-to-end WAV/MP3/M4A input to WAV output.

macOS GPU acceleration through MPS is not part of the first guaranteed product
surface. It can be explored after the CPU sidecar path is stable.

## Hardware Expectations

Minimum:

- 64-bit CPU.
- 8 GB RAM.
- 8 GB free disk after extraction.
- Slow but functional processing is acceptable.

Recommended:

- 8-core CPU.
- 16 GB RAM.
- NVIDIA GPU with at least 6 GB VRAM for CUDA acceleration.
- RTX 5070 Ti-class GPU is more than enough for local CUDA validation.

Release artifacts are expected to be large because PyTorch and model weights are
bundled. The Windows artifact is expected to be larger than a CPU-only package
because it includes the CUDA-capable PyTorch runtime even for users who fall back
to CPU. The disk minimum is higher because long inputs, temporary WAV handoff
files, and exported WAVs need working space.

## Local Development Fixtures

Use `localfiles/` for private local inputs, model files, runtime experiments, and
generated outputs. This directory is intentionally not part of the repository
history.

Baseline fixture set:

- `localfiles/samples/low_quality_voice_sample_1.wav`
- `localfiles/samples/low_quality_voice_sample_1.mp3`
- `localfiles/samples/low_quality_voice_sample_1.m4a`

These files should represent the same short low-quality spoken voice sample in
each supported input format. This is enough for runtime, audio-contract, and
desktop smoke checks.

The baseline fixture set centers on one representative short spoken-word sample.
Scenario-specific and long-file samples belong to later quality, stability, and
performance tuning passes.

Expected local model location:

- `localfiles/models/resemble-enhance/enhancer_stage2/`

Required local model files:

- `localfiles/models/resemble-enhance/enhancer_stage2/hparams.yaml`
- `localfiles/models/resemble-enhance/enhancer_stage2/ds/G/latest`
- `localfiles/models/resemble-enhance/enhancer_stage2/ds/G/default/mp_rank_00_model_states.pt`

Expected `latest` content:

```text
default
```

Expected model checkpoint SHA256:

```text
f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6
```

The sidecar should treat missing or mismatched model files as actionable setup
errors. It should not silently download replacements during normal app runtime.

## Completed First Product Surface Checklist

This checklist defines the completed first usable product surface. It is not the
execution order; use the goal-mode milestones below for implementation order.

1. Tauri app scaffold.
2. File picker and drag/drop for WAV, MP3, and M4A.
3. Rust audio probe and decode path.
4. Temporary WAV handoff into Python sidecar.
5. Resemble Enhance sidecar running from bundled local model path.
6. WAV export path.
7. Progress, cancellation, and error reporting.
8. Before/after playback.
9. One clear restore action for supported one-file spoken-word input, with
   Bluetooth, meeting, laptop-microphone, phone, and remote-call recordings
   represented as target source scenarios in product context and QA planning.
10. Resemble Enhance model settings exposed in a collapsed advanced panel with
    public demo-aligned defaults: Midpoint solver, 64 CFM steps, 0.50 prior
    temperature, and 0.10 denoising strength.
11. A visible job result indicator showing whether the completed enhancement
    used CPU fallback or NVIDIA CUDA acceleration.

## Goal-Mode Milestones

Use one milestone as one Codex goal. Start a new goal by reading `AGENTS.md`,
`CONTEXT.md`, `docs/roadmap.md`, relevant ADRs, and this plan. Treat the
milestone objective as the goal objective. Do not mark the goal complete until
every exit criterion is met or explicitly documented as deferred with a reason.

Each milestone should leave the repo in a coherent state: checks run, docs
updated when the behavior or plan changed, and the next milestone able to start
from documented repo state without hidden local setup.

### Milestone 1: Runtime Spine

Objective:

Create the smallest desktop-to-model path that proves ClearPodcast can run
Resemble Enhance locally from a Tauri/Rust app on macOS CPU.

Scope:

- Scaffold Tauri v2, React, TypeScript, and Rust.
- Add a minimal Rust command/job path that can launch a Python sidecar.
- Add the repository-owned Resemble Enhance sidecar entrypoint.
- Load model files from an explicit local path, without runtime downloads.
- Run a WAV input through the sidecar and produce an enhanced WAV output.
- Shape paths as if they will later live in a portable release artifact.

Exit criteria:

- A developer on macOS arm64 can run a documented command or dev-app flow that
  turns a local WAV into an enhanced WAV.
- The model path is explicit and local; no network access is required after the
  runtime and model files are present.
- Rust captures sidecar success, stderr, exit code, and a missing-model or
  missing-runtime failure as actionable errors.
- The sidecar path does not depend on the upstream demo server, Gradio UI,
  Deepspeed training path, or user-installed global Python.
- The README or implementation docs explain the local bootstrap command and the
  expected model/runtime location.

Out of scope:

- MP3 and M4A input.
- Polished desktop UI.
- Windows, CUDA, and portable release archives.
- Final podcast mastering.

Verification:

- Smoke-test WAV -> enhanced WAV on macOS CPU.
- Simulate a missing model path and verify the surfaced error.
- Run available Rust, TypeScript, and Python syntax or test checks introduced by
  the scaffold.
- Run `git diff --check`.

Completion state as of June 2, 2026:

- Tauri v2, React, TypeScript, and Rust scaffold files are present.
- Rust exposes a Tauri command and `enhance_wav` smoke-test CLI that launch an
  explicit local Python runtime.
- The repository-owned sidecar lives at
  `sidecars/resemble/clearpodcast_resemble.py` and validates local model files
  before importing inference dependencies.
- Local runtime bootstrap and smoke commands are documented in
  `docs/milestone-records/milestone-1-runtime-spine.md`.
- Full WAV -> enhanced WAV smoke verification passes on macOS CPU with the
  local 9.216 second WAV fixture. The output is a 44.1 kHz mono PCM16 WAV and
  the observed CPU processing time was about 39 seconds.
- Missing-runtime and missing-model verification both surface actionable Rust
  errors before the sidecar is launched.
- Runtime dependency drift is a real risk: Resemble Enhance 0.0.1 failed with
  NumPy 2.x in the CFM solver path. The macOS CPU runtime pins the verified
  scientific stack in `sidecars/resemble/requirements-macos-cpu.txt`.
- The sidecar reads and writes the WAV handoff with `soundfile`, not
  `torchaudio.load/save`, so it does not depend on TorchCodec for the milestone
  1 WAV boundary. Rust should still own user-facing MP3/M4A compatibility in
  Milestone 2.

### Milestone 2: Audio Contract

Objective:

Make the audio boundary production-shaped: user-visible WAV/MP3/M4A input
becomes mono `f32` PCM, the sidecar receives a stable temporary handoff, and the
final user-visible output is WAV.

Scope:

- Add Rust audio probing and metadata extraction.
- Decode WAV, MP3, and M4A input in Rust.
- Convert mono/stereo input to mono `f32` PCM.
- Define the temporary sidecar handoff format and cleanup behavior.
- Write the final WAV output from Rust.
- Add fixtures and tests for the supported input/output contract.

Exit criteria:

- WAV, MP3, and M4A inputs all complete the end-to-end enhancement path.
- User-visible output is 44.1 kHz mono WAV.
- Python is not responsible for user-facing MP3 or M4A compatibility.
- Unsupported, corrupt, or unreadable audio files produce clear errors.
- Temporary files are cleaned up after success, failure, and cancellation where
  cancellation exists.

Out of scope:

- UI polish beyond what is needed to trigger the flow.
- Windows CUDA acceleration.
- MP3 export.
- Broader codec support.

Verification:

- Unit tests cover WAV decode/write, MP3 decode, M4A decode,
  stereo-to-mono conversion, and unsupported input errors.
- Integration tests cover WAV -> sidecar -> WAV, MP3 -> sidecar -> WAV, and
  M4A -> sidecar -> WAV.
- Run `git diff --check`.

Completion state as of June 2, 2026:

- Rust owns the user-facing audio boundary in `src-tauri/src/audio.rs`.
- WAV decoding and WAV writing use `hound`.
- MP3 and M4A decoding use `symphonia` without introducing FFmpeg.
- WAV, MP3, and M4A inputs decode to mono `f32` PCM.
- Rust writes a stable mono 32-bit float WAV sidecar handoff.
- The Python sidecar remains WAV-only and is no longer responsible for MP3 or
  M4A compatibility.
- Rust reads the sidecar WAV output and writes the final user-visible standard
  44.1 kHz mono PCM16 WAV.
- Rust owns temporary handoff files and cleans the temporary job directory after
  success and sidecar failure. Cancellation is not present in milestone 2; it is
  a milestone 3 job-manager behavior.
- Tauri exposes `probe_audio_command` and `enhance_audio_command`, while
  `enhance_wav_command` remains as a compatibility wrapper.
- The `enhance_wav` smoke CLI keeps its historical name, but its `--input` flag
  now accepts `.wav`, `.mp3`, and `.m4a`.
- Synthetic committed tests cover WAV decode/write, MP3 decode, M4A/AAC decode,
  stereo-to-mono conversion, unsupported and corrupt input errors, WAV/MP3/M4A
  sidecar handoff paths, final WAV writing, and temporary cleanup.
- Full local model smoke checks pass for
  `localfiles/samples/low_quality_voice_sample_1.wav`,
  `localfiles/samples/low_quality_voice_sample_1.mp3`, and
  `localfiles/samples/low_quality_voice_sample_1.m4a`. All three outputs are
  44.1 kHz mono PCM16 WAV files with standard PCM headers.
- Milestone 2 has no deferred exit criteria. See
  `docs/milestone-records/milestone-2-audio-contract.md`.

### Milestone 3: Desktop MVP

Objective:

Turn the working backend path into a usable desktop workflow for one-file
podcast speech restoration.

Scope:

- Add file picker and drag/drop for WAV, MP3, and M4A.
- Show source metadata.
- Add job states for queued, running, completed, failed, and cancelled.
- Show progress or honest indeterminate processing state.
- Support cancellation and safe cleanup.
- Add before/after playback.
- Add export flow for the enhanced WAV.
- Expose Resemble Enhance model settings in a collapsed advanced panel with
  public demo-aligned defaults, reset defaults, and concise inline help.
- Keep the import-to-export flow as one clear restore path for all supported
  first-release inputs.

Exit criteria:

- A non-technical user can import a supported file, run enhancement, compare
  original/enhanced audio, and export the WAV.
- Errors are visible in the UI and do not leave the app stuck in a running state.
- Cancellation does not leave a successful-looking partial output.
- The workflow keeps one clear enhancement path from import to export for all
  supported first-release inputs.
- Enhancement settings start from public demo-aligned defaults and are passed
  into the job-managed backend request.
- Advanced settings can return to the public demo defaults from the UI.
- The app still works offline after local runtime/model setup.

Out of scope:

- Batch processing.
- Realtime recording or monitoring.
- MP3 export.
- Auto-update.
- Final visual design polish beyond a credible MVP.

Verification:

- Manual QA with the short low-quality voice fixture in WAV, MP3, and M4A
  forms.
- Long-file and scenario-specific samples can be added during later quality,
  stability, and performance tuning.
- UI/build checks introduced by the app scaffold.
- Run `git diff --check`.

Starting state after Milestone 2:

- Reuse `probe_audio_command` for metadata display.
- Reuse `enhance_audio_command` for the backend processing path.
- Do not reimplement codec handling in the UI layer.
- Add cancellation in the job manager and keep temporary handoff cleanup tied to
  the job lifecycle.

Completion state as of June 3, 2026:

- The React desktop surface in `src/App.tsx` now supports native file picking,
  Tauri drag/drop, source metadata display, a single restore action,
  cancellable job state, before/after playback, and WAV export.
- The desktop surface exposes Resemble Enhance model settings for solver, CFM
  steps, prior temperature, and denoising strength in a collapsed advanced
  panel. Defaults align with the public demo's initial enhancement path:
  `midpoint`, `nfe=64`, `tau=0.5`, and `lambd=0.1`; the panel includes reset
  defaults and concise help text.
- The desktop job panel reports the actual sidecar-selected processing device
  after completion, so users can see whether a job used CPU or NVIDIA CUDA.
- Rust exposes a job-managed command surface:
  `start_enhancement_job_command`, `get_enhancement_job_command`,
  `cancel_enhancement_job_command`, and `export_enhanced_wav_command`.
- The existing direct `probe_audio_command`, `enhance_audio_command`, and
  `enhance_wav_command` remain available for smoke tests and compatibility.
- Bluetooth, meeting, laptop-microphone, phone, and remote-call recordings are
  represented as target source scenarios in product context and QA planning.
  The desktop pipeline uses one restore action for supported imported audio.
- The runtime can cancel a launched Python sidecar process and checks
  cancellation between decode, handoff, sidecar, final decode, and final write
  stages.
- Completed desktop preview WAVs live in app-managed temporary job directories;
  export copies the completed preview to a user-selected `.wav` destination.
- Failed and cancelled jobs remove their temporary preview directory and do not
  expose a successful-looking partial output.
- The Tauri asset protocol is enabled for local audio playback from selected
  files and temporary enhanced previews.
- Tests cover job completion/export through a fake sidecar, cancellation of a
  running fake sidecar, no preview output after cancellation, WAV-only export
  destinations, and the existing Milestone 2 audio contract.
- Full local model smoke checks pass for the short low-quality fixture in WAV,
  MP3, and M4A form. All three Milestone 3 smoke outputs are 44.1 kHz mono WAV
  files under `localfiles/outputs/`.
- Windows 11 x64 local CPU validation also passes on the Windows development
  machine with `localfiles/runtime/windows-x64/Scripts/python.exe`; this
  validates the Milestone 3 desktop and smoke-test path on Windows but does not
  replace the Milestone 5 portable Windows artifact work.
- The Windows validation pass fixed two portability issues: model hparams saved
  with `pathlib.PosixPath` YAML tags now load on Windows, and cancellable desktop
  jobs tolerate non-UTF-8 sidecar log bytes from Windows console progress
  output.
- `npm run tauri build -- --bundles app` produces a macOS `.app` bundle. The
  default bundle target is currently `app` so the next milestone starts from a
  passing app bundle build.
- A DMG wrapper attempt reached the generated `.app` but timed out in Finder
  AppleScript with AppleEvent `-1712`; Milestone 4 should resolve the DMG path
  or intentionally use zip as the first macOS wrapper.
- Milestone 3 has no deferred exit criteria. See
  `docs/milestone-records/milestone-3-desktop-mvp.md`.

### Milestone 4: macOS Portable Release And Packaging Contract

Objective:

Produce a self-contained macOS arm64 CPU release artifact and establish the
portable packaging contract that the later Windows release milestone can reuse.
Milestone 4 should be fully verifiable from the macOS development machine.

Scope:

- Build the macOS arm64 CPU `.app` from a clean checkout.
- Choose the first macOS wrapper format: either fix the DMG path or use zip.
  The `.app` bundle already builds after Milestone 3, but the local DMG script
  timed out in Finder AppleScript with AppleEvent `-1712`.
- Produce a self-contained macOS arm64 CPU portable artifact that includes the
  Tauri app, Python runtime, minimal PyTorch inference environment, Resemble
  Enhance sidecar, model weights, resources, and third-party license notices.
- Add committed packaging manifests and staging scripts so a clean checkout can
  assemble the macOS runtime, sidecar, model, resource layout, and license
  notices before invoking Tauri build.
- Add cross-platform model/runtime manifest structure with source, expected
  artifact path, version, platform, and SHA256 metadata. Keep large runtime and
  model artifacts out of git unless a later ADR explicitly chooses Git LFS or
  release-asset storage.
- Replace the development-only `localfiles/` runtime/model defaults in the
  desktop workflow with packaged resource lookup, while preserving developer
  overrides for local smoke testing.
- Define the resource layout contract that Windows packaging should follow in
  Milestone 5, including where platform runtimes, sidecars, model files, and
  license notices live relative to the app executable.
- Verify portable folder/resource lookup for the macOS sidecar and model paths.
- Verify that the job-managed preview/export workflow works from packaged
  resource paths, not only from repository-relative development paths.
- Review the asset protocol scope for arbitrary user-selected audio and
  temporary enhanced previews in packaged builds.
- Document macOS archive size, extracted size, runtime expectations, no-network
  behavior, artifact layout, and known platform limitations.
- Document the Windows handoff requirements for Milestone 5: required local
  artifacts, expected staging commands, expected output archive shape, and smoke
  test checklist.

Exit criteria:

- A freshly extracted macOS arm64 CPU artifact runs without user-installed
  Python, Conda, FFmpeg, CUDA Toolkit, network access, or model downloads.
- The macOS artifact can complete the one-file desktop workflow for WAV, MP3,
  and M4A input: import, metadata display, enhancement, before/after playback,
  and WAV export.
- The app resolves the bundled Python runtime, sidecar, and model files from the
  packaged resource layout by default.
- Developer overrides still allow local smoke testing from `localfiles/` or an
  explicit runtime/model path.
- Third-party license notices are present in the macOS artifact.
- A fresh macOS developer checkout has documented commands for staging the
  required runtime and model artifacts into the Tauri resource layout without
  relying on hidden `localfiles/` state.
- Documentation explains the macOS artifact layout, archive size, extracted
  size, runtime expectations, no-network behavior, and platform support status.
- Documentation gives the Windows machine enough packaging-contract detail to
  start Milestone 5 after cloning the repository.

Out of scope:

- Windows portable artifact creation or validation.
- Auto-update.
- Start Menu shortcuts, file associations, MSI, NSIS, `.pkg`, or traditional
  installer flows.
- Windows 10 support guarantee.
- macOS MPS acceleration guarantee.

Verification:

- macOS CPU artifact smoke test.
- No-network smoke test after extracting the macOS artifact.
- WAV, MP3, and M4A input to WAV export smoke tests from the packaged macOS
  resource layout.
- Packaged-resource lookup test for runtime, sidecar, model files, and license
  notices.
- Developer override smoke test that still uses explicit local paths.
- License notice review.
- `npm run check`.
- `cargo test --manifest-path src-tauri/Cargo.toml`.
- `npm run tauri build` or the documented macOS artifact build command.
- Run `git diff --check`.

Completion state as of June 3, 2026:

- The first macOS wrapper format is zip. DMG is intentionally deferred because
  the previous Finder AppleScript path timed out with AppleEvent `-1712`.
- `packaging/artifacts.macos-arm64-cpu.json` defines the committed macOS CPU
  artifact manifest with source, artifact path, version, platform, and SHA256
  metadata.
- `scripts/stage-macos-cpu-resources.mjs` stages a self-contained macOS arm64
  CPU resource tree under `src-tauri/resources/clearpodcast/`, copies a
  relocatable base Python runtime, overlays the Resemble/PyTorch venv
  `site-packages`, validates the Resemble checkpoint SHA256, rejects absolute
  symlink leaks, stages license notices, and generates
  `clearpodcast/manifests/artifacts.json`.
- `scripts/build-macos-cpu-portable.mjs` stages resources, builds the Tauri
  `.app`, and creates
  `localfiles/releases/ClearPodcast-0.1.0-macos-arm64-cpu.zip`.
- Tauri now bundles `src-tauri/resources/clearpodcast` as the packaged
  `clearpodcast` resource directory.
- Rust resolves packaged Python runtime, sidecar, model directory, license
  notices, and artifact manifest paths from Tauri's resource directory by
  default. Developer overrides remain available from the UI and smoke CLI.
- The desktop UI no longer defaults to development-only `localfiles/` runtime
  and model paths; runtime/model fields are optional overrides.
- Third-party notices are staged at
  `clearpodcast/licenses/THIRD_PARTY_NOTICES.txt`; Python package `.dist-info`
  metadata is preserved in the packaged runtime for package-level license
  review.
- Observed local artifact sizes: 1.6 GB extracted `.app`, 957 MB packaged
  runtime, 688 MB packaged model, and 886 MB zip archive.
- Fresh-extracted WAV, MP3, and M4A smoke tests all pass using the packaged
  resource layout and produce 44.1 kHz mono WAV outputs.
- A no-network smoke test passed under macOS `sandbox-exec` with
  `(deny network*)`.
- The asset protocol scope remains `$HOME/**` and `$TEMP/**`. This supports
  typical home-directory source files and temp preview WAVs. External-volume
  original playback is documented as a future preview-path improvement if it
  becomes a release blocker.
- Windows handoff requirements for Milestone 5 are documented in
  `docs/milestone-records/milestone-4-macos-portable-release.md`.
- Milestone 4 has no deferred exit criteria. See
  `docs/milestone-records/milestone-4-macos-portable-release.md`.

### Milestone 5: Windows Portable Release And CUDA Validation

Objective:

Produce one self-contained Windows 11 x64 portable release artifact that bundles
a CUDA-capable PyTorch runtime, uses CUDA automatically when available, and falls
back to CPU when CUDA is unavailable or disabled. Validate the artifact on the
Windows RTX 5070 Ti machine. Milestone 5 is intended to run from a fresh clone on
the Windows validation computer.

Scope:

- Clone the repository onto the Windows 11 x64 validation machine after
  Milestone 4 is complete.
- Build one Windows x64 CUDA-capable portable archive using the packaging
  contract, manifests, and staging scripts established in Milestone 4.
- Select the Windows CUDA PyTorch wheel at packaging time based on the latest
  stable PyTorch support for the target GPU generation. As of June 3, 2026,
  prefer CUDA 13.0 (`cu130`) for the current PyTorch Windows Python 3.12 runtime
  after validating it on the RTX 5070 Ti. Do not require users to install the
  CUDA Toolkit.
- Stage Windows runtime artifacts, sidecar files, model weights, app resources,
  and third-party license notices into the documented portable folder layout.
- Verify that packaged Windows resource lookup finds the bundled runtime,
  sidecar, and model files without relying on repository-relative paths or
  hidden `localfiles/` state.
- Verify the desktop job-managed workflow on Windows: import, metadata display,
  enhancement, cancellation behavior, before/after playback, and WAV export.
- Validate automatic CPU fallback behavior when CUDA is unavailable or disabled.
- Validate CUDA startup, model load, and end-to-end inference on the RTX 5070 Ti
  machine.
- Verify the desktop job panel shows the actual selected processing device for
  both CUDA and CPU-fallback runs.
- Document Windows archive size, extracted size, runtime expectations, GPU
  driver expectations, no-network behavior, artifact layout, and known platform
  limitations.

Exit criteria:

- A freshly extracted Windows x64 portable archive runs on Windows 11 without
  user-installed Python, Conda, FFmpeg, CUDA Toolkit, network access, model
  downloads, or repository-relative `localfiles/` state.
- The Windows artifact completes end-to-end WAV, MP3, and M4A input to WAV
  export smoke tests with automatic CPU fallback when CUDA is disabled.
- The same Windows artifact uses the NVIDIA GPU when CUDA is available on the
  RTX 5070 Ti machine.
- CUDA unavailable or disabled states fall back to CPU. Explicit developer
  requests for `device=cuda` may fail, but must fail with a clear actionable
  error.
- The RTX 5070 Ti machine completes end-to-end WAV, MP3, and M4A input to WAV
  output CUDA smoke tests.
- Third-party license notices are present in the Windows artifact.
- Documentation explains Windows artifact layout, archive size, extracted size,
  runtime expectations, GPU driver expectations, CPU fallback behavior, and
  platform support status.

Out of scope:

- macOS packaging changes except documentation updates needed to keep the
  packaging contract aligned.
- Auto-update.
- Start Menu shortcuts, file associations, MSI, NSIS, or mandatory installers.
- Windows 10 support guarantee.
- Multi-GPU optimization or support for non-NVIDIA GPU acceleration.

Verification:

- Windows 11 portable archive no-network smoke test after extraction.
- Windows 11 CPU-fallback WAV, MP3, and M4A input to WAV export smoke tests.
- Windows 11 CUDA WAV, MP3, and M4A input to WAV export smoke tests on the RTX
  5070 Ti machine using the same artifact.
- CUDA enabled-device check and captured evidence that inference ran on NVIDIA
  GPU.
- CPU fallback test with CUDA disabled or unavailable.
- UI device indicator smoke test for CUDA and CPU-fallback runs.
- Cancellation smoke test on Windows while a sidecar job is running.
- License notice review for the Windows artifact.
- `npm run check`.
- `cargo test --manifest-path src-tauri/Cargo.toml`.
- Windows artifact build commands documented by Milestone 4.
- Run `git diff --check`.

Completion state as of June 3, 2026:

- `packaging/artifacts.windows-x64.json` defines the committed Windows x64
  artifact manifest with source, artifact path, version, platform, and SHA256
  metadata.
- `scripts/stage-windows-x64-resources.mjs` stages a self-contained Windows x64
  resource tree under `src-tauri/resources/clearpodcast/`, dereferences the
  uv-created base Python runtime, overlays the project `site-packages`,
  validates the Resemble checkpoint SHA256, stages license notices, and
  generates `clearpodcast/manifests/artifacts.json`.
- `scripts/build-windows-x64-portable.mjs` stages resources, builds the Tauri
  executable, and creates
  `localfiles/releases/ClearPodcast-0.1.0-windows-x64.zip`.
- The Windows runtime uses Python 3.12 with `torch==2.12.0+cu130`; PyTorch
  reports CUDA 13.0, and the local validation machine reports NVIDIA driver
  596.49 with `nvidia-smi` CUDA version 13.2.
- The Windows artifact is one CUDA-capable portable zip with CPU fallback, not
  separate CPU and CUDA downloads. Users do not need Python, Conda, FFmpeg, the
  CUDA Toolkit, network downloads, model downloads, or repository-relative
  `localfiles/` state after extraction.
- Rust packaged-resource lookup now resolves `runtimes/windows-x64/python.exe`
  on Windows while preserving the Milestone 4 macOS path
  `runtimes/macos-arm64-cpu/bin/python3` on non-Windows builds.
- The desktop UI sends `device=auto` by default. The sidecar chooses CUDA when
  `torch.cuda.is_available()` is true and otherwise falls back to CPU.
- The sidecar emits structured device metadata, and the desktop job panel shows
  whether a completed enhancement used NVIDIA GPU or CPU. A lightweight startup
  preflight also populates the standalone device card before the first
  enhancement run. That preflight runs in a background blocking task so PyTorch
  import and CUDA probing do not freeze the window.
- Windows Python sidecar and device-preflight child processes are launched
  without a visible console window.
- Observed local artifact sizes: 3.86 GiB portable folder and 2.58 GiB zip
  archive.
- Fresh-extracted CUDA WAV, MP3, and M4A smoke tests all pass on the RTX 5070
  Ti machine and report `selected_device: cuda` with device name
  `NVIDIA GeForce RTX 5070 Ti`.
- Fresh-extracted CPU fallback WAV, MP3, and M4A smoke tests all pass with
  `CUDA_VISIBLE_DEVICES=-1` and report `selected_device: cpu`.
- Explicit `device=cuda` with CUDA disabled fails clearly with
  `cuda_unavailable`.
- A no-network sidecar smoke passed using a Python socket-blocking
  `sitecustomize.py`; a Windows Firewall block rule could not be installed from
  this non-admin shell.
- Output header checks confirmed all fresh-extracted smoke outputs are standard
  PCM16 mono 44.1 kHz WAV files.
- The fresh-extracted `ClearPodcast.exe` starts from the portable folder.
- Windows cancellation behavior is covered by the job-manager fake sidecar
  tests, and packaged lookup tests cover both Windows and macOS runtime paths.
- Milestone 5 has no deferred exit criteria. See
  `docs/milestone-records/milestone-5-windows-portable-cuda.md`.

### Milestone 6: Residual Cleanup

Objective:

Establish a clean post-MVP baseline for the working import, restore, compare,
and export path by aligning product language, diagnostics, command entry
points, generated-resource hygiene, and documentation.

Scope:

- Use current product language across the app surface, command entry points, and
  active docs. Historical completion evidence lives in `docs/milestone-records/`.
- Place Python runtime and model path overrides in diagnostic or developer
  surfaces. Keep the smoke CLI available for local verification.
- Clarify compatibility command names such as `enhance_wav` and
  `enhance_wav_command` as diagnostic or release-smoke entry points aligned with
  the current WAV/MP3/M4A input contract.
- Add concise user-facing summaries for backend, sidecar, and device-detection
  failures. Diagnostics own stdout, stderr, tracebacks, paths, raw IDs,
  checkpoints, and sidecar internals.
- Align sidecar and runtime errors with the current internal WAV handoff
  boundary and packaged runtime model.
- Present job progress and results with product-facing status language.
- Make original and enhanced playback coherent for normal user-selected files,
  including any app-managed preview-copy lifecycle needed by the Tauri asset
  protocol.
- Confirm generated-output and staging boundaries for `localfiles/`,
  `src-tauri/resources/clearpodcast/`, `dist/`, `node_modules/`, and
  `src-tauri/target/`.
- Review macOS and Windows staging scripts for shared maintenance points.
- Refresh README and release-workflow wording so current product behavior and
  historical records have clear homes.

Exit criteria:

- The primary desktop UI presents the current restoration workflow in product
  language, with diagnostics as a secondary surface.
- Packaged runtime and model lookup remain the default behavior. Developer
  overrides are intentionally placed and covered by at least one smoke or unit
  path.
- Common failure modes have understandable user-facing messages: unsupported
  input, corrupt or unreadable audio, missing packaged runtime, missing model
  files, sidecar failure, cancellation, and device-detection failure.
- Sidecar and runtime error text describes current behavior when those errors
  can reach the desktop UI.
- Original and enhanced playback behave coherently for normal user-selected
  files, including any app-managed preview-copy lifecycle.
- Current docs describe the app as a working offline desktop restoration tool.
  Historical milestone completion notes remain intact under
  `docs/milestone-records/`.
- Generated resources, ignored files, ordinary checks, and documented local
  inputs have a clear relationship.

Boundaries:

- This milestone owns residual cleanup for the current workflow, diagnostics,
  command entry points, generated-resource hygiene, and documentation.
- Milestone 7 owns the full UI/UX redesign.
- The roadmap owns future themes for audio strategy, QA methodology, release
  readiness, public versioning, and product expansion.

Verification:

- `npm run check`.
- `cargo test --manifest-path src-tauri/Cargo.toml`.
- `git diff --check`.
- Use Browser smoke for React UI language, layout, diagnostics, advanced
  settings, button states, and frontend-only workflow behavior.
- Use Rust tests and the smoke CLI for Tauri command behavior, backend
  job-manager behavior, preview-copy lifecycle, export behavior, and developer
  override behavior.
- Reserve real Tauri GUI smoke for changes to native file dialogs, Tauri
  drag/drop, asset-protocol playback, packaged resource lookup, or explicitly
  requested GUI behavior.
- Review `git status --ignored` and confirm generated resources remain ignored
  and non-required for ordinary checks.
- Release packaging is reserved for explicit release-artifact requests.

Completion state as of June 3, 2026:

- The React desktop surface uses current product language for offline speech
  restoration, the restoration job state, device status, before/after playback,
  and WAV export.
- Python runtime and model directory overrides live in the collapsed
  Diagnostics panel. Diagnostics also owns raw paths, job ids, preview/export
  paths, runtime detail, and device-detection detail.
- The primary status panel shows concise user-facing summaries for common input,
  audio, runtime, model, sidecar, cancellation, export, and device-detection
  failures, while Diagnostics keeps technical detail available.
- Sidecar help and validation errors describe the current internal WAV handoff
  boundary. Compatibility command comments clarify that
  `enhance_audio_command`, `enhance_wav_command`, and the `enhance_wav` binary
  are diagnostic and release-smoke entry points aligned with the current
  WAV/MP3/M4A input contract.
- Original playback uses app-managed temporary preview copies prepared by Rust,
  while the selected source remains the processing input. Preview cleanup
  rejects unmanaged paths and only removes managed ClearPodcast preview
  directories.
- `README.md` and `docs/release-workflow.md` document the current diagnostic
  boundary, generated-resource boundary, ordinary-check expectations, and shared
  macOS/Windows staging maintenance points.
- Browser smoke covers the frontend-only M6 changes: product language,
  Diagnostics, Advanced settings, default values, and button states.
- Rust tests cover the preview-copy lifecycle, job manager, export behavior,
  cancellation cleanup, packaged lookup, audio contract, and compatibility paths.
- A developer override smoke CLI passes with the local macOS runtime and model,
  producing a 44.1 kHz mono WAV and CPU device metadata.
- `git status --ignored --short` confirms generated/private roots remain
  ignored and non-required for ordinary checks.
- Milestone 6 has no deferred exit criteria. See
  `docs/milestone-records/milestone-6-residual-cleanup.md`.

### Milestone 7: UI/UX Redesign

Objective:

Turn the current working desktop app into a polished one-file spoken-word
restoration workspace through a design-led, verifiable frontend redesign while
preserving the proven backend pipeline and exact Resemble Enhance parameter
access.

Scope:

- Start from a concise product-design brief for the one-file restoration
  workspace: user goal, primary workflow, visual direction, interaction level,
  supported desktop sizes, and non-goals.
- Define the visible product as a one-file, one-active-restoration workspace:
  choose a damaged spoken-word file, confirm source validity, run restoration,
  monitor the current run, compare before/after, export a WAV, and inspect
  diagnostics only when needed.
- Use a current-run capability model in the product surface. Transient backend
  states such as `queued` become user-facing preparation states for the active
  restoration, while backend job-manager details remain integration and
  diagnostic concepts.
- Build the information architecture, layout, labels, and panel structure from
  the root workflow. Existing MVP behavior is the functional contract; the
  current component order and visual treatment are redesign inputs.
- Establish an independent, polished visual system for the working behavior.
- Use a cel-shaded-inspired visual direction as the default aesthetic target:
  crisp illustrated planes, confident outlines, layered color blocks,
  expressive audio/status motifs, and enough restraint for a focused desktop
  productivity workflow.
- Redesign the application-level visual assets as part of the new visual system:
  product mark, Tauri application icon assets, in-app utility icons,
  empty-state artwork, and audio/status motifs.
- Research comparable speech-restoration, podcast-cleanup, and audio-enhancement
  workflows where useful, separating observed public user friction from
  inference. Use research to sharpen workflow clarity and prioritization while
  keeping the product surface scoped to M7.
- Audit the current ClearPodcast experience across import, source understanding,
  restore, processing state, cancellation, before/after comparison, WAV export,
  advanced settings, diagnostics, empty states, error states, and supported
  desktop window sizes. The audit should map implementation artifacts and
  capability-model mismatches to the intended user-facing concepts.
- Explore three credible visual and information-architecture directions before
  implementation. Keep those directions inside or adjacent to the cel-shaded
  brief, with usability evidence guiding any deviation. Pick one working target,
  with an agent-recommended default absent an explicit user choice.
- Make the first screen the usable restoration workspace, with layout driven by
  the current one-file journey.
- Redesign the primary desktop workflow around import, source understanding,
  restore, processing state, before/after comparison, and WAV export.
- Split the current monolithic React and CSS surface into maintainable UI
  modules for input, metadata, processing status, device status, playback,
  export, advanced enhancement settings, and diagnostics.
- Separate product-facing state, backend command integration, presentation
  components, diagnostics, and styling enough to keep future workflow changes
  localized.
- Keep exact enhancement controls for solver, CFM steps, prior temperature, and
  denoising strength in an advanced settings surface.
- Preserve reset-to-public-demo defaults:
  `midpoint`, `nfe=64`, `tau=0.5`, and `lambd=0.1`.
- Improve empty, loading, running, cancelled, failed, completed, and exported
  states so the user always knows what action is available next.
- Present processing-device information in product language while retaining
  CUDA/CPU details where useful.
- Improve accessibility and desktop ergonomics: keyboard focus, clear disabled
  states, predictable tab order, text that fits, window-size behavior, and
  robust drag/drop affordances.
- Keep diagnostic and developer controls available as secondary surfaces.
- Capture visual and interaction QA evidence before completion, using Browser or
  app screenshots where practical.
- Update current docs and screenshots or descriptions that become inaccurate
  after the redesign.

Execution flow:

1. Definition: write the M7 design brief and state matrix before changing the
   production UI, including the cel-shaded-inspired aesthetic target and the
   independent visual foundation. Include an information-architecture pass that
   maps root user needs, current capabilities, and visible surfaces.
2. Evidence: run a lightweight comparable-product research scan when source
   access is available, then audit the current app against the brief.
3. Direction: produce three design directions and choose a single target. If the
   user has not asked to review visual options, proceed with the strongest
   agent-recommended cel-shaded direction and document the choice.
4. Implementation: refactor the frontend into focused modules while preserving
   the current Tauri command contract and backend behavior.
5. QA: verify state coverage, accessibility, desktop sizing, interaction flow,
   model-parameter passthrough, diagnostics, export semantics, and
   capability-accurate affordances before marking the milestone complete.

Exit criteria:

- A non-technical user can import WAV, MP3, or M4A audio, run restoration,
  compare original/enhanced playback, and export a WAV through product-facing
  language and controls.
- The milestone records the design brief, comparable-product research signal or
  documented research limitation, current-experience audit, selected design
  direction, information-architecture rationale, and state matrix used for
  implementation.
- The redesigned layout is justified by the root one-file restoration journey.
- The visible product surface communicates the current capability model: one
  source file, one active restoration, current-run preparation, running,
  cancellation, completion, failure, WAV export, exact advanced parameters, and
  secondary diagnostics. Queues, batch processing, job history, multi-file
  projects, presets, accounts, and cloud workflows remain future milestone
  topics.
- The redesigned interface consistently expresses the selected
  cel-shaded-inspired direction without compromising workflow clarity.
- Product-mark, app-icon, in-app iconography, empty-state artwork, and
  audio/status visual motifs are aligned with the selected visual direction
  and the current-run restoration model.
- Advanced model parameters remain available and are passed through to the
  backend exactly as before.
- The redesigned UI preserves the current exact model-control surface in a
  secondary location.
- The interface remains usable on the supported desktop window sizes for macOS
  and Windows, with no overlapping text or controls.
- The frontend code is organized into focused modules with clear ownership for
  app state, backend integration, workflow panels, diagnostics, and styling.
- Existing backend behavior, packaged resource lookup, cancellation, device
  detection, and export semantics remain intact.
- Visual and interaction QA evidence covers empty, selected, running,
  cancelled, failed, completed, exported, advanced-settings, and diagnostics
  states.

User participation:

- The milestone should be executable without midstream user decisions by using
  conservative product assumptions, the existing implementation plan, and the
  cel-shaded-inspired visual direction.
- User review is valuable but optional for visual-direction selection, wording
  preferences, and final acceptance screenshots.
- Stop for user input only when continuing would change the product promise,
  switch away from the cel-shaded-inspired direction, remove existing model
  controls, expand beyond the one-file workflow, or create a new
  release/distribution commitment.

Boundaries:

- This milestone owns interface design, information architecture, frontend
  structure, desktop workflow ergonomics, and application-level visual assets
  for the current one-file restoration path.
- This milestone may use Product Design research, audit, ideation, and visual
  QA workflows as supporting tools, but the implementation plan remains the
  milestone source of truth.
- Full marketing brand systems, website redesign, release artifact rebuilds,
  and new product capabilities belong to separate milestones or explicit
  follow-up requests.
- The roadmap owns future themes for audio-quality exploration, preset
  validation, QA methodology, release readiness, additional formats, batch
  workflows, realtime recording, and model expansion.

Verification:

- `npm run check`.
- `cargo test --manifest-path src-tauri/Cargo.toml`.
- `git diff --check`.
- Frontend build verification with `npm run build`.
- Design-brief, information-architecture, and state-matrix review against the
  implemented UI.
- Visual asset review for logo/app icon variants, in-app icons, empty-state
  artwork, and audio/status motifs.
- Manual desktop smoke on macOS and Windows where practical for import, restore,
  cancellation, before/after playback, export, advanced settings, and developer
  diagnostics.
- Visual QA with screenshots or browser/app inspection for the supported desktop
  window sizes before marking the milestone complete.

Completion state as of June 3, 2026:

- The M7 design record lives at
  `docs/milestone-records/milestone-7-ui-ux-redesign.md` and captures the
  product-design brief, public comparable-product research signal and
  limitation, current-experience audit, information architecture, three design
  directions, selected Restoration Desk direction, visual system, and state
  matrix.
- The React surface is now a three-panel Restoration Desk workspace organized
  around Source, Current Run, and Compare And Export. The first screen remains
  the usable restoration workflow, not a landing page.
- Backend `queued` is presented as current-run preparation in the product
  surface, while job IDs, raw paths, runtime detail, and device detail remain in
  Diagnostics.
- Exact Resemble Enhance controls for solver, CFM steps, prior temperature, and
  denoising remain available in secondary Model Settings and still pass through
  to the backend request unchanged, with reset to `midpoint`, `nfe=64`,
  `tau=0.5`, and `lambd=0.1`.
- Diagnostics remains a secondary surface and still owns Python runtime/model
  overrides, raw paths, job IDs, preview/export paths, runtime details, and
  device-detection detail.
- Frontend code is split into focused modules under `src/backend/`,
  `src/domain/`, `src/hooks/`, `src/components/`, `src/dev/`, and
  `src/styles/`.
- The application-level visual system uses a cel-shaded-inspired product mark,
  regenerated Tauri desktop icon assets, in-app utility icons, empty-state
  artwork, audio/status motifs, confident outlines, and layered color blocks.
- Browser visual fixtures cover empty, selected, running, cancelled, failed,
  completed, exported, advanced-settings, and diagnostics states for
  frontend-only QA.
- Milestone 7 preserved backend processing, packaged resource lookup,
  cancellation, device detection, and WAV export semantics. Release artifact
  rebuilds remain owned by the release workflow.
- Milestone 7 has no deferred exit criteria. See
  `docs/milestone-records/milestone-7-ui-ux-redesign.md`.

## Open Questions

- Model weight storage and release-cache policy.
- Long-term sidecar audio handoff strategy: temporary WAV boundary or direct PCM
  IPC.
- Final loudness target for exported podcast WAV.
- Deterministic preprocessing and post-processing strategy for future
  audio-quality exploration.
