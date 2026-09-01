# 🚀 JFA Web Portfolio

> **Jimmy Faber — Implementator AI to Your Business System**
> Website portfolio pribadi dengan **blog backend**, **AI news curation**, dan **admin panel**.

![Status](https://img.shields.io/badge/status-live-brightgreen) ![Tech](https://img.shields.io/badge/TailwindCSS-v3-38bdf8) ![Backend](https://img.shields.io/badge/Backend-Supabase+Vercel-green)

## ✨ Fitur

### Portfolio
- 🤖 **Portfolio Dinamis** — Data proyek diambil dari GitHub API
- 🌐 **Multi-Bahasa** — Toggle Bahasa Indonesia / English
- ⌨️ **Typewriter Effect** — Animasi teks pada tagline
- 🎨 **Glassmorphism UI** — Desain dark futuristik dengan aksen cyan/purple
- 🧠 **Animated Neural Network** — SVG bergerak khas AI
- 📱 **Fully Responsive** — Mobile-friendly dengan hamburger menu
- 📬 **Form Kontak** — Terintegrasi dengan Formspree
- 🌙 **Dark/Light Mode** — Toggle tema dengan persistensi
- ✨ **Particle Cursor Effect** — Efek partikel mengikuti mouse
- 📊 **Animated Skill Bars** — Progress bar animasi saat scroll

### Blog Backend (NEW)
- 📰 **Berita Info AI** — RSS feed dari 8+ sumber AI, di-curate otomatis oleh Google Gemini API 2x sehari
- ✍️ **Opini & Tulisan** — Blog pribadi, ditulis melalui Admin Panel
- 🔐 **Admin Panel** — Dashboard untuk manage postingan opini (CRUD)
- ⚡ **Cron Jobs** — Vercel Cron otomatis fetch & curate berita 2x sehari (08:00 & 20:00 WIB)

## 🛠️ Tech Stack

| Kategori | Teknologi |
|---|---|
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla JavaScript |
| Backend | Vercel Serverless Functions |
| Database | Supabase (PostgreSQL) |
| AI Curation | Google Gemini API (gemini-2.0-flash) |
| RSS | rss-parser npm |
| Hosting | Vercel |
| Version Control | Git & GitHub |

## 📂 Struktur Proyek

```
jfawebporto/
├── index.html              # Portfolio website (HTML + CSS + JS)
├── admin.html              # Blog admin panel
├── package.json            # Dependencies
├── vercel.json             # Vercel config (cron, rewrites)
├── .env.example            # Environment variables template
├── api/
│   ├── blog.js             # CRUD API untuk opini posts
│   ├── news.js             # API untuk fetch curated news
│   └── cron/
│       └── fetch-news.js   # Cron: RSS fetch + Gemini curation
├── lib/
│   └── supabase.js         # Supabase client helper
├── scripts/
│   └── setup-db.js         # Database schema setup script
└── README.md
```

## ⚙️ Setup

### 1. Supabase
1. Buat akun di [supabase.com](https://supabase.com)
2. Buat project baru
3. Buka SQL Editor, jalankan SQL dari `scripts/setup-db.js` (lihat komentar di file)
4. Copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` dari Settings → API

### 2. Google Gemini API
1. Buka [Google AI Studio](https://aistudio.google.com/apikey)
2. Buat API key baru
3. Copy key-nya

### 3. Environment Variables
Buat file `.env` (atau set di Vercel Dashboard → Settings → Environment Variables):

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx...
GEMINI_API_KEY=AIza...
CRON_SECRET=your-random-secret
ADMIN_PASSWORD=your-secure-password
```

### 4. Deploy
```bash
git add .
git commit -m "feat: blog backend with AI curation"
git push origin main
```

### 5. Set Vercel Cron Secret
Di Vercel Dashboard → Settings → Environment Variables:
- Tambah `CRON_SECRET` (bisa random string)
- Vercel Cron otomatis menggunakan ini untuk autentikasi

## 📊 How It Works

### Berita Info AI (Otomatis)
```
RSS Feeds (8 sumber) → fetch-news.js → Gemini API (curation) → Supabase → /api/news → Frontend
        ↑                                                                   
   Vercel Cron (2x/day: 08:00 & 20:00 WIB)
```

### Opini & Tulisan (Manual)
```
Admin Panel (/admin) → /api/blog (POST) → Supabase → /api/blog (GET) → Frontend
```

## 🌍 Live Demo

🔗 **[jfawebporto.vercel.app](https://jfawebporto.vercel.app)**
🔐 **[jfawebporto.vercel.app/admin](https://jfawebporto.vercel.app/admin)** — Admin panel

## 📝 Customization

### RSS Feeds
Edit array `RSS_FEEDS` di `api/cron/fetch-news.js` untuk menambah/mengganti sumber berita.

### Blog Categories
Kategori berita: `ai-news`, `llm`, `computer-vision`, `ai-business`, `open-source`, `regulation`
Kategori opini: `opini`, `tutorial`, `review`, `insight`

## 🚀 Deployment

Website otomatis ter-deploy ke Vercel setiap push ke `main`. Cron job otomatis aktif di production.

```bash
git add .
git commit -m "update konten"
git push origin main
```

## 📫 Kontak

- 💼 [LinkedIn](https://linkedin.com/in/jimmyfaber)
- 📸 [Instagram](https://instagram.com/jimmyfaber)
- 🤖 [Telegram Bot](https://t.me/jimmyfaber)
- 🐙 [GitHub](https://github.com/Faber-Aritonang)

---

© 2025 Jimmy Faber — Implementator AI to Your Business System
