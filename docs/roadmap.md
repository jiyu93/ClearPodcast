# ClearPodcast Roadmap

This document describes the product phase after the completed v0.1 baseline. It
stays short and directional. Use `docs/implementation-plan.md` when a future
theme becomes an executable milestone with scope, exit criteria, and
verification.

## Current State

ClearPodcast v0.1 is the current release baseline:

- Offline one-file speech restoration works through the desktop app.
- WAV, MP3, and M4A inputs are supported.
- Export is WAV.
- macOS arm64 CPU packaging is available as a portable app zip.
- Windows x64 packaging is available as one CUDA-capable portable zip with CPU
  fallback.
- Product language, diagnostics, compatibility smoke entry points, original
  preview-copy playback, and generated-resource hygiene are aligned with the
  current app shape.
- The primary desktop surface is now a redesigned Restoration Desk workspace
  for source selection, current-run restoration, before/after comparison, WAV
  export, secondary exact model parameters, and secondary diagnostics.
- The frontend is split into focused state, backend command, presentation, and
  styling modules.
- Native Tauri GUI acceptance for the redesigned workflow is complete.

## Active Productization

The active productization phase starts from the v0.1 release baseline:

- A one-file, one-active-restoration desktop workflow.
- A cel-shaded-inspired Restoration Desk visual system with aligned product
  mark, app icon assets, in-app iconography, empty-state artwork, and
  audio/status motifs.
- Exact Resemble Enhance parameters preserved in secondary Model Parameters.
- Diagnostics and developer overrides preserved as secondary surfaces.
- Browser visual fixtures for state QA of the redesigned surface.

Milestone 7, UI/UX Redesign, is complete and accepted. The next executable
productization work becomes implementation scope when it is written as a new
milestone, issue, PRD, or ADR.

## Future Themes

These themes are intentionally broad. They should become concrete only when a
new milestone, issue, PRD, or ADR needs them.

- Audio quality exploration: investigate automatic preprocessing,
  post-processing, mastering, blending, or other processing layers that may
  improve practical listening results.
- Quality evaluation: define how subjective listening checks, fixtures, notes,
  and regression evidence should support audio decisions.
- Release operations: distribution, signing, platform messaging, packaging
  verification, checksums, and user-facing release materials.
- Product expansion: consider workflow additions only after the one-file
  restoration path feels solid.

## Document Roles

- `CONTEXT.md`: v0.1 release baseline, product problem, domain language,
  constraints, product boundaries, and quality bar.
- `docs/roadmap.md`: broad phase map and future themes.
- `docs/implementation-plan.md`: completed v0.1 milestone baseline and future
  executable milestone plan.
- `docs/development.md`: local setup, smoke testing, fixtures, and generated
  resource hygiene.
- `docs/milestone-records/`: historical records for completed milestones.
- `docs/release-workflow.md`: release build and verification entry point.
- `docs/adr/`: accepted decisions and tradeoffs.
