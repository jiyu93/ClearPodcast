# ADR 0001: Use Resemble Enhance As The Only First AI Model

## Status

Accepted.

## Context

ClearPodcast targets already-damaged spoken-word recordings from Bluetooth
headsets, meeting software, remote calls, phones, and laptop microphones. The
main product risk is not generic noise suppression. The risk is whether the app
can make compressed, thin, artifacted human speech sound publishable.

The project needs one model route for the first implementation so engineering can
focus on packaging, local execution, and user workflow.

## Decision

Use Resemble Enhance as the only AI model family for the first implementation.

Do not build a multi-model comparison framework into the MVP. Do not include
DeepFilterNet, ClearerVoice, Sidon, NVIDIA Maxine, or AudioSR in the first
implementation.

## Consequences

Positive:

- The model choice is aligned with speech restoration rather than simple
  denoising.
- Engineering can focus on offline packaging and a stable desktop pipeline.
- The product has one clear inference boundary.

Negative:

- Release artifacts will be large because Python, PyTorch, and model weights must be
  bundled.
- CPU processing may be slow.
- Model improvements depend on the Resemble Enhance path unless the ADR is
  revisited.

## Implementation Notes

- Use a repository-owned minimal Python sidecar rather than the upstream CLI.
- Load model weights from a bundled local path.
- Disable runtime downloads.
- Strip demo and training dependencies from the packaged environment.
