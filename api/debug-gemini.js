/**
 * Debug: Test Gemini API key and translation
 */
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

module.exports = async (req, res) => {
  const token = req.query.token || '';
  const adminPw = process.env.ADMIN_PASSWORD || '';
  if (adminPw && token !== adminPw) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(200).json({
      error: 'GEMINI_API_KEY not set',
      hasKey: false,
      envKeys: Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('SUPABASE') || k.includes('ADMIN')),
    });
  }

  try {
    const resp = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Translate to Indonesian: "Apple shares shocking evidence against former employee accused of stealing company data for OpenAI". Return only the translated title.' }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const error = data.error || null;

    return res.status(200).json({
      hasKey: true,
      keyLength: geminiKey.length,
      keyPrefix: geminiKey.substring(0, 8) + '...',
      httpStatus: resp.status,
      translation: text,
      geminiError: error,
      rawResponse: data,
    });
  } catch (err) {
    return res.status(200).json({
      hasKey: true,
      keyLength: geminiKey.length,
      error: err.message,
    });
  }
};
