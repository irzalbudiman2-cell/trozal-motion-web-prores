const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.trozalOpenImageToCodeVideo === 'function', null, { timeout: 15000 });
  await page.evaluate(() => window.trozalOpenImageToCodeVideo());
  await page.waitForSelector('#itcvRatio');

  const ratios = await page.locator('#itcvRatio option').evaluateAll(options => options.map(option => option.value));
  for (const ratio of ['16:9','9:16','1:1','4:5','3:4','2:3','3:2','4:3','5:4','21:9','custom']) {
    assert.ok(ratios.includes(ratio), 'Missing Mode 5 preview ratio ' + ratio);
  }
  assert.equal(await page.locator('#itcvCustomRatioFields').isVisible(), false);

  await page.locator('#itcvFiles').setInputFiles({
    name: 'preview-ratio.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  });
  await page.locator('#itcvTemplate').click();
  await page.waitForFunction(() => {
    const frame = document.getElementById('itcvPreview');
    return frame?.contentDocument?.readyState === 'complete' &&
      frame.contentDocument.querySelector('.camera') &&
      frame.contentDocument.getAnimations({subtree:true}).length > 0;
  }, null, { timeout: 15000 });

  await page.locator('#itcvRatio').selectOption('9:16');
  await page.waitForFunction(() => document.querySelector('#itcvPreview')?.style.aspectRatio === '9 / 16');
  await page.waitForFunction(() => document.querySelector('#itcvPreview')?.contentDocument?.documentElement?.innerHTML.includes('56.25vh'));

  const loop = page.locator('#itcvLoop');
  assert.equal(await loop.getAttribute('aria-pressed'), 'true', 'Loop should default to ON');
  await loop.click();
  assert.equal(await loop.getAttribute('aria-pressed'), 'false', 'Loop toggle should turn OFF');
  assert.match(await loop.innerText(), /Loop OFF/);
  const oneShotIterations = await page.locator('#itcvPreview').evaluate(frame =>
    frame.contentDocument.getAnimations({subtree:true})[0].effect.getTiming().iterations
  );
  assert.equal(oneShotIterations, 1, 'Loop OFF must make preview animations play for one iteration');

  await loop.click();
  assert.equal(await loop.getAttribute('aria-pressed'), 'true', 'Loop toggle should turn ON again');
  const loopIterations = await page.locator('#itcvPreview').evaluate(frame =>
    frame.contentDocument.getAnimations({subtree:true})[0].effect.getTiming().iterations
  );
  assert.equal(loopIterations, Infinity, 'Loop ON must restore infinite iteration');

  const guides = page.locator('#itcvGuides');
  await guides.click();
  assert.equal(await guides.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#itcvPreviewGuides').isVisible(), true);
  const guideBox = await page.locator('#itcvPreviewGuides').boundingBox();
  const previewBox = await page.locator('#itcvPreview').boundingBox();
  assert.ok(Math.abs(guideBox.width - previewBox.width) < 2, 'Guides should align to the live preview width');
  assert.ok(Math.abs(guideBox.height - previewBox.height) < 2, 'Guides should align to the live preview height');
  await guides.click();
  assert.equal(await page.locator('#itcvPreviewGuides').isVisible(), false);

  await page.locator('#itcvRatio').selectOption('custom');
  assert.equal(await page.locator('#itcvCustomRatioFields').isVisible(), true);
  await page.locator('#itcvCustomRatioWidth').fill('1080');
  await page.locator('#itcvCustomRatioHeight').fill('1920');
  await page.locator('#itcvCustomRatioHeight').dispatchEvent('change');
  await page.waitForFunction(() => document.querySelector('#itcvPreview')?.style.aspectRatio === '1080 / 1920');
  await page.waitForFunction(() => document.querySelector('#itcvPreview')?.contentDocument?.documentElement?.innerHTML.includes('56.25vh'));
  assert.match(await page.locator('#itcvMeta').innerText(), /1080×1920/);

  assert.deepEqual(errors, [], 'Unexpected browser page errors');
  console.log(JSON.stringify({
    result: 'PASS',
    ratios: ratios.length - 1,
    customRatio: '1080:1920',
    loop: 'ON/OFF applies Web Animations iteration count',
    guides: 'thirds + center + 90% safe area toggle',
    errors
  }, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
