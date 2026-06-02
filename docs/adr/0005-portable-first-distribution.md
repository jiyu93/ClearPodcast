# ADR 0005: Use Portable-First Distribution

## Status

Accepted.

## Context

ClearPodcast is an offline desktop speech restoration app with a large bundled
runtime: Python, PyTorch, Resemble Enhance inference code, and model weights.
The product should feel private, self-contained, and easy to try without asking
users to modify their system.

Traditional installers can be useful, but they add extra complexity around
system locations, privileges, registry entries, uninstallers, runtime bootstrap
steps, and update flows.

## Decision

Use portable-first distribution for the first product builds.

Windows should ship as a self-contained portable archive. After extraction, the
user should be able to run ClearPodcast without administrator privileges,
registry writes, or a system install.

macOS should ship as a self-contained `.app` bundle wrapped in a DMG or zip.
Users may drag it to Applications, but the app should not depend on a package
installer.

Do not make NSIS, MSI, or `.pkg` installers part of the first required release
surface.

## Consequences

Positive:

- Fits the offline and privacy-oriented product promise.
- Avoids requiring administrator privileges.
- Makes bundled Python, PyTorch, sidecar, and model paths easier to validate.
- Keeps Windows CPU and CUDA distributions explicit and separate.

Negative:

- Auto-update support is deferred.
- File associations and Start Menu shortcuts are deferred.
- Users must extract the Windows archive before running it.
- Portable archives may be large because all runtime files and model weights are
  included.

## Implementation Notes

- Windows archive layout should keep paths simple:
  - `ClearPodcast.exe`
  - `runtime/`
  - `sidecars/`
  - `models/`
  - `resources/`
  - `licenses/`
- Do not write mutable app data into signed or read-only application resources.
- Keep user settings, logs, and temporary processing files in a predictable
  writable location. A later decision should choose between OS user-data
  directories and an explicit portable data folder.
- If WebView2 provisioning becomes a real support issue on Windows, revisit
  whether an optional installer or fixed WebView2 runtime package is needed.
- Tauri's installer outputs can still be used for future distribution channels,
  but they are not the MVP default.
