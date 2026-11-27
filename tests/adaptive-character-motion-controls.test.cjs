'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','trozal-image-to-code-video.js'),'utf8');
const controls=[
 ['itcvHipCounter','hipCounterRotation'],
 ['itcvArmLegSync','armLegSync'],
 ['itcvGroundClearance','groundClearance'],
 ['itcvGaitBalance','gaitBalance'],
 ['itcvJointDamping','jointImpactDamping']
];
for(const [id,key] of controls){
 assert.ok(source.includes(id),`Missing visible adaptive motion control: ${id}`);
 assert.ok(source.includes(key),`Missing runtime/export configuration: ${key}`);
}
assert.match(source,/groundClearance\*\.9/,'Ground clearance must change foot swing lift');
assert.match(source,/jointImpactDamping\*\.24/,'Joint damping must affect knee/ankle rotation');
assert.match(source,/hipCounterRotation\*\.10/,'Hip counter-rotation must affect torso motion');
assert.match(source,/armLegSync\)\+Math\.sin/,'Arm-leg sync must blend gait phase');
assert.match(source,/gaitBalance\*\.5/,'Gait balance must stabilize torso sway');
console.log('PASS: five adaptive character motion controls are visible and wired to exported runtime.');
