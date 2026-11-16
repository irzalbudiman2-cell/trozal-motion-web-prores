const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const appSource = fs.readFileSync('index.html', 'utf8');

assert.match(appSource, /trozalReadOllamaStream\(response,\(partial,meta\)=>\s*\$\('visualMotionOutput'\)\.value=partial;/, 'Generated code should appear in the output editor incrementally while streaming');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const encoder = new TextEncoder();
    const chunks = [
      JSON.stringify({ message: { content: '<svg>' }, done: false }) + '\n',
      JSON.stringify({ message: { content: '<circle cx="10" cy="10"/>' }, done: false }) + '\n',
      JSON.stringify({ message: { content: '</svg>' }, done: true, eval_count: 42 }) + '\n'
    ];
    const stream = new ReadableStream({
      start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close(); }
    });
    const progress = [];
    const response = new Response(stream, { headers: { 'content-type': 'application/x-ndjson' } });
    const parsed = await trozalReadOllamaStream(response, (text, meta) => progress.push({ text, done: !!meta?.item?.done }));
    return { content: parsed.content, evalCount: parsed.data.eval_count, progress };
  });
  assert.equal(result.content, '<svg><circle cx="10" cy="10"/></svg>');
  assert.equal(result.evalCount, 42);
  assert.equal(result.progress.length, 3, 'Each streamed NDJSON content chunk should update progress');
  assert.equal(result.progress.at(-1).done, true);
  const splitChunk = await page.evaluate(async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ message: { content: 'Halo 世界 🌍' }, done: true }));
    const cuts = [bytes.slice(0, 7), bytes.slice(7, 13), bytes.slice(13)];
    const stream = new ReadableStream({ start(controller) { for (const chunk of cuts) controller.enqueue(chunk); controller.close(); } });
    const progress = [];
    const parsed = await trozalReadOllamaStream(new Response(stream), text => progress.push(text));
    return { content: parsed.content, done: parsed.data.done, progressCount: progress.length };
  });
  assert.equal(splitChunk.content, 'Halo 世界 🌍', 'UTF-8 and JSON records split across network chunks must be reconstructed');
  assert.equal(splitChunk.done, true, 'Final NDJSON record without a newline must still be parsed');
  assert.equal(splitChunk.progressCount, 1);
  const malformed = await page.evaluate(async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{not-json}\n')); controller.close(); } });
    try { await trozalReadOllamaStream(new Response(stream), () => {}); return ''; }
    catch (error) { return error.message; }
  });
  assert.match(malformed, /NDJSON Ollama tidak valid pada baris 1/);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', streamedChunks: result.progress.length, finalLength: result.content.length }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
