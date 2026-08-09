/**
 * Proxy local para Ideogram Layerize (contorna CORS do browser)
 * Uso: node proxy-ideogram.js
 * Porta: 8787
 */
const http = require('http');
const https = require('https');

const PORT = 8787;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Api-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/layerize') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Use POST /layerize' }));
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const apiKey = req.headers['api-key'] || req.headers['x-api-key'] || '';

    if (!apiKey) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Api-Key header obrigatorio' }));
      return;
    }

    const contentType = req.headers['content-type'] || 'application/octet-stream';

    const options = {
      hostname: 'api.ideogram.ai',
      path: '/v1/ideogram-v3/layerize-text',
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': contentType,
        'Content-Length': body.length
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      const out = [];
      proxyRes.on('data', (c) => out.push(c));
      proxyRes.on('end', () => {
        const buf = Buffer.concat(out);
        res.writeHead(proxyRes.statusCode || 500, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(buf);
      });
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
    });

    proxyReq.write(body);
    proxyReq.end();
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log('Proxy Ideogram em http://localhost:' + PORT);
  console.log('POST http://localhost:' + PORT + '/layerize');
});
