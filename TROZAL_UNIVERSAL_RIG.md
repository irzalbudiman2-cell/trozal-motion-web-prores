# TROZAL OLLAMA — Universal Object Rig

Universal Object Rig expands Mode 5 beyond whole-image movement and human-only rigging. It can segment visible components from many kinds of source images: people, animals, vehicles, machinery, plants, products, illustrations and graphic elements.

## How it works

1. **Qwen Vision (Ollama)** analyzes the image, labels candidate components and recommends plausible motion and pivot positions.
2. **SAM 2.1 Hiera Tiny** generates pixel masks locally. Automatic mode samples object regions; manual mode lets the user click a particular component.
3. **Local inpainting** reconstructs an approximate background after the selected component masks are removed.
4. **Universal Rig** stores each selected component as a transparent PNG with its own pivot, motion type, speed and optional parent relation.
5. Mode 5 embeds the reconstructed background and all component PNGs into the exported HTML/JavaScript. The export does not need Ollama or SAM 2 running during playback.

The old whole-image animation remains available when the segmentation service is not installed, cannot detect a useful mask, or is not suitable for a source image.

## Windows setup

Requirements:
- Windows 10/11
- Python 3.10, 3.11 or 3.12 with the Python Launcher
- Internet access for the one-time installation and model download
- NVIDIA GPU is optional; CPU fallback is available
- For the user's 16 GB RAM / GTX 1660 Super class of hardware, start with SAM 2.1 Tiny and 1024-pixel analysis

1. Keep Ollama running and make sure the chosen Vision model (for example `qwen2.5vl:3b`) is installed.
2. Run `TROZAL_UNIVERSAL_RIG_SETUP.bat` once. It creates an isolated `.trozal-rig-venv`, installs PyTorch and local segmentation dependencies, downloads the official SAM 2 source, and downloads the SAM 2.1 Tiny checkpoint.
3. Run `TROZAL_UNIVERSAL_RIG_START.bat` whenever Universal Object Rig is needed. Keep its console window open while using Mode 5.
4. Open TROZAL OLLAMA, go to Mode 5, select one source image, run **AI ANALISIS & GENERATE**, then press **AI SEGMENTASI KOMPONEN**. Review names and motion types; use **Klik gambar untuk tambah komponen** when an important part was missed. Press **Bangun Universal Rig** to update the preview and standalone HTML/JavaScript.

The local segmentation server listens only on `127.0.0.1:11436`. Ollama continues to use its normal local API. The SAM model is not downloaded automatically by the website.

## Model and device behavior

The installer requests PyTorch 2.5.1 / TorchVision 0.20.1 with CUDA 12.1 first. If that installation fails, it installs the CPU build. The Python service uses CUDA FP16 when available and can retry on CPU after CUDA out-of-memory errors. It disables compilation of SAM 2's optional custom CUDA extension because the service can run without that extension.

Meta's SAM 2 installation documentation requires Python 3.10+, PyTorch 2.5.1+ and TorchVision 0.20.1+; it also recommends WSL for Windows installations. The TROZAL installer uses the no-custom-CUDA-extension path, but native Windows setup can still vary with local Python/driver configuration. If installation fails, use the error shown in the setup console; do not delete the existing Ollama model.

## Accuracy limits

- SAM 2 segments visible regions; it does not know the correct physical hinge or joint on its own. Qwen proposes names and pivots, and the user should review them.
- Automatic segmentation returns candidate masks, not a guaranteed full semantic decomposition. Use manual click selection to isolate a missed component.
- Inpainting is local approximation. Large removed objects, textured backgrounds and overlapping objects can leave visible artifacts.
- The first release is a 2D cutout rig. It does not create new 3D geometry, true facial animation, physically simulated deformation or a complete 3D skeleton.
- One image is processed per Universal Rig. Multi-image slideshow mode remains separate.
- The generated HTML/JavaScript embeds image masks/backgrounds and can become large when many high-resolution parts are selected.

## Troubleshooting

- **SAM service not active:** run `TROZAL_UNIVERSAL_RIG_START.bat`; verify `http://127.0.0.1:11436/api/health` in the same computer's browser.
- **Chrome local network permission:** allow local/loopback network access for the TROZAL site if Chrome asks.
- **CUDA out of memory:** the service retries on CPU. If repeated, close other GPU-heavy applications and keep image input at or below 1024 pixels for analysis.
- **No masks:** use a clearer image, fewer overlapping objects, or manual click selection. Fall back to whole-image motion if the object cannot be isolated cleanly.
- **Rough background:** reduce the number of selected masks or keep the original-image motion mode for that image.
