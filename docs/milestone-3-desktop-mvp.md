# Milestone 3 Desktop MVP

Milestone 3 turns the Milestone 2 audio contract into a one-file desktop
workflow:

```text
Choose or drop WAV/MP3/M4A
-> Rust probe metadata
-> review enhancement settings
-> start a cancellable enhancement job
-> preview original and enhanced audio
-> export enhanced WAV
```

## Desktop Workflow

The React app in `src/App.tsx` now presents the first usable desktop surface:

- Native audio file picker for WAV, MP3, and M4A.
- Tauri file drag/drop for supported audio files.
- Source metadata display from `probe_audio_command`.
- One clear restore action for supported one-file spoken-word input.
- Collapsed advanced settings for official-demo-aligned Resemble Enhance
  solver, CFM steps, prior temperature, and denoising strength.
- Job state display for queued, running, completed, failed, and cancelled.
- Honest indeterminate processing state while Resemble Enhance runs.
- Before/after playback with local asset URLs.
- Export flow that asks for a WAV destination only after a job completes.

The runtime and model path fields remain visible as optional developer
overrides. After Milestone 4, leaving them blank uses packaged resource lookup;
local `localfiles/` paths can still be entered for smoke testing.

## Job Manager

The Tauri backend now exposes a job-managed workflow in `src-tauri/src/jobs.rs`:

- `start_enhancement_job_command`
- `get_enhancement_job_command`
- `cancel_enhancement_job_command`
- `export_enhanced_wav_command`

The older direct commands remain available:

- `probe_audio_command`
- `enhance_audio_command`
- `enhance_wav_command`

Each desktop job writes its completed preview WAV into an app-managed temporary
directory under the system temp folder. Export copies that completed preview WAV
to the user-selected `.wav` destination. Failed and cancelled jobs clear their
preview path and remove their job temp directory, so cancellation cannot look
like a successful partial export.

## Cancellation

`src-tauri/src/runtime.rs` now supports a cancellation token. When cancellation
is requested, the token marks the job as cancelled and kills the running Python
sidecar process if it has already been launched. The runtime checks the token
between decode, handoff, sidecar, final decode, and final write stages.

The temporary sidecar handoff directory from Milestone 2 is still owned by Rust
and is cleaned by normal `tempfile` lifetime behavior after success, failure, or
cancellation.

The cancellable sidecar path preserves stdout and stderr for diagnostics, but it
decodes captured logs lossily so Windows console progress output cannot make a
successful enhancement job fail only because a log stream contains non-UTF-8
bytes.

## Source Scenarios

Bluetooth headset, meeting software, phone recording, remote-call, and laptop
microphone recordings remain the product's target source examples. The desktop
workflow turns those real-world inputs into a single restore path: import,
enhance, compare, and export.

## Enhancement Settings

The desktop UI exposes Resemble Enhance model parameters in a collapsed advanced
settings panel for the single restore path:

- Solver selection: `midpoint` by default, with `rk4` and `euler` available.
- CFM steps slider: 1 to 128, default 64.
- Prior temperature slider: 0.00 to 1.00, default 0.50.
- Denoising strength slider: 0.00 to 1.00, default 0.10.
- Reset defaults action for returning the panel to the public demo defaults.
- Short hover and inline explanations for each adjustable value, plus separate
  explanations for the three solver choices.

The defaults match the public Resemble Enhance demo's initial enhancement path:
Midpoint solver, 64 CFM evaluations, 0.50 prior temperature, and denoising off,
which maps to `lambd=0.1` for enhancement.

## Local Preview Access

The Tauri asset protocol is enabled so the webview can play selected source
files and completed temporary WAV previews through normal `<audio>` controls.
The current scope allows files under `$HOME/**` and `$TEMP/**`, matching user
audio selection plus temporary enhanced previews.

## Verification Notes

As of June 2, 2026:

- TypeScript check passes:

```sh
npm run check
```

- Frontend production build passes:

```sh
npm run build
```

- macOS app bundle build passes:

```sh
npm run tauri build -- --bundles app
```

- Rust tests pass:

```sh
cargo test --manifest-path src-tauri/Cargo.toml
```

- Rust tests include job manager coverage for:
  - Completed fake-sidecar job export.
  - Cancellation of a running fake-sidecar job.
  - No preview WAV after cancellation.
  - WAV-only export destination enforcement.
- Existing audio contract tests still cover WAV/MP3/M4A decode, sidecar handoff,
  final WAV writing, and temp cleanup.
- Browser visual verification of the Vite app at `http://127.0.0.1:5173/`
  showed no horizontal overflow at a 767 px wide viewport.
- Full local model smoke checks pass with:
  - `localfiles/samples/low_quality_voice_sample_1.wav`
  - `localfiles/samples/low_quality_voice_sample_1.mp3`
  - `localfiles/samples/low_quality_voice_sample_1.m4a`
- The Milestone 3 smoke outputs were written to `localfiles/outputs/` as
  `low_quality_voice_sample_1.m3.wav.enhanced.wav`,
  `low_quality_voice_sample_1.m3.mp3.enhanced.wav`, and
  `low_quality_voice_sample_1.m3.m4a.enhanced.wav`.
- All three smoke outputs are 44.1 kHz mono WAV files.
- The default Tauri bundle target is currently `app`. A DMG wrapper attempt
  reached the generated `.app` but timed out in Finder AppleScript with
  AppleEvent `-1712`; Milestone 4 should either make DMG creation reliable in
  the local macOS build environment or choose zip as the first macOS wrapper.

As of June 3, 2026, Windows 11 x64 local CPU validation on the Windows
development machine also passes:

- `npm run check`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run tauri build`
- Full local model smoke checks pass with the short fixture in WAV, MP3, and
  M4A form using `localfiles/runtime/windows-x64/Scripts/python.exe`.
- The Windows smoke outputs were written to `localfiles/outputs/` as
  `low_quality_voice_sample_1.windows.wav.enhanced.wav`,
  `low_quality_voice_sample_1.windows.mp3.enhanced.wav`, and
  `low_quality_voice_sample_1.windows.m4a.enhanced.wav`.
- The first Windows run exposed two portability issues that are now fixed:
  Resemble Enhance model hparams saved with `pathlib.PosixPath` YAML tags now
  load on Windows, and cancellable desktop jobs tolerate non-UTF-8 sidecar log
  bytes from Windows console progress output.

Milestone 3 has no deferred exit criteria.

## Notes For Milestone 4

Milestone 4 should keep the job-manager command surface and UI workflow intact
while replacing development-only runtime/model defaults with packaged resource
lookup. Packaging work should also review whether the current asset protocol
scope should remain broad for arbitrary user-selected audio or be paired with a
narrower allowlist strategy after file selection. The first packaging task
should also resolve the DMG wrapper timeout or intentionally use a zip wrapper
for the macOS arm64 CPU artifact. Windows CPU and CUDA artifacts are now a
separate Milestone 5 handoff for the Windows validation machine.
