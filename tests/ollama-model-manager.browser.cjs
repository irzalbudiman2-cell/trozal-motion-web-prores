const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  const calls = { tags: 0, ps: 0, show: [] };
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.route('http://127.0.0.1:11434/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
      'access-control-allow-private-network': 'true',
      'content-type': 'application/json'
    };
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers });
    }
    if (path === '/api/tags') {
      calls.tags++;
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ models: [
        { name: 'scene-code:7b', size: 4200000000, modified_at: '2026-11-15T10:00:00Z', details: { family: 'qwen', parameter_size: '7B', quantization_level: 'Q4_K_M' } },
        { name: 'vision-lab:3b', size: 1900000000, modified_at: '2026-11-15T10:00:00Z', details: { family: 'qwen-vl', parameter_size: '3B', quantization_level: 'Q4_K_M' } },
        { name: 'embed-lab:latest', size: 330000000, modified_at: '2026-11-15T10:00:00Z', details: { family: 'nomic-bert', parameter_size: '0.3B', quantization_level: 'F16' } }
      ] }) });
    }
    if (path === '/api/ps') {
      calls.ps++;
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ models: [
        { name: 'vision-lab:3b', size: 1900000000, size_vram: 1250000000, expires_at: '2026-11-15T23:59:00Z' }
      ] }) });
    }
    if (path === '/api/show') {
      const payload = request.postDataJSON();
      calls.show.push(payload.model);
      const capabilities = payload.model === 'scene-code:7b'
        ? ['completion', 'tools']
        : payload.model === 'vision-lab:3b'
          ? ['completion', 'vision', 'tools']
          : ['embedding'];
      return route.fulfill({ status: 200, headers, body: JSON.stringify({
        details: { family: payload.model.startsWith('vision') ? 'qwen-vl' : 'qwen', parameter_size: payload.model.startsWith('embed') ? '0.3B' : (payload.model.startsWith('vision') ? '3B' : '7B'), quantization_level: 'Q4_K_M' },
        model_info: { 'general.architecture': 'qwen' },
        capabilities
      }) });
    }
    return route.fulfill({ status: 404, headers, body: JSON.stringify({ error: 'not found' }) });
  });

  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#ollamaModelRefreshBtn').click();
  await page.waitForFunction(() => document.getElementById('ollamaModelManagerStatus')?.textContent.includes('TERHUBUNG'));

  assert.equal(await page.locator('#ollamaModelManagerPanel').count(), 1, 'Model Manager panel should exist');
  assert.equal(await page.locator('.ollama-model-card').count(), 3, 'All installed models should be listed');
  assert.match(await page.locator('#ollamaModelManagerSummary').innerText(), /3/);
  assert.match(await page.locator('#ollamaModelManagerStatus').innerText(), /1 sedang dimuat/);
  assert.match(await page.locator('.ollama-model-card').filter({ hasText: 'vision-lab:3b' }).innerText(), /SEDANG DIMUAT/);
  assert.match(await page.locator('.ollama-model-card').filter({ hasText: 'vision-lab:3b' }).innerText(), /Vision/);

  const sceneOptions = await page.locator('#visualMotionAiModel option').evaluateAll(options => options.map(option => option.value));
  const visionOptions = await page.locator('#trozalVisionModel option').evaluateAll(options => options.map(option => option.value));
  assert.deepEqual(sceneOptions, ['scene-code:7b', 'vision-lab:3b'], 'Scene generation should only offer completion-capable models');
  assert.deepEqual(visionOptions, ['vision-lab:3b'], 'Vision should only offer models reporting the vision capability');
  assert.equal(await page.locator('#visualMotionAiModel').inputValue(), 'scene-code:7b');
  assert.equal(await page.locator('#trozalVisionModel').inputValue(), 'vision-lab:3b');

  await page.locator('#visualMotionAiCheckBtn').click();
  await page.waitForFunction(() => document.getElementById('visualMotionAiStatus')?.textContent.includes('TERHUBUNG'));
  await page.locator('#trozalVisionCheckBtn').click();
  await page.waitForFunction(() => document.getElementById('trozalVisionConnection')?.textContent.includes('TERHUBUNG'));

  assert.ok(calls.tags >= 3, 'Refresh and both Cek Ollama buttons should use the shared model manager');
  assert.ok(calls.ps >= 3, '/api/ps should be read during model refresh');
  assert.ok(calls.show.includes('scene-code:7b') && calls.show.includes('vision-lab:3b') && calls.show.includes('embed-lab:latest'), '/api/show should inspect each installed model');
  assert.deepEqual(pageErrors, [], 'No uncaught browser errors should occur');

  console.log(JSON.stringify({
    result: 'PASS',
    installedModels: 3,
    sceneModels: sceneOptions,
    visionModels: visionOptions,
    runningModel: 'vision-lab:3b',
    apiCoverage: calls,
    checked: ['Dynamic /api/tags discovery', '/api/show capability inspection', '/api/ps loaded-model status', 'Task-aware model selectors', 'Both legacy Cek Ollama buttons use shared manager']
  }, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
