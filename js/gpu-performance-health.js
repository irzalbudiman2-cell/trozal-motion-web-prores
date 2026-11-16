/* TROZAL GPU & PERFORMANCE HEALTH · local-only diagnostics */
(() => {
 'use strict';
 const byId=id=>document.getElementById(id);
 const setText=(id,value)=>{const el=byId(id);if(el)el.textContent=String(value);};
 const cards=(items)=>{const host=byId('gpuPerformanceHealthStats');if(!host)return;host.replaceChildren();items.forEach(([label,value])=>{const card=document.createElement('div'),b=document.createElement('b'),span=document.createElement('span');b.textContent=label;span.textContent=value;card.append(b,span);host.append(card);});};
 async function check(){
  setText('gpuPerformanceHealthStatus','Memeriksa WebGPU, WebGL2, Canvas2D, dan beban proyek…');
  const nav=navigator,canvas=document.createElement('canvas'),canvas2d=document.createElement('canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),ctx=canvas2d.getContext('2d');
  let webgpu='Tidak tersedia',adapter=null;
  try{
   if(nav.gpu&&typeof nav.gpu.requestAdapter==='function'){
    adapter=await Promise.race([nav.gpu.requestAdapter(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),2500))]);
    webgpu=adapter?'Tersedia':'Tidak ada adapter';
   }
  }catch(error){webgpu='Tidak dapat diinisialisasi';}
  let renderer='Tidak diketahui',maxTexture='—';
  if(gl){
   try{const ext=gl.getExtension('WEBGL_debug_renderer_info');renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);maxTexture=String(gl.getParameter(gl.MAX_TEXTURE_SIZE))+' px';}catch(_){}
  }
  const threads=Number(nav.hardwareConcurrency||0),ram=Number(nav.deviceMemory||0);
  const resolution=String(byId('resolution')?.value||'1920x1080').split('x').map(Number);
  const width=resolution[0]||1920,height=resolution[1]||1080,fps=Math.max(1,Number(byId('fps')?.value)||30),duration=Math.max(.1,Number(byId('duration')?.value)||10);
  const frameMb=width*height*4/1048576,frames=Math.ceil(fps*duration),bufferGb=frameMb*frames/1024;
  const hybrid=window.TrozalHybridCanvasRenderer?.getStatus?.();
  cards([
   ['WebGPU',webgpu],
   ['WebGL2 / WebGL',gl?((typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext)?'WebGL2':'WebGL'):'Tidak tersedia'],
   ['Canvas2D',ctx?'Tersedia':'Tidak tersedia'],
   ['CPU threads',threads?String(threads):'Tidak dilaporkan'],
   ['RAM terdeteksi',ram?ram+' GB (indikatif)':'Tidak dilaporkan'],
   ['GPU renderer',renderer.slice(0,70)],
   ['Max texture',maxTexture],
   ['Buffer / frame',frameMb.toFixed(1)+' MB'],
   ['Estimasi buffer frame',bufferGb.toFixed(2)+' GB · '+frames+' frame']
  ]);
  const scoreWarnings=[];
  if(!gl)scoreWarnings.push('WebGL tidak tersedia');
  if(ram&&bufferGb>ram*.35)scoreWarnings.push('estimasi buffer frame tinggi dibanding RAM terdeteksi');
  if(width>=3840&&fps>=60)scoreWarnings.push('4K/60 FPS berpotensi berat');
  const health=scoreWarnings.length?'PERLU PERHATIAN · '+scoreWarnings.join('; '):'KONDISI API GRAFIS TERSEDIA · periksa hasil benchmark untuk memilih jalur render';
  setText('gpuPerformanceHealthStatus',health+' · Hybrid: '+(hybrid?.strategy||'belum benchmark')+(hybrid?.reason?' · '+hybrid.reason:''));
  const origin=window.location.origin;
  setText('ollamaAllowedOrigin',origin);setText('ollamaAllowedOriginInline',origin);
  return {webgpu,webgl:!!gl,canvas2d:!!ctx,threads,ram,renderer,maxTexture,frameMb,bufferGb,hybrid};
 }
 const button=byId('gpuPerformanceHealthCheck');
 if(button)button.addEventListener('click',async()=>{button.disabled=true;try{await check();}catch(error){setText('gpuPerformanceHealthStatus','Pemeriksaan gagal: '+(error?.message||String(error)));}finally{button.disabled=false;}});
 window.TrozalGpuPerformanceHealth=Object.freeze({check});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>check().catch(()=>{}),{once:true});else check().catch(()=>{});
})();
