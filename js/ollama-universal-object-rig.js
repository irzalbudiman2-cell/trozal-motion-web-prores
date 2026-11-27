/* TROZAL MOTION · OLLAMA Universal Object Rig UI */
(function () {
  'use strict';
  if (window.TROZALUniversalRig) return;
  const API_HOSTS = ['http://127.0.0.1:11436', 'http://localhost:11436'];
  const MOTIONS = [
    ['swing','Swing / Ayun'],['hinge','Hinge / Engsel'],['wheel','Wheel / Putar'],
    ['rotate','Rotate / Rotasi'],['bob','Bob / Naik turun'],['float','Float / Melayang'],
    ['pulse','Pulse / Skala'],['static','Tetap']
  ];
  const MASK_COLORS = [
    [48, 211, 190], [255, 190, 82], [117, 168, 255], [232, 116, 197],
    [155, 220, 115], [185, 151, 255], [255, 126, 107], [92, 214, 235],
    [246, 223, 112], [140, 182, 177], [222, 147, 102], [162, 197, 255],
    [221, 130, 153], [187, 214, 115]
  ];
  function create(options) {
    const opt = options || {};
    const $ = id => document.getElementById(id);
    let imageUrl = '', image = null, imageSize = null, segments = [], rig = null, picking = false;
    let pendingPoints = [], pointLabel = 1;
    const maskPreviewCanvases = new Map();
    const seamSettings = { enabled: true, strength: 0.85, radiusScale: 1 };
    const status = message => {
      if ($('itcvRigStatus')) $('itcvRigStatus').textContent = String(message || '');
      if (opt.onStatus) opt.onStatus(String(message || ''));
    };
    function mountSeamControls() {
      const anchor = $('itcvRigStatus');
      if (!anchor || $('itcvRigSeamControls')) return;
      const panel = document.createElement('section'); panel.id = 'itcvRigSeamControls';
      panel.style.cssText = 'margin:8px 0;padding:10px;border:1px solid #9a6bd6;border-radius:9px;background:linear-gradient(145deg,#24183a,#171326);color:#f0e7ff;';
      panel.innerHTML = '<strong style="display:block;color:#d9c1ff;margin-bottom:7px">JOINT SEAM WELDING · PENGATUR SAMBUNGAN</strong><label style="display:flex;gap:7px;align-items:center"><input id="itcvRigSeamEnabled" type="checkbox" checked> Aktifkan overlap piksel sendi</label><label style="display:block;margin-top:7px">Kekuatan sambungan <output id="itcvRigSeamStrengthValue">85%</output><input id="itcvRigSeamStrength" type="range" min="0" max="100" value="85" style="width:100%"></label><label style="display:block;margin-top:7px">Radius sambungan <output id="itcvRigSeamRadiusValue">100%</output><input id="itcvRigSeamRadius" type="range" min="50" max="180" value="100" style="width:100%"></label><small>Overlap hanya memakai piksel foreground dari mask SAM 2.1, bukan piksel latar buatan. rasio overlap mask bersama = piksel mask yang bertumpuk dibagi total piksel gabungan di area sendi.</small><div id="itcvRigSeamDiagnostics" aria-live="polite" style="margin-top:8px;padding:8px;border:1px solid #55416f;border-radius:7px;background:#100d1b;font-size:11px;color:#e9ddff">Diagnostik sambungan akan muncul setelah rig dibuat.</div>';
      anchor.insertAdjacentElement('afterend', panel);
      const strength = $('itcvRigSeamStrength'), radius = $('itcvRigSeamRadius');
      strength.addEventListener('input', () => { seamSettings.strength = Number(strength.value) / 100; $('itcvRigSeamStrengthValue').textContent = strength.value + '%'; });
      radius.addEventListener('input', () => { seamSettings.radiusScale = Number(radius.value) / 100; $('itcvRigSeamRadiusValue').textContent = radius.value + '%'; });
      $('itcvRigSeamEnabled').addEventListener('change', event => { seamSettings.enabled = !!event.target.checked; });
    }
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
      let response, lastNetworkError = null;
      try {
        for (const host of API_HOSTS) {
          try {
            response = await fetch(host + path, {
              method: body ? 'POST' : 'GET',
              mode: 'cors',
              credentials: 'omit',
              headers: body ? { 'Content-Type': 'application/json' } : undefined,
              body: body ? JSON.stringify(body) : undefined,
              cache: 'no-store',
              signal: controller ? controller.signal : undefined
            });
            break;
          } catch (error) {
            if (error && error.name === 'AbortError') throw error;
            if (error && error.name !== 'TypeError') throw error;
            lastNetworkError = error;
          }
        }
        if (!response) throw lastNetworkError || new TypeError('NetworkError');
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error('SAM 2.1 tidak menyelesaikan ' + path + ' dalam ' + Math.round(timeoutMs / 1000) + ' detik. Periksa jendela server lokal dan beban GPU/CPU, lalu coba lagi.');
        }
        if (error && error.name === 'TypeError') {
          // A failed POST preflight can also mean the local Python server is an
          // older copy that does not register the requested route. Probe the
          // simple GET health endpoint to distinguish that from a network block.
          if (path === '/api/pose/segment-parts') {
            for (const host of API_HOSTS) {
              try {
                const healthResponse = await fetch(host + '/api/health', {
                  method: 'GET', mode: 'cors', credentials: 'omit',
                  cache: 'no-store', signal: controller ? controller.signal : undefined
                });
                if (!healthResponse.ok) continue;
                const health = await healthResponse.json();
                if (health && health.ok) {
                  const capabilities = Array.isArray(health.capabilities) ? health.capabilities : [];
                  if (!capabilities.includes('pose_segment_parts')) {
                    throw new Error('Server SAM 2.1 lokal masih versi lama: /api/pose/segment-parts belum terdaftar. Perbarui file TROZAL_UNIVERSAL_RIG_SERVER.py dari repositori OLLAMA terbaru, tutup server lama, lalu jalankan kembali TROZAL_UNIVERSAL_RIG_START.bat. SAM 2.1 dan /api/segment/auto sudah aktif; yang belum tersedia hanya Character Part Segmentation.');
                  }
                  throw new Error('Endpoint Character Part Segmentation sudah terdaftar pada server lokal, tetapi preflight browser gagal. Izinkan Local network access untuk origin TROZAL di Chrome/Edge, lalu reload. Periksa juga bahwa server yang berjalan memakai file TROZAL_UNIVERSAL_RIG_SERVER.py versi terbaru.');
                }
              } catch (diagnosticError) {
                if (diagnosticError && diagnosticError.message && diagnosticError.message.startsWith('Server SAM 2.1 lokal') ||
                    diagnosticError && diagnosticError.message && diagnosticError.message.startsWith('Endpoint Character Part')) {
                  throw diagnosticError;
                }
              }
            }
          }
          throw new Error('Browser tidak dapat menjangkau SAM 2.1 di port 11436. Saya sudah mencoba 127.0.0.1 dan localhost. Periksa TROZAL_UNIVERSAL_RIG_START.bat, endpoint /api/health, dan izin Local network access Chrome/Edge. Gunakan HTTPS/GitHub Pages atau localhost, bukan file://. Detail browser: '+(error&&error.message||'NetworkError'));
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
    function previewSize() {
      const canvas = $('itcvRigSource');
      return canvas ? { width: canvas.width, height: canvas.height } : { width: 1, height: 1 };
    }
    function maskColor(index) { return MASK_COLORS[index % MASK_COLORS.length]; }
    async function buildMaskPreview(part, index) {
      if (!part || !part.mask) return false;
      const source = await loadImage(part.mask);
      const size = previewSize();
      const preview = document.createElement('canvas');
      preview.width = Math.max(1, size.width);
      preview.height = Math.max(1, size.height);
      const context = preview.getContext('2d', { willReadFrequently: true });
      context.drawImage(source, 0, 0, preview.width, preview.height);
      const pixels = context.getImageData(0, 0, preview.width, preview.height);
      const color = maskColor(index);
      for (let offset = 0; offset < pixels.data.length; offset += 4) {
        const coverage = pixels.data[offset];
        pixels.data[offset] = color[0];
        pixels.data[offset + 1] = color[1];
        pixels.data[offset + 2] = color[2];
        pixels.data[offset + 3] = coverage;
      }
      context.putImageData(pixels, 0, 0);
      maskPreviewCanvases.set(part.id, preview);
      return true;
    }
    function refreshMaskFocusOptions() {
      const select = $('itcvRigMaskFocus');
      if (!select) return;
      const selected = select.value || 'all';
      select.replaceChildren();
      const all = document.createElement('option');
      all.value = 'all'; all.textContent = 'Semua komponen';
      select.append(all);
      segments.forEach(part => {
        const option = document.createElement('option');
        option.value = part.id; option.textContent = part.name || part.id;
        select.append(option);
      });
      select.value = segments.some(part => part.id === selected) ? selected : 'all';
    }
    async function prepareMaskPreviews(list) {
      maskPreviewCanvases.clear();
      const source = Array.isArray(list) ? list : segments;
      const results = await Promise.all(source.map(async (part, index) => {
        try { return await buildMaskPreview(part, index); }
        catch (_) { return false; }
      }));
      refreshMaskFocusOptions();
      return results.filter(Boolean).length;
    }
    function getImageUrl() { return Promise.resolve(opt.getImage ? opt.getImage() : imageUrl); }
    async function setImage(dataUrl) {
      imageUrl = dataUrl || await getImageUrl();
      if (!imageUrl) { image = null; imageSize = null; drawSource(); return; }
      image = await loadImage(imageUrl);
      imageSize = { width: image.naturalWidth, height: image.naturalHeight };
      segments = []; pendingPoints = []; rig = null; maskPreviewCanvases.clear();
      if ($('itcvRigPointHint')) $('itcvRigPointHint').textContent = '0 titik';
      refreshMaskFocusOptions(); drawSource(); renderList();
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
      const overlayControl = $('itcvRigMaskOverlay');
      const maskVisible = !overlayControl || overlayControl.checked;
      const focus = $('itcvRigMaskFocus')?.value || 'all';
      const opacityControl = $('itcvRigMaskOpacity');
      const opacity = opacityControl ? Math.max(0, Math.min(1, Number(opacityControl.value) / 100)) : 0.42;
      if (maskVisible && opacity > 0) {
        segments.forEach(part => {
          if (part.enabled === false || (focus !== 'all' && part.id !== focus)) return;
          const overlay = maskPreviewCanvases.get(part.id);
          if (!overlay) return;
          ctx.save(); ctx.globalAlpha = opacity; ctx.drawImage(overlay, 0, 0, w, h); ctx.restore();
        });
      }
      pendingPoints.forEach((point, index) => {
        const px = point.x / imageSize.width * w, py = point.y / imageSize.height * h;
        ctx.save(); ctx.beginPath(); ctx.arc(px, py, Math.max(5, w / 95), 0, Math.PI * 2);
        ctx.fillStyle = point.label === 1 ? '#35e58b' : '#ff657a'; ctx.fill();
        ctx.lineWidth = Math.max(2, w / 320); ctx.strokeStyle = '#07131b'; ctx.stroke();
        ctx.fillStyle = '#06131a'; ctx.font = 'bold ' + Math.max(9, w / 55) + 'px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(point.label === 1 ? '+' : '−', px, py);
        ctx.restore();
      });
      const boundsControl = $('itcvRigShowBounds');
      if (!boundsControl || boundsControl.checked) segments.forEach((part, index) => {
        if (part.enabled === false || (focus !== 'all' && part.id !== focus)) return;
        const fx = w / imageSize.width, fy = h / imageSize.height;
        const x = part.bboxOriginal[0] * fx, y = part.bboxOriginal[1] * fy;
        const bw = part.bboxOriginal[2] * fx, bh = part.bboxOriginal[3] * fy;
        ctx.save(); ctx.strokeStyle = 'rgb(' + maskColor(index).join(',') + ')';
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
        const maskQuality = await analyzeSegmentMaskQuality(segments);
        if (maskQuality.emptyCount) throw new Error(maskQuality.emptyCount + ' mask kosong. Perbaiki segmentasi sebelum membangun rig.');
        if (!segments.length) throw new Error('SAM 2 tidak mengembalikan mask. Periksa kualitas gambar atau gunakan klik manual untuk memilih komponen.');
        updateProgress({ phase: 'preview', progress: 92, message: 'Membuat overlay mask untuk diperiksa…' }, true);
        status('Membuat preview mask warna untuk ' + segments.length + ' komponen…' + (maskQuality.warningCount ? ' · ' + maskQuality.warningCount + ' peringatan kualitas; arahkan kursor ke komponen untuk detail.' : ' · kualitas mask awal baik.'));
        const previewCount = await prepareMaskPreviews(segments);
        renderList(); drawSource();
        updateProgress({ phase: 'labeling', progress: 94, message: previewCount + ' overlay mask siap · Qwen Vision sedang memberi nama komponen…' }, true);
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
    async function addAt(x, y, label = pointLabel) {
      if (!imageUrl) imageUrl = await getImageUrl();
      if (!image) await setImage(imageUrl);
      const px = Math.max(0, Math.min(imageSize.width - 1, Number(x)));
      const py = Math.max(0, Math.min(imageSize.height - 1, Number(y)));
      pendingPoints.push({ x: px, y: py, label: label === 0 ? 0 : 1 });
      drawSource();
      const positives = pendingPoints.filter(point => point.label === 1).length;
      const negatives = pendingPoints.length - positives;
      if ($('itcvRigPointHint')) $('itcvRigPointHint').textContent = pendingPoints.length + ' titik · ' + positives + ' positif / ' + negatives + ' negatif';
      status('Titik tersimpan: ' + positives + ' positif (+), ' + negatives + ' negatif (−). Tambahkan titik lain atau jalankan Segmentasi Titik.');
      return pendingPoints[pendingPoints.length - 1];
    }
    async function runPointSegmentation() {
      if (!pendingPoints.length) throw new Error('Tambahkan minimal satu titik positif atau negatif pada gambar.');
      if (!pendingPoints.some(point => point.label === 1)) throw new Error('Tambahkan minimal satu titik positif (+) untuk menentukan objek.');
      if (!imageUrl) imageUrl = await getImageUrl();
      if (!image) await setImage(imageUrl);
      const scale = Math.min(1, 1024 / Math.max(imageSize.width, imageSize.height));
      const points = pendingPoints.map(point => [point.x * scale, point.y * scale]);
      const labels = pendingPoints.map(point => point.label);
      status('SAM 2.1 memproses ' + points.length + ' titik prompt…');
      const result = await call('/api/segment/point', { image: imageUrl, points, labels });
      const part = normaliseSegment(result.segment, segments.length, result.width, result.height);
      part.name = ($('itcvRigPartName').value || '').trim() || ('Komponen ' + (segments.length + 1));
      part.motion = $('itcvRigPartMotion').value || 'float';
      part.promptPoints = pendingPoints.map(point => ({ x: point.x, y: point.y, label: point.label }));
      segments.push(part);
      pendingPoints = [];
      if ($('itcvRigPointHint')) $('itcvRigPointHint').textContent = '0 titik';
      await buildMaskPreview(part, segments.length - 1);
      refreshMaskFocusOptions(); renderList(); drawSource();
      $('itcvRigBuild').disabled = false;
      status('Komponen "' + part.name + '" berhasil dipisahkan dengan ' + points.length + ' titik prompt.');
      return part;
    }
    async function analyzeSegmentMaskQuality(list) {
      const reports = [];
      for (const part of list) {
        const source = await loadImage(part.mask);
        const scale = Math.min(1, 256 / Math.max(source.naturalWidth, source.naturalHeight));
        const width = Math.max(1, Math.round(source.naturalWidth * scale));
        const height = Math.max(1, Math.round(source.naturalHeight * scale));
        const sample = document.createElement('canvas'); sample.width = width; sample.height = height;
        const context = sample.getContext('2d', { willReadFrequently: true });
        context.drawImage(source, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        const total = width * height, foreground = new Uint8Array(total), visited = new Uint8Array(total);
        const queue = new Int32Array(total);
        let area = 0;
        for (let i = 0; i < total; i++) {
          const alpha = pixels[i * 4 + 3], red = pixels[i * 4];
          if ((alpha < 250 ? alpha >= 32 : red >= 32)) { foreground[i] = 1; area++; }
        }
        let components = 0, largest = 0;
        for (let start = 0; start < total; start++) {
          if (!foreground[start] || visited[start]) continue;
          components++;
          let head = 0, tail = 0; queue[tail++] = start; visited[start] = 1;
          while (head < tail) {
            const index = queue[head++], x = index % width, y = (index / width) | 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              const next = ny * width + nx;
              if (foreground[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
            }
          }
          largest = Math.max(largest, tail);
        }
        const detached = Math.max(0, area - largest);
        const warnings = [];
        if (!area) warnings.push('mask kosong');
        else if (area < 12) warnings.push('mask sangat kecil');
        if (components > 1 && detached >= Math.max(6, Math.ceil(area * 0.08))) warnings.push('fragmen mask terpisah');
        const report = { area, components, detached, warnings };
        part.quality = report;
        reports.push(report);
      }
      return {
        parts: reports,
        warningCount: reports.reduce((sum, report) => sum + report.warnings.length, 0),
        emptyCount: reports.filter(report => !report.area).length
      };
    }
    function renderList() {
      const host = $('itcvRigParts'); host.replaceChildren();
      segments.forEach((part, index) => {
        const row = document.createElement('div'); row.className = 'rig-part';
        if (part.quality && part.quality.warnings.length) row.title = part.name + ': ' + part.quality.warnings.join('; ');
        const quality = document.createElement('small');
        quality.style.cssText = 'grid-column:1/-1;display:block;margin:3px 0 5px 24px;font-size:10px;line-height:1.4;color:' +
          (part.quality && part.quality.warnings.length ? '#ffc18b' : '#91d9bf');
        quality.textContent = part.quality
          ? ('Mask · ' + part.quality.area + ' px sampel · ' + part.quality.components + ' fragmen' +
            (part.quality.warnings.length ? ' · PERIKSA: ' + part.quality.warnings.join(', ') : ' · OK'))
          : 'Mask belum dianalisis';
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
        row.append(enabled, name, motion, parent, quality); host.append(row);
      });
      $('itcvRigCount').textContent = segments.filter(p => p.enabled).length + ' / ' + segments.length + ' komponen aktif';
      refreshMaskFocusOptions();
    }
    async function estimateLocalPose() {
      if (!imageUrl) imageUrl = await getImageUrl();
      const result = await call('/api/pose/estimate', { image: imageUrl }, { timeoutMs: 45000 });
      return result.pose && result.pose.detected && Array.isArray(result.pose.landmarks) ? result.pose : null;
    }
    function applyPoseJointPivots(list, pose) {
      if (!pose || !Array.isArray(pose.landmarks) || pose.landmarks.length < 29) return 0;
      const normalizedName = value => String(value || '').toLowerCase()
        .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
      const midpoint = (a, b) => {
        const left = pose.landmarks[a], right = pose.landmarks[b];
        if (!left || !right) return null;
        return { x: (Number(left.x) + Number(right.x)) * 0.5, y: (Number(left.y) + Number(right.y)) * 0.5,
          visibility: Math.min(Number(left.visibility ?? 1), Number(right.visibility ?? 1)) };
      };
      let applied = 0;
      for (const part of list) {
        const name = normalizedName(part.name);
        const isLeft = /\\b(left|kiri)\\b/.test(name);
        const isRight = /\\b(right|kanan)\\b/.test(name);
        const side = isLeft ? 'L' : isRight ? 'R' : '';
        let point = null, joint = '';
        const pair = (leftIndex, rightIndex) => side === 'L' ? pose.landmarks[leftIndex] :
          side === 'R' ? pose.landmarks[rightIndex] : midpoint(leftIndex, rightIndex);
        if (/head|kepala/.test(name)) { point = midpoint(11, 12); joint = 'neck'; }
        else if (/upper.?arm|lengan atas|shoulder|bahu/.test(name)) { point = pair(11, 12); joint = 'shoulder'; }
        else if (/forearm|lower.?arm|lengan bawah|elbow|siku/.test(name)) { point = pair(13, 14); joint = 'elbow'; }
        else if (/hand|tangan|wrist|pergelangan tangan/.test(name)) { point = pair(15, 16); joint = 'wrist'; }
        else if (/thigh|upper.?leg|paha|hip|pinggul/.test(name)) { point = pair(23, 24); joint = 'hip'; }
        else if (/shin|lower.?leg|betis|knee|lutut/.test(name)) { point = pair(25, 26); joint = 'knee'; }
        else if (/foot|ankle|telapak|pergelangan kaki|kaki/.test(name)) { point = pair(27, 28); joint = 'ankle'; }
        else if (/torso|body|badan|dada/.test(name)) { point = midpoint(23, 24); joint = 'pelvis'; }
        if (!point) continue;
        const x = Number(point.x), y = Number(point.y), visibility = Number(point.visibility ?? point.presence ?? 1);
        if (!Number.isFinite(x) || !Number.isFinite(y) || visibility < 0.22 || x < 0 || x > 1 || y < 0 || y > 1) continue;
        const box = part.bboxOriginal || [0, 0, imageSize.width, imageSize.height];
        const cx = x * imageSize.width, cy = y * imageSize.height;
        const pad = Math.max(18, Math.max(Number(box[2]) || 0, Number(box[3]) || 0) * 0.32);
        const inside = cx >= box[0] - pad && cx <= box[0] + box[2] + pad &&
          cy >= box[1] - pad && cy <= box[1] + box[3] + pad;
        if (!inside) continue;
        part.pivotNormX = x; part.pivotNormY = y;
        part.poseAnchor = { joint, x, y, visibility: +visibility.toFixed(3) };
        applied++;
      }
      return applied;
    }
    async function autoCharacterParts() {
      const button = $('itcvRigCharacterAuto');
      if (!imageUrl) imageUrl = await getImageUrl();
      if (!imageUrl) throw new Error('Pilih gambar sumber terlebih dahulu.');
      if (!image) await setImage(imageUrl);
      if (button) { button.disabled = true; button.textContent = 'Memisahkan tubuh…'; }
      try {
        const requestId = 'character-parts-' + Date.now();
        updateProgress({ phase: 'prepare', progress: 1, message: 'Mendeteksi pose dan sendi tubuh…' }, true);
        status('Character Part Segmentation: MediaPipe mendeteksi sendi, lalu SAM 2.1 memisahkan kepala, torso, lengan, tangan, paha, betis, dan kaki…');
        const result = await call('/api/pose/segment-parts', { image: imageUrl, requestId }, { timeoutMs: 360000 });
        if (!Array.isArray(result.segments) || !result.segments.length) {
          const missing = result.diagnostics && result.diagnostics.missingParts ? result.diagnostics.missingParts.join(', ') : '';
          throw new Error('Tidak ada layer tubuh yang berhasil dibuat. ' + missing);
        }
        segments = result.segments.map((item, index) => {
          const part = normaliseSegment(item, index, result.width, result.height);
          part.name = String(item.name || part.name);
          part.category = 'character';
          part.motion = MOTIONS.some(entry => entry[0] === item.motion) ? item.motion : 'swing';
          part.parent = '';
          part.parentId = String(item.parent || '');
          part.pivotNormX = Number.isFinite(Number(item.pivotX)) ? Number(item.pivotX) : part.pivotNormX;
          part.pivotNormY = Number.isFinite(Number(item.pivotY)) ? Number(item.pivotY) : part.pivotNormY;
          part.poseAnchor = { engine: 'MediaPipe Pose Landmarker Lite', x: part.pivotNormX, y: part.pivotNormY };
          return part;
        });
        segments.forEach(part => {
          const parent = segments.find(item => item.id === part.parentId);
          part.parent = parent ? parent.name : '';
        });
        const quality = await analyzeSegmentMaskQuality(segments);
        if (quality.emptyCount) throw new Error('Ada mask kosong. Ulangi segmentasi atau gunakan titik manual.');
        await prepareMaskPreviews(segments);
        renderList(); drawSource();
        if ($('itcvRigBuild')) $('itcvRigBuild').disabled = false;
        updateProgress({ phase: 'completed', progress: 100, message: 'Pemisahan tubuh selesai.' }, true);
        const missing = result.diagnostics && result.diagnostics.missingParts || [];
        status('Character Part Segmentation selesai: ' + segments.length + ' layer terpisah · ' +
          segments.map(part => part.name).join(', ') +
          (missing.length ? ' · bagian yang tidak terdeteksi: ' + missing.join(', ') : '') +
          '. Periksa overlay mask sebelum Bangun Universal Rig.');
        return segments;
      } finally {
        if (button) { button.disabled = false; button.textContent = '♙ AUTO CHARACTER PARTS'; }
      }
    }

    async function build() {
      mountSeamControls();
      if (!segments.length) throw new Error('Belum ada mask. Jalankan Character Part Segmentation atau AI Segmentasi Komponen terlebih dahulu.');
      const maskAudit = await analyzeSegmentMaskQuality(segments);
      await prepareMaskPreviews(segments);
      drawSource();
      if (maskAudit.emptyCount) throw new Error(maskAudit.emptyCount + ' mask kosong. Universal Rig tidak dibangun agar bagian tubuh tidak hilang.');
      const flagged = segments.filter(part => part.quality && part.quality.warnings.length);
      if (flagged.length && typeof window.confirm === 'function') {
        const details = flagged.slice(0, 8).map(part => part.name + ': ' + part.quality.warnings.join(', ')).join('\\n');
        const proceed = window.confirm('Pemeriksaan overlay menemukan ' + flagged.length + ' layer yang perlu ditinjau. Periksa warna mask dan batas komponennya pada preview.\\n\\n' + details + (flagged.length > 8 ? '\\n…dan ' + (flagged.length - 8) + ' layer lainnya.' : '') + '\\n\\nLanjut Bangun Universal Rig?');
        if (!proceed) { status('Build dibatalkan. Perbaiki/disable layer bermasalah lalu periksa overlay kembali.'); return null; }
      }
      const selected = segments.filter(part => part.enabled !== false);
      if (!selected.length) throw new Error('Aktifkan minimal satu komponen mask.');
      imageUrl = await getImageUrl();
      if (!imageUrl) throw new Error('Gambar sumber tidak tersedia.');
      if (!image) await setImage(imageUrl);
      let poseData = null;
      let poseAnchorsApplied = 0;
      try {
        status('Pose Estimation lokal sedang mendeteksi sendi tubuh…');
        poseData = await estimateLocalPose();
        poseAnchorsApplied = applyPoseJointPivots(selected, poseData);
        status(poseData ? 'Pose lokal terdeteksi · ' + poseAnchorsApplied + ' pivot sendi diselaraskan.' :
          'Tidak ada pose manusia yang terdeteksi · memakai pivot komponen yang sudah ada.');
      } catch (error) {
        status('Pose Estimation tidak tersedia · memakai pivot komponen lama: ' + error.message);
      }
      status('SAM 2.1 sedang mengisi area latar yang tertutup objek…');
      const background = await call('/api/inpaint', { image: imageUrl, masks: selected.map(part => part.mask) });
      const inpaintInfo = background.diagnostics || {};
      status('Rekonstruksi latar selesai · cakupan mask ' + (inpaintInfo.maskCoverage ?? '—') +
        '% · area perbaikan ' + (inpaintInfo.expandedCoverage ?? '—') +
        '% · radius adaptif ' + (inpaintInfo.inpaintRadius ?? '—') + ' px.');
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
      // Cache compact one-byte foreground mattes, then create a shared source-pixel
      // overlap around each parent/child joint. This prevents a narrow SAM seam
      // from opening when connected segments rotate in opposite directions.
      const maskDataById = new Map();
      for (const segment of selected) {
        const maskImage = await loadImage(segment.mask);
        const maskCanvas = document.createElement('canvas'); maskCanvas.width = imageSize.width; maskCanvas.height = imageSize.height;
        const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
        maskContext.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);
        const rgba = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
        const matte = new Uint8Array(imageSize.width * imageSize.height);
        for (let i = 0; i < matte.length; i++) matte[i] = rgba[i * 4];
        maskDataById.set(segment.id, matte);
      }
      const jointSeams = [];
      const jointSeamsByPart = new Map();
      for (const child of selected) {
        const parentId = parentById.get(child.id);
        const parent = selected.find(part => part.id === parentId);
        if (!parent) continue;
        const x = child.pivotNormX * imageSize.width, y = child.pivotNormY * imageSize.height;
        const childSpan = Math.max(1, Math.min(child.bboxOriginal[2], child.bboxOriginal[3]));
        const parentSpan = Math.max(1, Math.min(parent.bboxOriginal[2], parent.bboxOriginal[3]));
        if (!seamSettings.enabled) continue;
        const radius = Math.max(5, Math.min(60, Math.min(childSpan, parentSpan) * 0.18 * seamSettings.radiusScale));
        const parentMask = maskDataById.get(parent.id), childMask = maskDataById.get(child.id);
        if (!parentMask || !childMask) continue;
        const unionMask = new Uint8Array(imageSize.width * imageSize.height);
        const x0 = Math.max(0, Math.floor(x - radius)), x1 = Math.min(imageSize.width - 1, Math.ceil(x + radius));
        const y0 = Math.max(0, Math.floor(y - radius)), y1 = Math.min(imageSize.height - 1, Math.ceil(y + radius));
        let sharedPixels = 0, unionPixels = 0;
        for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
          const dx = px + 0.5 - x, dy = py + 0.5 - y;
          if (dx * dx + dy * dy > radius * radius) continue;
          const index = py * imageSize.width + px;
          const a = parentMask[index], b = childMask[index], value = Math.max(a, b);
          if (value > 16) { unionMask[index] = value; unionPixels++; }
          if (a > 32 && b > 32) sharedPixels++;
        }
        const seam = { parentId: parent.id, childId: child.id, x, y, radius, unionMask, sharedPixels, unionPixels };
        const overlapRatio = unionPixels ? sharedPixels / unionPixels : 0;
        const quality = overlapRatio >= 0.25 ? 'baik' : overlapRatio >= 0.12 ? 'perlu ditinjau' : 'rendah';
        jointSeams.push({ parentId: parent.id, childId: child.id, x, y, radius, sharedPixels, unionPixels, overlapRatio, quality });
        for (const id of [parent.id, child.id]) {
          const list = jointSeamsByPart.get(id) || [];
          list.push(seam); jointSeamsByPart.set(id, list);
        }
      }
      const seamDiagnostics = $('itcvRigSeamDiagnostics');
      if (seamDiagnostics) {
        seamDiagnostics.replaceChildren();
        const summary = document.createElement('strong');
        const weakCount = jointSeams.filter(seam => seam.quality === 'rendah').length;
        const meanOverlap = jointSeams.length ? Math.round(jointSeams.reduce((sum, seam) => sum + seam.overlapRatio, 0) / jointSeams.length * 100) : 0;
        summary.textContent = jointSeams.length
          ? 'DIAGNOSTIK: ' + jointSeams.length + ' sambungan · rata-rata overlap ' + meanOverlap + '% · ' + weakCount + ' sambungan rendah'
          : 'DIAGNOSTIK: belum ada pasangan sendi yang dapat dihitung';
        seamDiagnostics.append(summary);
        jointSeams.forEach((seam, index) => {
          const row = document.createElement('div');
          const ratio = Math.round((seam.overlapRatio || 0) * 100);
          row.style.cssText = 'margin-top:5px;padding-top:5px;border-top:1px solid #403451;color:' + (seam.quality === 'baik' ? '#b9f4d0' : seam.quality === 'perlu ditinjau' ? '#ffd49a' : '#ff9b9b');
          row.textContent = (index + 1) + '. ' + seam.parentId + ' → ' + seam.childId +
            ' · overlap ' + ratio + '% · ' + seam.quality + ' · piksel bersama ' + seam.sharedPixels + '/' + seam.unionPixels +
            (seam.quality === 'rendah' ? ' · saran: cek pivot dan refine mask dengan titik +/−.' : '');
          seamDiagnostics.append(row);
        });
      }
      for (const segment of selected) {
        const maskImage = await loadImage(segment.mask);
        const maskCanvas = document.createElement('canvas'); maskCanvas.width = imageSize.width; maskCanvas.height = imageSize.height;
        const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
        maskContext.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);
        const maskPixels = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
        const partSeams = jointSeamsByPart.get(segment.id) || [];
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
          let alphaMask = maskPixels[sourceIndex];
          if (partSeams.length) {
            const px = bx + x + 0.5, py = by + y + 0.5;
            for (const seam of partSeams) {
              const dx = px - seam.x, dy = py - seam.y, distance = Math.hypot(dx, dy);
              if (distance >= seam.radius) continue;
              const unionAlpha = seam.unionMask[(by + y) * imageSize.width + bx + x];
              if (unionAlpha <= 0) continue;
              const t = Math.max(0, Math.min(1, distance / seam.radius));
              const feather = (1 - t * t * (3 - 2 * t)) * seamSettings.strength;
              alphaMask = Math.max(alphaMask, Math.round(unionAlpha * feather));
            }
          }
          outputPixels.data[targetIndex + 3] = Math.round(sourcePixels.data[sourceIndex + 3] * alphaMask / 255);
        }
        cropContext.putImageData(outputPixels, 0, 0);
        const motion = segment.motion || 'float';
        // Character joints use conservative anatomical amplitudes. Large generic
        // swing values make independent layers look like detached stickers.
        // Make articulated motion clearly visible in the CSS preview while
        // keeping a conservative range for a single still-image character.
        const anatomicalAmplitude = {
          torso: 0.08, head: 0.14,
          upperArmL: 0.24, upperArmR: 0.24,
          forearmL: 0.28, forearmR: 0.28,
          handL: 0.18, handR: 0.18,
          thighL: 0.14, thighR: 0.14,
          shinL: 0.22, shinR: 0.22,
          footL: 0.12, footR: 0.12
        };
        const amplitude = segment.category === 'character'
          ? (motion === 'static' ? 0 : (anatomicalAmplitude[segment.id] ?? 0.025))
          : (motion === 'wheel' ? 6.283 : motion === 'hinge' ? 0.28 :
            motion === 'swing' ? 0.24 : motion === 'rotate' ? 0.35 :
            motion === 'bob' ? 0.05 : motion === 'pulse' ? 0.08 : motion === 'static' ? 0 : 0.12);
        const speed = segment.id.startsWith('foot') || segment.id.startsWith('shin') ? 1.1 :
          segment.id.startsWith('hand') ? 1.5 : segment.id.startsWith('forearm') ? 1.25 : 0.9;
        parts.push({
          id: segment.id, name: segment.name, category: segment.category || 'other',
          poseAnchor: segment.poseAnchor || null,
          parent: parentById.get(segment.id) || '', motion, src: crop.toDataURL('image/png'),
          x: bx, y: by, w: bw, h: bh,
          pivotX: segment.pivotNormX * imageSize.width, pivotY: segment.pivotNormY * imageSize.height,
          amp: amplitude, speed: segment.category === 'character' ? speed : (motion === 'wheel' ? 1.6 : motion === 'static' ? 0 : 0.9),
          phase: parts.length * 0.73, enabled: true
        });
      }
      rig = {
        version: 1, width: imageSize.width, height: imageSize.height,
        background: bg.toDataURL('image/png'), parts, jointSeams,
        jointSeamSettings: { enabled: seamSettings.enabled, strength: seamSettings.strength, radiusScale: seamSettings.radiusScale },
        pose: poseData ? { engine: poseData.engine, detected: true, landmarks: poseData.landmarks } : null,
        engine: 'SAM 2.1 Tiny + Local Pose Estimation + Ollama Vision',
        note: 'Mask dan rig dibuat lokal. Latar hasil inpainting adalah perkiraan; tinjau bagian tepi.'
      };
      if (opt.onApply) opt.onApply(rig);
      status('Universal Rig siap: ' + parts.length + ' komponen · ' + poseAnchorsApplied +
        ' pivot sendi diselaraskan' + (poseData ? ' dengan Pose Estimation lokal.' : ' · pivot default dipertahankan.') +
        ' · ' + jointSeams.length + ' batas sendi diberi overlap piksel bersama (' + (seamSettings.enabled ? Math.round(seamSettings.strength * 100) + '% kekuatan' : 'nonaktif') + '). HTML/JavaScript telah diperbarui.');
      return rig;
    }
    const canvas = $('itcvRigSource');
    if (canvas) canvas.addEventListener('click', async event => {
      if (!picking || !image) return;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * imageSize.width;
      const y = (event.clientY - rect.top) / rect.height * imageSize.height;
      try { await addAt(x, y, pointLabel); }
      catch (error) { status('Gagal menyimpan titik prompt: ' + error.message); }
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
    ['itcvRigMaskOverlay','itcvRigMaskOpacity','itcvRigMaskFocus','itcvRigShowBounds'].forEach(id => {
      const control = $(id);
      if (!control) return;
      const refresh = () => {
        if (id === 'itcvRigMaskOpacity' && $('itcvRigMaskOpacityValue')) {
          $('itcvRigMaskOpacityValue').textContent = Math.round(Number(control.value) || 0) + '%';
        }
        drawSource();
      };
      control.addEventListener('input', refresh);
      control.addEventListener('change', refresh);
    });
    const positiveButton = $('itcvRigPointPositive');
    const negativeButton = $('itcvRigPointNegative');
    function setPointMode(label) {
      pointLabel = label;
      picking = true;
      if (canvas) canvas.style.cursor = 'crosshair';
      if (positiveButton) positiveButton.classList.toggle('active', label === 1);
      if (negativeButton) negativeButton.classList.toggle('active', label === 0);
      status(label === 1 ? 'Mode titik positif (+): klik bagian objek yang ingin dipertahankan.' : 'Mode titik negatif (−): klik latar/bagian yang harus dikeluarkan dari mask.');
    }
    $('itcvRigPickMode').addEventListener('click', () => {
      if (!image) { status('Pilih gambar dahulu.'); return; }
      setPointMode(1);
    });
    if (positiveButton) positiveButton.addEventListener('click', () => setPointMode(1));
    if (negativeButton) negativeButton.addEventListener('click', () => setPointMode(0));
    const runPointsButton = $('itcvRigPointRun');
    if (runPointsButton) runPointsButton.addEventListener('click', () => {
      picking = false; if (canvas) canvas.style.cursor = 'default';
      runPointSegmentation().catch(error => status('Segmentasi titik gagal: ' + error.message));
    });
    const undoPointButton = $('itcvRigPointUndo');
    if (undoPointButton) undoPointButton.addEventListener('click', () => {
      if (!pendingPoints.length) { status('Tidak ada titik prompt untuk dibatalkan.'); return; }
      const removed = pendingPoints.pop();
      picking = false; if (canvas) canvas.style.cursor = 'default';
      const positives = pendingPoints.filter(point => point.label === 1).length;
      const negatives = pendingPoints.length - positives;
      if ($('itcvRigPointHint')) $('itcvRigPointHint').textContent = pendingPoints.length + ' titik · ' + positives + ' positif / ' + negatives + ' negatif';
      drawSource();
      status('Titik terakhir (' + (removed.label === 1 ? 'positif' : 'negatif') + ') dibatalkan. ' + pendingPoints.length + ' titik tersisa.');
    });
    const clearPointsButton = $('itcvRigPointClear');
    if (clearPointsButton) clearPointsButton.addEventListener('click', () => {
      pendingPoints = []; picking = false; if (canvas) canvas.style.cursor = 'default';
      if ($('itcvRigPointHint')) $('itcvRigPointHint').textContent = '0 titik';
      drawSource(); status('Titik prompt dihapus. Mask komponen yang sudah ada tetap aman.');
    });
    $('itcvRigBuild').addEventListener('click', () => build().catch(error => status('Build Rig gagal: ' + error.message)));
    mountSeamControls();
    return {
      setImage, check, autoSegment, autoCharacterParts, addAt, runPointSegmentation, build,
      getRig: () => rig, getSegments: () => segments,
      clear: () => { segments = []; pendingPoints = []; rig = null; maskPreviewCanvases.clear(); if ($('itcvRigPointHint')) $('itcvRigPointHint').textContent = '0 titik'; refreshMaskFocusOptions(); renderList(); drawSource(); $('itcvRigBuild').disabled = true; }
    };
  }
  window.TROZALUniversalRig = { create };
})();