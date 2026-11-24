'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#itcvModeBtn', { timeout: 20000 });

    const assets = await page.evaluate(async () => {
      function dataUrl(color, mask) {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const x = c.getContext('2d');
        x.fillStyle = mask ? '#000' : '#152c3c'; x.fillRect(0, 0, 64, 64);
        x.fillStyle = color; x.fillRect(16, 18, 32, 30);
        return c.toDataURL('image/png');
      }
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = '#172d40'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#d5a43d'; x.fillRect(16, 18, 32, 30);
      const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
      return {
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
        image: c.toDataURL('image/png'),
        mask: dataUrl('#fff', true)
      };
    });
    const imageBuffer = Buffer.from(assets.bytes);

    await page.route('http://127.0.0.1:11434/**', async route => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
        'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Private-Network': 'true'
      }});
      if (req.url().endsWith('/api/tags')) return route.fulfill({
        status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ models: [{ name: 'qwen2.5vl:3b' }] })
      });
      if (req.url().endsWith('/api/chat')) {
        const body = req.postDataJSON();
        const prompt = body.messages?.[0]?.content || '';
        const content = prompt.includes('universal object-motion director')
          ? JSON.stringify({ parts: [{ segmentId: 'sam-1', name: 'Roda depan', category: 'vehicle', motion: 'wheel', pivotX: 0.25, pivotY: 0.62, parent: 'Bodi mobil' }] })
          : JSON.stringify({ description: 'Product vehicle motion', layers: [], components: [{ name: 'Roda depan', category: 'vehicle', motion: 'wheel' }] });
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ message: { role: 'assistant', content } }) });
      }
      return route.fulfill({ status: 404, body: '{"error":"unexpected Ollama route"}' });
    });

    let autoRequestId = '';
    await page.route('http://127.0.0.1:11436/**', async route => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
        'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Private-Network': 'true'
      }});
      if (req.url().endsWith('/api/health')) return route.fulfill({
        status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, engine: 'SAM 2.1 Hiera Tiny', device: 'cpu', model_loaded: true, checkpoint: true })
      });
      if (req.url().endsWith('/api/segment/status')) return route.fulfill({
        status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, requestId: autoRequestId, phase: 'sampling', progress: 56, completed: 11, total: 20, message: 'SAM 2.1 menganalisis area 12/20…', active: true, device: 'cpu' })
      });
      if (req.url().endsWith('/api/segment/auto')) {
        autoRequestId = req.postDataJSON().requestId;
        await new Promise(resolve => setTimeout(resolve, 800));
        return route.fulfill({
          status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ ok: true, requestId: autoRequestId, width: 64, height: 64, device: 'cpu', segments: [{
            id: 'sam-1', score: .96, area: 960, areaRatio: .23,
            bbox: [16, 18, 32, 30], mask: assets.mask
          }] })
        });
      }
      if (req.url().endsWith('/api/inpaint')) return route.fulfill({
        status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, background: assets.image, width: 64, height: 64 })
      });
      return route.fulfill({ status: 404, body: '{"error":"unexpected SAM route"}' });
    });

    await page.locator('#itcvModeBtn').click();
    await page.waitForSelector('#itcvRigAuto');
    await page.waitForFunction(() => document.getElementById('itcvVisionModel')?.value === 'qwen2.5vl:3b');
    await page.locator('#itcvFiles').setInputFiles({
      name: 'vehicle.png', mimeType: 'image/png', buffer: imageBuffer
    });
    await page.waitForFunction(() => document.querySelector('#itcvThumbs img')?.complete === true);

    await page.locator('#itcvGenerate').click();
    await page.waitForFunction(() => { const html=document.getElementById('itcvHtml')?.value||''; return html.includes('<!doctype html>') && html.includes('@keyframes'); }, { timeout: 20000 });

    await page.locator('#itcvRigCheck').click();
    await page.waitForFunction(() => document.getElementById('itcvRigStatus')?.textContent.includes('SAM 2.1 Tiny terhubung'), { timeout: 10000 });
    assert.equal(await page.locator('#itcvRigCheck').textContent(), 'SAM 2.1 Terhubung');

    await page.locator('#itcvRigAuto').click();
    await page.waitForFunction(() => Number(document.getElementById('itcvRigProgressBar')?.value || 0) >= 50, { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('#itcvRigParts input[type="text"]')?.value === 'Roda depan', { timeout: 20000 });
    assert.equal(await page.locator('#itcvRigAuto').isEnabled(), true, 'Segmentation button must be released after inference completes');
    assert.match(await page.locator('#itcvRigProgressText').innerText(), /100%/, 'Completed segmentation should show 100% progress');
    assert.equal(await page.locator('#itcvRigParts select').first().inputValue(), 'wheel');

    await page.locator('#itcvRigBuild').click();
    await page.waitForFunction(() => { const html=document.getElementById('itcvHtml')?.value||''; return html.includes('Roda depan') && html.includes('class="rig-canvas"') && html.includes('class="part part-0"') && html.includes('@keyframes trozal-part-0'); }, { timeout: 20000 });
    const html = await page.locator('#itcvHtml').inputValue();
    assert.doesNotMatch(html, /<script\b|\bimport\s*\(/i, 'Importer-safe OLLAMA HTML must not contain JavaScript or module imports.');
    await page.frameLocator('#itcvPreview').locator('.part-0').waitFor({ timeout: 10000 });
    assert.notEqual(await page.frameLocator('#itcvPreview').locator('.part-0').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.deepEqual(errors, [], 'Unexpected Browser page errors');

    // The segmentation button must still explain the failure when its optional
    // controller script cannot be loaded; it must not remain visually inert.
    const fallbackPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const fallbackErrors = [];
    fallbackPage.on('pageerror', error => fallbackErrors.push(error.message));
    await fallbackPage.route('**/js/ollama-universal-object-rig.js*', route => route.abort());
    await fallbackPage.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
    await fallbackPage.waitForSelector('#itcvModeBtn', { timeout: 20000 });
    await fallbackPage.locator('#itcvModeBtn').click();
    await fallbackPage.locator('#itcvFiles').setInputFiles({
      name: 'vehicle.png', mimeType: 'image/png', buffer: imageBuffer
    });
    await fallbackPage.locator('#itcvRigAuto').click();
    await fallbackPage.waitForFunction(() => /Controller Universal Rig tidak siap/.test(document.getElementById('itcvRigStatus')?.textContent || ''), { timeout: 5000 });
    assert.equal(await fallbackPage.locator('#itcvRigAuto').isEnabled(), true, 'Fallback should release the button when controller initialization fails');
    assert.equal(await fallbackPage.locator('#itcvRigAuto').textContent(), 'AI Segmentasi Komponen');
    assert.deepEqual(fallbackErrors, [], 'Controller-load fallback must not throw browser errors');
    await fallbackPage.close();

    console.log('PASS: OLLAMA Universal Rig SAM progress, responsive fallback, masks, Qwen labels and self-contained preview.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
