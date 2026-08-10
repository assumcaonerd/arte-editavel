/**
 * Servico de OCR - BYOK multi-provedor
 * Chave fica so no localStorage do usuario.
 */

var STORAGE_KEY = 'arte-editavel-ocr-settings';
var DEFAULT_SETTINGS = { provider: 'local', apiKey: '' };

function getSettings() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
    return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
  } catch (e) {
    return Object.assign({}, DEFAULT_SETTINGS);
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function clearSettings() {
  localStorage.removeItem(STORAGE_KEY);
}

async function analyzeImage(imageDataUrl) {
  var settings = getSettings();
  var provider = settings.provider || 'local';
  var apiKey = (settings.apiKey || '').trim();

  if (provider === 'local' || provider === 'simulated') {
    return await callLocalOCR(imageDataUrl);
  }

  if (!apiKey) {
    throw new Error('Informe a chave do provedor ou selecione o OCR local.');
  }

  var match = imageDataUrl.match(/^data:(image\/\w+);base64,/);
  var mimeType = match ? match[1] : 'image/jpeg';
  var base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');

  try {
    if (provider === 'gemini') return await callGemini(base64Data, mimeType, apiKey);
    if (provider === 'groq') return await callGroq(base64Data, mimeType, apiKey);
    if (provider === 'openai') return await callOpenAI(base64Data, mimeType, apiKey);
    if (provider === 'claude') return await callClaude(base64Data, mimeType, apiKey);
    return getSimulatedAnalysis();
  } catch (err) {
    console.warn('[OCR] Erro:', provider, err.message);
    var fallback = getSimulatedAnalysis();
    fallback.error = err.message;
    fallback.providerAttempted = provider;
    return fallback;
  }
}

async function callLocalOCR(imageDataUrl) {
  if (!window.Tesseract) throw new Error('OCR local não carregado. Verifique sua conexão e recarregue a página.');
  var result = await window.Tesseract.recognize(imageDataUrl, 'por+eng');
  var data = result.data || {};
  var width = 1;
  var height = 1;
  if (data.words && data.words.length) {
    data.words.forEach(function (word) {
      if (word.bbox) {
        width = Math.max(width, word.bbox.x1 || 0);
        height = Math.max(height, word.bbox.y1 || 0);
      }
    });
  }
  var lines = (data.lines || []).filter(function (line) {
    return line.text && line.text.trim().length > 1 && (line.confidence == null || line.confidence >= 25);
  });
  var elements = lines.map(function (line, i) {
    var box = line.bbox || { x0: 0, y0: 0, x1: width, y1: Math.max(20, height * 0.08) };
    return {
      id: 'text-' + (i + 1),
      type: 'text',
      label: i === 0 ? 'Título' : 'Texto ' + (i + 1),
      text: line.text.trim(),
      bbox: {
        x: box.x0 / width,
        y: box.y0 / height,
        w: Math.max(0.02, (box.x1 - box.x0) / width),
        h: Math.max(0.02, (box.y1 - box.y0) / height)
      },
      confidence: line.confidence >= 75 ? 'high' : line.confidence >= 50 ? 'medium' : 'low',
      color: '#ffffff',
      fontGuess: i === 0 ? 'Impact' : 'Arial'
    };
  });
  return { elements: elements, provider: 'OCR local', simulated: false, raw: data.text || '' };
}

async function callGroq(base64Data, mimeType, apiKey) {
  var prompt = 'List ALL visible text in this graphic design / meme / news image, one per line.\nFocus on titles, handles, captions, headlines.\nExample:\nBABAQUICE\n@username\nSome caption';

  var response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    var errText = await response.text();
    throw new Error('Groq: ' + response.status + ' - ' + errText.slice(0, 250));
  }

  var data = await response.json();
  var text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';

  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

  var lines = text.split('\n').map(function(l) {
    return l.replace(/^[\*\-\d\.\s]+/, '').replace(/\*\*/g, '').replace(/^(TEXT|TEXTO)\s*:\s*/i, '').trim();
  }).filter(function(l) {
    if (l.length < 2 || l.length > 120) return false;
    if (/^(the |a group|four men|main photo|image shows|photo:|foto:)/i.test(l)) return false;
    return true;
  });

  var seen = {};
  var unique = [];
  lines.forEach(function(l) {
    var key = l.toUpperCase();
    if (!seen[key]) { seen[key] = true; unique.push(l); }
  });

  var elements = [
    { id: 'bg-1', type: 'background', label: 'Fundo', confidence: 'high', bbox: { x: 0, y: 0, w: 1, h: 1 } },
    { id: 'photo-1', type: 'photo', label: 'Fotografia principal', confidence: 'medium', bbox: { x: 0.05, y: 0.15, w: 0.9, h: 0.5 } }
  ];

  unique.slice(0, 8).forEach(function(line, i) {
    elements.push({
      id: 'text-' + (i + 1),
      type: 'text',
      label: i === 0 ? 'Titulo' : 'Texto ' + (i + 1),
      text: line,
      bbox: { x: 0.08, y: 0.04 + i * 0.1, w: 0.84, h: 0.09 },
      confidence: 'medium',
      color: '#ffffff',
      fontGuess: i === 0 ? 'Impact' : 'Arial Black'
    });
  });

  return { elements: elements, provider: 'groq', simulated: false, raw: text };
}

