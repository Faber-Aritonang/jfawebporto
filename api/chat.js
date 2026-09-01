/**
 * Chat API: AI Assistant for Jimmy Faber's Portfolio
 *
 * Uses Gemini API with context about Jimmy to answer visitor questions.
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

const SYSTEM_PROMPT = `Kamu adalah AI assistant untuk portfolio Jimmy Faber — seorang AI Implementator.

Berikut informasi tentang Jimmy Faber:

PROFIL:
- Nama: Jimmy Faber
- Role: AI Implementator — Implementasi AI untuk Sistem Bisnis
- Tagline: "Implementator AI to Your Business System"
- Email: faber.aritonang@gmail.com
- GitHub: github.com/Faber-Aritonang
- Instagram: instagram.com/jimmyfaberaritonang
- LinkedIn: linkedin.com/in/jimmy-faber-7ab463279
- Telegram: t.me/jimmyfaberaritonang_bot

KEAHLIAN:
- AI & Machine Learning: TensorFlow, PyTorch, LLM, Embeddings, Computer Vision
- Backend & APIs: Python, FastAPI, Node.js, Express, Database & SQL
- DevOps & Cloud: Docker, Kubernetes, AWS, GCP, CI/CD

LAYANAN:
- Implementasi AI untuk bisnis
- Integrasi API/model AI
- Pengembangan sistem AI end-to-end
- Konsultasi transformasi digital dengan AI

PENGALAMAN:
- 5+ tahun di bidang IT & AI
- 20+ proyek AI
- Fokus pada ROI yang terukur dan sustainable

ATURAN JAWAB:
- Jawab dalam Bahasa Indonesia
- Singkat, padat, dan profesional (maksimal 3-4 kalimat)
- Jika ditanya tentang harga/konsultasi, arahkan ke email atau Telegram
- Jika pertanyaan di luar konteks Jimmy, tetap bantu tapi akhiri dengan "Untuk info lebih lanjut tentang Jimmy Faber, silakan hubungi via email atau Telegram."
- Gunakan emoji secukupnya (tidak berlebihan)
- Format jawaban dengan line break untuk keterbacaan`;

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const resp = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT + '\n\nPengunjung: ' + message }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[Chat] Gemini error:', resp.status, err.substring(0, 200));
      return res.status(500).json({ error: 'AI service unavailable' });
    }

    const data = await resp.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, saya tidak bisa memproses pertanyaan ini.';

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
