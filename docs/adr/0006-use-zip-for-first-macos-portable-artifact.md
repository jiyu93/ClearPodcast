# ADR 0006: Use Zip For The First macOS Portable Artifact

## Status

Accepted.

## Context

ClearPodcast is portable-first. On macOS, the first release artifact needs to
ship a self-contained `.app` bundle containing the Tauri binary, Python runtime,
Resemble Enhance sidecar, model files, resources, and license notices.

Milestone 3 proved that `npm run tauri build -- --bundles app` can produce the
`.app` bundle. A DMG wrapper attempt reached the generated `.app` but timed out
inside Finder AppleScript with AppleEvent `-1712`.

## Decision

Use a zip archive containing `ClearPodcast.app` as the first macOS portable
wrapper.

Keep the Tauri bundle target at `app` for the working `.app` path. The packaging
script stages resources, builds the `.app`, then uses macOS `ditto` to create a
zip archive with the `.app` as the archive root.

## Consequences

- The first macOS artifact avoids Finder AppleScript automation.
- The artifact remains portable and self-contained after extraction.
- Users can run the `.app` from the extracted folder or move it manually.
- DMG can be revisited later if it solves a concrete distribution or user
  experience problem.
- Code signing, notarization, and Gatekeeper messaging remain outside the first
  local portable packaging milestone.
