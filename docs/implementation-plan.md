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
- Input formats: WAV and MP3.
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

- `symphonia` for MP3 decoding and probing.
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

Do not require the user to install:

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
- End-to-end WAV/MP3 input to WAV output.

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

## First MVP

Build this before broader features:

1. Tauri app scaffold.
2. File picker and drag/drop for WAV and MP3.
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

## First Engineering Milestones

### Milestone 1: Repo Scaffold

- Create Tauri v2 + React + TypeScript app.
- Add Rust modules for job state and audio I/O.
- Add placeholder sidecar invocation.
- Add docs and agent conventions.

### Milestone 2: Audio I/O

- Decode WAV and MP3 to mono f32 PCM in Rust.
- Write WAV output through Rust.
- Add fixture tests for mono/stereo WAV and MP3 inputs.

### Milestone 3: Sidecar Inference

- Vendor or fork the minimal Resemble Enhance inference path.
- Add local model path resolution.
- Add no-network startup checks.
- Run a single input WAV to output WAV from the sidecar.

### Milestone 4: End-To-End Desktop Flow

- Connect UI to Rust command.
- Show job progress.
- Support cancellation.
- Preview original and enhanced audio.
- Export enhanced WAV.

### Milestone 5: Packaging

- Build a portable CPU artifact with bundled runtime and model.
- Build macOS arm64 and Windows 11 x64 CPU portable artifacts.
- Build and validate a Windows 11 x64 NVIDIA CUDA portable artifact on the RTX
  5070 Ti machine.
- Verify no network access is required after extraction.
- Generate third-party license notices.
- Document archive size, extracted size, and hardware expectations.

## Testing Strategy

Unit tests:

- WAV decode/write.
- MP3 decode.
- Stereo-to-mono conversion.
- Path validation.
- Job state transitions.

Integration tests:

- Decode MP3 -> sidecar temporary WAV -> enhanced WAV.
- Decode WAV -> sidecar temporary WAV -> enhanced WAV.
- Missing model files.
- Missing Python runtime.
- CPU fallback when CUDA is unavailable.
- Windows 11 CUDA sidecar startup and inference on the RTX 5070 Ti machine.

Manual QA:

- Bluetooth headset sample.
- Meeting app recording sample.
- Phone voice memo sample.
- Laptop microphone sample.
- Long recording at least 60 minutes.

## Open Questions

- Whether to store model weights in the repository, Git LFS, release artifacts,
  or a release build cache.
- Whether the sidecar boundary should initially be temp WAV or direct PCM IPC.
- Final loudness target for exported podcast WAV.
- Whether to add optional deterministic post-processing before the first public
  build or defer it until after the model path is stable.
