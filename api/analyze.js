/**
 * Endpoint seguro de análise de imagem (Vercel Serverless Function)
 * 
 * A chave do Gemini fica APENAS aqui, como variável de ambiente.
 * Nunca no frontend.
 * 
 * Configure no Vercel:
 *   GEMINI_API_KEY = sua_chave_aqui
 */

export default async function handler(req, res) {
  // Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Chave da API não configurada no servidor',
      hint: 'Configure a variável de ambiente GEMINI_API_KEY'
    });
  }

  try {
    const { image, mimeType = 'image/jpeg' } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Imagem não enviada' });
    }

    // Prompt estruturado para artes gráficas
    const prompt = `Você é um especialista em análise de artes gráficas (posts, flyers, banners políticos e de redes sociais).

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

Regras importantes:
- bbox usa valores normalizados de 0 a 1 (proporção da imagem)
- type pode ser: text, photo, logo, background, shape, object
- confidence: "high", "medium" ou "low"
- Para textos, extraia o texto o mais fiel possível
- Identifique títulos, subtítulos e legendas
- Se não tiver certeza de um elemento, use confidence "low"
- Retorne somente o JSON, nada mais`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: image.replace(/^data:image\/\w+;base64,/, '')
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erro Gemini:', errText);
      return res.status(502).json({ 
        error: 'Falha na análise da imagem',
        details: errText.slice(0, 300)
      });
    }

    const data = await response.json();
    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Tenta extrair o JSON da resposta
    let parsed;
    try {
      // Remove possíveis ```json ... ```
      const cleaned = textResponse.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Resposta não é JSON válido:', textResponse);
      return res.status(502).json({ 
        error: 'O modelo não retornou JSON válido',
        raw: textResponse.slice(0, 500)
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Erro no endpoint:', err);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
