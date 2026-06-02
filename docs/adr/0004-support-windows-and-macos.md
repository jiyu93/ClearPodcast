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

Build the first release artifacts as portable, self-contained packages:

- macOS arm64 CPU `.app`, wrapped in DMG or zip.
- Windows x64 CUDA-capable portable archive with CPU fallback, validated first
  on Windows 11.

Do not promise macOS MPS acceleration in the first product surface. MPS can be
explored after the CPU sidecar path is stable.

ADR 0007 amends the original Windows release split. Windows now has one
CUDA-capable portable artifact instead of separate CPU and CUDA archives.

## Consequences

Positive:

- The project can move quickly on the developer's normal macOS setup.
- Windows users get one archive that uses CUDA when available and CPU when it is
  not.
- The RTX 5070 Ti machine gives a concrete CUDA validation target.

Negative:

- Release work must handle separate Python and PyTorch environments per
  platform.
- CUDA validation cannot be completed from macOS alone.
- The Windows archive is larger than a CPU-only package because it bundles the
  CUDA-capable PyTorch runtime.

## Implementation Notes

- Keep all inference paths functional on CPU.
- Select the Windows CUDA PyTorch wheel at packaging time based on current
  support for the target NVIDIA GPU generation. As of June 3, 2026, prefer the
  CUDA 13.0 (`cu130`) wheel line after validating it on the RTX 5070 Ti.
- The Windows artifact should require an up-to-date NVIDIA driver for CUDA
  acceleration but should not require users to install the CUDA Toolkit.
- Validate Windows 11 first. Evaluate Windows 10 only after the Windows 11 path
  is stable.
- Add release notes and lockfiles per platform once the sidecar is introduced.
