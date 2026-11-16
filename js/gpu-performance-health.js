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
 
 // Contextual controls: expose the existing hybrid decision and always-on IP guardrail.
 function mountCanvasAndIpPanels(){
  const healthPanel=byId('gpuPerformanceHealthPanel');
  if(!healthPanel||byId('trozalCanvasControlPanel'))return;
  const style=document.createElement('style');
  style.textContent=`
   #trozalCanvasControlPanel{border:1px solid #4b9bc7;background:linear-gradient(145deg,#12344a,#0b2232);color:#e6f5ff}
   #trozalCanvasControlPanel h3{color:#bceaff}
   #trozalCanvasControlPanel .canvas-ui-card{padding:8px;margin:7px 0;border:1px solid #326985;border-radius:8px;background:#071d2a}
   #trozalCanvasControlPanel .canvas-ui-label{display:block;color:#9dcce4;font-size:9px;text-transform:uppercase;letter-spacing:.06em}
   #trozalCanvasControlPanel .canvas-ui-value{display:block;color:#effaff;font-size:12px;font-weight:700;margin-top:3px;overflow-wrap:anywhere}
   #trozalCanvasControlPanel .canvas-ui-results{display:grid;gap:5px;margin-top:7px}
   #trozalCanvasControlPanel .canvas-ui-results div{font-size:10px;color:#c9e5f3;padding:6px;border-radius:6px;background:#102c3d}
   #trozalCanvasControlPanel button{width:100%;margin-top:6px}
   #trozalIpGuardrailPanel{border:1px solid #9b7bce;background:linear-gradient(145deg,#30234b,#1a1530);color:#f0eaff}
   #trozalIpGuardrailPanel h3{color:#e4d2ff}
   #trozalIpGuardrailPanel .ip-state{padding:8px;border:1px solid #7153a2;border-radius:8px;background:#1c1530;color:#d9c8ff;font-size:11px;font-weight:700}
   #trozalIpGuardrailPanel ul{padding-left:18px;margin:8px 0;color:#e0d6f2;font-size:10px;line-height:1.55}
   #trozalIpGuardrailPanel details{border-top:1px solid #594477;margin-top:8px;padding-top:7px}
   #trozalIpGuardrailPanel summary{cursor:pointer;color:#d8c2ff;font-size:10px;font-weight:700}
   #trozalIpGuardrailPanel .ip-note{font-size:10px;color:#bdaed5;line-height:1.5;margin-top:7px}
  `;
  document.head.append(style);
  const canvas=document.createElement('section');
  canvas.className='panel';canvas.id='trozalCanvasControlPanel';
  canvas.innerHTML=`
   <h3>◈ CANVAS RENDER CONTROL</h3>
   <p class="help">Pantau keputusan Hybrid Canvas dan benchmark yang dijalankan otomatis. Panel ini tidak mengubah resolusi atau FPS proyek.</p>
   <div class="canvas-ui-card"><span class="canvas-ui-label">Renderer aktif</span><span class="canvas-ui-value" id="trozalCanvasUiMode">Menunggu benchmark…</span></div>
   <div class="canvas-ui-card"><span class="canvas-ui-label">Kebijakan</span><span class="canvas-ui-value">HYBRID · BALANCED · otomatis</span><small>GPU Assist hanya dipilih jika minimal 15% lebih cepat pada 720p dan 1080p. Selain itu Canvas2D tetap digunakan.</small></div>
   <div class="canvas-ui-card"><span class="canvas-ui-label">Alasan pemilihan</span><span class="canvas-ui-value" id="trozalCanvasUiReason">Benchmark belum selesai.</span></div>
   <div class="canvas-ui-results" id="trozalCanvasUiResults"><div>Hasil benchmark akan tampil di sini.</div></div>
   <button type="button" id="trozalCanvasUiRefresh">↻ Perbarui status perangkat</button>
   <button type="button" id="trozalCanvasUiSpeed">⚡ Buka pengaturan kecepatan render</button>
   <p class="help">Kecepatan Normal/TURBO tetap diatur melalui kontrol Render utama. Panel ini tidak memaksakan GPU jika hasil benchmark lebih lambat.</p>
  `;
  const ip=document.createElement('section');
  ip.className='panel';ip.id='trozalIpGuardrailPanel';
  ip.innerHTML=`
   <h3>◇ ORIGINAL CONTENT & IP GUARDRAILS</h3>
   <div class="ip-state">● PERLINDUNGAN PROMPT AKTIF · OTOMATIS</div>
   <p class="help">Aturan orisinalitas disisipkan otomatis ke instruksi AI. Tidak perlu mengaktifkan ulang setiap kali membuat prompt atau adegan.</p>
   <ul>
    <li>Hindari karakter, semesta fiksi, karya seni, desain, dan identitas pihak ketiga yang dilindungi.</li>
    <li>Jangan menampilkan logo, merek dagang, watermark, tanda tangan, atau identitas perusahaan yang dikenali.</li>
    <li>Gunakan subjek fiktif, objek generik tanpa merek, komposisi baru, dan bahasa visual orisinal.</li>
    <li>Jangan menyalin lirik, kutipan, teks, screenshot, atau materi visual berhak cipta.</li>
   </ul>
   <details><summary>Lihat cakupan dan cara kerja</summary>
    <p class="ip-note">Guardrail diterapkan pada instruksi AI untuk pembuatan Visual Motion lokal Ollama dan jalur prompt AI yang mengintegrasikan kebijakan orisinalitas. Jika brief meminta IP terlindungi, AI diarahkan mengubahnya menjadi alternatif orisinal yang tidak menyalin elemen khas.</p>
   </details>
   <p class="ip-note">Catatan: ini adalah pengaman instruksi AI, bukan pemeriksaan hukum atau jaminan bahwa setiap keluaran pasti bebas pelanggaran.</p>
  `;
  healthPanel.insertAdjacentElement('afterend',canvas);
  canvas.insertAdjacentElement('afterend',ip);
  function renderCanvasStatus(){
   const status=window.TrozalHybridCanvasRenderer?.getStatus?.()||window.__trozalHybridCanvasStatus||{};
   const mode=byId('trozalCanvasUiMode'),reason=byId('trozalCanvasUiReason'),results=byId('trozalCanvasUiResults');
   if(mode)mode.textContent=status.ready?(status.strategy==='gpu-assist'?'GPU Assist · benchmark menang':'Canvas2D · fallback aktif'):'Benchmark berjalan / menunggu render pertama';
   if(reason)reason.textContent=status.reason||'Belum ada hasil benchmark.';
   if(results){
    results.replaceChildren();
    const rows=status.benchmark?.results||[];
    if(!rows.length){const row=document.createElement('div');row.textContent='Hasil 720p dan 1080p akan tampil setelah benchmark selesai.';results.append(row);}
    rows.forEach(item=>{const row=document.createElement('div');row.textContent=item.resolution+': Canvas2D '+item.canvas2dMedianMs+' ms · GPU Assist '+item.gpuAssistMedianMs+' ms · '+item.winner;results.append(row);});
   }
  }
  window.addEventListener('trozal:hybrid-canvas-status',renderCanvasStatus);
  byId('trozalCanvasUiRefresh')?.addEventListener('click',async()=>{
   const button=byId('trozalCanvasUiRefresh');button.disabled=true;
   try{await window.TrozalGpuPerformanceHealth?.check?.();renderCanvasStatus();}
   catch(error){setText('gpuPerformanceHealthStatus','Pemeriksaan gagal: '+(error?.message||String(error)));}
   finally{button.disabled=false;}
  });
  byId('trozalCanvasUiSpeed')?.addEventListener('click',()=>{
   const target=byId('renderSpeedMode');
   target?.scrollIntoView({behavior:'smooth',block:'center'});
   target?.focus({preventScroll:true});
  });
  renderCanvasStatus();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountCanvasAndIpPanels,{once:true});
 else mountCanvasAndIpPanels();

})();