# ClearPodcast Implementation Plan

## Goal

Build an offline desktop application that restores poor spoken-word podcast
recordings captured through Bluetooth headsets, laptop microphones, meeting
software, phone recordings, and remote-call workflows.

The first product version should let a user import a WAV or MP3 recording,
process it locally with Resemble Enhance, apply basic podcast-oriented output
normalization, and export a WAV file.

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
User selects .wav or .mp3
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
- Recommended first output: 44.1 kHz mono 24-bit PCM WAV.
- If implementation simplicity matters, 32-bit float WAV is acceptable for early
  internal builds, but product export should prefer 24-bit PCM.

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
- Windows x64 CPU portable archive, validated first on Windows 11.
- Windows x64 NVIDIA CUDA portable archive, validated first on Windows 11.

The CPU artifact is the compatibility baseline. CUDA is an acceleration artifact,
not the only supported path.

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
- Windows 11 x64 CPU for general Windows compatibility.
- Windows 11 x64 NVIDIA CUDA for accelerated inference and high-performance
  validation on the local RTX 5070 Ti machine.

The Windows NVIDIA artifact should use the latest stable PyTorch CUDA wheel that
supports the target GPU generation at packaging time. Do not pin the first CUDA
artifact to an older CUDA build before validating it against the target Windows
GPU.

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
- NVIDIA GPU with at least 6 GB VRAM for the CUDA build.
- RTX 5070 Ti-class GPU is more than enough for local CUDA validation.

Release artifacts are expected to be large because PyTorch and model weights are
bundled. A 1.5 GB to 3 GB extracted app footprint is acceptable for the product
promise of offline restoration. The disk minimum is higher because long inputs,
temporary WAV handoff files, and exported WAVs need working space.

## Local Development Fixtures

Use `localfiles/` for private local inputs, model files, runtime experiments, and
generated outputs. This directory is intentionally not part of the repository
history.

MVP fixture set:

- `localfiles/samples/low_quality_voice_sample_1.wav`
- `localfiles/samples/low_quality_voice_sample_1.mp3`
- `localfiles/samples/low_quality_voice_sample_1.m4a`

These files should represent the same short low-quality spoken voice sample in
each supported input format. This is enough for Runtime Spine, Audio Contract,
and early Desktop MVP smoke tests.

Do not require separate meeting, phone, Bluetooth, laptop microphone, or
60-minute samples before the MVP workflow is stable. Add scenario-specific and
long-file samples later when tuning quality, stability, and performance.

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

## MVP Feature Checklist

This checklist defines the first usable product surface. It is not the execution
order; use the goal-mode milestones below for implementation order.

1. Tauri app scaffold.
2. File picker and drag/drop for WAV, MP3, and M4A.
3. Rust audio probe and decode path.
4. Temporary WAV handoff into Python sidecar.
5. Resemble Enhance sidecar running from bundled local model path.
6. WAV export path.
7. Progress, cancellation, and error reporting.
8. Before/after playback.
9. Basic preset names, even if they map to fixed defaults at first:
   - Bluetooth headset.
   - Meeting recording.
   - Laptop microphone.
   - Phone recording.

## Goal-Mode Milestones

Use one milestone as one Codex goal. Start a new goal by reading `AGENTS.md`,
`CONTEXT.md`, relevant ADRs, and this plan. Treat the milestone objective as the
goal objective. Do not mark the goal complete until every exit criterion is met
or explicitly documented as deferred with a reason.

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

### Milestone 3: Desktop MVP

Objective:

Turn the working backend path into a usable desktop workflow for one-file
podcast speech restoration.

Scope:

- Add file picker and drag/drop for WAV, MP3, and M4A.
- Show source metadata and selected preset.
- Add job states for queued, running, completed, failed, and cancelled.
- Show progress or honest indeterminate processing state.
- Support cancellation and safe cleanup.
- Add before/after playback.
- Add export flow for the enhanced WAV.
- Add the first preset names: Bluetooth headset, meeting recording, laptop
  microphone, and phone recording.

Exit criteria:

- A non-technical user can import a supported file, run enhancement, compare
  original/enhanced audio, and export the WAV.
- Errors are visible in the UI and do not leave the app stuck in a running state.
- Cancellation does not leave a successful-looking partial output.
- Presets are represented in the UI and pipeline even if they initially map to
  the same processing defaults.
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
- Long-file and scenario-specific samples can be deferred until after the MVP
  workflow is stable.
- UI/build checks introduced by the app scaffold.
- Run `git diff --check`.

### Milestone 4: Portable Release

Objective:

Produce self-contained portable release artifacts for the first supported
platform matrix and prove they run without network or system Python setup.

Scope:

- Build macOS arm64 CPU `.app`, wrapped in DMG or zip.
- Build Windows x64 CPU portable archive, validated first on Windows 11.
- Build Windows x64 NVIDIA CUDA portable archive, validated first on Windows 11
  with the RTX 5070 Ti machine.
- Bundle Python runtime, PyTorch, sidecar, model weights, resources, and license
  notices.
- Verify portable folder/resource lookup for sidecar and model paths.
- Document archive size, extracted size, runtime expectations, and known
  platform limitations.

Exit criteria:

- Freshly extracted macOS and Windows CPU artifacts run without user-installed
  Python, Conda, FFmpeg, CUDA Toolkit, or model downloads.
- Windows CUDA artifact uses the NVIDIA GPU when available and falls back or
  fails clearly when CUDA is unavailable.
- The RTX 5070 Ti machine completes an end-to-end WAV/MP3/M4A input to WAV output
  CUDA smoke test.
- Third-party license notices are present in the artifact.
- Documentation explains the artifact layout and platform support status.

Out of scope:

- Auto-update.
- Start Menu shortcuts, file associations, MSI, NSIS, or `.pkg` installers.
- Windows 10 support guarantee.
- macOS MPS acceleration guarantee.

Verification:

- No-network smoke test after extraction.
- macOS CPU artifact smoke test.
- Windows 11 CPU artifact smoke test.
- Windows 11 CUDA artifact smoke test on the RTX 5070 Ti machine.
- License notice review.
- Run `git diff --check`.

## Open Questions

- Whether to store model weights in the repository, Git LFS, release artifacts,
  or a release build cache.
- Whether to keep the temporary WAV handoff long-term or move to direct PCM IPC
  after the MVP path is stable.
- Final loudness target for exported podcast WAV.
- Whether to add optional deterministic post-processing before the first public
  build or defer it until after the model path is stable.
