# 🚀 JFA Web Portfolio

> **Jimmy Faber — Implementator AI to Your Business System**
>
> Website portfolio pribadi dengan **blog backend**, **AI news curation**, dan **admin panel**.

![Status](https://img.shields.io/badge/status-live-brightgreen) ![Tech](https://img.shields.io/badge/TailwindCSS-v3-38bdf8) ![Backend](https://img.shields.io/badge/Backend-Supabase+Vercel-green)

## ✨ Fitur

### Portfolio
- 🤖 **Portfolio Dinamis** — 30 repo terbaru diambil langsung dari GitHub REST API (`sort=updated`), kartu proyek bisa dibuka jadi modal detail
- 💬 **AI Chat Assistant** — Widget chat di halaman utama, memanggil `/api/chat` (Gemini)
- 🌐 **Multi-Bahasa** — Toggle Bahasa Indonesia / English
- ⌨️ **Typewriter Effect** — Animasi teks pada tagline
- 🎨 **Glassmorphism UI** — Desain dark futuristik dengan aksen cyan/purple
- 🧠 **Animated Neural Network** — SVG bergerak khas AI
- 📱 **Fully Responsive** — Mobile-friendly dengan hamburger menu
- 📬 **Form Kontak** — Kirim ke `/api/contact`, diteruskan lewat Resend atau webhook. Kalau keduanya belum di-set, endpoint membalas 503 dan form otomatis beralih ke aplikasi email pengunjung (`mailto`)
- 🌙 **6 Tema** — Dark, Light, Midnight, Nature, Sunset, Cyber; pilihan disimpan di `localStorage`
- ✨ **Particle Cursor Effect** — Efek partikel mengikuti mouse
- 📊 **Animated Skill Bars** — Progress bar animasi saat scroll

### Blog Backend
- 📰 **Berita Info AI** — RSS dari 8 sumber AI, di-curate otomatis Google Gemini (skor relevansi + terjemahan ke Bahasa Indonesia) sekali sehari
- ✍️ **Opini & Tulisan** — Blog pribadi dengan cover, tag, draft/publish, dan lampiran file (PDF, PPT, video, gambar, ZIP)
- 🔐 **Admin Panel** — Login password, CRUD postingan, upload/hapus lampiran, hapus berita, fetch berita manual
- ⚡ **Cron Jobs** — Vercel Cron memanggil `/api/cron/fetch-news` setiap 08:00 WIB, plus tombol "Fetch berita sekarang" di admin

## 🛠️ Tech Stack

| Kategori | Teknologi |
|:---|:---|
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla JavaScript |
| Backend | Vercel Serverless Functions |
| Database | Supabase (PostgreSQL) |
| AI (kurasi berita + chat) | Google Gemini API (gemini-3.5-flash-lite) |
| Form Kontak | Resend API atau webhook (Zapier / Make / Discord / Slack) |
| RSS | rss-parser npm |
| Storage | Supabase Storage (bucket `blog-attachments`) |
| Hosting | Vercel |
| Version Control | Git & GitHub |

## 📂 Struktur Proyek

```
jfawebporto/
├── index.html              # Portfolio website (HTML + CSS + JS)
├── blog.html               # Halaman detail artikel
├── admin/index.html        # Blog admin panel (/admin)
├── package.json            # Dependencies
├── vercel.json             # Vercel config (cron)
├── schema-v2.sql           # Schema utama: blog, attachments, news, storage + RLS
├── schema-v2-only.sql      # Migrasi tambahan (attachments + policy storage)
├── schema.sql              # Schema lama — jangan dipakai, masih ada policy tulis terbuka
├── .env.example            # Environment variables template
├── api/
│   ├── blog.js             # CRUD API untuk opini posts
│   ├── news.js             # API untuk fetch curated news
│   ├── upload.js           # Upload lampiran ke Supabase Storage
│   ├── chat.js             # AI assistant (Gemini)
│   ├── contact.js          # Form kontak (webhook atau Resend)
│   ├── test.js             # Health check: GET /api/test → { ok: true }
│   ├── fetch-news.js       # Alias lama (require) → api/cron/fetch-news.js
│   └── cron/
│       └── fetch-news.js   # Cron: RSS fetch + Gemini curation & terjemahan
├── lib/
│   └── supabase.js         # Supabase client helper
├── scripts/
│   └── setup-db.js         # Legacy: hanya untuk schema lama, pakai schema-v2.sql
└── README.md
```

## ⚙️ Setup

### 1. Supabase
1. Buat akun di [supabase.com](https://supabase.com)
2. Buat project baru
3. Buka **SQL Editor → New Query**, tempel isi `schema-v2.sql`, lalu Run
   - File ini membuat tabel `blog_posts`, `blog_attachments`, `news_articles`, bucket storage `blog-attachments` (limit 100MB), dan policy RLS baca-saja untuk publik.
   - Aman dijalankan berulang; kalau muncul error `policy ... already exists`, berarti yang ter-run masih salinan lama — buka ulang file dari repo.
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

# Form kontak — isi salah satu (kalau kosong, form menawarkan kirim via aplikasi email)
RESEND_API_KEY=re_xxxxxxxx
CONTACT_TO_EMAIL=faber.aritonang@gmail.com
CONTACT_FROM_EMAIL=Portfolio <onboarding@resend.dev>
CONTACT_WEBHOOK_URL=
```

Form kontak memakai `CONTACT_WEBHOOK_URL` kalau diisi; kalau tidak, pesan dikirim lewat Resend ke `CONTACT_TO_EMAIL`. Tanpa keduanya endpoint membalas `503 { configured: false }` dan frontend menawarkan `mailto`. Pengaman spam: honeypot field `website` dan rate limit 5 pesan / 10 menit per IP (disimpan in-memory per instance function).

> Server memakai `SUPABASE_SERVICE_KEY` untuk semua operasi tulis (service role bypass RLS). Kalau key ini kosong, `lib/supabase.js` turun ke anon key dan menulis warning di log — jangan dipakai di production. Jalankan ulang `schema-v2.sql` setelah update agar policy RLS lama (`FOR ALL USING (true)`) terhapus.

### 4. Deploy
Import repo ini di [Vercel](https://vercel.com/new); setiap push ke `main` otomatis ter-deploy. Perintah push-nya ada di bagian **Deployment** di bawah.

### 5. Set Vercel Cron Secret
Di Vercel Dashboard → Settings → Environment Variables:
- Tambah `CRON_SECRET` (bisa random string)
- Vercel Cron otomatis menggunakan ini untuk autentikasi

## 🔄 Cara Kerja

### Berita Info AI (Otomatis)
```
RSS (8 sumber) → api/cron/fetch-news.js → Gemini (skor + terjemahan) → Supabase → /api/news → Frontend
        ↑
   Vercel Cron (08:00 WIB) + tombol "Fetch berita sekarang" di admin
```

Detail pipeline di `api/cron/fetch-news.js`:
- Ambil maksimal 15 item terbaru dari tiap feed di array `RSS_FEEDS` (paralel, timeout 8 detik per feed).
- Dedupe berdasarkan URL, baik di dalam batch maupun terhadap 500 URL terakhir di database.
- Gemini memproses maksimal **40 artikel baru** per run (batch 10 artikel) dengan skor minimal **40**; judul & ringkasan diterjemahkan ke Bahasa Indonesia.
- Kalau `GEMINI_API_KEY` kosong atau Gemini gagal, artikel tetap disimpan sebagai fallback (skor 50, teks asli) — pipeline tidak berhenti.
- Upsert `onConflict: url`, lalu hanya **200 artikel terbaru** yang dipertahankan (`fetched_at`).

- **Endpoint:** `/api/cron/fetch-news` (alias lama `/api/fetch-news`, keduanya GET/POST).
- **Autentikasi:** `Authorization: Bearer $CRON_SECRET` (dipakai Vercel Cron) atau header `x-admin-token: $ADMIN_PASSWORD` (dipakai tombol manual di admin).

> **Catatan plan Hobby:** Vercel hanya mengizinkan cron sekali sehari — jadwal di `vercel.json` sudah disetel `0 1 * * *` (08:00 WIB). Untuk 2x sehari (08:00 & 20:00 WIB) di plan Pro, ubah jadi `0 1,13 * * *`.

### Opini & Tulisan (Manual)
```
Admin Panel (/admin) → /api/blog (POST/PUT) → Supabase → /api/blog (GET) → index.html / blog.html
```

- Publik hanya melihat `published = true`; admin (header `Authorization: Bearer $ADMIN_PASSWORD`) juga melihat draft.
- Slug dibuat otomatis dari judul + suffix timestamp (`judul-post-mf3k2a`), jadi judul sama tidak bentrok.
- `excerpt` kosong diisi otomatis dari 200 karakter pertama konten.
- Lampiran diunggah setelah postingan tersimpan, karena butuh `post_id`.

## 🧩 API Backend Blog

| Method | Endpoint | Auth | Fungsi |
|:---|:---|:---|:---|
| `GET` | `/api/blog` | publik | List postingan published (`limit`, `offset`, `category`) |
| `GET` | `/api/blog?slug=xxx` | publik | Detail satu postingan + lampiran |
| `GET` | `/api/blog?auth=check` | admin | Cek password admin (login panel) |
| `POST` | `/api/blog` | admin | Buat postingan (`title`, `content`, `excerpt`, `cover_image`, `category`, `tags`, `published`) |
| `PUT` | `/api/blog` | admin | Update postingan (butuh `id`) |
| `DELETE` | `/api/blog?id=xxx` | admin | Hapus postingan + baris lampirannya |
| `GET` | `/api/news` | publik | List berita (`limit`, `offset`, `category`) |
| `DELETE` | `/api/news?id=xxx` | admin | Hapus satu berita |
| `POST` | `/api/upload` | admin | `action: sign` → signed upload URL; `action: finalize` → catat lampiran ke DB |
| `DELETE` | `/api/upload?id=xxx` | admin | Hapus objek Storage + baris `blog_attachments` |
| `GET/POST` | `/api/cron/fetch-news` | cron/admin | Fetch RSS + kurasi Gemini |

Request body `/api/blog` & `/api/upload` menerima JSON; auth admin selalu lewat header `Authorization: Bearer <ADMIN_PASSWORD>`.

### Model Data
- **`blog_posts`** — `title`, `slug` (unik), `content`, `excerpt`, `cover_image`, `category`, `tags[]`, `published`, `created_at`, `updated_at`.
- **`blog_attachments`** — `post_id` (FK, cascade delete), `file_name`, `file_url`, `file_type`, `file_size`.
- **`news_articles`** — `title`, `url` (unik), `source`, `summary`, `gemini_summary`, `category`, `image_url`, `published_at`, `fetched_at`, `gemini_score`.

### Alur Upload Lampiran
```
1. POST /api/upload { action: 'sign', file_name, file_type, file_size }
   → { upload_url, token, path, public_url }
2. Browser PUT file langsung ke upload_url (Supabase Storage)
3. POST /api/upload { action: 'finalize', post_id, file_url, ... } → baris blog_attachments
```

File tidak melewati body-parser Vercel (±4.5MB), jadi batasnya mengikuti bucket: **100MB** per file. Tipe yang diterima: PDF, PPT/PPTX, MP4, WebM, JPEG, PNG, GIF, WebP, TXT, ZIP. `finalize` menolak `file_url` yang bukan dari bucket `blog-attachments`.

## 🌍 Live Demo

- 🔗 **Website:** [jfawebporto.vercel.app](https://jfawebporto.vercel.app)
- 🔐 **Admin panel:** [jfawebporto.vercel.app/admin](https://jfawebporto.vercel.app/admin)

## 🎨 Kustomisasi

### RSS Feeds
Edit array `RSS_FEEDS` di `api/cron/fetch-news.js` untuk menambah/mengganti sumber berita.

### Kategori Blog
- **Berita:** `ai-news`, `llm`, `computer-vision`, `ai-business`, `open-source`, `regulation`
- **Opini:** `opini`, `ai-keseharian`, `tutorial`, `review`, `insight`

## 🚀 Deployment

Website otomatis ter-deploy ke Vercel setiap push ke `main`. Cron job otomatis aktif di production.

```bash
git add .
git commit -m "update konten"
git push origin main
```

## 🩺 Troubleshooting

### Tulis ke database gagal — `new row violates row-level security policy`
- **Gejala:** `POST`/`PUT`/`DELETE` di `/api/blog`, `/api/news`, atau `/api/upload` membalas `500` dengan pesan tersebut; di log Vercel muncul `[Supabase] SUPABASE_SERVICE_KEY belum di-set — memakai anon key`.
- **Penyebab:** `lib/supabase.js` jatuh ke `SUPABASE_ANON_KEY`. Policy di `schema-v2.sql` hanya memberi `SELECT` ke `anon`, jadi insert/update/delete ditolak RLS.
- **Perbaikan:** set `SUPABASE_SERVICE_KEY` (Settings → API → `service_role`) di Environment Variables, lalu redeploy. Key ini hanya boleh dipakai di server, jangan pernah dimasukkan ke `index.html`/`admin/index.html`.

Kalau error-nya justru "berhasil tapi data bisa ditulis siapa pun", berarti database masih memakai policy lama dari `schema.sql` (`FOR ALL USING (true)`). Jalankan ulang `schema-v2.sql`: file itu menghapus policy `Service all ...` dan menyisakan policy baca-saja untuk publik. Akses tulis tetap jalan karena service role bypass RLS, sementara pembaca anon hanya bisa melihat `published = true`.

### Form kontak balas `503`
- **Gejala:** `POST /api/contact` → `503 { "error": "Form kontak belum dikonfigurasi", "configured": false }`, dan form langsung membuka aplikasi email (`mailto`). Itu perilaku normal saat belum ada kanal pengiriman.
- **Penyebab:** `CONTACT_WEBHOOK_URL` dan `RESEND_API_KEY` sama-sama kosong, atau env sudah diisi tapi belum redeploy.
- **Perbaikan:** isi salah satu. Untuk Resend, `CONTACT_TO_EMAIL` wajib; `CONTACT_FROM_EMAIL` default memakai `onboarding@resend.dev` yang hanya boleh mengirim ke email pemilik akun Resend — verifikasi domain lalu ganti `from`-nya.
- **`502` "Pesan gagal dikirim"** artinya kanal sudah terkonfigurasi tapi pengiriman ditolak (webhook non-2xx, Resend error, atau `CONTACT_TO_EMAIL` kosong saat memakai Resend). Cek log `[Contact]` di Vercel. `429` berarti rate limit 5 pesan / 10 menit per IP sudah tercapai.

### Cron `401 Unauthorized`
- **Gejala:** log Vercel Cron atau `curl` manual membalas `401 { "error": "Unauthorized" }`, jumlah berita tidak bertambah.
- **Penyebab:** `isAuthorized()` di `api/cron/fetch-news.js` hanya menerima dua hal: header `Authorization: Bearer <CRON_SECRET>` (dikirim Vercel Cron) atau `x-admin-token: <ADMIN_PASSWORD>` (tombol manual di admin, `?token=` juga diterima). Kalau `CRON_SECRET` belum di-set di environment **Production**, Vercel tidak mengirim header apa pun sehingga request selalu ditolak.
- **Perbaikan:** tambahkan `CRON_SECRET` di Production lalu redeploy, dan pastikan nilainya sama persis (tanpa spasi/tanda kutip ikut tersimpan). Uji manual:

```bash
curl -i -H "x-admin-token: $ADMIN_PASSWORD" https://<domain>/api/cron/fetch-news
```

### Login admin selalu `401`
`checkAdmin()` membandingkan `Authorization: Bearer <ADMIN_PASSWORD>` persis. `401` di `/api/blog?auth=check` berarti password yang diketik tidak sama dengan env di environment yang sedang dipakai — cek apakah `ADMIN_PASSWORD` hanya di-set untuk Preview/Development, atau ada spasi ikut tersimpan.

## 📫 Kontak

- 💼 [LinkedIn](https://linkedin.com/in/jimmy-faber-7ab463279)
- 📸 [Instagram](https://instagram.com/jimmyfaberaritonang)
- 🤖 [Telegram Bot](https://t.me/jimmyfaber)
- 🐙 [GitHub](https://github.com/Faber-Aritonang)

---

© 2025 Jimmy Faber — Implementator AI to Your Business System
