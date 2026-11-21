'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('icon-logo-motion-studio.js', 'utf8');

test('illustrative catalogue keeps 1,500 concepts across 30 meaningful domains', () => {
  const motifs = source.match(/const motifs=Array\.from\(\{length:(\d+)\}/);
  assert.equal(Number(motifs?.[1]), 1500);
  const domainsStart = source.indexOf('const logoDomains=[');
  const domainsEnd = source.indexOf('];', domainsStart);
  assert.ok(domainsStart >= 0 && domainsEnd > domainsStart, 'logoDomains catalogue boundaries must exist');
  const domainText = source.slice(domainsStart, domainsEnd);
  assert.equal((domainText.match(/'[^']+'/g) || []).length, 30);
  for (const term of ['Hewan & Satwa Liar','Tumbuhan & Botani','Kendaraan Darat','Antariksa & Planet','Fantasi & Mitologi','Robot & Android']) {
    assert.ok(domainText.includes(term), 'missing domain: ' + term);
  }
});

test('illustrations contain independently animated semantic parts, not an enclosing frame', () => {
  const start = source.indexOf('function svgFor(l,small=false){');
  const end = source.indexOf('function rectSvg(', start);
  assert.ok(start >= 0 && end > start, 'svgFor function and helper boundary must exist');
  const fnSource = source.slice(start, end).trim();
  const svgFor = new Function('esc', 'rectSvg', 'return (' + fnSource + ');')(
    value => String(value).replace(/[&<>"']/g, ''),
    (x,y,w,h,fill) => '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'"/>'
  );
  const families = new Set();
  const uniqueArtwork = new Set();
  let minParts = Infinity;
  for (let i = 0; i < 1500; i++) {
    const svg = svgFor({ logoIndex:i, id:'same', name:'Same concept', color:'#ffbd45', accent:'#55c7dc', style:'Flat Color' });
    uniqueArtwork.add(svg);
    const family = svg.match(/data-illustration-family="(\d+)"/);
    if (family) families.add(family[1]);
    const parts = (svg.match(/data-part="/g) || []).length;
    minParts = Math.min(minParts, parts);
    assert.ok(parts >= 5, 'concept '+i+' needs multiple semantic parts');
    assert.match(svg, /@keyframes .*reveal/);\n    assert.match(svg, /@keyframes .*orbit/);\n    assert.match(svg, /data-part=\"body\"/);\n    assert.doesNotMatch(svg, /data-part=\"signature-(?:crest|emblem)\"/, 'no universal diamond or crest overlay');
    assert.doesNotMatch(svg, /<rect[^>]*(?:width="(?:100%|240)"|height="(?:100%|240)")/, 'no enclosing frame');
  }
  assert.equal(families.size, 15, 'all fifteen illustration families must be represented');
  assert.equal(uniqueArtwork.size, 1500, 'all 1,500 concepts must render structurally distinct artwork, not only unique labels or IDs');
  assert.ok(minParts >= 5);
});
