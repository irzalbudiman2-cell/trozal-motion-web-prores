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

for (const route of ['/api/health', '/api/segment/status', '/api/segment/auto', '/api/segment/point', '/api/inpaint']) {
  assert.ok(server.includes(route), 'Missing local segmenter route: ' + route);
}
assert.match(server, /host="127\.0\.0\.1"/, 'SAM2 service must bind only to loopback');
assert.match(server, /sam2\.1_hiera_tiny\.pt/, 'Use SAM 2.1 Tiny checkpoint');
assert.match(server, /SAM2ImagePredictor/, 'Use SAM2 image prompt predictor');
assert.match(server, /Access-Control-Allow-Private-Network/, 'Allow browser local-network preflight');
assert.match(server, /force_cpu=True/, 'Provide CPU fallback when CUDA runs out of memory');
assert.match(server, /def _set_segment_progress/, 'Expose server-side inference progress updates');
assert.match(server, /def segment_status\(\)/, 'Expose SAM inference status for browser polling');
assert.match(server, /"loading_model"/, 'Progress should distinguish first model load from point scanning');
assert.match(server, /"sampling"/, 'Progress should advance while SAM scans candidate regions');
assert.match(ui, /AbortController/, 'Local SAM requests must have bounded timeouts');
assert.match(ui, /\/api\/segment\/status/, 'Browser UI must poll local SAM inference progress');
assert.match(ui, /itcvRigProgressBar/, 'Show actual SAM inference progress in Mode 5 UI');
assert.match(mode5, /closest\('#itcvRigAuto'\)/, 'Mode 5 needs an independent segmentation click handler');
assert.match(mode5, /stopImmediatePropagation\(\)/, 'Independent handler must prevent duplicate segment requests');
assert.match(setup, /SAM2_BUILD_CUDA=0/, 'Do not require nvcc custom extension for setup');
assert.match(setup, /torch==2\.5\.1/, 'Pin supported PyTorch baseline');
assert.match(setup, /cu121/, 'Attempt CUDA 12.1 PyTorch for compatible NVIDIA GPUs');
assert.match(start, /TROZAL_RIG_PORT=11436/, 'Local segmenter should use dedicated port 11436');

for (const id of ['itcvRigCheck','itcvRigAuto','itcvRigSource','itcvRigPickMode','itcvRigBuild','itcvRigParts',
  'itcvRigMaskOverlay','itcvRigMaskOpacity','itcvRigMaskOpacityValue','itcvRigMaskFocus','itcvRigShowBounds']) {
  assert.ok(mode5.includes(id), 'Missing Universal Rig control: ' + id);
}
assert.match(ui, /function buildMaskPreview\(/, 'SAM results must be converted into colored mask overlays.');
assert.match(ui, /maskPreviewCanvases\.get\(part\.id\)/, 'Preview must render the matching mask for each component.');
assert.match(ui, /globalAlpha = opacity/, 'Mask overlay opacity must be adjustable.');
assert.match(ui, /itcvRigMaskFocus/, 'Preview must support focusing an individual component.');
assert.match(ui, /prepareMaskPreviews\(segments\)/, 'Auto segmentation must prepare mask previews before rig construction.');
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
assert.match(mode5, /universalRigEmbedded/);
assert.match(mode5, /makeRuntime\(images,cfg,art,universalRig\)/);
assert.match(mode5, /universalRig:universalRig\|\|null/);
assert.ok(html.includes('./js/ollama-universal-object-rig.js'), 'Universal Rig controller is not loaded by index.html');
assert.match(pagesBuild, /cp js\/ollama-universal-object-rig\.js site\/js\/ollama-universal-object-rig\.js/,
  'GitHub Pages build must package the Universal Rig controller referenced by index.html');
assert.match(pagesBuild, /test -s site\/js\/ollama-universal-object-rig\.js/,
  'GitHub Pages build must fail if the Universal Rig controller asset is missing');

console.log('PASS: OLLAMA Universal Object Rig local API, SAM2 routes, loopback guard, UI controls and self-contained export contract.');
