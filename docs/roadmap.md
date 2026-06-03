# ClearPodcast Roadmap

This document describes the broad product phases after the MVP. It should stay
short and directional. Use `docs/implementation-plan.md` for executable
milestone scope, exit criteria, and verification.

## Current State

ClearPodcast has completed its MVP, portable packaging foundation, and first
post-MVP residual cleanup pass:

- Offline one-file speech restoration works through the desktop app.
- WAV, MP3, and M4A inputs are supported.
- Export is WAV.
- macOS arm64 CPU packaging is available as a portable app zip.
- Windows x64 packaging is available as one CUDA-capable portable zip with CPU
  fallback.
- Product language, diagnostics, compatibility smoke entry points, original
  preview-copy playback, and generated-resource hygiene are aligned with the
  current app shape.

The next work is the Milestone 7 UI/UX redesign around the proven restoration
pipeline, using a design brief, current-experience audit, selected visual
direction, frontend modularization, and visual/interaction QA as the execution
path.

## Active Productization

The active post-MVP phase is productization:

- Redesign the UI/UX around the normal restoration workflow.
- Use the proven MVP behavior as a functional reference while establishing an
  independent visual foundation.
- Ground the redesign in a concise product-design brief, comparable-workflow
  research where useful, a current-experience audit, and one selected visual
  direction before implementation.
- Build layout and product surfaces from the root one-file restoration need and
  the current user-visible capability model.
- Focus the product surface on one source file and one active restoration.
  Queues, batch processing, job history, projects, accounts, and cloud sync
  remain future milestone topics.
- Use a cel-shaded-inspired visual direction as the default aesthetic target
  while keeping the app ergonomic as a focused desktop restoration workspace.
- Redesign the product mark, app icon, in-app iconography, and visual motifs as
  part of the application-level visual system.
- Keep exact model controls and the secondary Diagnostics surface available
  while improving the primary workspace.

Milestone 6, Residual Cleanup, is complete. Milestone 7, UI/UX Redesign, is the
next executable productization milestone in `docs/implementation-plan.md`.

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
