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
assert.match(source,/part\.w\*\.025\*pelvisLateralShift/,'Pelvis shift must alter torso pivot translation.');



const motionProfiles=['natural','run','landing','upper','default'];
for(const profile of motionProfiles){
 assert.ok(source.includes(profile+':{itcvPelvisShift:'),`Missing Character Balance Lab profile: ${profile}`);
}
for(const id of ['itcvBalancePresets','itcvBalancePresetStatus'])assert.ok(source.includes(id),`Missing motion profile UI element: ${id}`);
assert.match(source,/data-balance-preset="natural"/,'Natural Walk profile button must be visible.');
assert.match(source,/data-balance-preset="run"/,'Run Impact profile button must be visible.');
assert.match(source,/data-balance-preset="landing"/,'Soft Landing profile button must be visible.');
assert.match(source,/data-balance-preset="upper"/,'Upper Body Stable profile button must be visible.');
assert.match(source,/data-balance-preset="default"/,'Restore Defaults button must be visible.');
assert.ok(source.includes("input.dispatchEvent(new Event('input'"),'Applying a profile must update slider outputs through input events.');


// Mode 5 workspace layout, dedicated full-body presets, and motion advisor.
for(const id of ['itcvPosePresetPanel','itcvPosePresetStatus','itcvMotionAdvisor','itcvMotionAdvisorAnalyze','itcvMotionAdvisorApply','itcvFootstepImpact']){
 assert.ok(source.includes(id),`Missing Mode 5 motion workspace feature: ${id}`);
}
for(const preset of ['walk','idle','run']){
 assert.ok(source.includes(preset+':{itcvMotionPreset:'),`Missing full-body motion preset: ${preset}`);
 assert.match(source,new RegExp('data-pose-preset="'+preset+'"'),`Missing visible ${preset} preset button.`);
}
assert.match(source,/motionDock=rigPanel&&rigPanel\.querySelector\('#itcvMotionAssistControls'\)/,'Character Motion Assist must be detached from the right inspector.');
assert.match(source,/center\.append\(motionDock\)/,'Character Motion Assist must appear below the center Preview.');
assert.match(source,/footstepImpact:Number\(/,'Footstep impact value must be serialized into the exported runtime.');
assert.match(source,/impactPulse\*part\.h\*\.018\*footstepImpact/,'Footstep impact must affect torso weight absorption.');
assert.match(source,/impactPulse\*footstepImpact\*\.025/,'Footstep impact must add a subtle head follow-through.');
assert.match(source,/function analyzeMotionBalance\(applyFixes=false\)/,'Motion Balance Advisor must calculate recommendations.');
assert.match(source,/if\(applyFixes\)\{[\s\S]*?Object\.entries\(updates\)/,'Motion Balance Advisor must apply bounded safe corrections.');
assert.match(source,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'The moved motion dock must use a compact two-column control layout.');

console.log('PASS: adaptive gait controls, five Character Balance Lab controls, and five quick motion profiles are visible and wired to exported runtime.');
