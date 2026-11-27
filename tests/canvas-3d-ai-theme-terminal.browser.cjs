'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
function scene(name='Terminal Scene',duration=6){
 const objects=[
  ['hero',name+' Hero','sphere',0,0,0,'#36c7dc','spin'],
  ['stage','Stage','cylinder',0,-1,0,'#26364f','none'],
  ['accent','Accent','torus',0,.8,0,'#9a82f5','orbit'],
  ['detail','Detail','cube',1,.2,.4,'#f2a84b','pulse']
 ].map(([id,objName,type,x,y,z,color,animation])=>({id,name:objName,type,x,y,z,rx:0,ry:12,rz:0,sx:1,sy:1,sz:1,color,metallic:.3,roughness:.34,emission:0,materialPreset:'custom',animation,speed:.5,amount:.4,parentId:null,keyframes:[]}));
 return {version:2,duration,fps:30,loop:true,light:1.2,showGrid:true,camera:{yaw:.5,pitch:.25,distance:7,projection:'perspective',orthoScale:4.8,target:[0,0,0]},lights:[{name:'Key',x:-3,y:4,z:4,color:'#ffe2b5',intensity:1.2},{name:'Fill',x:3,y:1,z:2,color:'#6caeff',intensity:.7},{name:'Rim',x:0,y:3,z:-4,color:'#a98cff',intensity:.9}],objects,selected:'hero',playhead:0};
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
  const errors=[],ollamaPrompts=[];
  page.on('pageerror',error=>errors.push(error.stack||error.message));
  await page.route('http://127.0.0.1:11434/**',async route=>{
   const request=route.request(),url=request.url();
   if(url.endsWith('/api/tags'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({models:[{name:'qwen3.5:4b'}]})});
   if(url.endsWith('/api/chat')&&request.method()==='POST'){
    const payload=request.postDataJSON(),user=payload.messages?.find(m=>m.role==='user')?.content||'';
    ollamaPrompts.push(user);
    if(user.includes('CONCEPT SLOT:')){
     const slot=Number((user.match(/CONCEPT SLOT:\s*(\d+)/)||[])[1]||ollamaPrompts.length);
     const concept={title:'OLLAMA Concept '+slot,pitch:'Concept '+slot+' · original design',scene:scene('Concept '+slot,6+slot)};
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({model:'qwen3.5:4b',message:{role:'assistant',content:JSON.stringify(concept)},done:true})});
    }
    if(user.includes('You are a senior procedural JavaScript 3D scene author')){
     const output='return '+JSON.stringify(scene('Terminal JavaScript Scene',4))+';';
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({model:'qwen3.5:4b',message:{role:'assistant',content:output},done:true})});
    }
    if(user.includes('You are a senior procedural 3D scene designer')){
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({model:'qwen3.5:4b',message:{role:'assistant',content:JSON.stringify(scene('Terminal JSON Scene',5))},done:true})});
    }
    return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Unexpected Ollama request in browser test.'})});
   }
   if(url.endsWith('/api/generate'))return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Unexpected fallback request.'})});
   return route.continue();
  });
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#trozalCanvas3DOpen',{timeout:15000});
  await page.locator('#trozalCanvas3DOpen').click();
  await page.waitForSelector('#trozal3DAIThemePanel',{timeout:15000});
  assert.equal(await page.locator('#trozal3DAITheme option').count(),333,'All 333 themes must load.');
  assert.ok((await page.locator('#trozal3DAIIPPanel').innerText()).includes('KEKAYAAN INTELEKTUAL'),'IP panel must be visible beside theme generation.');
  const firstTheme=await page.locator('#trozal3DAITheme').inputValue();
  await page.locator('#trozal3DAIRandom').click();
  const randomTheme=await page.locator('#trozal3DAITheme').inputValue();
  assert.ok(randomTheme&&randomTheme!==firstTheme,'Acak Tema must select a different theme.');
  await page.locator('#trozal3DAIThemeSearch').fill('');
  await page.locator('#trozal3DAITheme').selectOption('Space & Astronomy');
  const spaceProfile=await page.evaluate(()=>window.trozalGetThemeDomainProfile('Space & Astronomy'));
  const visibleSpaceCategories=await page.locator('#trozal3DAICategory option').allTextContents();
  for(const category of spaceProfile.styles)assert.ok(visibleSpaceCategories.includes(category),'Theme category profile is missing '+category+'.');
  assert.ok(visibleSpaceCategories.length>=spaceProfile.styles.length,'Theme Studio may add supported direction presets but must retain all domain categories.');
  await page.locator('#trozal3DAIExtra').fill('Podium obsidian, aksen cyan, kamera orbit perlahan dan material brushed titanium.');
  await page.locator('#trozal3DAICheck').click();
  await page.waitForFunction(()=>document.getElementById('trozal3DAIStatus')?.textContent.includes('OLLAMA TERHUBUNG'));
  assert.match(await page.locator('#trozal3DAIStatus').innerText(),/qwen3\.5:4b tersedia/);
  await page.locator('#trozal3DAIGenerate').click();
  await page.waitForFunction(()=>document.getElementById('trozal3DAIStatus')?.textContent.includes('3 konsep siap dipilih'),{timeout:30000});
  assert.equal(await page.locator('#trozal3DAIConcepts [data-concept]').count(),3,'Three independent Ollama calls should produce three concepts.');
  const themePrompts=ollamaPrompts.filter(p=>p.includes('CONCEPT SLOT:'));
  assert.equal(themePrompts.length,3,'Each concept must be generated in a separate Ollama request.');
  for(const prompt of themePrompts){assert.ok(prompt.includes('MAIN THEME: Space & Astronomy'));assert.ok(prompt.includes('Podium obsidian, aksen cyan'));assert.ok(prompt.includes('INTELLECTUAL PROPERTY POLICY'));}
  await page.locator('#trozal3DAIConcepts [data-concept="1"]').click();
  assert.match(await page.locator('#trozal3DAIJson').inputValue(),/"duration": 8/,'Selecting concept 2 must switch the JSON editor to its own scene.');
  await page.locator('#trozal3DAIApply').click();
  let active=await page.evaluate(()=>window.TROZAL_CANVAS_3D.getProject());
  assert.equal(active.objects.length,4,'A selected generated concept must apply to Canvas 3D.');
  assert.equal(active.duration,8);
  // Ollama Terminal should share the selected theme brief and local model.
  await page.locator('#t3dTerminalOpen').click();
  await page.waitForFunction(()=>document.getElementById('t3dTerminalPanel')&&!document.getElementById('t3dTerminalPanel').hidden);
  assert.match(await page.locator('#t3dTerminalProvider').innerText(),/Ollama/);
  await page.locator('#t3dTerminalThemeBrief').click();
  const brief=await page.locator('#t3dTerminalPrompt').inputValue();
  assert.match(brief,/Space & Astronomy/);
  assert.match(brief,/Podium obsidian, aksen cyan/);
  // Generate / validate / apply Scene JSON v2.
  await page.locator('#t3dTerminalPrompt').fill('Buat scene komersial premium dengan podium dan material metal.');
  await page.locator('#t3dTerminalMode').selectOption('json');
  await page.locator('#t3dTerminalGenerate').click();
  await page.waitForFunction(()=>document.getElementById('t3dTerminalCode')?.value.includes('Terminal JSON Scene'),{timeout:20000});
  await page.locator('#t3dTerminalValidate').click();
  await page.waitForFunction(()=>document.getElementById('t3dTerminalStatus')?.textContent.includes('JSON valid'));
  await page.locator('#t3dTerminalApply').click();
  active=await page.evaluate(()=>window.TROZAL_CANVAS_3D.getProject());
  assert.equal(active.objects.length,4);
  assert.equal(active.duration,5);
  // Generate / sandbox / validate / apply JavaScript Scene Script.
  await page.locator('#t3dTerminalMode').selectOption('js');
  await page.locator('#t3dTerminalPrompt').fill('Buat scene 3D yang berbeda untuk uji JavaScript.');
  await page.locator('#t3dTerminalGenerate').click();
  await page.waitForFunction(()=>document.getElementById('t3dTerminalCode')?.value.includes('Terminal JavaScript Scene'),{timeout:20000});
  await page.locator('#t3dTerminalValidate').click();
  await page.waitForFunction(()=>document.getElementById('t3dTerminalStatus')?.textContent.includes('JavaScript berhasil'),{timeout:15000});
  await page.locator('#t3dTerminalApply').click();
  active=await page.evaluate(()=>window.TROZAL_CANVAS_3D.getProject());
  assert.equal(active.objects.length,4);
  assert.equal(active.duration,4);
  assert.deepEqual(errors,[],'No uncaught browser JavaScript errors are expected.');
  console.log(JSON.stringify({result:'PASS',themeCount:333,randomTheme:'PASS',ipPanelAndPrompt:'PASS',ollamaConnection:'PASS',threeSeparateConceptRequests:'PASS',selectedConceptApply:'PASS',terminalJsonGenerateValidateApply:'PASS',terminalJavascriptSandboxValidateApply:'PASS',pageErrors:errors.length},null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
