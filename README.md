# Arte Editavel

Editor independente estilo Canva que reconstrói artes achatadas (PNG/JPG) em camadas editáveis.

## Pipeline profissional

```
Imagem achatada
  → OCR estruturado (Groq / Gemini / OpenAI / Claude)
  → Remoção de texto + inpainting (fal.ai) OU Ideogram Layerize
  → Fundo limpo + textos IText nativos no Fabric.js
  → Edição tipo Canva + export PNG
```

### Providers (BYOK — chave só no seu navegador)

| Provider | O que faz | Onde pegar chave |
|----------|-----------|------------------|
| **Groq** (grátis) | OCR visão | console.groq.com |
| **Ideogram Layerize** | Fundo sem texto + blocos de texto | ideogram.ai API |
| **fal.ai** | Qwen-Image-Layered + object-removal | fal.ai |
| Gemini / OpenAI / Claude | OCR visão | respectivos consoles |

## Como rodar

```bash
npx serve .
```

Abra **http://localhost:3000** (não abra o HTML direto).

1. Config → escolha provider e cole a chave
2. Enviar arte → Transformar → Ir para o editor
3. Edite textos, mova, exporte PNG

## Arquivos

- `layerService.js` — engine de reconstrução (Ideogram / fal / vision+inpaint)
- `ocrService.js` — OCR multi-provider
- `app.js` — editor Fabric.js estilo Canva
- `index.html` — UI

## Diferencial vs abordagem amadora

- Não só “cola texto por cima”
- Pipeline: detectar → apagar texto da imagem → recriar como camada editável
- Pronto para Ideogram Layerize (o mesmo tipo de tech por trás de tools de layerize de mercado)
- Pronto para Qwen-Image-Layered (decomposição RGBA)
