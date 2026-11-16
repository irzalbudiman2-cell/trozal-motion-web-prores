const { chromium } = require('playwright');
const assert = require('node:assert/strict');

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
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', streamedChunks: result.progress.length, finalLength: result.content.length }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
