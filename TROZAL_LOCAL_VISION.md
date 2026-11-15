# TROZAL LOCAL VISION — DIRECT WEB

## Tujuan

Menganalisis piksel dari Preview/render aktual menggunakan model Ollama yang berjalan di PC pengguna. Website GitHub Pages menghubungi API Ollama secara langsung melalui browser ke `http://127.0.0.1:11434`.

**Tidak diperlukan TROZAL Bridge, server proxy lokal, file BAT, API key, atau layanan AI berbayar.** Ollama sendiri tetap harus terpasang dan berjalan di Windows.

## Target perangkat

- Windows 10/11
- RAM 16 GB
- NVIDIA GTX 1660 Super
- Model ringan awal: `qwen3-vl:2b`
- Model lebih berat: `qwen3-vl:4b` atau model Vision lain yang kompatibel

Mulai dari model 2B untuk menjaga penggunaan VRAM. Model 4B dapat dicoba jika performa dan memori masih memadai.

## Konfigurasi satu kali di Windows (tanpa BAT)

1. Install Ollama dari https://ollama.com/download/windows.
2. Buka Command Prompt atau PowerShell dan pasang model yang dibutuhkan, misalnya:
   ```powershell
   ollama pull qwen3-vl:2b
   ```
3. Tekan Start dan cari **Edit environment variables for your account**.
4. Pada bagian **User variables**, klik **New**.
5. Isi:
   - Variable name: `OLLAMA_ORIGINS`
   - Variable value: `https://irzalbudiman2-cell.github.io,https://trozal-motion-web-prores.vercel.app,https://trozal-motion-web-prores-git-ollama-direct-web-7718e1-trozal-id.vercel.app`
6. Klik OK sampai semua jendela tertutup.
7. Klik ikon Ollama di system tray, pilih **Quit**, lalu jalankan Ollama kembali dari Start Menu.

Daftar tersebut mengizinkan GitHub Pages, domain Vercel utama, dan preview Vercel yang sedang diuji. Setiap origin harus persis berupa scheme + host, tanpa slash di akhir. Daftar dipisahkan koma **tanpa spasi**. Jangan gunakan `*` karena itu akan mengizinkan origin website lain. URL preview dapat berubah ketika deployment baru dibuat; tambahkan host preview terbaru jika berbeda.

## Cara menggunakan

1. Buka salah satu situs TROZAL yang origin-nya sudah diizinkan, termasuk preview saat ini: https://trozal-motion-web-prores-git-ollama-direct-web-7718e1-trozal-id.vercel.app.
2. Pastikan aplikasi Ollama berjalan di Windows.
3. Klik **Cek Ollama** pada panel AI yang ingin digunakan.
4. Jika Chrome meminta izin akses jaringan lokal / **Loopback network**, pilih **Allow**.
5. Jika pernah menolak izin, buka Site settings untuk situs GitHub Pages TROZAL dan ubah **Loopback network** menjadi **Allow**, lalu reload.
6. Pilih model yang sudah terpasang dan jalankan Generate atau Analisis Visual.

## Koneksi langsung

- Daftar model: `GET http://127.0.0.1:11434/api/tags`
- Chat / generasi: `POST http://127.0.0.1:11434/api/chat`
- Generator fallback: `POST http://127.0.0.1:11434/api/generate`
- Origin browser yang diizinkan: `https://irzalbudiman2-cell.github.io`, `https://trozal-motion-web-prores.vercel.app`, dan `https://trozal-motion-web-prores-git-ollama-direct-web-7718e1-trozal-id.vercel.app` (sesuaikan bila URL preview berubah).

Website tidak mengirim prompt atau gambar ke backend TROZAL. Browser mengirim permintaan langsung ke Ollama lokal di komputer yang sama. Jangan membuka akses Ollama ke jaringan publik dan jangan mengubah `OLLAMA_HOST` menjadi `0.0.0.0` untuk kebutuhan ini.

## Privasi dan keamanan

- Prompt, gambar, dan respons model diproses oleh Ollama lokal.
- CORS dibatasi ke origin TROZAL yang dipakai; jangan gunakan wildcard.
- Izin Loopback Chrome hanya diperlukan agar halaman HTTPS dapat mengakses layanan loopback di PC.
- Ollama harus tetap aktif selama fitur AI digunakan.

## Batasan dan troubleshooting

- Jika muncul `Failed to fetch`, periksa apakah Ollama berjalan, `OLLAMA_ORIGINS` sudah benar, dan Ollama sudah direstart setelah variabel dibuat.
- Jika respons CORS ditolak, pastikan nilai origin tidak mengandung slash akhir dan cocok dengan alamat website yang dibuka.
- Jika Chrome memblokir akses, izinkan **Loopback network** pada Site settings situs TROZAL.
- Jika `/api/tags` berhasil tetapi model tidak tersedia, unduh model dengan `ollama pull nama-model`.
- Analisis Vision membutuhkan model multimodal yang mendukung gambar. Model teks saja tidak cukup.
- Hentikan playback sebelum capture otomatis. Jika frame Preview tidak tertangkap dengan benar, pilih screenshot PNG/JPG/WebP secara manual.
- Hasil AI dapat keliru; tinjau judul, deskripsi, kategori, dan keyword sebelum ekspor.
