## Agent skills

### Issue tracker

Issues and PRDs are tracked in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

The repo uses the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo with `CONTEXT.md` at the root and ADRs in `docs/adr/`. See `docs/agents/domain.md`.

### Documentation hygiene

During development, actively judge whether each meaningful code, architecture, packaging, or product-scope change should update the project docs. Keep `README.md`, `CONTEXT.md`, `docs/implementation-plan.md`, ADRs, and `docs/agents/` aligned with the current state of the project.

### Release workflow

For routine release requests such as "build a new release", "make a macOS zip",
"package the current app", or "create a portable artifact", use
`docs/release-workflow.md`. Release commands are CPU- and time-intensive; do not run them
during ordinary development, UI iteration, test, or review work unless the user
explicitly asks for a release artifact. Do not require the user to mention the
historical implementation milestone.

### Goal-mode development

When working in Codex goal mode, use `docs/implementation-plan.md` as the
milestone source of truth. Treat one milestone as one goal, follow its scope and
out-of-scope boundaries, and only mark the goal complete when its exit criteria
and verification expectations are satisfied or explicitly documented as
deferred.

### Local files

Use `localfiles/` for private samples, model weights, runtime experiments, and
generated outputs. Do not commit files from `localfiles/`.
