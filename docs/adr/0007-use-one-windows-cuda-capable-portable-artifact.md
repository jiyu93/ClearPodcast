# ADR 0007: Use One Windows CUDA-Capable Portable Artifact

## Status

Accepted.

## Context

ADR 0004 originally split the first Windows release surface into a CPU portable
archive and a separate NVIDIA CUDA portable archive. That keeps compatibility
and acceleration artifacts explicit, but it makes the product choice visible to
non-technical users before they know whether CUDA is available on their machine.

ClearPodcast's Windows goal is simpler from the user's point of view: extract
one folder, run the app, and let the local runtime use NVIDIA CUDA when it is
available. If CUDA is unavailable, disabled, or no NVIDIA GPU is present, the
same app should fall back to CPU processing.

The size tradeoff is acceptable for the first Windows validation target because
the product already bundles Python, PyTorch, Resemble Enhance, and model
weights for offline mode.

## Decision

Ship one Windows x64 portable archive for the first Windows release surface.

The Windows archive bundles a CUDA-capable PyTorch runtime and uses automatic
device selection by default:

```text
if torch.cuda.is_available():
  use CUDA
else:
  use CPU
```

The Windows runtime should use the latest stable PyTorch CUDA wheel that is
validated on the RTX 5070 Ti machine. As of June 3, 2026, the preferred Windows
CUDA wheel line is CUDA 13.0 (`cu130`) because the current PyTorch Windows
Python 3.12 wheel set provides CUDA 13.0 support for the active torch line and
it is the best fit for the target Blackwell-generation validation GPU.

Do not require users to install the CUDA Toolkit. CUDA acceleration requires a
compatible NVIDIA driver. CPU fallback should not require an NVIDIA GPU or CUDA
Toolkit; those users pay only the larger download and extracted artifact size.

## Consequences

Positive:

- Windows users do not need to choose between CPU and CUDA downloads.
- The product can present one obvious restore workflow.
- CUDA validation still happens on the RTX 5070 Ti machine.
- Non-CUDA Windows machines remain supported through CPU fallback.

Negative:

- The Windows archive is much larger than a CPU-only archive.
- Users without NVIDIA CUDA hardware download unused CUDA runtime files.
- The single artifact depends on the CUDA wheel importing cleanly and reporting
  CUDA unavailable instead of failing hard on non-CUDA machines.

## Implementation Notes

- The desktop workflow should send `device=auto` unless a developer override is
  intentionally added.
- The sidecar default device should be `auto`, not `cpu`.
- The sidecar should log the selected device, `torch.cuda.is_available()`,
  `torch.version.cuda`, and the first CUDA device name when available.
- The desktop job panel should show the actual selected device after each
  completed job, not merely the requested device mode.
- The Windows packaged runtime directory should be `runtimes/windows-x64/`.
- Milestone 5 verification must include:
  - CUDA smoke tests on the RTX 5070 Ti.
  - CPU fallback smoke tests with CUDA disabled.
  - A no-network smoke test after extracting the portable archive.
  - Confirmation that bundled runtime lookup does not use hidden
    repository-relative `localfiles/` paths.
