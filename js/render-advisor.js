(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const analyze = $('renderAdvisorAnalyze');
  const apply = $('renderAdvisorApply');
  const status = $('renderAdvisorStatus');
  const resolution = $('resolution');
  const fps = $('fps');
  const duration = $('duration');
  const speed = $('renderSpeedMode');
  if (!analyze || !apply || !status || !resolution || !fps || !duration || !speed) return;
  let recommended = 'normal';
  const parseResolution = value => {
    const match = String(value || '').match(/(\d+)\s*x\s*(\d+)/i);
    return match ? { width:Number(match[1]), height:Number(match[2]) } : null;
  };
  const analyzeLoad = () => {
    const size = parseResolution(resolution.value);
    if (!size) {
      status.textContent = 'Resolusi tidak dikenali. Pilih preset resolusi yang tersedia lalu ulangi analisis.';
      apply.style.display = 'none';
      return;
    }
    const frameRate = Math.max(1, Number(fps.value) || 30);
    const seconds = Math.max(1, Number(duration.value) || 10);
    const megapixels = size.width * size.height / 1000000;
    const totalFrames = Math.ceil(frameRate * seconds);
    const pixelsPerSecond = megapixels * frameRate;
    const memory = Number(navigator.deviceMemory) || 0;
    const cores = Number(navigator.hardwareConcurrency) || 0;
    const highLoad = megapixels >= 8 || pixelsPerSecond >= 240 || totalFrames >= 900 || (memory > 0 && memory <= 4);
    const extreme = megapixels >= 30 || (megapixels >= 8 && frameRate >= 60) || (memory > 0 && memory <= 4 && megapixels >= 8);
    recommended = highLoad ? 'turbo' : 'normal';
    const reasons = [];
    if (megapixels >= 8) reasons.push('resolusi tinggi');
    if (frameRate >= 60) reasons.push('60 FPS');
    if (totalFrames >= 900) reasons.push('durasi menghasilkan banyak frame');
    if (memory > 0 && memory <= 4) reasons.push('batas memori browser terdeteksi rendah');
    if (!reasons.length) reasons.push('beban preset tergolong ringan');
    const current = speed.value === 'turbo' ? 'TURBO' : 'Normal';
    const next = recommended === 'turbo' ? 'TURBO' : 'Normal';
    const caution = extreme ? ' Hindari menjalankan aplikasi berat lain; untuk 8K pertimbangkan 4K bila terjadi kehabisan memori.' : '';
    status.textContent = 'Estimasi: '+megapixels.toFixed(1)+' MP/frame · '+totalFrames+' frame · '+pixelsPerSecond.toFixed(0)+' MP/s. Faktor: '+reasons.join(', ')+'. Rekomendasi: '+next+'. Preset saat ini: '+current+'. Resolusi dan FPS tidak diubah.'+caution;
    apply.style.display = recommended === 'turbo' && speed.value !== 'turbo' ? 'inline-block' : 'none';
    apply.textContent = 'Terapkan TURBO';
  };
  analyze.addEventListener('click', analyzeLoad);
  apply.addEventListener('click', () => {
    if (recommended !== 'turbo') return;
    speed.value = 'turbo';
    speed.dispatchEvent(new Event('change', { bubbles:true }));
    status.textContent += ' Preset TURBO diterapkan; resolusi, FPS, durasi, dan format ekspor tetap sama.';
    apply.style.display = 'none';
  });
  [resolution,fps,duration,speed].forEach(el => {
    el.addEventListener('change', () => {
      if (status.textContent.startsWith('Estimasi:')) analyzeLoad();
    });
  });
  window.TROZAL_RENDER_ADVISOR = { analyze: analyzeLoad };
})();