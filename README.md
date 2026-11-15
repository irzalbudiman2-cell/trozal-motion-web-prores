# TROZAL MOTION — Web ProRes

Browser-based motion graphics editor with local FFmpeg.wasm processing. The intended output path is QuickTime MOV / Apple ProRes 4444 with alpha.

## What the workflow does

On every push to `main` (or manual workflow dispatch), GitHub Actions:

1. Copies the editor into a static Pages site.
2. Vendors `@ffmpeg/ffmpeg@0.12.15` worker modules and JSZip into the same origin.
3. Clones the FFmpeg.wasm v12.15 source.
4. Adds explicit configure flags for `prores_ks`, PNG decode, image2 demuxing, MOV muxing, and the file protocol.
5. Builds the single-threaded WebAssembly core with Docker using `make prd`.
6. Publishes the site and core to GitHub Pages.

## First-time Pages setup

Open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. Then push to `main` or run the workflow manually from **Actions → Build ProRes WASM and Deploy GitHub Pages**.

Expected public site URL:

`https://irzalbudiman2-cell.github.io/trozal-motion-web-prores/`

## Export formats

- **WebM** — native browser MediaRecorder.
- **MP4 H.264** — FFmpeg.wasm, with locally hosted worker/core files.
- **MOV ProRes 4444 + Alpha** — custom local WASM core using `prores_ks`, profile 4, `yuva444p10le`, and `-alpha_bits 16`.
- **PNG Sequence ZIP** — transparent PNG frames.

The app only reports ProRes as successful after FFprobe verifies the codec, profile 4444, and alpha-capable pixel format. A successful workflow build alone is not proof that export works in every browser. Test first at 1280×720, 10 seconds, 30 FPS.

## Resource notes

The FFmpeg core is downloaded by the browser from this repository's GitHub Pages origin on first use. It runs in the user's browser; frames are not uploaded to a paid rendering service. 4K or long renders can require substantial browser memory.

## Local AI Vision metadata (direct browser connection)

TROZAL MOTION can analyze actual preview frames using an Ollama model running on the same Windows PC. The website connects directly to `http://127.0.0.1:11434`; there is no TROZAL Bridge, local proxy, or BAT launcher.

1. Install Ollama for Windows: https://ollama.com/download/windows
2. Install a local model, for example `ollama pull qwen3-vl:2b`.
3. Add a Windows user environment variable named `OLLAMA_ORIGINS` with the comma-separated origins `https://irzalbudiman2-cell.github.io,https://trozal-motion-web-prores.vercel.app,https://trozal-motion-web-prores-git-ollama-direct-web-7718e1-trozal-id.vercel.app` (no spaces, no trailing slashes).
4. Quit Ollama from the system tray and start it again so it inherits the new variable.
5. Open the GitHub Pages site or the current [Vercel preview](https://trozal-motion-web-prores-git-ollama-direct-web-7718e1-trozal-id.vercel.app), allow Chrome's **Loopback network** access when prompted, and click **Cek Ollama**. Add a newly generated Vercel preview origin to `OLLAMA_ORIGINS` when its hostname changes.

See [TROZAL_LOCAL_VISION.md](TROZAL_LOCAL_VISION.md) for the manual Windows setup and troubleshooting. Do not use a wildcard origin (`*`); allow only the trusted TROZAL site. Metadata is an AI draft and should be reviewed before export.

## Licensing

The custom FFmpeg core contains GPL-enabled FFmpeg components. See `THIRD_PARTY_NOTICES.md` for upstream sources and license notes.
