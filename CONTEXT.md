# ClearPodcast Context

ClearPodcast is an offline desktop application for restoring poor spoken-word
podcast recordings.

## Current Release Baseline

ClearPodcast v0.1 is the release baseline for the completed one-file speech
restoration product surface. The app imports WAV, MP3, or M4A speech recordings,
runs Resemble Enhance locally, supports before/after comparison, exports a
standard WAV file, and ships as portable macOS and Windows archives.

The active product identity is a polished offline restoration desk for the
current file and current run. Milestone records document how that baseline was
reached; current behavior is described in this context document, the roadmap,
the development guide, and the release workflow.

## Product Problem

Many independent podcasters record through Bluetooth headsets, laptop
microphones, online meeting software, mobile voice memos, or remote-call tools.
By the time they start post-production, the recording quality is already a fact:
the audio may be noisy, bandwidth-limited, compressed, reverberant, clipped, or
thin.

ClearPodcast exists to accept that reality and improve the final publishable
result as much as possible without requiring the user to re-record, buy studio
equipment, or upload private conversations to a cloud service.

## Primary User

The primary user is a podcast creator who wants to publish spoken-word content
and does not want to understand audio engineering.

They should be able to drag in a WAV, MP3, or M4A file, run enhancement locally
with one clear action, compare the result, and export a WAV file suitable for
further publishing or distribution.

The desktop UI supports English, Simplified Chinese, Japanese, and Korean
language switching in the app header. The selected language is persisted locally
and used for controls, status labels, model parameter help, logs, and processing
error summaries.

Run controls, model parameters, and run logs are three mutually exclusive views of
the current enhancement workspace. Runtime events are written to a local
`clearpodcast.log` text file in the app log directory, with bounded rotation for
older files. The Log view in the second panel displays only the current app
session and follows new entries as they arrive.

## Core Domain Language

- Bad recording: A real-world speech recording with noise, codec damage,
  Bluetooth artifacts, meeting-app processing, room tone, reverberation, low
  bandwidth, uneven volume, or mild clipping.
- Speech restoration: AI-based reconstruction and enhancement of damaged human
  speech, including denoising, de-artifacting, and bandwidth restoration.
- Podcast mastering: Deterministic post-processing after AI restoration:
  loudness normalization, limiting, gain staging, and optional spoken-word EQ or
  dynamics.
- Offline mode: All inference, decoding, and export happen on the local machine.
  No model download or user audio upload is required at runtime.
- Sidecar: A bundled helper runtime launched by the desktop app. For this
  project, the AI inference sidecar is expected to be Python + PyTorch.

## Product Constraints

- The app runs as a desktop app and is usable offline.
- The supported v0.1 platforms are Windows and macOS.
- macOS arm64 is the daily development baseline.
- Windows 11 x64 is the primary NVIDIA CUDA validation and acceleration target.
- Distribution is portable-first. Prefer self-contained app folders or app
  bundles over mandatory system installers.
- The macOS portable wrapper is a zip archive containing a self-contained
  `.app` bundle.
- Resemble Enhance is the single AI model family for v0.1.
- Runtime, Python environment, PyTorch dependencies, and model weights are
  bundled into the app distribution.
- FFmpeg must not be introduced.
- v0.1 supports WAV, MP3, and M4A input.
- v0.1 exports WAV only.
- Audio file decoding and WAV writing should be handled outside the Python model
  layer so the inference boundary remains clean.

## Product Boundaries For v0.1

- Full DAW editing.
- Multitrack podcast editing.
- Cloud processing.
- Real-time microphone enhancement.
- MP3 export.
- Video import.
- Music mastering.
- Support for every audio codec.

## Quality Bar

The app should optimize for spoken-word podcast quality, not mathematical signal
purity alone. The output should sound clearer, fuller, more stable, and more
publishable, while avoiding obvious watery artifacts, over-denoising, robotic
speech, and harsh high-frequency hallucination.

## Recommended Repo Layout

- `src-tauri/`: Tauri shell, Rust commands, file tasks, bundled resources.
- `src/`: TypeScript/React desktop UI.
- `sidecars/resemble/`: Minimal Python inference sidecar.
- `models/resemble-enhance/`: Bundled model weights in release artifacts.
- `packaging/`: Platform-specific runtime, model, release, and license notes.
- `src-tauri/resources/clearpodcast/`: Git-ignored staged resource layout for
  packaged runtime, sidecar, model, license notices, and artifact manifests.
- `crates/audio-io/`: Rust WAV/MP3/M4A decode and WAV encode code if split into
  a workspace crate.
- `docs/`: implementation docs, packaging docs, ADRs, and agent setup docs.
