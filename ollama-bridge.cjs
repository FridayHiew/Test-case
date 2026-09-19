#!/usr/bin/env node
/**
 * Zero-dependency Local Ollama CORS & PNA Proxy Bridge
 * 
 * Allows Progressive Web Apps (PWAs) hosted on HTTPS (like GitHub Pages)
 * to smoothly communicate with your local Ollama instance without CORS
 * or Private Network Access (PNA) restrictions.
 * 
 * Usage:
 *   node ollama-bridge.cjs [targetPort=11434] [listenPort=11435]
 * Or:
 *   npm run bridge
 */

const http = require('http');

const TARGET_PORT = parseInt(process.argv[2] || process.env.OLLAMA_PORT || '11434', 10);
const LISTEN_PORT = parseInt(process.argv[3] || process.env.BRIDGE_PORT || '11435', 10);
const TARGET_HOST = '127.0.0.1';

const server = http.createServer((req, res) => {
  // Set full wildcard CORS and Private Network Access headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${TARGET_HOST}:${TARGET_PORT}`
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    headers['access-control-allow-origin'] = '*';
    headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
    headers['access-control-allow-headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin';
    headers['access-control-allow-private-network'] = 'true';

    res.writeHead(proxyRes.statusCode || 200, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      error: `Bridge failed to connect to local Ollama on port ${TARGET_PORT}. Ensure Ollama is running ('ollama serve'). System error: ${err.message}`
    }));
  });

  req.pipe(proxyReq);
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log('===============================================================');
  console.log(`🚀 Ollama CORS & PNA Bridge is active!`);
  console.log(`   Listening at: http://localhost:${LISTEN_PORT}`);
  console.log(`   Proxying to:  http://${TARGET_HOST}:${TARGET_PORT}`);
  console.log(`   Allows HTTPS GitHub Pages & PWAs to call local Ollama safely.`);
  console.log('===============================================================');
});
