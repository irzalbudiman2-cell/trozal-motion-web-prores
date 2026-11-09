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

**Status: Initial implementation committed; browser interaction and export parity still require validation.**

Implemented:
- Per-layer keyframe editor for X/Y position, rotation, scale, and opacity.
- Auto Keyframe mode writes changes to the current playhead when a transform value is edited.
- Per-keyframe outgoing interpolation: Hold, Linear, Ease In, Ease Out, Easy Ease, and custom cubic Bezier.
- Editable Bezier control values (X1/Y1/X2/Y2) stored with the outgoing keyframe.
- Value Graph for Position X, Position Y, Rotation, Scale, and Opacity. Drag points to change keyframe time and value.
- Motion Path X/Y graph. Drag points to change X/Y position while keeping keyframe time.
- Keyframe easing and Bezier values are persisted as part of the existing project keyframe data; Auto Keyframe preference is saved per layer.
- Legacy keyframes without easing data continue to use the previous smooth/ease-in-out interpolation.

Still planned for this phase:
- Dedicated velocity/speed graph and tangent handles on the visible curve.
- On-stage motion path overlay with editable handles.
- Frame snapping, keyframe snapping, and undo/redo integration for graph edits.

Acceptance checks:
- Preview and exported frames use the same keyframe interpolation function.
- Older project JSON files without easing/graph fields continue to load with the old smooth interpolation.
- Save/reopen preserves easing mode, Bezier values, Auto Keyframe preference, and all keyframe values.
- Dragging graph points updates the same layer keyframe data used by preview and render.

## Phase 3 — Text Animation Studio

**Status: Initial implementation committed; browser interaction and preview/export parity still require validation.**

Implemented:
- Multiple native text layers with add, duplicate, delete, select and reorder operations.
- Presets including Custom, Cinematic Title, Lower Third, Subtitle, Neon Headline, Minimal Caption and Impact Headline.
- Per-character and per-word motion with direction controls and stagger timing.
- Text fill, outline and shadow styling.
- Native text preview and frame-render integration.
- Text-layer persistence in project JSON and autosave.

Still planned:
- Per-line reveal and more advanced text-on-path controls.
- Complete typography controls for line height, baseline and safe-area guides.
- More advanced variable-font and local-font dependency reporting.
- Full browser and render parity checks for every preset.

Acceptance checks:
- Text remains editable after project save/reopen.
- Preview and exported frames render text with consistent layout and timing.
- Missing fonts are reported before render rather than silently substituted without notice.
- Older project JSON files without text-layer data continue to load with safe defaults.

## Phase 4 — Mask, Shape & Path Animation

**Status: Multi-mask initial implementation committed; advanced vector-path behavior and export parity remain in development.**

Implemented:
- Shape mask manager with add, duplicate, delete and select operations.
- Multiple masks with Add, Subtract, Intersect and Difference composition modes.
- Independent mask shape, size, rotation, position and enabled state.
- Per-mask keyframes for position, size, rotation and enabled state, with interpolation and Bezier easing data.
- Editable path controls for the supported mask path workflow.
- Project JSON persistence for mask layers and keyframes.
- Preview mask compositing and canvas-based export masking.

Still planned:
- Alpha Matte and Luma Matte workflows.
- Feather and expansion controls.
- Shape morphing with topology compatibility checks.
- Native Trim Paths for arbitrary imported SVG paths; current stroke reveal is limited to supported mask geometry.
- Stronger capability warnings for unsupported filters and blend/matte combinations.
- Browser testing of mask ordering, subtract/intersect results and preview/export parity.

Acceptance checks:
- Masks and path animation are deterministic at arbitrary playhead times.
- Alpha is preserved in PNG and ProRes output.
- Unsupported geometry is reported and never silently exported as a different result.
- Multiple masks survive project save/reopen and evaluate consistently at the same frame.

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

## Phase 6 — Prompt-to-Visual & Visual Scene Sequencer

**Status: Initial procedural generator and editable scene sequencer committed; visual QA and deeper native-timeline integration remain planned.**

Implemented:
- Prompt-to-Visual panel with its own purple feature color, separate from other editor panels.
- Prompt parsing into a sequence of visual scene descriptions.
- Procedural SVG scene generation for categories such as city, space, ocean, nature, desert, winter, Santa, vehicles, aircraft, animals and jewelry.
- CSS camera motion, atmosphere/particles and scene transitions without animated text overlays.
- Dedicated teal Visual Scene Sequencer panel.
- Per-scene description, duration, entrance transition, camera movement and visual style.
- Drag-and-drop scene ordering, move-up/move-down controls, add and delete scene operations.
- Generated standalone HTML with one SVG composition per scene and a summed timeline duration.
- Generated visual HTML can be sent through the existing HTML import/preview path.
- Prompt, visual settings and scene sequence are persisted in project JSON and autosave.

Current limitations:
- Scene artwork is procedural SVG selected from keyword-driven visual templates. This is not an external generative image/video model and does not produce photorealistic AI footage.
- Prompt understanding is keyword/template based; unsupported subjects may fall back to a generic illustration.
- Scene objects are not yet exposed as independent native editor tracks after import.
- Browser preview and frame-render parity for all generated CSS transitions and camera effects still require visual testing.

Next development:
- Import each generated scene as an editable native multi-track composition.
- Add scene thumbnails and playhead scrubbing in the sequencer.
- Add object-level selection and independent motion controls within generated scenes.
- Integrate a server-side AI image/video provider only after provider selection, secure key handling and usage controls are designed.

Acceptance checks:
- Scene order, durations and per-scene settings survive project save/reopen.
- The generated HTML contains only visual SVG compositions and no title/text overlay.
- Summed scene duration matches the generated output duration.
- Each scene's transition and camera settings are reflected in the generated HTML.
- Existing HTML/SVG import and MP4, ProRes 4444 alpha and PNG Sequence ZIP export paths remain intact.

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
