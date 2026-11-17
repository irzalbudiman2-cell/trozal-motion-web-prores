'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const renderer = fs.readFileSync('hybrid-canvas-renderer.js', 'utf8');
const gpu = fs.readFileSync('browser-gpu-frame-pipeline.js', 'utf8');
const health = fs.readFileSync('js/gpu-performance-health.js', 'utf8');
for (const id of ['mp4Bitrate','mp4BitrateEstimate','ollamaModelManagerStatus','ollamaModelRefreshBtn','gpuPerformanceHealthPanel','gpuPerformanceHealthCheck','gpuPerformanceHealthStatus','gpuPerformanceHealthStats','trozalHybridCanvasStatus']) {
  assert.ok(html.includes('id="'+id+'"'), 'Missing required UI: '+id);
}
assert.match(html, /TROZAL_VISION_BASE=trozalVisionBaseUrl\(\)/);
assert.match(html, /const BASE='http:\/\/127\.0\.0\.1:11434'/);
assert.match(html, /window\.location\.origin/);
assert.doesNotMatch(html, /ollama-direct-web-7718e1/);
assert.match(html, /TrozalHybridCanvasRenderer\.prepare\(\)/);
assert.match(renderer, /mode:\s*'hybrid'/);
assert.match(renderer, /item\.ratio\s*<=\s*0\.85/);
assert.match(gpu, /webgl2/);
assert.match(health, /requestAdapter/);
assert.match(health, /hardwareConcurrency/);
assert.match(health, /deviceMemory/);
assert.match(html, /captureHtmlMotionAt\(elapsed\)/);
assert.match(html, /__trozalGpuFrameAssistEnabled===true/);
assert.match(html, /value=["']3840x2160["']/);
assert.match(html, /ProRes 4444/);
assert.match(html, /PNG Sequence/);
for (const id of ['renderBtn','cancelRenderBtn','format','resolution','proresMode','multiTrackEditor']) {
  assert.equal((html.match(new RegExp("id=[\\\"']"+id+"[\\\"']", 'g'))||[]).length,1,'Existing editor/export control must remain exactly once: #'+id);
}

const healthUi = fs.readFileSync('js/gpu-performance-health.js', 'utf8');
for (const id of ['trozalCanvasControlPanel','trozalCanvasUiMode','trozalCanvasUiReason','trozalCanvasUiResults','trozalIpGuardrailPanel']) {
  assert.ok(healthUi.includes(id), 'Missing new Canvas/IP UI: '+id);
}
assert.match(healthUi, /CANVAS RENDER CONTROL/);
assert.match(healthUi, /ORIGINAL CONTENT & IP GUARDRAILS/);
assert.match(healthUi, /trozal:hybrid-canvas-status/);
assert.match(healthUi, /renderSpeedMode/);
assert.match(html, /TROZAL_IP_SAFETY_POLICY/);
assert.match(html, /INTELLECTUAL PROPERTY \/ ORIGINALITY/);
console.log('Ollama hybrid renderer, MP4 bitrate, Ollama direct connection, GPU health, and workspace/export regression guards passed.');