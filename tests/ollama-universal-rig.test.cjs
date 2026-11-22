'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('TROZAL_UNIVERSAL_RIG_SERVER.py', 'utf8');
const setup = fs.readFileSync('TROZAL_UNIVERSAL_RIG_SETUP.bat', 'utf8');
const start = fs.readFileSync('TROZAL_UNIVERSAL_RIG_START.bat', 'utf8');
const ui = fs.readFileSync('js/ollama-universal-object-rig.js', 'utf8');
const mode5 = fs.readFileSync('trozal-image-to-code-video.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

for (const route of ['/api/health', '/api/segment/auto', '/api/segment/point', '/api/inpaint']) {
  assert.ok(server.includes(route), 'Missing local segmenter route: ' + route);
}
assert.match(server, /host="127\.0\.0\.1"/, 'SAM2 service must bind only to loopback');
assert.match(server, /sam2\.1_hiera_tiny\.pt/, 'Use SAM 2.1 Tiny checkpoint');
assert.match(server, /SAM2ImagePredictor/, 'Use SAM2 image prompt predictor');
assert.match(server, /Access-Control-Allow-Private-Network/, 'Allow browser local-network preflight');
assert.match(server, /force_cpu=True/, 'Provide CPU fallback when CUDA runs out of memory');
assert.match(setup, /SAM2_BUILD_CUDA=0/, 'Do not require nvcc custom extension for setup');
assert.match(setup, /torch==2\.5\.1/, 'Pin supported PyTorch baseline');
assert.match(setup, /cu121/, 'Attempt CUDA 12.1 PyTorch for compatible NVIDIA GPUs');
assert.match(start, /TROZAL_RIG_PORT=11436/, 'Local segmenter should use dedicated port 11436');

for (const id of ['itcvRigCheck','itcvRigAuto','itcvRigSource','itcvRigPickMode','itcvRigBuild','itcvRigParts']) {
  assert.ok(mode5.includes(id), 'Missing Universal Rig control: ' + id);
}
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

console.log('PASS: OLLAMA Universal Object Rig local API, SAM2 routes, loopback guard, UI controls and self-contained export contract.');
