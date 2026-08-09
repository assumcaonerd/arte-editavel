/**
 * Serviço de OCR - abstração com suporte a múltiplos provedores
 * e modelo "traga a sua própria chave" (BYOK).
 *
 * A chave fica apenas no localStorage do navegador do usuário.
 * Nunca é enviada para nossos servidores.
 */

const STORAGE_KEY = 'arte-editavel-ocr-settings';

const DEFAULT_SETTINGS = {
  provider: 'simulated',
  apiKey: ''
};

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

/**
 * Analisa uma imagem usando o provedor escolhido pelo usuário
 */
async function analyzeImage(imageDataUrl) {
  const settings = getSettings();
  const provider = settings.provider || 'simulated';
  const apiKey = (settings.apiKey || '').trim();

  // Sem chave ou provedor simulado → usa análise local
  if (provider === 'simulated' || !apiKey) {
    console.log('[OCR] Usando análise simulada');
    return getSimulatedAnalysis();
  }

  const match = imageDataUrl.match(/^data:(image\/\w+);base64,/);
  const mimeType = match ? match[1] : 'image/jpeg';
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');

  try {
    if (provider === 'gemini') {
      return await callGemini(base64Data, mimeType, apiKey);
    }
    if (provider === 'groq') {
      return await callGroq(base64Data, mimeType, apiKey);
    }
    if (provider === 'openai') {
      return await callOpenAI(base64Data, mimeType, apiKey);
    }
    if (provider === 'claude') {
      return await callClaude(base64Data, mimeType, apiKey);
    }

    // Provedor desconhecido
    return getSimulatedAnalysis();
  } catch (err) {
    console.warn('[OCR] Erro no provedor', provider, err.message);
    // Em caso de erro devolve simulado + marca o erro
    const fallback = getSimulatedAnalysis();
    fallback.error = err.message;
    fallback.providerAttempted = provider;
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/*  Prompt comum                                                      */
/* ------------------------------------------------------------------ */

const ANALYSIS_PROMPT = `Você é um especialista em análise de artes gráficas (posts, flyers, banners políticos e de redes sociais).

Analise a imagem e retorne APENAS um JSON válido (sem markdown, sem texto extra) no seguinte formato:

{
  "elements": [
    {
      "id": "texto-1",
      "type": "text",
      "label": "Título principal",
      "text": "texto reconhecido exatamente como aparece",
      "bbox": { "x": 0.1, "y": 0.05, "w": 0.8, "h": 0.12 },
      "confidence": "high",
      "fontGuess": "Montserrat",
      "color": "#ffffff",
      "fontSizeEstimate": 48
    },
    {
      "id": "foto-1",
      "type": "photo",
      "label": "Fotografia principal",
      "bbox": { "x": 0.05, "y": 0.2, "w": 0.4, "h": 0.5 },
      "confidence": "medium"
    },
    {
      "id": "fundo-1",
      "type": "background",
      "label": "Fundo",
      "bbox": { "x": 0, "y": 0, "w": 1, "h": 1 },
      "confidence": "high",
      "color": "#1a1a2e"
    }
  ]
}

Regras:
- bbox usa valores normalizados de 0 a 1
- type pode ser: text, photo, logo, background, shape, object
- confidence: "high", "medium" ou "low"
- Extraia o texto o mais fiel possível
- Identifique títulos, subtítulos e legendas
- Se não tiver certeza, use confidence "low"
- Retorne somente o JSON, nada mais`;

/* ------------------------------------------------------------------ */
/*  Gemini                                                            */
/* ------------------------------------------------------------------ */

async function callGemini(base64Data, mimeType, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: ANALYSIS_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini: ${response.status} – ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseModelResponse(text, 'gemini');
}

/* ------------------------------------------------------------------ */
/*  Groq                                                              */
/* ------------------------------------------------------------------ */

async function callGroq(base64Data, mimeType, apiKey) {
  // Groq usa API compatível com OpenAI + modelos com visão (Llama 4 Scout / Llama 3.2 Vision)
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`
              }
            }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq: ${response.status} – ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return parseModelResponse(text, 'groq');
}

/* ------------------------------------------------------------------ */
/*  OpenAI                                                            */
/* ------------------------------------------------------------------ */

async function callOpenAI(base64Data, mimeType, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI: ${response.status} – ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return parseModelResponse(text, 'openai');
}

/* ------------------------------------------------------------------ */
/*  Claude                                                            */
/* ------------------------------------------------------------------ */

async function callClaude(base64Data, mimeType, apiKey) {
  // Claude usa media_type no formato image/jpeg etc.
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Data
              }
            },
            { type: 'text', text: ANALYSIS_PROMPT }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude: ${response.status} – ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text || '';
  return parseModelResponse(text, 'claude');
}

/* ------------------------------------------------------------------ */
/*  Utilitários                                                       */
/* ------------------------------------------------------------------ */

function parseModelResponse(text, provider) {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    parsed.provider = provider;
    parsed.simulated = false;
    return parsed;
  } catch (e) {
    console.error('Resposta não é JSON válido:', text.slice(0, 300));
    throw new Error('O modelo não retornou JSON válido');
  }
}

function getSimulatedAnalysis() {
  return {
    elements: [
      {
        id: 'bg-1',
        type: 'background',
        label: 'Fundo',
        confidence: 'high',
        bbox: { x: 0, y: 0, w: 1, h: 1 },
        color: '#1a1a2e'
      },
      {
        id: 'photo-1',
        type: 'photo',
        label: 'Fotografia principal',
        confidence: 'medium',
        bbox: { x: 0.05, y: 0.1, w: 0.45, h: 0.7 },
        note: 'Área estimada - ajuste manual se necessário'
      },
      {
        id: 'text-1',
        type: 'text',
        label: 'Título (estimado)',
        confidence: 'medium',
        bbox: { x: 0.52, y: 0.15, w: 0.42, h: 0.12 },
        text: 'Título da Arte',
        fontGuess: 'Montserrat',
        color: '#ffffff',
        fontSizeEstimate: 42
      },
      {
        id: 'text-2',
        type: 'text',
        label: 'Subtítulo / legenda',
        confidence: 'low',
        bbox: { x: 0.52, y: 0.3, w: 0.4, h: 0.08 },
        text: 'Texto secundário',
        fontGuess: 'Inter',
        color: '#cccccc',
        fontSizeEstimate: 22
      },
      {
        id: 'logo-1',
        type: 'logo',
        label: 'Possível logotipo',
        confidence: 'low',
        bbox: { x: 0.75, y: 0.8, w: 0.18, h: 0.12 },
        note: 'Baixa confiança - confirme ou redesenhe'
      }
    ],
    simulated: true,
    provider: 'simulated'
  };
}

// Exporta para o app
window.OCRService = {
  analyzeImage,
  getSimulatedAnalysis,
  getSettings,
  saveSettings,
  clearSettings
};
