# ADR 0003: Bundle A Python Sidecar For AI Inference

## Status

Accepted.

## Context

Resemble Enhance is a Python + PyTorch project. Rewriting the model runtime in
Rust or converting the model before the first product build would add risk and
delay. The project still needs a desktop-native shell and clean offline release
artifacts.

## Decision

Use Tauri for the desktop app and bundle a minimal Python sidecar for Resemble
Enhance inference.

The sidecar is a product-owned command-line program launched by the Rust layer.
It should not expose a server by default and should not require network access.

## Consequences

Positive:

- Fastest path to using the selected model reliably.
- Clear separation between desktop app responsibilities and model inference.
- Easier to package CPU and CUDA variants.

Negative:

- Larger release artifacts.
- More complex packaging than a pure Rust app.
- Need robust sidecar process management and error reporting.

## Implementation Notes

- Package Python runtime and dependencies with the app.
- Maintain a minimal lockfile or manifest for the Python inference environment.
- Pass explicit input/output/model paths to the sidecar.
- Sidecar output should be structured enough for progress, errors, and logs.
