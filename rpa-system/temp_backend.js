const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  const path = url.parse(req.url, true).pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (path === '/api/social-proof-metrics') {
    res.writeHead(200);
    res.end(JSON.stringify({
      metrics: { totalUsers: 1250, activeToday: 68, conversions: 32, conversionRate: '2.6%', lastUpdated: new Date().toISOString() }
    }));
  } else if (path === '/api/user/plan') {
    res.writeHead(200);
    res.end(JSON.stringify({ plan: 'free', features: ['basic-automation'] }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(3030, () => console.log('Backend running on http://localhost:3030'));
