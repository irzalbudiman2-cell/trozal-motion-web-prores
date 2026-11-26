'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('TROZAL_UNIVERSAL_RIG_SERVER.py', 'utf8');
const setup = fs.readFileSync('TROZAL_UNIVERSAL_RIG_SETUP.bat', 'utf8');
const start = fs.readFileSync('TROZAL_UNIVERSAL_RIG_START.bat', 'utf8');
const ui = fs.readFileSync('js/ollama-universal-object-rig.js', 'utf8');
const mode5 = fs.readFileSync('trozal-image-to-code-video.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const pagesBuild = fs.readFileSync('.github/workflows/build-prores-pages.yml', 'utf8');

for (const route of ['/api/health', '/api/segment/status', '/api/segment/auto', '/api/segment/point', '/api/pose/estimate', '/api/pose/segment-parts', '/api/inpaint']) {
  assert.ok(server.includes(route), 'Missing local segmenter route: ' + route);
}
assert.match(server, /host="127\.0\.0\.1"/, 'SAM2 service must bind only to loopback');
assert.match(server, /sam2\.1_hiera_tiny\.pt/, 'Use SAM 2.1 Tiny checkpoint');
assert.match(server, /SAM2ImagePredictor/, 'Use SAM2 image prompt predictor');
assert.match(server, /Access-Control-Allow-Private-Network/, 'Allow browser local-network preflight');
assert.match(server, /request\.method == "OPTIONS"/, 'Private Network Access must be enabled on allowlisted OPTIONS preflights even when Chromium omits the legacy request header.');
assert.match(ui, /Local network access/, 'Local API connection errors must explain the Chrome/Edge local-network permission.');
assert.match(ui, /127\.0\.0\.1:11436/, 'Local API diagnostics must identify the expected loopback endpoint.');
assert.match(server, /force_cpu=True/, 'Provide CPU fallback when CUDA runs out of memory');
assert.ok(server.indexOf('_device = device') >= 0 && server.indexOf('_device = device') < server.indexOf('model = build_sam2(CONFIG'), 'Record the CUDA attempt before SAM2 model initialization so kernel-load failures can trigger CPU retry');
assert.ok(server.includes('def _is_cuda_runtime_error('), 'Recognize unsupported CUDA kernel images and runtime failures');
assert.ok(server.includes('_is_cuda_runtime_error(exc)'), 'CUDA runtime failures must be detected before CPU retry');
const pointPredictor = server.slice(server.indexOf('def _predict_masks'), server.indexOf('@app.after_request', server.indexOf('def _predict_masks')));
assert.ok(pointPredictor.indexOf('try:') < pointPredictor.indexOf('predictor = _set_image(image)'), 'Point segmentation must guard model loading and image encoding, not only predictor.predict(), for CPU fallback');
assert.match(server, /def _set_segment_progress/, 'Expose server-side inference progress updates');
assert.match(server, /def segment_status\(\)/, 'Expose SAM inference status for browser polling');
assert.match(server, /"loading_model"/, 'Progress should distinguish first model load from point scanning');
assert.match(server, /"sampling"/, 'Progress should advance while SAM scans candidate regions');
assert.match(ui, /AbortController/, 'Local SAM requests must have bounded timeouts');
assert.match(ui, /\/api\/segment\/status/, 'Browser UI must poll local SAM inference progress');
assert.match(ui, /itcvRigProgressBar/, 'Show actual SAM inference progress in Mode 5 UI');
assert.match(mode5, /closest\('#itcvRigAuto'\)/, 'Mode 5 needs an independent segmentation click handler');
assert.match(mode5, /stopImmediatePropagation\(\)/, 'Independent handler must prevent duplicate segment requests');
assert.match(setup, /mediapipe==0\.10\.21/, 'Install local MediaPipe Pose runtime');
assert.match(setup, /pose_landmarker_lite\.task/, 'Download local pose model during setup');
assert.match(setup, /SAM2_BUILD_CUDA=0/, 'Do not require nvcc custom extension for setup');
assert.match(setup, /torch==2\.9\.1/, 'Pin multi-GPU PyTorch baseline');
assert.match(setup, /cu128/, 'Use CUDA 12.8 for Turing and Blackwell NVIDIA GPUs');
assert.match(setup, /rocm-rel-7\.2\.1/, 'Provide AMD ROCm Windows profile');
assert.match(setup, /GPU_PROFILE/, 'Offer NVIDIA, AMD and CPU profiles');
assert.match(server, /def _torch_runtime_info\(/, 'Expose accelerator diagnostics');
assert.match(server, /def _select_accelerator\(/, 'Select NVIDIA, AMD ROCm or CPU');
assert.match(server, /get_arch_list\(/, 'Check NVIDIA wheel architecture support');
assert.match(server, /"runtime": _torch_runtime_info\(\)/, 'Expose GPU diagnostics from health endpoint');
assert.match(start, /TROZAL_RIG_PORT=11436/, 'Local segmenter should use dedicated port 11436');

for (const id of ['itcvRigCheck','itcvRigAuto','itcvRigSource','itcvRigPickMode','itcvRigBuild','itcvRigParts',
  'itcvRigMaskOverlay','itcvRigMaskOpacity','itcvRigMaskOpacityValue','itcvRigMaskFocus','itcvRigShowBounds',
  'itcvRigPointPositive','itcvRigPointNegative','itcvRigPointClear','itcvRigPointRun','itcvRigPointHint']) {
  assert.ok(mode5.includes(id), 'Missing Universal Rig control: ' + id);
}
assert.match(ui, /function buildMaskPreview\(/, 'SAM results must be converted into colored mask overlays.');
assert.match(ui, /async function analyzeSegmentMaskQuality\(/, 'Mode 5 must measure mask area and connected fragments before rig construction.');
assert.match(ui, /maskQuality\.emptyCount/, 'Mode 5 must stop rig construction when SAM returns an empty mask.');
assert.match(ui, /part\.quality\.warnings/, 'Mode 5 must expose per-component mask warnings in the parts list.');
assert.match(ui, /fragmen mask terpisah/, 'Mode 5 must identify detached mask fragments for review.');
assert.match(ui, /maskPreviewCanvases\.get\(part\.id\)/, 'Preview must render the matching mask for each component.');
assert.match(ui, /globalAlpha = opacity/, 'Mask overlay opacity must be adjustable.');
assert.match(ui, /itcvRigMaskFocus/, 'Preview must support focusing an individual component.');
assert.match(ui, /prepareMaskPreviews\(segments\)/, 'Auto segmentation must prepare mask previews before rig construction.');
assert.match(ui, /function runPointSegmentation\(/, 'Manual point refinement must submit all selected prompts together.');
assert.match(ui, /points, labels/, 'SAM point endpoint must receive both coordinates and foreground/background labels.');
assert.match(ui, /pendingPoints\.some\(point => point\.label === 1\)/, 'Point refinement must require at least one positive foreground prompt.');
assert.match(ui, /pointLabel = label/, 'Positive and negative point modes must be switchable.');
assert.match(mode5, /rig-mask-controls/, 'Mode 5 must render the dedicated segmentation preview controls.');
assert.match(ui, /document\.addEventListener\('click', async event =>/,'Health check must use delegated click handling for dynamically mounted Mode 5 UI');
assert.match(ui, /Memeriksa SAM 2\.1/,'Health check must show immediate pending feedback');
assert.match(ui, /SAM 2\.1 Terhubung/,'Health check must show visible success feedback');
assert.match(ui, /checkpoint terdeteksi; model dimuat saat segmentasi pertama/,'Unloaded model state must be explained as lazy loading, not an error');
assert.match(ui, /\/api\/segment\/auto/);
assert.match(ui, /\/api\/segment\/point/);
assert.match(ui, /\/api\/inpaint/);
assert.match(ui, /getImageUrl/);
assert.match(ui, /onApply/);
assert.match(ui, /toDataURL\('image\/png'\)/);
assert.match(mode5, /function drawUniversalRig/);
assert.match(mode5, /function drawJointMesh\(/, 'OLLAMA Universal Rig must deform articulated part textures with local mesh strips.');
assert.match(mode5, /function drawTriangle\(/, 'OLLAMA Universal Rig must rasterize actual triangle mesh faces with affine texture mapping.');
assert.match(mode5, /const density=Math\.max\(4,Math\.min\(24/, 'OLLAMA mesh density must be user-configurable within safe bounds.');
assert.match(mode5, /itcvMeshEnabled/, 'OLLAMA must expose a visible mesh enable control.');
assert.match(mode5, /jointInfluence/, 'OLLAMA must serialize joint influence into the runtime.');
assert.match(mode5, /itcvJointAnchors/, 'OLLAMA must expose a visible cross-segment shared-joint control.');
assert.match(mode5, /axisLengthSq/, 'OLLAMA mesh weights must follow the shared proximal-to-distal joint axis.');
assert.match(mode5, /distal:child\?\{x:Number\(child\.pivotX\),y:Number\(child\.pivotY\)\}/, 'OLLAMA child pivots must anchor parent segment distal seams.');
assert.ok(mode5.includes('ctx.transform(A,B,C,D,E,F)'), 'OLLAMA triangle faces must map source texture coordinates onto deformed vertices.');
assert.ok(mode5.includes('smoothWeight=value=>'), 'OLLAMA vertices must blend proximal/distal joint influences with smooth weights.');
assert.ok(mode5.includes('distalWeight:weight'), 'OLLAMA must retain normalized joint influence weights per shared mesh vertex.');
assert.match(mode5, /drawJointMesh\(image,part\.x,part\.y/, 'OLLAMA export renderer must use the mesh deformation path for segmented parts.');
assert.match(mode5, /universalRigEmbedded/);
assert.match(mode5, /makeRuntime\(images,cfg,art,universalRig\)/);
assert.match(mode5, /universalRig:universalRig\|\|null/);
assert.ok(html.includes('./js/ollama-universal-object-rig.js'), 'Universal Rig controller is not loaded by index.html');
assert.match(pagesBuild, /cp js\/ollama-universal-object-rig\.js site\/js\/ollama-universal-object-rig\.js/,
  'GitHub Pages build must package the Universal Rig controller referenced by index.html');
assert.match(pagesBuild, /test -s site\/js\/ollama-universal-object-rig\.js/,
  'GitHub Pages build must fail if the Universal Rig controller asset is missing');


assert.match(server, /"id": identifier, "maskId": record\["id"\]/, 'Character part IDs must match the parent IDs so the Universal Rig can build connected anatomical chains.');
assert.match(ui, /anatomicalAmplitude/, 'Mode 5 character parts must use conservative per-joint motion amplitudes instead of one generic whole-image-like swing.');
assert.match(ui, /segment\.category === 'character'/, 'Anatomical motion limits must apply only to character layers and preserve generic object motion.');
assert.match(ui, /part\.parentId = String\(item\.parent \|\| ''\)/, 'The Mode 5 controller must preserve anatomical parent references.');
assert.match(server, /def pose_segment_parts\(\)/, 'Mode 5 must expose a dedicated pose-guided human part segmentation endpoint.');
for (const part of ['Kepala','Badan / Torso','Lengan Atas Kiri','Lengan Bawah Kiri','Tangan Kiri','Paha Kiri','Betis Kiri','Kaki Kiri']) {
  assert.ok(server.includes(part), 'Character Part Segmentation is missing anatomical layer: ' + part);
}
assert.match(server, /_pose_part_roi/, 'SAM masks must be constrained to pose-guided anatomical regions rather than treating the whole person as one object.');
assert.match(ui, /async function autoCharacterParts\(/, 'Mode 5 must expose an automatic human body-part segmentation workflow.');
assert.match(ui, /\/api\/pose\/segment-parts/, 'Mode 5 must call the dedicated human body-part segmentation endpoint.');
assert.match(mode5, /itcvRigCharacterAuto/, 'Mode 5 must show an explicit AUTO CHARACTER PARTS control.');
assert.match(mode5, /rigController\.autoCharacterParts\(\)/, 'The visible Mode 5 control must invoke per-body-part segmentation.');

assert.match(server, /def _adaptive_inpaint_parameters\(width, height\)/, 'Background reconstruction must scale its repair parameters to the source resolution.');
assert.match(server, /cv2\.dilate\(union, kernel, iterations=1\)/, 'Inpainting must expand the foreground mask before reconstructing hidden background.');
assert.match(server, /cv2\.inpaint\(source, dilated, inpaint_radius, cv2\.INPAINT_TELEA\)/, 'Inpainting radius must use the adaptive resolution-aware value.');
assert.match(server, /"maskCoverage": round\(mask_coverage \* 100, 2\)/, 'The inpaint API must report original foreground mask coverage.');
assert.match(ui, /inpaintInfo\.expandedCoverage/, 'Mode 5 must visibly report the expanded background repair coverage.');

assert.match(mode5,/id="itcvTransportBar"/, 'Mode 5 must display a dedicated playback transport bar.');
assert.match(mode5,/id="itcvPlay"/, 'Mode 5 must expose Play.');
assert.match(mode5,/id="itcvPause"/, 'Mode 5 must expose Pause.');
assert.match(mode5,/id="itcvStop"/, 'Mode 5 must expose Stop.');
assert.match(mode5,/id="itcvTimelineScrub"/, 'Mode 5 must expose a visible timeline scrubber.');
assert.match(mode5,/function seekPreview\(/, 'Timeline scrubbing must seek CSS animations in the preview iframe.');
assert.match(mode5,/animation\.currentTime=/, 'Playback transport must update animation currentTime.');
assert.match(mode5,/function stopPreview\(/, 'Stop must pause and reset the preview to time zero.');
assert.match(mode5,/itcvMotionAssistControls/,'OLLAMA must expose pose preset, foot contact lock and follow-through controls.');assert.match(mode5,/cfg\.motionAssist=/,'OLLAMA must serialize motion assist settings into the generated runtime.');assert.match(mode5,/footStance/,'OLLAMA runtime must reduce foot rotation during stance and lift during swing.');assert.match(mode5,/followThrough/,'OLLAMA runtime must blend secondary follow-through motion.');assert.match(mode5,/preset===.*run/,'OLLAMA runtime must adapt cadence for run preset.');

for(const id of ['itcvGestureAction','itcvGazeDirection','itcvBreathing','itcvBodySway','itcvRootMotion']) assert.ok(mode5.includes('id="'+id+'"'),'Mode 5 must expose '+id+'.');
for(const token of ['gestureAngle','gazeAngle','breathing','bodySway','rootPath']) assert.ok(mode5.includes(token),'Generated OLLAMA rig runtime must apply '+token+'.');
for(const id of ['itcvArmSwing','itcvStrideLength','itcvTorsoTwist','itcvHeadNod','itcvMotionSmoothness']) assert.ok(mode5.includes('id="'+id+'"'),'Mode 5 must expose biomechanical control '+id+'.');
for(const token of ['armSwing','strideLength','torsoTwist','headNod','motionSmoothness']) assert.ok(mode5.includes(token),'Generated OLLAMA rig runtime must apply biomechanical control '+token+'.');
assert.match(mode5,/isArm\?Math\.sin\(phase\+Math\.PI\)\*armSwing/, 'Arm swing must drive arm segments independently.');
assert.match(mode5,/footSwing\*Math\.PI\)\*part\.h\*\.075\*footLock\*\(\.65\+strideLength\*\.7\)/, 'Stride length must scale the foot lift during swing.');
assert.match(mode5,/Math\.sin\(t\*1\.8\)\*torsoTwist/, 'Torso twist must animate the torso.');
assert.match(mode5,/Math\.sin\(t\*2\.4\)\*headNod/, 'Head nod must animate the head.');
assert.match(mode5,/smoothness\*\.18/, 'Motion smoothness must blend the motion phase to soften transitions.');
console.log('PASS: OLLAMA Universal Object Rig local API, SAM2 routes, Character Part Segmentation, motion assist, loopback guard, UI controls and self-contained export contract.');
assert.match(mode5,/trozal-rig-timeline/, 'Mode 5 runtime must expose a visible timeline for the generated rig.');
assert.match(mode5,/aria-label','Timeline playhead'/, 'Mode 5 timeline must support scrubbing the preview playhead.');
assert.match(mode5,/UNIVERSAL RIG · TIMELINE/, 'Mode 5 timeline must label the articulated rig tracks.');
assert.match(mode5,/timelineParts\.forEach/, 'Each segmented body part must have an independently selectable timeline track.');
assert.match(mode5,/scrub\.addEventListener\('input'/, 'Scrubbing the timeline must seek the rendered preview.');

assert.match(mode5,/itcvContinuity/,'OLLAMA must expose cross-segment continuity control.');
assert.match(mode5,/crossSegmentContinuity/,'OLLAMA must serialize cross-segment continuity.');
assert.match(mode5,/drawPart\(part,parentWave\)/,'OLLAMA must propagate parent motion influence.');
assert.match(ui, /const jointSeams = \[\]/, 'Universal Rig must build a shared joint seam map for every articulated parent-child pair.');
assert.match(ui, /torso: 0\.08, head: 0\.14/,'Character rig must use visible anatomical motion amplitudes instead of near-static values.');
assert.ok(mode5.includes('.camera{animation:none!important;transform:none!important}'),'The rig preview must lock global camera movement so articulated body motion is visible.');
assert.match(mode5, /motion==='rotate'&&part\.category==='character'/,'Human limb rotate motion must not spin a full 360 degrees.');
assert.match(ui, /jointSeamsByPart/, 'Both connected segments must receive the same joint overlap source pixels.');
assert.match(ui, /const unionMask = new Uint8Array\(imageSize\.width \* imageSize\.height\)/, 'Joint welding must use the union of the two SAM foreground masks, not invent background pixels.');
assert.match(ui, /const feather = \(1 - t \* t \* \(3 - 2 \* t\)\) \* seamSettings\.strength/, 'Shared joint pixels must fade smoothly using the configured seam strength.');
assert.match(ui, /itcvRigSeamControls/, 'Mode 5 must display visible joint seam controls.');
assert.match(ui, /seamSettings\.radiusScale/, 'Mode 5 must apply the user-configured seam radius.');
assert.match(ui, /alphaMask = Math\.max\(alphaMask, Math\.round\(unionAlpha \* feather\)\)/, 'Each connected layer must receive the same feathered foreground pixels around its shared pivot.');
assert.match(ui, /background: bg\.toDataURL\('image\/png'\), parts, jointSeams/, 'Generated rig must retain per-joint seam diagnostics.');
assert.match(ui, /batas sendi diberi overlap piksel bersama/, 'Mode 5 must report how many joint seams received shared source-pixel overlap.');


assert.match(mode5,/Pilih track tubuh/, 'Mode 5 timeline must expose a selected-track editor.');
assert.match(mode5,/Intensitas gerak/, 'Each rig track must expose an independent motion intensity control.');
assert.match(mode5,/Kecepatan/, 'Each rig track must expose an independent speed control.');
assert.match(mode5,/selectedTrack\.intensity=Number\(amp\.value\)/, 'Track intensity must update the selected body part.');
assert.match(mode5,/selectedTrack\.speed=Number\(speed\.value\)/, 'Track speed must update the selected body part.');
assert.match(mode5,/part\.intensity\?\?1/, 'The runtime must apply per-track intensity to mesh deformation.');
assert.match(mode5,/scale=trunc\(iw\/2\)\*2:trunc\(ih\/2\)\*2/, 'MP4 encoder must normalize canvas dimensions to even H.264 dimensions.');
assert.match(mode5,/FFmpeg gagal dimuat/, 'MP4 render errors must identify local FFmpeg asset/runtime problems.');

for(const id of ['itcvGaitPhaseOffset','itcvStanceRatio','itcvKneeFlexAssist','itcvAnkleStabilization','itcvPoseBlend']) assert.ok(mode5.includes('id="'+id+'"'),'Mode 5 must expose adaptive gait control '+id+'.');
for(const token of ['gaitPhaseOffset','stanceRatio','kneeFlexAssist','ankleStabilization','poseBlend','gaitOffset','kneeFlexAssist','ankleStabilization']) assert.ok(mode5.includes(token),'Generated OLLAMA rig must apply '+token+'.');
