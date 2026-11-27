'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'canvas-3d-studio.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(html.includes('./canvas-3d-studio.js'), 'CANVAS 3D script must be loaded by the main application.');
for (const id of [
  'trozalCanvas3DOpen','trozalCanvas3DOverlay','trozal3DCanvas','trozal3DObjectList',
  'trozal3DNewType','trozal3DAdd','trozal3DDuplicate','trozal3DDelete','trozal3DReset',
  'trozal3DX','trozal3DY','trozal3DZ','trozal3DRX','trozal3DRY','trozal3DRZ',
  'trozal3DSX','trozal3DSY','trozal3DSZ','trozal3DMetal','trozal3DRough','trozal3DMaterialPreset','trozal3DEmission',
  'trozal3DAnimation','trozal3DSpeed','trozal3DAmount','trozal3DPlay','trozal3DPause',
  'trozal3DStop','trozal3DTime','trozal3DLoop','trozal3DDuration','trozal3DFps',
  'trozal3DSave','trozal3DExportJson','trozal3DExportPng','trozal3DParent','trozal3DAddKeyframe','trozal3DKeyframeInfo','trozal3DLightingControls',
  'trozal3DCameraTools','trozal3DCameraProjection','trozal3DCameraFocus','trozal3DCameraFront','trozal3DCameraSide','trozal3DCameraTop','trozal3DOrthoScale',
  'trozal3DTransformSnap','trozal3DSnapEnabled','trozal3DSnapMove','trozal3DSnapRotate','trozal3DSnapScale',
  'trozal3DUndo','trozal3DRedo','trozal3DHistoryCount'
]) assert.ok(source.includes('id=\''+id+'\'') || source.includes('id="'+id+'"') || source.includes(".id='"+id+"'"), 'Missing CANVAS 3D control: '+id);
for (const token of [
  "getContext('webgl2'", 'uniform mat3 uNormalMatrix', 'normalize(uNormalMatrix*aNormal)', 'function normalMatrix(m)', 'uniformMatrix3fv(l.normal,false,normalMatrix(m))', 'drawArrays(gl.TRIANGLES', 'drawArrays(gl.LINES',
  'function geometry(type)', "type==='cube'", "type==='sphere'", "type==='torus'",
  "type==='cylinder'", "type==='cone'", "type==='plane'", 'function localModel(o,t)', 'function model(o,t,seen=new Set())',
  "o.animation==='spin'", "o.animation==='orbit'", "o.animation==='bounce'",
  "o.animation==='pulse'", 'function camera(w,h)', 'function orthographic(scale,aspect,n,far)', 'function lookAt(eye,target)',
  'uMetallic','uRoughness','uEmission','emission:1.35','function renderLights()','uLightPos[3]','uLightColor[3]','uLightPower[3]','function renderLights()','data-light-field','function exportPng()', 'function save()', 'function keyedValues(o,t)', 'function model(o,t,seen=new Set())',
  'pointerdown','pointermove','addEventListener(\'wheel\'', 'function snapValue(value,step)', 'function historyUndo()', 'function historyRedo()', 'function historyRecord(label,key)', 'historySnapshot()', 'historyRestore(snapshot)', 'Ctrl+Z', 'Ctrl+Y', 'transformSnap:{...state.transformSnap}', 'state.transformSnap.enabled?snapValue(value,state.transformSnap.move)', 'state.transformSnap.enabled?snapValue(value,state.transformSnap.rotate)', 'state.transformSnap.enabled?snapValue(value,state.transformSnap.scale)'
]) assert.ok(source.includes(token), 'Missing 3D renderer feature: '+token);
assert.ok(source.includes("Object.defineProperty(window,'TROZAL_CANVAS_3D'"), 'CANVAS 3D must expose its public scene API.');
assert.match(source, /WebGL2 tidak tersedia/);
assert.doesNotMatch(source, /three\.min\.js|cdnjs\.cloudflare\.com\/ajax\/libs\/three/i,
  'CANVAS 3D must not depend on an external Three.js CDN.');
assert.ok(source.includes('function easingProgress(u,mode)'), 'Keyframe easing evaluator must be present.');
assert.ok(source.includes("case 'ease-in'" ) && source.includes("case 'ease-out'") && source.includes("case 'ease-in-out'") && source.includes("case 'smoothstep'") && source.includes("case 'hold'"), 'All supported interpolation modes must be implemented.');
assert.ok(source.includes('trozal3DKeyframeEasing') && source.includes("easing:$(\'trozal3DKeyframeEasing\')?.value||\'ease-in-out\'"), 'Keyframe easing must be selectable and saved per keyframe.');
assert.ok(source.includes("b.easing||a.easing||'linear'"), 'Each keyframe segment must apply its stored easing with a linear fallback for old projects.');
console.log('PASS: CANVAS 3D WebGL2 scene, geometry, transform, materials, three-point lighting, per-object motion, camera, timeline and exports are wired.');
