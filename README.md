# Arte Editável

Protótipo funcional de aplicativo web para **reconstrução e edição de artes gráficas** a partir de imagens achatadas (PNG, JPG, WEBP).

O objetivo é transformar uma imagem pronta (flyer, post, banner, etc.) em um projeto editável com camadas independentes, textos reais, fotografias e formas — no espírito do Canva, Adobe Express e Figma.

## Como usar

1. Abra o arquivo `index.html` em um navegador moderno (Chrome, Edge, Firefox).
2. Clique em **Enviar arte**.
3. Selecione uma imagem.
4. Clique em **Transformar em arte editável**.
5. Revise os elementos detectados e abra no editor.
6. Edite, mova, troque textos, adicione fotos, mude fundo, use comandos em português.
7. Exporte em PNG, JPG, WEBP, SVG, JSON ou camadas separadas.

Também funciona servindo a pasta com qualquer servidor estático simples:

```bash
npx serve .
# ou
python -m http.server 8080
```

## O que o protótipo já faz

- Upload de PNG / JPG / JPEG / WEBP
- Fluxo completo de análise com indicador de progresso
- Lista de elementos detectados com grau de confiança (alta / média / baixa)
- Editor visual com **Fabric.js** (camadas reais, arrastar, redimensionar, rotacionar, etc.)
- Textos verdadeiros e editáveis (não rastreados na foto)
- Painel de camadas
- Painel de propriedades (fonte, tamanho, cor, opacidade, posição, rotação…)
- Comandos em linguagem natural em português
- Desfazer / Refazer
- Salvamento local + exportação JSON do projeto
- Exportação PNG / JPG / WEBP (alta resolução)
- Exportação SVG
- Exportação de cada camada em PNG transparente (ZIP)
- Comparação “antes e depois” com slider
- Formatos de prancheta: original, quadrado, story, paisagem, retrato, A4 e personalizado
- Interface em português do Brasil, escura e limpa

## Comandos de linguagem natural (exemplos)

- `Mude o título para Capitão Assumção`
- `Deixe o fundo azul-escuro`
- `Centralize os textos`
- `Transforme em story`
- `Transforme em formato quadrado`
- `Remova o logotipo`
- `Use uma fonte mais forte e moderna`
- `Acrescente um texto`

## Limitação importante (e honesta)

Uma imagem JPG ou PNG é **achatada**. Ela não contém as camadas originais, os textos editáveis nem as fotografias separadas.

Qualquer ferramenta que prometa “desconstruir” uma arte precisa:

1. Estimar onde estão os elementos (visão computacional + OCR)
2. Reconstruir o fundo atrás de textos e objetos (inpainting)
3. Recriar os textos como tipografia real
4. Indicar o grau de confiança de cada detecção

Neste protótipo a etapa de análise é **simulada de forma realista** (com progresso, lista de elementos e confiança). A estrutura do código já está preparada para receber o resultado de um modelo de visão real.

### Como plugar uma IA de verdade

Substitua a função `startAnalysis()` em `app.js` por uma chamada a:

- **GPT-4o / Claude 3.5 / Gemini** (visão multimodal) pedindo bounding boxes + OCR + classificação
- **Google Cloud Vision** + **Document AI** para OCR de alta qualidade
- **Segment Anything (SAM)** ou modelos de segmentação para máscaras de pessoas/objetos
- **Inpainting** (Stable Diffusion, Adobe Firefly, etc.) para reconstruir o fundo

O formato esperado de resposta já está modelado no array `state.detectedElements`.

## Estrutura dos arquivos

```
arte-editavel/
├── index.html      # Interface completa
├── app.js          # Lógica do editor, análise, exportação e comandos
└── README.md       # Este arquivo
```

## Próximos passos recomendados

1. Integrar um modelo de visão real (a parte mais importante para fidelidade).
2. Melhorar o OCR e a sugestão de fontes parecidas (Google Fonts + matching).
3. Implementar exportação PPTX de verdade (com pptxgenjs ou similar) para levar fotos + textos editáveis ao PowerPoint/Canva.
4. Adicionar máscaras, recorte inteligente e remoção de fundo.
5. Histórico de versões mais robusto e sincronização em nuvem.

## Tecnologias

- HTML5 + Tailwind CSS (CDN)
- Fabric.js 5 (canvas orientado a objetos)
- JSZip (exportação de camadas)
- Google Fonts

---

Feito para o fluxo de trabalho de produção de conteúdo político e gráfico.
