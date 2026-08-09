# Arquitetura (baseada nos repos que funcionam)

## Referencias que deram certo

1. **Photext** (popdeuxrem/Photext)
   - Tesseract.js (bbox em pixels) → Fabric.js Textbox
   - Cloudflare inpaint para apagar texto original
   - Fluxo: Upload → Preprocess → OCR → Canvas

2. **OCR-Arcade** (winterdrive/OCR-Arcade)
   - OCR + Fabric → camadas editaveis → export PPTX

3. **Edit Anything** / **NoNo-Banana-Text**
   - Paralelo: OCR + remocao de texto
   - Fundo limpo + textos reposicionados

## Nosso pipeline

```
Upload
  → LayerService.reconstruct()
      → Tesseract.js (bboxes precisos) OU Groq vision
      → (opcional) Ideogram Layerize / fal inpaint → fundo limpo
  → Fabric.js
      → Imagem de fundo
      → Capa preta sob cada texto (esconde original)
      → Textbox/IText editavel na posicao do bbox
  → Export PNG
```

## O que copiamos

| Idea | De | Status |
|------|-----|--------|
| Tesseract bbox pixel | Photext | Implementado |
| Capa sob texto | Photext cover | Implementado |
| Fabric camadas | OCR-Arcade | Implementado |
| Fundo limpo API | Ideogram/fal | Pronto (precisa chave) |
