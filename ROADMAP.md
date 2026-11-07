# TROZAL MOTION — Product & Engineering Roadmap

This roadmap records the staged development plan for TROZAL MOTION. Work is incremental and must preserve the existing HTML/SVG import path and the 4K, MP4/H.264, QuickTime MOV ProRes 4444 + Alpha, and PNG Sequence ZIP export paths.

## Compatibility guardrails

- Do not replace or bypass the existing frame renderer or FFmpeg.wasm export pipeline without a separately reviewed migration.
- Keep the current 4K UHD output path and the tested MP4, ProRes 4444 alpha, and PNG sequence workflows.
- Treat preview resolution and export resolution as separate settings.
- Preserve alpha from transparent source canvas through PNG frames and the ProRes 4444 `yuva444p10le` encode path.
- Save new editor state backward-compatibly in project JSON; missing fields in older projects must receive safe defaults.
- Every new render-affecting feature must be applied both in preview and in the frame renderer before it is considered complete.
- Test small projects first, then 1080p, 4K, longer durations, and alpha export. Never infer export compatibility from a successful UI build alone.

## Phase 1 — Multi-Track Timeline Editor

**Status: Initial implementation committed.**

Implemented in the first increment:
- Timeline rows for separated SVG layers.
- Drag a clip to move its start/end window.
- Trim the start and end handles.
- Toggle layer visibility from the timeline.
- Lock/unlock a clip against timeline dragging.
- Select a track and retain the existing per-layer animation/keyframe controls.
- Add, rename, jump to, and delete timeline markers.
- Store timeline markers and track locks in the project JSON.
- Show an honest single-composition track for unsplit SVG/HTML content. Per-element HTML DOM track extraction remains a later capability.

Acceptance checks:
- Moving and trimming a split-SVG clip updates the existing per-layer start/end controls.
- Visibility toggles affect preview and exported frames.
- Markers survive project save/reopen.
- Existing layer solo, keyframes, HTML import, autosave and export paths continue to work.

## Phase 2 — Keyframe & Graph Editor

Planned:
- Unified keyframe lanes for position X/Y, scale, rotation, opacity and supported effect parameters.
- Auto-keyframe mode that inserts/updates a key when an animated property changes at the playhead.
- Per-keyframe interpolation: Hold, Linear, Ease In, Ease Out, Easy Ease, and editable cubic Bezier.
- Graph Editor with value/speed curves, tangent handles and numeric easing controls.
- Motion-path overlay with draggable position points.
- Frame-accurate stepping and snap-to-marker/keyframe.

Acceptance checks:
- Preview and exported frames evaluate the same keyframe interpolation function.
- Existing project keyframes migrate without changing their current smooth interpolation.
- Graph edits are undoable and are persisted in project JSON.

## Phase 3 — Text Animation Studio

Planned:
- Native text layers with editable content, font family, weight, size, alignment, tracking, leading and fill/stroke.
- Per-character, per-word and per-line reveal.
- Typewriter, kinetic typography, tracking reveal, text scramble, 3D-style flip and title-card presets.
- Lower-third builder with name, role, logo/label and entrance/exit timing.
- Text-on-path and safe-area guides where the browser renderer supports them.
- Use local/system fonts by default; make font dependencies visible before export.

Acceptance checks:
- Text remains editable after project save/reopen.
- Preview and export render text with consistent layout and timing.
- Missing fonts are reported before render rather than silently substituted without notice.

## Phase 4 — Mask, Shape & Path Animation

Planned:
- Shape layers: rectangle, ellipse, polygon, free path and editable bezier path.
- Mask modes: Add, Subtract, Intersect and Difference.
- Alpha Matte and Luma Matte where supported by the renderer.
- Feather, expansion and animated mask/path points.
- Shape morphing with normalized path points and compatible path topology checks.
- Trim Paths / Stroke Reveal for supported SVG path geometry.
- Explicit capability warnings for unsupported filters or blend/matte combinations.

Acceptance checks:
- Masks and path animation are deterministic at arbitrary playhead times.
- Alpha is preserved in PNG and ProRes output.
- Unsupported geometry is reported and never silently exported as a different result.

## Phase 5 — Smart Render & Memory Manager

Planned:
- Render preflight estimating frame count, pixel-frames, canvas memory and likely browser limits.
- Preview proxies at 1/2 and 1/4 resolution without changing export resolution.
- Chunked frame preparation and memory release between batches.
- Frame cache keyed by source, settings and time; invalidate only affected frames.
- Recovery checkpoints and resume-from-frame for supported local render jobs.
- Render queue with per-job progress, cancel/retry and clear failure reasons.
- Output validator for container, codec/profile, resolution, FPS, duration, pixel format and alpha metadata.

Acceptance checks:
- Proxy mode never changes final output resolution.
- Memory is bounded by a documented batch strategy.
- Resume never skips or duplicates frames.
- MOV success requires verified ProRes 4444 profile and alpha-capable pixel format; PNG sequence success requires every expected frame.
- Render queue failures are isolated per job and do not corrupt the active project.

## Release validation matrix

Before a release that changes rendering or composition:
1. Import and preview one HTML scene and one SVG scene.
2. Split SVG, edit two tracks, add markers, save project, reload project.
3. Compare preview and exported frame positions at the start, middle, and end.
4. Render 720p and 1080p test clips.
5. Render 4K 30 fps short test.
6. Export MP4/H.264 and inspect resolution/FPS/playback.
7. Export PNG Sequence ZIP and verify frame count and alpha.
8. Export MOV ProRes 4444 and verify profile, pixel format and alpha.
9. Confirm older project JSON files still open.

## Delivery policy

Each phase is committed separately where practical. A build/deploy success verifies packaging and publication, not visual correctness of every edit or codec output. User-side render tests remain the final compatibility check for the target browser and hardware.
