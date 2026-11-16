'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({path:require.resolve('jszip/dist/jszip.min.js')});
  await page.waitForFunction(()=>!!window.TrozalHybridCanvasRenderer&&!!window.TrozalGpuFramePipeline);
  const status=await page.evaluate(()=>window.TrozalHybridCanvasRenderer.prepare());
  assert.equal(status.mode,'hybrid');assert.equal(status.ready,true);
  assert.ok(['gpu-assist','canvas2d'].includes(status.strategy));
  await page.locator('#gpuPerformanceHealthCheck').click();
  await page.waitForFunction(()=>/KONDISI API GRAFIS|PERLU PERHATIAN/.test(document.querySelector('#gpuPerformanceHealthStatus')?.textContent||''));
  assert.equal(await page.locator('#gpuPerformanceHealthPanel').count(),1);
  assert.equal(await page.locator('#mp4Bitrate').count(),1);
  assert.equal(await page.locator('#ollamaModelRefreshBtn').count(),1);
  assert.equal(await page.locator('#stage').count(),1);
  assert.equal(await page.locator('#timelineTabs').count(),1);
  assert.equal(await page.locator('#renderBtn').count(),1);
  assert.equal(await page.locator('#format option[value="mov"]').count(),1);
  assert.equal(await page.locator('#format option[value="pngseq"]').count(),1);
  await page.locator('#fileInput').setInputFiles({name:'hybrid-canvas-smoke.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=','base64')});
  await page.waitForFunction(()=>{const image=document.querySelector('#object img');return !!image&&image.complete&&image.naturalWidth>0;});
  await page.evaluate(()=>{
   document.getElementById('resolution').value='1280x720';
   document.getElementById('duration').value='1';
   const fps=document.getElementById('fps');if(![...fps.options].some(o=>o.value==='1')){const o=document.createElement('option');o.value='1';o.textContent='1';fps.append(o);}fps.value='1';
   document.getElementById('format').value='pngseq';
  });
  await page.locator('#renderBtn').click();
  await page.waitForFunction(()=>/PNG Sequence selesai|Render gagal|dibatalkan/i.test(document.getElementById('exportStatus')?.textContent||''),null,{timeout:30000});
  const exportStatus=await page.locator('#exportStatus').innerText();
  assert.match(exportStatus,/PNG Sequence selesai/);
  assert.deepEqual(errors,[]);
  console.log('Ollama hybrid Canvas benchmark, GPU health UI, bitrate UI, and PNG export smoke passed:',JSON.stringify({strategy:status.strategy,benchmark:status.benchmark?.results||null,exportStatus}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
