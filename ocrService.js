/**
 * Serviço de OCR - abstração
 * 
 * No frontend ele chama o endpoint seguro /api/analyze
 * A chave da API nunca fica aqui.
 */

const OCR_ENDPOINT = '/api/analyze'; // em produção será a URL do seu backend

/**
 * Analisa uma imagem e retorna elementos estruturados
 * @param {string} imageDataUrl - data URL da imagem (base64)
 * @returns {Promise<{elements: Array}>}
 */
async function analyzeImage(imageDataUrl) {
  // Extrai o mime type
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,/);
  const mimeType = match ? match[1] : 'image/jpeg';
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');

  try {
    const response = await fetch(OCR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Data,
        mimeType
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${response.status}`);
    }

    const result = await response.json();
    return result;

  } catch (err) {
    console.warn('Falha no OCR real, usando análise simulada:', err.message);
    // Fallback para a análise simulada (para desenvolvimento local sem backend)
    return getSimulatedAnalysis();
  }
}

/**
 * Análise simulada (usada quando o endpoint não está disponível)
 * Mantém o protótipo funcionando offline / sem chave
 */
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
    simulated: true
  };
}

// Exporta para uso no app.js
window.OCRService = {
  analyzeImage,
  getSimulatedAnalysis
};
