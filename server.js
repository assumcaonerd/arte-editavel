const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT) || 3000;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

async function proxyIdeogram(req, res) {
  const apiKey = req.headers['api-key'];
  if (!apiKey) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Chave da Ideogram não informada' }));
    return;
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 25 * 1024 * 1024) {
      res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Imagem maior que 25 MB' }));
      return;
    }
    chunks.push(chunk);
  }

  try {
    const upstream = await fetch('https://api.ideogram.ai/v1/ideogram-v3/layerize-text', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': req.headers['content-type'] || 'application/octet-stream'
      },
      body: Buffer.concat(chunks)
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(body);
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Falha ao acessar a Ideogram', details: error.message }));
  }
}

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/ideogram/layerize') {
    await proxyIdeogram(req, res);
    return;
  }

  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);

  if (!file.startsWith(root + path.sep) || file.includes(`${path.sep}.git${path.sep}`)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(file, (statError, stat) => {
    if (statError || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`Arte Editável disponível em http://localhost:${port}`);
});
