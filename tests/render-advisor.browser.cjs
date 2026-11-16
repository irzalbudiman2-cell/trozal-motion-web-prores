'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#renderAdvisorAnalyze');
  await page.locator('#resolution').selectOption('3840x2160');
  await page.locator('#fps').selectOption('60');
  await page.locator('#duration').fill('20');
  await page.locator('#renderAdvisorAnalyze').click();
  const status=await page.locator('#renderAdvisorStatus').innerText();
  assert.match(status,/Rekomendasi: TURBO/);
  assert.equal(await page.locator('#renderAdvisorApply').isVisible(),true);
  assert.equal(await page.locator('#resolution').inputValue(),'3840x2160');
  assert.equal(await page.locator('#fps').inputValue(),'60');
  await page.locator('#renderAdvisorApply').click();
  assert.equal(await page.locator('#renderSpeedMode').inputValue(),'turbo');
  assert.equal(await page.locator('#resolution').inputValue(),'3840x2160');
  assert.equal(await page.locator('#fps').inputValue(),'60');
  await page.locator('#resolution').selectOption('1280x720');
  await page.locator('#fps').selectOption('24');
  await page.locator('#renderAdvisorAnalyze').click();
  assert.match(await page.locator('#renderAdvisorStatus').innerText(),/Rekomendasi: Normal/);
  assert.deepEqual(errors,[]);
  console.log('PASS: adaptive advisor recommendations, explicit apply, and resolution/FPS preservation');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});