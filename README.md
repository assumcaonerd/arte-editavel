# Arte Editável

Protótipo de aplicativo web para reconstrução e edição de artes gráficas a partir de imagens (PNG, JPG, WEBP).

O objetivo é transformar uma arte pronta em um projeto editável com camadas independentes, textos reais e comandos em português.

## Como rodar localmente (sem OCR real)

1. Abra a pasta no terminal
2. Rode um servidor estático:
   ```bash
   npx serve .
   # ou
   python -m http.server 8080
   ```
3. Acesse o endereço que aparecer

Neste modo o app usa análise **simulada** (funciona para testar o editor).

## Como ativar o OCR real (Gemini) de forma segura

A chave da API **nunca** fica no frontend nem no GitHub.

### Opção recomendada: Vercel (mais prática)

1. Crie uma conta gratuita em [vercel.com](https://vercel.com)
2. Importe este repositório
3. Em **Settings → Environment Variables**, adicione:
   ```
   GEMINI_API_KEY = sua_chave_do_google_ai_studio
   ```
4. Faça o deploy

O arquivo `api/analyze.js` já está pronto. Ele recebe a imagem, chama o Gemini e devolve o JSON estruturado. A chave fica só no servidor da Vercel.

### Como conseguir a chave do Gemini

1. Acesse [aistudio.google.com](https://aistudio.google.com)
2. Crie uma API Key
3. Cole ela apenas na variável de ambiente da Vercel (nunca no código)

### Testando localmente com a chave

Você pode usar o Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

Ele sobe o frontend + a função `/api/analyze` localmente e carrega a variável de ambiente.

## Estrutura do projeto

```
arte-editavel/
├── index.html          # Interface
├── app.js              # Editor (Fabric.js)
├── ocrService.js       # Abstração do OCR (chama o endpoint seguro)
├── api/
│   └── analyze.js      # Função serverless (Vercel) - aqui fica a chamada ao Gemini
└── README.md
```

## Fluxo de análise

1. Usuário envia a imagem
2. Frontend chama `/api/analyze` (sem enviar chave)
3. O servidor usa a chave e consulta o Gemini
4. Retorna elementos com bounding box, texto, confiança e tipo
5. O editor cria as camadas editáveis
6. Usuário revisa e corrige o que precisar

## Próximos passos planejados

- Migrar o motor principal para PaddleOCR-VL (self-hosted) quando o volume crescer
- Manter Gemini como fallback para casos difíceis
- Melhorar inpainting do fundo e detecção de fontes

## Tecnologias

- Fabric.js (editor de canvas)
- Tailwind CSS
- Gemini 2.0 Flash (OCR via endpoint seguro)
- Vercel Serverless Functions

---

Feito para produção de conteúdo político e gráfico.
