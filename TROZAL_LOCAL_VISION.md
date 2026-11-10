# TROZAL LOCAL VISION

## Tujuan

Membuat metadata dari piksel gambar hasil preview/render, bukan dari prompt teks, nama file, atau rencana scene. Analisis berjalan lokal di PC pengguna melalui Ollama; tidak memerlukan OpenAI API key dan tidak mengirim gambar ke layanan AI cloud.

## Target perangkat

- Windows 10/11
- RAM 16 GB
- NVIDIA GTX 1660 Super (umumnya 6 GB VRAM)
- Model awal: `qwen3-vl:2b` (sekitar 1.9 GB unduhan)
- Model alternatif: `qwen3-vl:4b` (sekitar 3.3 GB; lebih berat)

Gunakan 2B sebagai default untuk perangkat dengan VRAM 6 GB. Model 4B dapat dicoba kemudian jika penggunaan memori dan kecepatannya masih nyaman. Dukungan akselerasi NVIDIA memerlukan driver yang kompatibel; jika GPU tidak digunakan penuh, Ollama dapat membagi beban ke CPU/RAM.

## Instalasi

1. Install Ollama: https://ollama.com/download/windows
2. Pastikan model tersedia:
   ```powershell
   ollama pull qwen3-vl:2b
   ```
3. Jalankan Ollama seperti biasa. Tidak perlu mengatur `OLLAMA_ORIGINS` untuk mode Bridge lokal.
4. Unduh/jalankan `TROZAL_OLLAMA_BRIDGE_START.bat` dari folder repo.
5. Bridge akan mengambil versi TROZAL MOTION terbaru dan otomatis membuka `http://127.0.0.1:11435/`.
6. Gunakan tab TROZAL MOTION lokal yang terbuka dari Bridge. Jangan gunakan tab GitHub Pages untuk fitur AI lokal jika ingin menghindari izin Loopback Chrome.

## Koneksi lokal

Bridge menyajikan halaman TROZAL dan meneruskan endpoint `/api/tags` serta `/api/chat` ke Ollama. Karena halaman dan API berjalan pada origin loopback yang sama, browser tidak perlu mengizinkan halaman publik GitHub Pages mengakses loopback. Biarkan jendela Bridge tetap terbuka selama penggunaan.

## Cara menggunakan

- Hentikan playback terlebih dahulu.
- Klik **Analisis Visual Sebenarnya**. Jika tidak memilih gambar manual, TROZAL mencoba menangkap tiga frame preview pada 0%, 50%, dan 85% durasi.
- Alternatif: pilih hingga empat screenshot PNG/JPG/WebP untuk analisis.
- AI mengisi judul, deskripsi, kategori, dan keyword dari gambar yang dikirim.
- Periksa dan koreksi metadata sebelum menambahkannya ke batch atau mengekspor.

## Privasi dan keamanan

- Browser menggunakan Bridge lokal `http://127.0.0.1:11435`; Bridge meneruskan permintaan ke Ollama `http://127.0.0.1:11434`.
- Tidak ada API key, backend cloud, atau biaya per request.
- Gambar yang dipilih atau ditangkap diproses oleh model Ollama lokal.

## Batasan

- Analisis visual AI dapat salah mengenali detail; hasil wajib diperiksa manusia.
- Pengambilan frame preview menggunakan renderer DOM-to-image yang sudah digunakan aplikasi. Konten eksternal atau elemen tertentu mungkin tidak tertangkap sempurna; gunakan screenshot manual jika hasil tangkapan tidak sesuai.
- Preview yang sedang diputar harus dihentikan sebelum capture otomatis.
- Jika Ollama/CORS/model belum siap, fitur metadata lama tetap tersedia.
