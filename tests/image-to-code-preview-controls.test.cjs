const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('trozal-image-to-code-video.js', 'utf8');
const expectedRatios = ['16:9','9:16','1:1','4:5','3:4','2:3','3:2','4:3','5:4','21:9','custom'];
for (const ratio of expectedRatios) {
  assert.ok(source.includes('value="' + ratio + '"'), 'Mode 5 preview must offer ratio ' + ratio);
}
for (const id of ['itcvCustomRatioFields','itcvCustomRatioWidth','itcvCustomRatioHeight']) {
  assert.match(source, new RegExp('id="' + id + '"'), 'Custom preview ratio is missing #' + id);
}
assert.match(source, /function selectedPreviewRatio\(\)/, 'Custom ratio must resolve to a width:height value before preview generation');
assert.match(source, /ratio:selectedPreviewRatio\(\)/, 'Generated HTML and JavaScript must use the selected preview ratio');
assert.match(source, /id="itcvLoop"/, 'Mode 5 preview transport must expose a Loop button');
assert.match(source, /function applyPreviewLoop\(\)/, 'Loop button must update actual Web Animations timing');
assert.match(source, /effect\.updateTiming\(\{iterations:previewLoopEnabled\?Infinity:1/, 'Loop toggle must switch between repeated playback and one cycle');
assert.match(source, /id="itcvGuides"/, 'Mode 5 preview must expose composition guides');
assert.match(source, /id="itcvPreviewGuides"/, 'Preview guides must include visual overlay lines and safe margins');
assert.match(source, /refreshRatioPreview\(\)/, 'Changing the preview ratio must refresh an already generated preview');
assert.match(source, /addEventListener\('click',\(\)=>\{previewLoopEnabled=!previewLoopEnabled/, 'Loop button click must toggle the loop state');
new Function(source);
console.log('Mode 5 preview ratio, custom size, loop toggle, ratio refresh, and framing-guide regression checks passed.');

const globalRatioSource = require('node:fs').readFileSync('index.html','utf8');
for (const ratio of ['16:9','9:16','1:1','4:5','3:4','2:3','3:2','4:3','5:4','21:9','custom']) {
  assert.ok(globalRatioSource.includes('value="'+ratio+'"'), 'All-mode preview ratio is missing '+ratio);
}
for (const id of ['trozalGlobalPreviewRatio','trozalGlobalRatioWidth','trozalGlobalRatioHeight','trozalGlobalRatioReset']) {
  assert.ok(globalRatioSource.includes('id="'+id+'"'), 'Global preview ratio control is missing '+id);
}
