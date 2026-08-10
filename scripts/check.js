const fs = require('fs');
const vm = require('vm');

const required = ['index.html', 'app.js', 'ocrService.js', 'layerService.js', 'server.js'];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Arquivo obrigatório ausente: ${file}`);
}

const html = fs.readFileSync('index.html', 'utf8');
for (const script of ['ocrService.js', 'layerService.js', 'app.js']) {
  if (!html.includes(`src="${script}"`)) throw new Error(`Script não carregado no HTML: ${script}`);
}

for (const file of ['app.js', 'ocrService.js', 'layerService.js', 'server.js']) {
  new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
}

console.log('Verificação concluída: arquivos, referências e sintaxe estão válidos.');
