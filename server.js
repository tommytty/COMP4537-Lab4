const http = require('http');

const server = http.createServer((req, res) => {
  // 1. Set CORS Headers (Pre-emptively allow all or a placeholder)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. Handle Preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 3. Simple Routing Logic
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname.includes('/insert')) {
    // Task: Check/Create table & Insert rows here
  } else if (req.method === 'GET' && url.pathname.includes('/api/v1/sql/')) {
    // Task: Execute SELECT query with restricted user
  }
});

server.listen(8080, () => console.log('Server 2 running on port 8080'));
