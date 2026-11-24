/* TROZAL MOTION · OLLAMA Universal Object Rig UI */
(function () {
  'use strict';
  if (window.TROZALUniversalRig) return;
  const API = 'http://127.0.0.1:11436';
  const MOTIONS = [
    ['swing','Swing / Ayun'],['hinge','Hinge / Engsel'],['wheel','Wheel / Putar'],
    ['rotate','Rotate / Rotasi'],['bob','Bob / Naik turun'],['float','Float / Melayang'],
    ['pulse','Pulse / Skala'],['static','Tetap']
  ];
  function create(options) {
    const opt = options || {};
    const $ = id => document.getElementById(id);
    let imageUrl = '', image = null, imageSize = null, segments = [], rig = null, picking = false;
    const status = message => {
      if ($('itcvRigStatus')) $('itcvRigStatus').textContent = String(message || '');
      if (opt.onStatus) opt.onStatus(String(message || ''));
    };
    function updateProgress(state, visible) {
      let panel = $('itcvRigProgress');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'itcvRigProgress';
        panel.style.cssText = 'margin:7px 0;padding:8px;border:1px solid #32776d;border-radius:8px;background:#092522;color:#d6fff2;';
        const bar = document.createElement('progress');
        bar.id = 'itcvRigProgressBar'; bar.max = 100; bar.value = 0;
        bar.style.cssText = 'display:block;width:100%;height:9px;accent-color:#55d6b1;';
        const label = document.createElement('div');
        label.id = 'itcvRigProgressText';
        label.style.cssText = 'margin-top:5px;font-size:10px;line-height:1.4;';
        panel.append(bar, label);
        const anchor = $('itcvRigStatus');
        if (anchor) anchor.insertAdjacentElement('afterend', panel);
      }
      panel.hidden = visible === false;
      const bar = $('itcvRigProgressBar');
      const label = $('itcvRigProgressText');
      if (bar) bar.value = Math.max(0, Math.min(100, Number(state && state.progress) || 0));
      if (label) {
        const percent = Math.round(Math.max(0, Math.min(100, Number(state && state.progress) || 0)));
        label.textContent = (state && state.message ? String(state.message) : 'Menyiapkan segmentasi…') + ' · ' + percent + '%';
      }
    }
    const call = async (path, body, options) => {
      const settings = options || {};
      const timeoutMs = Number(settings.timeoutMs) > 0 ? Number(settings.timeoutMs) : 15000;
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
      let response;
      try {
        response = await fetch(API + path, {
          method: body ? 'POST' : 'GET',
          mode: 'cors',
          credentials: 'omit',
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          cache: 'no-store',
          signal: controller ? controller.signal : undefined
        });
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error('SAM 2.1 tidak menyelesaikan ' + path + ' dalam ' + Math.round(timeoutMs / 1000) + ' detik. Periksa jendela server lokal dan beban GPU/CPU, lalu coba lagi.');
        }
        if (error && error.name === 'TypeError') {
          throw new Error('Browser menolak koneksi ke server lokal (CORS/izin jaringan lokal). Perbarui server TROZAL, restart START.bat, lalu izinkan akses jaringan lokal untuk domain aplikasi.');
        }
        throw error;
      } finally {
        if (timer !== null) window.clearTimeout(timer);
      }
      let result;
      try { result = await response.json(); }
      catch (_) { throw new Error('SAM 2 mengirim respons yang tidak dapat dibaca dari ' + path + '.'); }
      if (!response.ok || !result.ok) throw new Error(result.error || ('SAM 2 HTTP ' + response.status + ' pada ' + path));
      return result;
    };
    const loadImage = src => new Promise((resolve, reject) => {
      const im = new Image(); im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Gambar sumber/mask tidak dapat dibaca.')); im.src = src;
    });
    function getImageUrl() { return Promise.resolve(opt.getImage ? opt.getImage() : imageUrl); }
    async function setImage(dataUrl) {
      imageUrl = dataUrl || await getImageUrl();
      if (!imageUrl) { image = null; imageSize = null; drawSource(); return; }
      image = await loadImage(imageUrl);
      imageSize = { width: image.naturalWidth, height: image.naturalHeight };
      segments = []; rig = null; drawSource(); renderList();
    }
    function drawSource() {
      const canvas = $('itcvRigSource'); if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#08151a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!image) {
        ctx.fillStyle = '#a8c9c1'; ctx.font = '12px Arial';
        ctx.fillText('Pilih satu gambar untuk mulai segmentasi objek', 12, 24); return;
      }
      const scale = Math.min(1, 640 / Math.max(imageSize.width, imageSize.height));
      const w = Math.max(1, Math.round(imageSize.width * scale));
      const h = Math.max(1, Math.round(imageSize.height * scale));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ctx.drawImage(image, 0, 0, w, h);
      segments.forEach((part, index) => {
        if (part.enabled === false) return;
        const fx = w / imageSize.width, fy = h / imageSize.height;
        const x = part.bboxOriginal[0] * fx, y = part.bboxOriginal[1] * fy;
        const bw = part.bboxOriginal[2] * fx, bh = part.bboxOriginal[3] * fy;
        ctx.save(); ctx.strokeStyle = index % 2 ? '#60dfc1' : '#ffd37b';
        ctx.lineWidth = Math.max(1.3, w / 420); ctx.strokeRect(x, y, bw, bh);
        ctx.fillStyle = 'rgba(2,12,18,.76)'; ctx.fillRect(x, y, Math.min(bw, 140), 16);
        ctx.fillStyle = '#f2fffb'; ctx.font = '10px Arial';
        ctx.fillText(part.name || ('Part ' + (index + 1)), x + 3, y + 11); ctx.restore();
      });
    }
    function normaliseSegment(item, index, width, height) {
      const box = item.bbox || [0, 0, width, height];
      const sx = imageSize.width / width, sy = imageSize.height / height;
      return {
        id: String(item.id || ('segment-' + (index + 1))),
        name: 'Komponen ' + String(index + 1).padStart(2, '0'),
        mask: item.mask, bbox: box.slice(0, 4),
        bboxOriginal: [box[0] * sx, box[1] * sy, box[2] * sx, box[3] * sy],
        score: Number(item.score) || 0, areaRatio: Number(item.areaRatio) || 0,
        enabled: true, motion: 'float', category: 'other',
        pivotNormX: (box[0] + box[2] / 2) / width,
        pivotNormY: (box[1] + box[3] / 2) / height, parent: ''
      };
    }
    function parseJson(source) {
      const text = String(source || '').trim().replace(/^\x60{3}(?:json)?\s*/i, '').replace(/\s*\x60{3}$/, '');
      try { return JSON.parse(text); }
      catch (_) {
        const start = text.indexOf('{'), end = text.lastIndexOf('}');
        if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
        throw new Error('Qwen tidak menghasilkan JSON komponen yang valid.');
      }
    }
    async function classify() {
      const model = opt.getModel ? opt.getModel() : '';
      if (!model || !segments.length || !opt.askVision) return;
      const boxes = segments.map(part => ({
        segmentId: part.id, name: part.name,
        bbox: [
          +(part.bboxOriginal[0] / imageSize.width).toFixed(3),
          +(part.bboxOriginal[1] / imageSize.height).toFixed(3),
          +(part.bboxOriginal[2] / imageSize.width).toFixed(3),
          +(part.bboxOriginal[3] / imageSize.height).toFixed(3)
        ]
      }));
      const prompt = 'You are a universal object-motion director. Identify arbitrary components in this image, not only humans. Return ONLY JSON: {"parts":[{"segmentId":"exact id","name":"short component name","category":"character|animal|vehicle|machine|plant|product|graphic|other","motion":"swing|hinge|wheel|rotate|bob|float|pulse|static","pivotX":0.5,"pivotY":0.5,"parent":""}]}. pivotX and pivotY are normalized coordinates on the full image. Match only supplied segment IDs. Give physically plausible motion and do not hallucinate components. Segments: ' + JSON.stringify(boxes);
      const parsed = parseJson(await opt.askVision(prompt, imageUrl));
      const byId = new Map((parsed.parts || []).map(part => [String(part.segmentId), part]));
      const allowed = new Set(MOTIONS.map(motion => motion[0]));
      segments.forEach(part => {
        const item = byId.get(part.id); if (!item) return;
        part.name = String(item.name || part.name).slice(0, 60);
        part.category = String(item.category || 'other');
        if (allowed.has(item.motion)) part.motion = item.motion;
        const px = Number(item.pivotX), py = Number(item.pivotY);
        if (Number.isFinite(px) && px >= 0 && px <= 1) part.pivotNormX = px;
        if (Number.isFinite(py) && py >= 0 && py <= 1) part.pivotNormY = py;
        part.parent = String(item.parent || '');
      });
    }
    async function check() {
      try {
        const result = await call('/api/health');
        if (result.checkpoint === false) throw new Error('API aktif, tetapi checkpoint sam2.1_hiera_tiny.pt tidak ditemukan.');
        const device = result.device === 'unloaded' ? 'perangkat dipilih otomatis saat inferensi' : (result.device || 'auto');
        status('SAM 2.1 Tiny terhubung · ' + device + ' · ' +
          (result.model_loaded ? 'model sudah aktif' : 'checkpoint terdeteksi; model dimuat saat segmentasi pertama') + '.');
        return result;
      } catch (error) {
        status('SAM 2.1 belum aktif: ' + error.message + ' Jalankan TROZAL_UNIVERSAL_RIG_START.bat.');
        throw error;
      }
    }
    async function autoSegment() {
      const autoButton = $('itcvRigAuto');
      let pollActive = false;
      let pollTask = null;
      const requestId = 'rig-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      if (autoButton) { autoButton.disabled = true; autoButton.textContent = 'Menyiapkan SAM 2.1…'; }
      const pollProgress = async () => {
        let failures = 0;
        while (pollActive) {
          try {
            const progress = await call('/api/segment/status', null, { timeoutMs: 5000 });
            if (progress.requestId && progress.requestId !== requestId) {
              await new Promise(resolve => window.setTimeout(resolve, 700));
              continue;
            }
            updateProgress(progress, true);
            if (progress.message) status(progress.message);
            failures = 0;
          } catch (_) {
            failures += 1;
            if (failures >= 3) break; // Older local servers remain usable; show the client-side fallback status.
          }
          await new Promise(resolve => window.setTimeout(resolve, 650));
        }
      };
      try {
        updateProgress({ phase: 'prepare', progress: 0, message: 'Menyiapkan gambar untuk SAM 2.1…' }, true);
        status('Menyiapkan gambar dan memeriksa layanan SAM 2.1…');
        if (!imageUrl) imageUrl = await getImageUrl();
        if (!imageUrl) throw new Error('Pilih gambar sumber terlebih dahulu.');
        if (!image) await setImage(imageUrl);
        if (segments.length && !window.confirm('Ganti daftar segmentasi yang sudah ada?')) {
          status('Segmentasi tidak dijalankan. Komponen sebelumnya tetap dipertahankan.');
          updateProgress({ phase: 'idle', progress: 0, message: 'Menunggu perintah segmentasi.' }, false);
          return null;
        }
        const service = await check();
        status('SAM 2.1 siap · memulai inferensi lokal. Pemuatan model pertama dapat membutuhkan waktu lebih lama.');
        updateProgress({ phase: 'starting', progress: 2, message: 'Mengirim gambar ke SAM 2.1 lokal…' }, true);
        pollActive = true;
        pollTask = pollProgress();
        const result = await call('/api/segment/auto', {
          image: imageUrl,
          requestId
        }, { timeoutMs: 240000 });
        pollActive = false;
        if (pollTask) await pollTask;
        segments = (result.segments || []).map((item, index) => normaliseSegment(item, index, result.width, result.height));
        if (!segments.length) throw new Error('SAM 2 tidak mengembalikan mask. Periksa kualitas gambar atau gunakan klik manual untuk memilih komponen.');
        updateProgress({ phase: 'labeling', progress: 94, message: segments.length + ' mask ditemukan · Qwen Vision sedang memberi nama komponen…' }, true);
        status(segments.length + ' mask ditemukan. Qwen Vision sedang memberi nama dan menyarankan gerakan…');
        let labelWarning = '';
        try { await classify(); }
        catch (error) { labelWarning = ' · Label AI belum tersedia: ' + error.message; }
        renderList(); drawSource();
        if ($('itcvRigBuild')) $('itcvRigBuild').disabled = false;
        updateProgress({ phase: 'completed', progress: 100, message: 'Segmentasi selesai · ' + segments.length + ' komponen ditemukan.' }, true);
        status(segments.length + ' komponen ditemukan · ' + (result.device || service.device || 'SAM 2') + labelWarning);
        return segments;
      } catch (error) {
        pollActive = false;
        updateProgress({ phase: 'error', progress: 0, message: 'Segmentasi gagal: ' + error.message }, true);
        status('Segmentasi gagal: ' + error.message);
        throw error;
      } finally {
        pollActive = false;
        if (pollTask) await Promise.race([
          pollTask,
          new Promise(resolve => window.setTimeout(resolve, 900))
        ]);
        if (autoButton) { autoButton.disabled = false; autoButton.textContent = 'AI Segmentasi Komponen'; }
      }
    }
    async function addAt(x, y) {
      if (!imageUrl) imageUrl = await getImageUrl();
      if (!image) await setImage(imageUrl);
      const scale = Math.min(1, 1024 / Math.max(imageSize.width, imageSize.height));
      const result = await call('/api/segment/point', {
        image: imageUrl, points: [[x * scale, y * scale]], labels: [1]
      });
      const part = normaliseSegment(result.segment, segments.length, result.width, result.height);
      part.name = ($('itcvRigPartName').value || '').trim() || ('Komponen ' + (segments.length + 1));
      part.motion = $('itcvRigPartMotion').value || 'float';
      segments.push(part); renderList(); drawSource();
      $('itcvRigBuild').disabled = false;
      status('Komponen "' + part.name + '" berhasil dipisahkan. Klik bagian lain untuk menambah komponen.');
    }
    function renderList() {
      const host = $('itcvRigParts'); host.replaceChildren();
      segments.forEach((part, index) => {
        const row = document.createElement('div'); row.className = 'rig-part';
        const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = part.enabled !== false;
        enabled.title = 'Aktifkan komponen'; enabled.addEventListener('change', () => {
          part.enabled = enabled.checked; drawSource();
          $('itcvRigCount').textContent = segments.filter(p => p.enabled).length + ' / ' + segments.length + ' aktif';
        });
        const name = document.createElement('input'); name.type = 'text'; name.value = part.name || ('Komponen ' + (index + 1));
        name.title = 'Nama komponen'; name.addEventListener('change', () => { part.name = name.value.slice(0, 60); drawSource(); });
        const motion = document.createElement('select');
        MOTIONS.forEach(entry => { const option = document.createElement('option'); option.value = entry[0]; option.textContent = entry[1]; motion.append(option); });
        motion.value = part.motion || 'float'; motion.addEventListener('change', () => { part.motion = motion.value; });
        const parent = document.createElement('select'); parent.title = 'Parent / bagian induk';
        const rootOption = document.createElement('option'); rootOption.value = ''; rootOption.textContent = 'Root'; parent.append(rootOption);
        segments.filter(item => item.id !== part.id).forEach(item => { const option = document.createElement('option'); option.value = item.name; option.textContent = item.name; parent.append(option); });
        parent.value = part.parent || ''; parent.addEventListener('change', () => { part.parent = parent.value; });
        row.append(enabled, name, motion, parent); host.append(row);
      });
      $('itcvRigCount').textContent = segments.filter(p => p.enabled).length + ' / ' + segments.length + ' komponen aktif';
    }
    async function build() {
      const selected = segments.filter(part => part.enabled !== false);
      if (!selected.length) throw new Error('Aktifkan minimal satu komponen mask.');
      imageUrl = await getImageUrl();
      if (!imageUrl) throw new Error('Gambar sumber tidak tersedia.');
      if (!image) await setImage(imageUrl);
      status('SAM 2.1 sedang mengisi area latar yang tertutup objek…');
      const background = await call('/api/inpaint', { image: imageUrl, masks: selected.map(part => part.mask) });
      const backgroundImage = await loadImage(background.background);
      const bg = document.createElement('canvas'); bg.width = imageSize.width; bg.height = imageSize.height;
      bg.getContext('2d').drawImage(backgroundImage, 0, 0, bg.width, bg.height);
      const parts = [];
      const parentById = new Map();
      const selectedIds = new Set(selected.map(part => part.id));
      for (const segment of selected) {
        const directParent = segments.find(item => item.id !== segment.id && item.name === segment.parent && selectedIds.has(item.id));
        const seen = new Set([segment.id]);
        let cursor = directParent, hasCycle = false;
        while (cursor) {
          if (seen.has(cursor.id)) { hasCycle = true; break; }
          seen.add(cursor.id);
          cursor = segments.find(item => item.name === cursor.parent && selectedIds.has(item.id));
        }
        parentById.set(segment.id, hasCycle ? '' : (directParent ? directParent.id : ''));
      }
      const sourceCanvas = document.createElement('canvas'); sourceCanvas.width = imageSize.width; sourceCanvas.height = imageSize.height;
      const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
      sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
      const sourcePixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      for (const segment of selected) {
        const maskImage = await loadImage(segment.mask);
        const maskCanvas = document.createElement('canvas'); maskCanvas.width = imageSize.width; maskCanvas.height = imageSize.height;
        const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
        maskContext.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);
        const maskPixels = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
        const bx = Math.max(0, Math.floor(segment.bboxOriginal[0]));
        const by = Math.max(0, Math.floor(segment.bboxOriginal[1]));
        const bw = Math.max(1, Math.min(imageSize.width - bx, Math.ceil(segment.bboxOriginal[2])));
        const bh = Math.max(1, Math.min(imageSize.height - by, Math.ceil(segment.bboxOriginal[3])));
        const crop = document.createElement('canvas'); crop.width = bw; crop.height = bh;
        const cropContext = crop.getContext('2d'); const outputPixels = cropContext.createImageData(bw, bh);
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const sourceIndex = ((by + y) * imageSize.width + bx + x) * 4;
          const targetIndex = (y * bw + x) * 4;
          outputPixels.data[targetIndex] = sourcePixels.data[sourceIndex];
          outputPixels.data[targetIndex + 1] = sourcePixels.data[sourceIndex + 1];
          outputPixels.data[targetIndex + 2] = sourcePixels.data[sourceIndex + 2];
          outputPixels.data[targetIndex + 3] = Math.round(sourcePixels.data[sourceIndex + 3] * maskPixels[sourceIndex] / 255);
        }
        cropContext.putImageData(outputPixels, 0, 0);
        const motion = segment.motion || 'float';
        const amplitude = motion === 'wheel' ? 6.283 : motion === 'hinge' ? 0.28 :
          motion === 'swing' ? 0.24 : motion === 'rotate' ? 0.35 :
          motion === 'bob' ? 0.05 : motion === 'pulse' ? 0.08 : motion === 'static' ? 0 : 0.12;
        parts.push({
          id: segment.id, name: segment.name, category: segment.category || 'other',
          parent: parentById.get(segment.id) || '', motion, src: crop.toDataURL('image/png'),
          x: bx, y: by, w: bw, h: bh,
          pivotX: segment.pivotNormX * imageSize.width, pivotY: segment.pivotNormY * imageSize.height,
          amp: amplitude, speed: motion === 'wheel' ? 1.6 : motion === 'static' ? 0 : 0.9,
          phase: parts.length * 0.73, enabled: true
        });
      }
      rig = {
        version: 1, width: imageSize.width, height: imageSize.height,
        background: bg.toDataURL('image/png'), parts,
        engine: 'SAM 2.1 Tiny + Ollama Vision',
        note: 'Mask dan rig dibuat lokal. Latar hasil inpainting adalah perkiraan; tinjau bagian tepi.'
      };
      if (opt.onApply) opt.onApply(rig);
      status('Universal Rig siap: ' + parts.length + ' komponen terpisah. HTML/JavaScript telah diperbarui.');
      return rig;
    }
    const canvas = $('itcvRigSource');
    if (canvas) canvas.addEventListener('click', async event => {
      if (!picking || !image) return;
      picking = false; canvas.style.cursor = 'default';
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * imageSize.width;
      const y = (event.clientY - rect.top) / rect.height * imageSize.height;
      try { await addAt(x, y); }
      catch (error) { status('Gagal memisahkan titik: ' + error.message); }
    });
    // Delegate the health-check click so it still works if Mode 5 is mounted
    // after this controller is created. Always give immediate visible feedback.
    document.addEventListener('click', async event => {
      const button = event.target && event.target.closest ? event.target.closest('#itcvRigCheck') : null;
      if (!button) return;
      event.preventDefault();
      if (button.dataset.checking === '1') return;
      button.dataset.checking = '1';
      button.disabled = true;
      const previous = button.textContent;
      button.textContent = 'Memeriksa SAM 2.1...';
      status('Menghubungkan ke server lokal SAM 2.1 di http://127.0.0.1:11436/api/health ...');
      try {
        await check();
        button.textContent = 'SAM 2.1 Terhubung';
      } catch (error) {
        button.textContent = 'Cek Segmenter Lokal';
        status('Pemeriksaan SAM 2.1 gagal: ' + error.message + ' Pastikan jendela START tetap terbuka.');
      } finally {
        button.disabled = false;
        delete button.dataset.checking;
        if (button.textContent === 'Memeriksa SAM 2.1...') button.textContent = previous;
      }
    });
    $('itcvRigAuto').addEventListener('click', () => autoSegment().catch(error => status('Segmentasi gagal: ' + error.message)));
    $('itcvRigPickMode').addEventListener('click', () => {
      if (!image) { status('Pilih gambar dahulu.'); return; }
      picking = !picking; canvas.style.cursor = picking ? 'crosshair' : 'default';
      status(picking ? 'Klik tepat pada komponen yang ingin dipisahkan.' : 'Mode pemilihan komponen dihentikan.');
    });
    $('itcvRigBuild').addEventListener('click', () => build().catch(error => status('Build Rig gagal: ' + error.message)));
    return {
      setImage, check, autoSegment, addAt, build,
      getRig: () => rig, getSegments: () => segments,
      clear: () => { segments = []; rig = null; renderList(); drawSource(); $('itcvRigBuild').disabled = true; }
    };
  }
  window.TROZALUniversalRig = { create };
})();