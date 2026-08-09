# Arte Editavel

Transforma artes chapadas (PNG/JPG) em camadas editaveis estilo Canva.

## Rodar
```bash
npx serve .
# http://localhost:3000
```

## Config
- **Groq** (gratis): OCR
- **Ideogram Layerize**: fundo limpo + textos
- **fal.ai**: remocao de texto / camadas

Chave fica so no navegador (BYOK).

## Limitacao
Imagem chapada nao devolve camadas originais. OCR cria textos editaveis; apagar o texto da foto exige Ideogram ou fal.
