# ClearPodcast Roadmap

This document describes the broad product phases after the MVP. It should stay
short and directional. Use `docs/implementation-plan.md` for executable
milestone scope, exit criteria, and verification.

## Current State

ClearPodcast has completed its MVP, portable packaging foundation, residual
cleanup pass, and first design-led UI/UX redesign:

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
  export, secondary exact model tuning, and secondary diagnostics.
- The frontend is split into focused state, backend command, presentation, and
  styling modules.

## Active Productization

The active post-MVP phase is productization. The current product baseline is:

- A one-file, one-active-restoration desktop workflow.
- A cel-shaded-inspired Restoration Desk visual system with aligned product
  mark, app icon assets, in-app iconography, empty-state artwork, and
  audio/status motifs.
- Exact Resemble Enhance controls preserved in secondary Model Tuning.
- Diagnostics and developer overrides preserved as secondary surfaces.
- Browser visual fixtures for state QA of the redesigned surface.

Milestone 7, UI/UX Redesign, is complete. The next executable productization
work should be written as a new milestone, issue, PRD, or ADR before it becomes
implementation scope.

## Future Themes

These themes are intentionally broad. They should become concrete only when a
new milestone, issue, PRD, or ADR needs them.

- Audio quality exploration: investigate automatic preprocessing,
  post-processing, mastering, blending, or other processing layers that may
  improve practical listening results.
- Quality evaluation: define how subjective listening checks, fixtures, notes,
  and regression evidence should support audio decisions.
- Release readiness: harden distribution, signing, platform messaging,
  packaging verification, and user-facing release materials.
- Product expansion: consider workflow additions only after the one-file
  restoration path feels solid.

## Document Roles

- `CONTEXT.md`: product problem, domain language, constraints, and non-goals.
- `docs/roadmap.md`: broad phase map and future themes.
- `docs/implementation-plan.md`: concrete milestone execution plan.
- `docs/development.md`: local setup, smoke testing, fixtures, and generated
  resource hygiene.
- `docs/milestone-records/`: historical records for completed milestones.
- `docs/release-workflow.md`: release build and verification entry point.
- `docs/adr/`: accepted decisions and tradeoffs.
