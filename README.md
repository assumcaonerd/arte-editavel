# Arte Editável

Protótipo de aplicativo web para reconstrução e edição de artes gráficas a partir de imagens (PNG, JPG, WEBP).

Transforma uma arte pronta em um projeto editável com camadas independentes, textos reais e comandos em português.

## Como usar (usuário final)

1. Abra o aplicativo
2. Clique em **Config** (canto superior)
3. Escolha o provedor de OCR:
   - **Simulado** → funciona sem chave (modo de demonstração)
   - **Gemini** → cole sua chave do Google AI Studio
   - **OpenAI** → cole sua chave da OpenAI
   - **Claude** → cole sua chave da Anthropic
4. Salve
5. Envie uma arte e clique em **Transformar em arte editável**

A chave fica salva **somente no seu navegador**. Ela nunca é enviada para nossos servidores.

### Onde conseguir as chaves

- **Gemini**: [aistudio.google.com](https://aistudio.google.com) → Get API key
- **OpenAI**: [platform.openai.com](https://platform.openai.com) → API keys
- **Claude**: [console.anthropic.com](https://console.anthropic.com) → API keys

## Como rodar localmente

```bash
npx serve .
# ou
python -m http.server 8080
```

Abra o endereço que aparecer no navegador.

## Estrutura

```
arte-editavel/
├── index.html          # Interface + modal de configurações
├── app.js              # Editor (Fabric.js)
├── ocrService.js       # Lógica de OCR multi-provedor (BYOK)
├── api/
│   └── analyze.js      # Endpoint serverless (opcional, para uso futuro)
└── README.md
```

## Modelo de chave (BYOK)

O aplicativo usa o modelo **Bring Your Own Key**:

- Cada usuário escolhe o provedor e usa a própria chave
- Você (dono do app) não paga a conta de OCR de ninguém
- Fácil de escalar para milhares de usuários
- O usuário controla o custo e a privacidade

## Tecnologias

- Fabric.js (editor de canvas)
- Tailwind CSS
- Gemini / OpenAI / Claude (via chave do usuário)
- Análise simulada como fallback

## Próximos passos possíveis

- Adicionar PaddleOCR-VL como opção local/self-hosted
- Melhorar detecção de fontes e inpainting de fundo
- Exportação PPTX mais completa
- Histórico de projetos na nuvem (opcional)

---

Feito para produção de conteúdo político e gráfico.
