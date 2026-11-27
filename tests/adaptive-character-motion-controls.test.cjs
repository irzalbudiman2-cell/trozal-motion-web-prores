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

const balanceControls=[
 ['itcvPelvisShift','pelvisLateralShift'],
 ['itcvShoulderCounter','shoulderCounterSwing'],
 ['itcvHeelToeRoll','heelToeRoll'],
 ['itcvLandingSoftness','landingSoftness'],
 ['itcvNeckStabilization','neckStabilization']
];
for(const [id,key] of balanceControls){
 assert.ok(source.includes(id),`Missing Character Balance Lab control: ${id}`);
 assert.ok(source.includes(key),`Missing Character Balance Lab runtime config: ${key}`);
}
assert.match(source,/CHARACTER BALANCE LAB · 5 ADVANCED CONTROLS/,'OLLAMA must show the new five-control Character Balance Lab panel.');
assert.match(source,/shoulderCounterSwing\*\.095/,'Shoulder counter-swing must affect arm rotation.');
assert.match(source,/heelToeRoll\*\.13/,'Heel-to-toe roll must affect foot rotation.');
assert.match(source,/landingSoftness\*\.18/,'Landing softness must damp knee impact.');
assert.match(source,/neckStabilization\*\.38/,'Neck stabilization must damp head rotation.');
assert.match(source,/pelvisLateralShift\*\.025/,'Pelvis shift must alter torso pivot translation.');

console.log('PASS: adaptive gait controls and five Character Balance Lab controls are visible and wired to exported runtime.');
