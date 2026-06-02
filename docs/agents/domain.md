# Domain Docs

How the engineering skills should consume this repo's domain documentation when
exploring the codebase.

## Layout

This is a single-context repo.

Read these files before planning or editing code:

- `CONTEXT.md` at the repo root.
- Relevant ADRs under `docs/adr/`.
- `docs/implementation-plan.md` when working on initial product scaffolding,
  packaging, audio I/O, or sidecar integration.

If one of these files is missing, proceed silently. Do not suggest creating it
upfront unless the user's task specifically asks for documentation work.

## Use The Project Vocabulary

When an output names a domain concept, use the terms from `CONTEXT.md`.

Important project terms include:

- Bad recording.
- Speech restoration.
- Podcast mastering.
- Offline mode.
- Sidecar.

Avoid drifting into generic terms like "noise remover" when the intended product
concept is broader speech restoration.

## Respect ADRs

If a proposed change contradicts an ADR under `docs/adr/`, surface that
explicitly before implementing.

Current accepted decisions:

- Resemble Enhance is the only first AI model.
- FFmpeg is excluded; first release supports WAV/MP3/M4A input and WAV output.
- AI inference runs through a bundled Python sidecar.
- Windows and macOS are the first supported platforms; Windows 11 x64 is the
  primary NVIDIA CUDA validation target.
- Distribution is portable-first; installers are optional future artifacts, not
  the default first release surface.

Goal-mode work:

- Use the `Goal-Mode Milestones` section in `docs/implementation-plan.md` as the
  execution plan.
- Treat each milestone as one Codex goal with its own scope, exit criteria, and
  verification evidence.
- Do not expand a goal with later-milestone work unless the milestone explicitly
  depends on it.
