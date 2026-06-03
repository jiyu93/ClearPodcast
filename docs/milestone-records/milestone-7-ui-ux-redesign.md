# Milestone 7: UI/UX Redesign

Date: June 3, 2026

## Objective

Turn the proven ClearPodcast one-file restoration pipeline into a polished
desktop workspace for non-technical podcast creators, without changing the
backend command contract, packaged runtime lookup, cancellation behavior,
device detection, or WAV export semantics.

## Product Design Brief

User goal:

- Choose one damaged spoken-word recording.
- Confirm that ClearPodcast understands the file.
- Run one local restoration.
- Watch the current run without learning backend job terms.
- Compare original and enhanced audio.
- Export the enhanced WAV.
- Open diagnostics only when something needs technical inspection.

Primary workflow:

```text
Choose source -> confirm source -> restore -> monitor run -> compare -> export
```

Interaction level:

- Full production UI. The redesigned controls call the existing Tauri commands.
- Browser-only visual fixtures may be used for state QA, but the product surface
  remains the desktop workflow.

Supported desktop sizes:

- Primary desktop: 1280 x 800 and larger.
- Compact desktop: 960 x 720.
- Narrow fallback: down to 720 px width with stacked panels.

Visual direction:

- Cel-shaded-inspired productivity workspace.
- Crisp illustrated planes, confident ink outlines, layered color blocks, and
  waveform/status motifs.
- Restrained enough for repeated desktop work; no marketing hero or decorative
  landing page.

Non-goals:

- Batch processing, queues, job history, multi-file projects, presets, accounts,
  cloud workflows, website branding, and release artifact rebuilds.
- New model settings beyond the existing exact solver, CFM steps, prior
  temperature, and denoising controls.

## Comparable-Product Research Signal

Research source access was limited to public web pages and public help/marketing
material. Account-required product internals were not inspected.

- Adobe Podcast emphasizes a simple Enhance Speech entry point, browser-based
  use, and one-click spoken-audio cleanup. Its public copy also makes plan
  limits and upload/download constraints prominent.
  Sources: https://podcast.adobe.com/ and
  https://helpx.adobe.com/podcast/adobe-podcast-faq.html
- Descript Studio Sound frames the restoration action as one-click noise removal
  and voice enhancement for imperfect real-world recordings, including phone,
  Bluetooth, and conference-call sources.
  Source: https://www.descript.com/studio-sound
- Auphonic positions post-production as automated leveling, noise reduction, and
  loudness work, with stronger attention to technical production controls.
  Source: https://auphonic.com/
- Podcastle and adjacent podcast cleanup tools usually lead with upload,
  cleanup, and download, but public pages often mix restoration with editing,
  transcription, video, or team workflows.
  Source: https://podcastle.ai/

Research implications for ClearPodcast:

- The first screen should be the actual workspace, not a marketing explanation.
- The import, restore, compare, and export path should be visibly linear.
- Processing time needs honest state language because offline CPU work can be
  slow.
- Diagnostics should stay available but should not compete with the core action.
- ClearPodcast should lean into its differentiator: local/offline one-file
  restoration with no upload.

## Current Experience Audit

Implementation artifacts before M7:

- `src/App.tsx` owned product state, Tauri command calls, drag/drop handling,
  error mapping, status language, diagnostics, advanced settings, playback, and
  presentation components in one file.
- `src/styles.css` owned all global, layout, panel, control, diagnostics, and
  responsive styles in one file.
- The UI was functional and product-language aligned after M6, but the panel
  order still reflected MVP assembly: import/status/playback/diagnostics.

Findings:

- Import worked, but source understanding was a secondary metadata grid rather
  than the first confirmation step in the journey.
- The backend `queued` state was still visually present as a job phase; the user
  concept should be preparation for the active restoration.
- Restore and cancel controls were inside the import panel, even though they
  belong to the current run.
- Export lived in the status panel, while comparison lived below it. The natural
  user moment is compare first, export second.
- Advanced settings were present and exact, but visually close to the import
  step. They should remain secondary model controls.
- Diagnostics were correctly secondary, and the redesign needed to express them
  as a maintenance drawer with lower visual priority than the main workflow.
- Empty, failed, cancelled, completed, and exported states had correct text but
  lacked a cohesive visual motif.
- The visual system was serviceable but neutral: white panels, green action
  color, simple status chips, and no distinct product mark beyond the app icon.

## Information Architecture

The redesigned surface is organized around the root journey:

1. Source: choose or drop one file, see accepted formats, confirm metadata.
2. Current Run: understand preparation/running/done/error/cancelled states,
   launch or cancel restoration, and see processing-device status.
3. Compare And Export: listen to original and enhanced audio, then export WAV.
4. Model Settings: exact Resemble Enhance controls in a secondary surface.
5. Diagnostics: runtime overrides and raw backend details in a secondary surface.

