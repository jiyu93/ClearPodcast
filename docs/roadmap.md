# ClearPodcast Roadmap

This document describes the broad product phases after the MVP. It should stay
short and directional. Use `docs/implementation-plan.md` for executable
milestone scope, exit criteria, and verification.

## Current State

ClearPodcast has completed its MVP and portable packaging foundation:

- Offline one-file speech restoration works through the desktop app.
- WAV, MP3, and M4A inputs are supported.
- Export is WAV.
- macOS arm64 CPU packaging is available as a portable app zip.
- Windows x64 packaging is available as one CUDA-capable portable zip with CPU
  fallback.

The next work is about turning the proven pipeline into a more coherent
product.

## Active Productization

The active post-MVP phase is productization:

- Align the user-facing app, documentation, commands, and diagnostics with the
  current product shape.
- Redesign the UI/UX around the normal restoration workflow.
- Keep exact model controls available while moving developer-only controls out
  of the primary path.

These items are tracked as Milestone 6, Residual Cleanup, and Milestone 7,
UI/UX Redesign, in `docs/implementation-plan.md`.

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
- `docs/milestone-records/`: historical records for completed milestones.
- `docs/release-workflow.md`: release build and verification entry point.
- `docs/adr/`: accepted decisions and tradeoffs.
