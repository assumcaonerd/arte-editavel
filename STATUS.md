# Status — Arte Editável (09/08/2026)

## Funciona
- Upload, editor Fabric, camadas, export PNG
- OCR Groq (textos reais)
- BYOK no localStorage
- Tesseract.js no HTML
- LayerService no código (Ideogram / fal / vision)
- Capa sob textos (código local)

## Não funciona ainda
- Texto original some da imagem sem Ideogram/fal
- Sync total GitHub dos JS mais novos

## Amanhã
1. Sincronizar app.js + ocrService.js + layerService.js + index.html
2. Testar com chave Ideogram ou fal se disponível
3. Capa automática sempre ligada
4. Ajustar posição com Tesseract em textos simples

## Rodar
```
npx serve .
# localhost:3000
```
