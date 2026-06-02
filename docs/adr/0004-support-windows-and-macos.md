# ADR 0004: Support Windows And macOS First

## Status

Accepted.

## Context

ClearPodcast is a desktop app for offline speech restoration. The project needs
to support the platforms where independent podcasters are likely to work, while
also matching the available development and validation machines.

Daily development happens on macOS arm64. The available high-performance
validation machine is a Windows 11 x64 PC with an NVIDIA GeForce RTX 5070 Ti.

## Decision

Support Windows and macOS as the first product platforms.

Use macOS arm64 as the day-to-day development and CPU release baseline. Use
Windows 11 x64 as the primary compatibility and CUDA acceleration target.

Build three first release artifacts:

- macOS arm64 CPU `.app`, wrapped in DMG or zip.
- Windows x64 CPU portable archive, validated first on Windows 11.
- Windows x64 NVIDIA CUDA portable archive, validated first on Windows 11.

Do not promise macOS MPS acceleration in the first product surface. MPS can be
explored after the CPU sidecar path is stable.

## Consequences

Positive:

- The project can move quickly on the developer's normal macOS setup.
- Windows users get a CPU-compatible archive and a faster NVIDIA archive.
- The RTX 5070 Ti machine gives a concrete CUDA validation target.

Negative:

- Release work must handle separate Python and PyTorch environments per
  platform.
- CUDA artifact validation cannot be completed from macOS alone.
- Artifact size and dependency lockfiles may differ between CPU and CUDA
  variants.

## Implementation Notes

- Keep all inference paths functional on CPU.
- Select the Windows CUDA PyTorch wheel at packaging time based on current
  support for the target NVIDIA GPU generation.
- The Windows CUDA artifact should require an up-to-date NVIDIA driver but should
  not require users to install the CUDA Toolkit.
- Validate Windows 11 first. Evaluate Windows 10 only after the Windows 11 path
  is stable.
- Add release notes and lockfiles per platform once the sidecar is introduced.