async function callGemini(base64Data, mimeType, apiKey) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;
  var response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: 'List ALL visible text in this image, one per line. Be concise.' },
        { inline_data: { mime_type: mimeType, data: base64Data } }
      ]}],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
    })
  });
  if (!response.ok) {
    var errText = await response.text();
    throw new Error('Gemini: ' + response.status + ' - ' + errText.slice(0, 200));
  }
  var data = await response.json();
  var text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || '';
  return parseTextToElements(text, 'gemini');
}

async function callOpenAI(base64Data, mimeType, apiKey) {
  var response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'List ALL visible text in this image, one per line.' },
        { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64Data, detail: 'high' } }
      ]}],
      max_tokens: 2048, temperature: 0.1
    })
  });
  if (!response.ok) {
    var errText = await response.text();
    throw new Error('OpenAI: ' + response.status + ' - ' + errText.slice(0, 200));
  }
  var data = await response.json();
  var text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  return parseTextToElements(text, 'openai');
}

async function callClaude(base64Data, mimeType, apiKey) {
  var response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048, temperature: 0.1,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
        { type: 'text', text: 'List ALL visible text in this image, one per line.' }
      ]}]
    })
  });
  if (!response.ok) {
    var errText = await response.text();
    throw new Error('Claude: ' + response.status + ' - ' + errText.slice(0, 200));
  }
  var data = await response.json();
  var text = (data.content && data.content[0] && data.content[0].text) || '';
  return parseTextToElements(text, 'claude');
}

function parseTextToElements(text, provider) {
  text = (text || '').replace(/```json|```/g, '').trim();
  var lines = text.split('\n').map(function(l) {
    return l.replace(/^[\*\-\d\.\s]+/, '').replace(/\*\*/g, '').trim();
  }).filter(function(l) { return l.length > 2 && l.length < 100; });

  var elements = [
    { id: 'bg-1', type: 'background', label: 'Fundo', confidence: 'high', bbox: { x: 0, y: 0, w: 1, h: 1 } },
    { id: 'photo-1', type: 'photo', label: 'Fotografia principal', confidence: 'medium', bbox: { x: 0.05, y: 0.15, w: 0.9, h: 0.5 } }
  ];

  lines.slice(0, 8).forEach(function(line, i) {
    elements.push({
      id: 'text-' + (i + 1),
      type: 'text',
      label: i === 0 ? 'Titulo' : 'Texto ' + (i + 1),
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
    elements: [],
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
