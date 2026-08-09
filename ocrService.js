/**
 * Serviço de OCR - BYOK multi-provedor
 * Chave fica só no localStorage do usuário.
 */

const STORAGE_KEY = 'arte-editavel-ocr-settings';
const DEFAULT_SETTINGS = { provider: 'simulated', apiKey: '' };

function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function clearSettings() {
  localStorage.removeItem(STORAGE_KEY);
}

async function analyzeImage(imageDataUrl) {
  const settings = getSettings();
  const provider = settings.provider || 'simulated';
  const apiKey = (settings.apiKey || '').trim();

  if (provider === 'simulated' || !apiKey) {
    console.log('[OCR] Modo simulado');
    return getSimulatedAnalysis();
  }

  const match = imageDataUrl.match(/^data:(image\/\w+);base64,/);
  const mimeType = match ? match[1] : 'image/jpeg';
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');

  try {
    if (provider === 'gemini') return await callGemini(base64Data, mimeType, apiKey);
    if (provider === 'groq') return await callGroq(base64Data, mimeType, apiKey);
    if (provider === 'openai') return await callOpenAI(base64Data, mimeType, apiKey);
    if (provider === 'claude') return await callClaude(base64Data, mimeType, apiKey);
    return getSimulatedAnalysis();
  } catch (err) {
    console.warn('[OCR] Erro:', provider, err.message);
    const fallback = getSimulatedAnalysis();
    fallback.error = err.message;
    fallback.providerAttempted = provider;
    return fallback;
  }
}

/* -------------------- GROQ (visão) -------------------- */
async function callGroq(base64Data, mimeType, apiKey) {
  const prompt = `List ALL visible text in this graphic design / meme image, one per line.
Focus on the main readable texts (titles, handles, captions).
Format:
BABAQUICE
@username
Some caption line
Another text line`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.6-27b',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64Data } }
        ]
      }],
      max_tokens: 2048,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Groq: ' + response.status + ' – ' + errText.slice(0, 250));
  }

  const data = await response.json();
  let text = data?.choices?.[0]?.message?.content || '';

  // Remove thinking blocks
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

  const lines = text.split('\n')
    .map(function(l) {
      return l.replace(/^[\*\-\d\.\s]+/, '').replace(/\*\*/g, '').replace(/^(TEXT|TEXTO)\s*:\s*/i, '').trim();
    })
    .filter(function(l) {
      if (l.length < 2 || l.length > 100) return false;
      if (/^(the |a group|four men|main photo|image shows|photo:|foto:)/i.test(l)) return false;
      return true;
    });

  // Unique lines
  const seen = {};
  const unique = [];
  lines.forEach(function(l) {
    const key = l.toUpperCase();
    if (!seen[key]) {
      seen[key] = true;
      unique.push(l);
    }
  });

  const elements = [
    { id: 'bg-1', type: 'background', label: 'Fundo', confidence: 'high', bbox: { x: 0, y: 0, w: 1, h: 1 } },
    { id: 'photo-1', type: 'photo', label: 'Fotografia principal', confidence: 'medium', bbox: { x: 0.05, y: 0.15, w: 0.9, h: 0.5 } }
  ];

  unique.slice(0, 8).forEach(function(line, i) {
    elements.push({
      id: 'text-' + (i + 1),
      type: 'text',
      label: i === 0 ? 'Título' : 'Texto ' + (i + 1),
      text: line,
      bbox: { x: 0.08, y: 0.04 + i * 0.1, w: 0.84, h: 0.09 },
      confidence: 'medium',
      color: '#ffffff',
      fontGuess: i === 0 ? 'Impact' : 'Arial Black'
    });
  });

  return { elements: elements, provider: 'groq', simulated: false, raw: text };
}

/* -------------------- GEMINI -------------------- */
async function callGemini(base64Data, mimeType, apiKey) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;
  const prompt = 'List ALL visible text in this image, one per line. Be concise.';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Data } }
      ]}],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Gemini: ' + response.status + ' – ' + errText.slice(0, 200));
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseTextToElements(text, 'gemini');
}

/* -------------------- OPENAI -------------------- */
async function callOpenAI(base64Data, mimeType, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'List ALL visible text in this image, one per line.' },
        { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64Data, detail: 'high' } }
      ]}],
      max_tokens: 2048,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('OpenAI: ' + response.status + ' – ' + errText.slice(0, 200));
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return parseTextToElements(text, 'openai');
}

/* -------------------- CLAUDE -------------------- */
async function callClaude(base64Data, mimeType, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      temperature: 0.1,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
        { type: 'text', text: 'List ALL visible text in this image, one per line.' }
      ]}]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Claude: ' + response.status + ' – ' + errText.slice(0, 200));
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text || '';
  return parseTextToElements(text, 'claude');
}

/* -------------------- HELPERS -------------------- */
function parseTextToElements(text, provider) {
  text = (text || '').replace(/```json|```/g, '').trim();
  const lines = text.split('\n')
    .map(function(l) { return l.replace(/^[\*\-\d\.\s]+/, '').replace(/\*\*/g, '').trim(); })
    .filter(function(l) { return l.length > 2 && l.length < 100; });

  const elements = [
    { id: 'bg-1', type: 'background', label: 'Fundo', confidence: 'high', bbox: { x: 0, y: 0, w: 1, h: 1 } },
    { id: 'photo-1', type: 'photo', label: 'Fotografia principal', confidence: 'medium', bbox: { x: 0.05, y: 0.15, w: 0.9, h: 0.5 } }
  ];

  lines.slice(0, 8).forEach(function(line, i) {
    elements.push({
      id: 'text-' + (i + 1),
      type: 'text',
      label: i === 0 ? 'Título' : 'Texto ' + (i + 1),
      text: line,
      bbox: { x: 0.08, y: 0.04 + i * 0.1, w: 0.84, h: 0.09 },
      confidence: 'medium',
      color: '#ffffff',
      fontGuess: i === 0 ? 'Impact' : 'Arial Black'
    });
  });

  return { elements: elements, provider: provider, simulated: false, raw: text };
}

function getSimulatedAnalysis() {
  return {
    elements: [
      { id: 'bg-1', type: 'background', label: 'Fundo', confidence: 'high', bbox: { x: 0, y: 0, w: 1, h: 1 }, color: '#1a1a2e' },
      { id: 'photo-1', type: 'photo', label: 'Fotografia principal', confidence: 'medium', bbox: { x: 0.05, y: 0.1, w: 0.45, h: 0.7 } },
      { id: 'text-1', type: 'text', label: 'Título (estimado)', confidence: 'medium', bbox: { x: 0.52, y: 0.15, w: 0.42, h: 0.12 }, text: 'Título da Arte', fontGuess: 'Montserrat', color: '#ffffff' },
      { id: 'text-2', type: 'text', label: 'Subtítulo', confidence: 'low', bbox: { x: 0.52, y: 0.3, w: 0.4, h: 0.08 }, text: 'Texto secundário', fontGuess: 'Inter', color: '#cccccc' },
      { id: 'logo-1', type: 'logo', label: 'Possível logotipo', confidence: 'low', bbox: { x: 0.75, y: 0.8, w: 0.18, h: 0.12 } }
    ],
    simulated: true,
    provider: 'simulated'
  };
}

window.OCRService = {
  analyzeImage: analyzeImage,
  getSimulatedAnalysis: getSimulatedAnalysis,
  getSettings: getSettings,
  saveSettings: saveSettings,
  clearSettings: clearSettings
};
