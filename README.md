# Arte Editavel

Transforma artes chapadas (PNG/JPG) em camadas editaveis estilo Canva.

## Rodar
```bash
npm start
# http://localhost:3000
```

Não há dependências para instalar. É necessário Node.js 18 ou superior e conexão com a internet para carregar Fabric.js, Tailwind e o OCR local.

## Config
- **OCR local** (grátis, sem chave): Tesseract em português e inglês
- **Groq**, Gemini, OpenAI ou Claude: OCR opcional por visão
- **Ideogram Layerize**: fundo limpo + textos
- **fal.ai**: remocao de texto / camadas

As chaves opcionais ficam somente no navegador (BYOK) e são enviadas diretamente ao provedor selecionado.

## Verificar

```bash
npm run check
```

## Limitacao
Imagem chapada nao devolve camadas originais. OCR cria textos editaveis; apagar o texto da foto exige Ideogram ou fal.
