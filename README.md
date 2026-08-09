# Arte Editavel

App web para transformar artes (PNG/JPG) em camadas editaveis.

## Como usar (local)

1. Baixe o ZIP deste repositorio
2. Extraia a pasta
3. No terminal, dentro da pasta:

```bash
npx serve .
```

4. Abra **http://localhost:3000** (nao abra o arquivo HTML direto)
5. Clique em **Config**
6. Escolha **Groq (gratis)** e cole sua chave de https://console.groq.com
7. Enviar arte → Transformar em arte editavel

## O que funciona

- Upload de PNG/JPG/WEBP
- Analise com Groq / Gemini / OpenAI / Claude (BYOK)
- Textos detectados viram camadas editaveis
- Editar texto, mover, excluir, exportar PNG

## Chaves de API

A chave fica so no seu navegador (localStorage). Nunca e enviada para o GitHub.

- Groq (recomendado, gratis): https://console.groq.com
- Gemini: https://aistudio.google.com
