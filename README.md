# ClearPodcast

English | [简体中文](README.zh-CN.md)

ClearPodcast is an offline desktop app for restoring damaged spoken-word podcast
recordings from Bluetooth headsets, meeting apps, remote calls, phone recordings,
and ordinary computer microphones.

## Features

- Restores one WAV, MP3, or M4A spoken-word recording at a time.
- Runs Resemble Enhance locally through a bundled Python + PyTorch sidecar.
- Keeps audio decoding and final WAV writing in Rust.
- Shows source metadata, current run state, before/after playback, export, model
  settings, and local diagnostics in the desktop app.
- Exports standard WAV only.
- Runs offline from self-contained release artifacts after extraction.

## Platform And Format Support

| Area | Current support |
| --- | --- |
| Desktop platforms | macOS and Windows |
| Development baseline | macOS arm64 |
| Windows acceleration target | Windows 11 x64 with NVIDIA CUDA and CPU fallback |
| Input formats | WAV, MP3, M4A |
| Export format | WAV |
| Distribution | Portable-first archives |

macOS packaging produces a zip containing a self-contained `ClearPodcast.app`.
Windows packaging produces one x64 portable zip that uses CUDA automatically when
available and falls back to CPU otherwise.

## Quick Start From Source

Install the JavaScript dependencies:

```sh
npm install
```

Bootstrap a local macOS CPU runtime when developing or smoke-testing on macOS:

```sh
PYTHON_BIN=/path/to/python3.12 scripts/bootstrap-macos-cpu-runtime.sh
```

Model weights and local runtimes are private local inputs under `localfiles/`;
they are not committed to the repository. See [Development](docs/development.md)
for local runtime setup, model layout, smoke commands, Windows notes, and visual
fixtures.

Start the desktop app in Tauri dev mode:

```sh
npm run tauri dev
```

Run the normal source checks:

```sh
npm run check
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

Release packaging is intentionally separate from ordinary development. Use the
[release workflow](docs/release-workflow.md) only when building a portable
artifact.

## Repository Map

- `src/`: React + TypeScript desktop UI.
- `src-tauri/`: Tauri shell, Rust commands, job management, audio I/O, app logs,
  and packaging resource lookup.
- `sidecars/resemble/`: ClearPodcast-owned Resemble Enhance inference sidecar.
- `packaging/`: artifact manifests, license notice generation, and release
  packaging metadata.
- `scripts/`: development, verification, staging, and portable packaging
  scripts.
- `docs/`: roadmap, implementation plan, release workflow, ADRs, development
  notes, and milestone records.
- `localfiles/`: private samples, runtimes, model weights, experiments, release
  zips, extracted artifacts, and generated smoke outputs.

## Documentation

- [Domain context](CONTEXT.md): product problem, users, language, constraints,
  non-goals, and quality bar.
- [Roadmap](docs/roadmap.md): product phase map and future themes.
- [Implementation plan](docs/implementation-plan.md): executable milestone
  scope, architecture, and verification expectations.
- [Development](docs/development.md): local setup, smoke testing, fixtures, and
  generated-file hygiene.
- [Release workflow](docs/release-workflow.md): macOS and Windows portable
  release commands and verification.
- [Architecture decisions](docs/adr/): accepted technical and product tradeoffs.
- [Milestone records](docs/milestone-records/): records for completed
  milestones.

## Issues And Contributions

Issues and PRDs are tracked in this repository's GitHub Issues.

Keep user-facing product changes, packaging changes, architecture decisions, and
release workflow changes reflected in the relevant docs when they change the
current project shape.

## License

ClearPodcast is licensed under the [Apache License 2.0](LICENSE). Project
attribution notices are in [NOTICE](NOTICE), and third-party dependency and
runtime notices are packaged separately under `packaging/licenses/`.
