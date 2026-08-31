# 🚀 JFA Web Portfolio

> **Jimmy Faber — Implementator AI to Your Business System**

Website portfolio pribadi interaktif yang menampilkan proyek-proyek di bidang **IT & AI**, dibangun dengan teknologi modern dan di-deploy dengan infrastruktur gratis (GitHub + Vercel).

![Status](https://img.shields.io/badge/status-live-brightgreen) ![Tech](https://img.shields.io/badge/TailwindCSS-v3-38bdf8) ![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Fitur Interaktif

- 🤖 **Portfolio Dinamis** — Data proyek diambil otomatis dari GitHub API (selalu update saat push repo baru)
- 🌐 **Multi-Bahasa** — Toggle Bahasa Indonesia / English (ter-simpan di localStorage)
- ⌨️ **Typewriter Effect** — Animasi teks pada tagline
- 🎨 **Glassmorphism UI** — Desain dark futuristik dengan aksen cyan/purple
- 🧠 **Animated Neural Network** — SVG neural network bergerak dengan animasi pulse
- 📱 **Fully Responsive** — Mobile-friendly dengan hamburger menu
- 📬 **Form Kontak** — Terintegrasi dengan Formspree
- ⚡ **Lightweight** — Single HTML file, tanpa build step

### 🆕 Fitur Baru (v2 — Interaktif)

- 📊 **Scroll Progress Bar** — Indikator progress di bagian atas halaman
- 🎯 **Active Nav Highlight** — Navbar otomatis highlight section yang sedang aktif
- 📈 **Animated Skill Bars** — Progress bar animate saat section skills masuk viewport
- 🔍 **Project Detail Modal** — Klik project card → muncul modal dengan detail lengkap (stars, forks, watchers, topics, dll)
- 📅 **GitHub Activity Graph** — Visualisasi kontribusi 6 bulan terakhir dalam bentuk heatmap
- ✨ **Particle Cursor Effect** — Efek partikel mengikuti gerakan mouse (cyan & purple)
- 🌓 **Dark/Light Mode Toggle** — Toggle tema gelap/terang dengan persistensi localStorage
- 📝 **Blog dari GitHub** — Blog section otomatis diambil dari deskripsi repo GitHub
- 🏷️ **Tech Stack Icon Grid** — Grid ikon teknologi berdasarkan bahasa di repo GitHub

## 🛠️ Tech Stack

| Kategori | Teknologi |
|---|---|
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla JavaScript |
| Font | Inter, JetBrains Mono |
| API | GitHub REST API (repos, events) |
| Form | Formspree |
| Hosting | Vercel |
| Version Control | Git & GitHub |

## 🌍 Live Demo

🔗 **[jfawebporto.vercel.app](https://jfawebporto.vercel.app)**

## 📂 Struktur Proyek

```
jfawebporto/
└── index.html    # Seluruh website (HTML + CSS + JS)
```

## ⚙️ Kustomisasi

Bagian yang perlu diganti ditandai dengan komentar `CUSTOMIZATION` di dalam `index.html`:

1. **Foto profil** — ganti avatar inisial dengan `<img>`
2. **Username GitHub** — ganti `USERNAME` di JavaScript
3. **Tech stack** — sesuaikan skill di section About (atau biarkan otomatis dari GitHub)
4. **Link sosial media** — Email, Telegram Bot, Instagram, LinkedIn
5. **Formspree ID** — daftar di [formspree.io](https://formspree.io), ganti `YOUR_FORMSPREE_ID`

## 🚀 Deployment

Website otomatis ter-deploy ke Vercel setiap kali ada push ke branch `main`:

```bash
git add .
git commit -m "update konten"
git push origin main
```

## 📦 Fitur Interaktif — Cara Kerja

### Scroll Progress Bar
Thin gradient bar di top yang menunjukkan seberapa jauh user telah scroll halaman.

### Active Nav Highlight
Menggunakan `IntersectionObserver` untuk mendeteksi section aktif dan highlight link navbar yang sesuai.

### Animated Skill Bars
Progress bar beranimasi dari 0 ke angka sebenarnya saat section skills pertama kali masuk viewport. Menggunakan `IntersectionObserver` + CSS transitions.

### Project Detail Modal
Klik pada project card akan membuka modal dengan informasi lengkap:
- Stars, Forks, Watchers, Issues
- Tanggal dibuat & terakhir update
- Ukuran repo, license, topics
- Link ke GitHub & Live Demo

### GitHub Activity Graph
Mengambil data dari GitHub Events API (`/users/{username}/events/public`) dan menampilkan heatmap kontribusi 26 minggu terakhir. Waktu update, size, dll.

### Particle Cursor Effect
Canvas-based particles yang mengikuti gerakan mouse dengan warna cyan & purple. Partikel mengecil dan fade out seiring waktu.

### Dark/Light Mode
Toggle tema yang tersimpan di `localStorage`. Semua glassmorphism, text colors, dan background berubah secara transisi.

### Blog dari GitHub
Blog section otomatis mengambil 4 repo terbaru yang memiliki deskripsi, menampilkannya sebagai kartu artikel dengan kategori, waktu update, dan link ke GitHub.

### Tech Stack Icon Grid
Grid ikon teknologi yang di-generate otomatis dari bahasa pemrograman di seluruh repo GitHub, diurutkan berdasarkan jumlah repo.

## 📫 Kontak

- 💼 [LinkedIn](https://linkedin.com/in/jimmyfaber)
- 📸 [Instagram](https://instagram.com/jimmyfaber)
- 🤖 [Telegram Bot](https://t.me/jimmyfaber)
- 🐙 [GitHub](https://github.com/Faber-Aritonang)

---

© 2025 Jimmy Faber — Implementator AI to Your Business System