Capability model:

- One source file.
- One active restoration.
- One enhanced preview.
- One WAV export action after completion.
- No visible queue, batch, history, projects, accounts, or cloud state.

## Direction Exploration

Direction A: Restoration Desk

- Three-column desktop workbench: Source, Current Run, Compare And Export.
- Cel-shaded paper planes, ink borders, waveform cards, and clear action zones.
- Best fit for the current product because the journey is obvious and does not
  imply future batch or project features.

Direction B: Signal Console

- Dense technical console with waveform meters, device telemetry, and status
  rails.
- Strong for power users but too close to diagnostics and audio engineering.
- Risk: makes a non-technical creator feel they need to understand the model.

Direction C: Studio Strip

- Horizontal flow like a lightweight audio editor: import lane, process lane,
  compare lane.
- Attractive for wide monitors, but less robust at compact desktop widths and
  risks implying timeline editing.

Selected direction:

- Direction A, Restoration Desk.
- It best preserves the one-file workflow, keeps diagnostics secondary, and gives
  the cel-shaded visual direction room through flat panels, bold outlines,
  source/enhanced waveform motifs, and a clearer product mark.

## State Matrix

| State | User concept | Primary action | Secondary action | Surface behavior |
| --- | --- | --- | --- | --- |
| Empty | No source chosen | Choose audio | Inspect diagnostics | Source panel shows empty artwork and accepted formats; run/export are disabled. |
| Selected | Source is valid | Restore speech | Change source or adjust model settings | Metadata is visible; original playback is available when the preview copy exists. |
| Preparing | Active restoration is preparing | Cancel | Inspect diagnostics | Backend `queued` is shown as preparation, not a queue. |
| Running | Local restoration is processing | Cancel | Inspect device details | Current Run panel highlights local processing and honest wait time. |
| Cancelled | Restoration stopped | Restore again | Change source | No enhanced preview is presented as successful output. |
| Failed | Restoration needs attention | Restore again after fixing issue | Open diagnostics | Product summary appears in the run panel; raw detail stays in diagnostics. |
| Completed | Enhanced preview is ready | Export WAV | Compare playback | Enhanced player and output metadata are visible. |
| Exported | WAV has been saved | Export again | Compare playback | Export confirmation appears near the export action and diagnostics records the path. |
| Advanced Open | Model controls visible | Reset defaults | Adjust exact parameters | Solver, CFM steps, prior temperature, and denoising remain exact and locked while active. |
| Diagnostics Open | Technical details visible | Edit overrides when needed | Copy/read raw paths manually | Overrides, job id, preview/export paths, and backend/device detail are grouped away from the main journey. |

## Visual System

Product mark:

- A rounded square badge with ink outline, warm yellow restoration field, teal
  speech capsule, and contrasting before/after wave paths.
- The mark is used in the app header, SVG source, and regenerated Tauri icon
  raster assets.

In-app motifs:

- Source artwork uses a split before/after waveform: rough input on one side,
  clear restored output on the other.
- Status chips use shape and copy, not color alone.
- Current-run states use preparation, restoring, restored, cancelled, and needs
  attention language.

Palette:

- Ink: `#14211f`
- Paper: `#fff8ec`
- Workbench: `#f3ead9`
- Teal: `#0f7664`
- Mint: `#a7e7c3`
- Gold: `#f4bf45`
- Coral: `#ef6b57`
- Sky: `#81c7e8`
- Slate: `#42534f`

## Implementation Summary

- Split frontend state, types, command integration, and presentation into
  focused modules under `src/`.
- Rebuilt the first screen as a three-panel Restoration Desk workspace:
  Source, Current Run, and Compare And Export.
- Moved exact model controls into a secondary Model Settings drawer while
  preserving defaults and request passthrough.
- Kept Diagnostics secondary with runtime/model overrides and raw details.
- Added browser visual fixtures for state QA in non-Tauri preview URLs:
  `?fixture=empty`, `selected`, `running`, `cancelled`, `failed`,
  `completed`, `exported`, `advanced`, and `diagnostics`.
- Updated the product mark and regenerated Tauri icon assets from the new SVG.

## Verification

- `npm run check`
- `npm run build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `git diff --check`
- Browser visual QA for empty, selected, running, cancelled, failed, completed,
  exported, advanced-settings, and diagnostics fixture states at supported
  desktop sizes. The M7 visual QA evidence used Browser DOM/layout inspection:
  no horizontal viewport overflow, no key text-container overflow, expected
  audio-control counts, and expected enabled actions across the fixture states.

## Deferred Items

- Real macOS and Windows Tauri GUI smoke with native file dialogs, drag/drop,
  audio playback, cancellation, and export remains the next practical manual
  acceptance pass.
- Release artifact rebuilds remain owned by the release workflow.
