// Simple backend server using only built-in Node.js modules
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3030;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS requests
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Set content type to JSON
  res.setHeader('Content-Type', 'application/json');

  // Route handlers
  if (path === '/api/health' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'ok', 
      message: 'Backend server is running',
      timestamp: new Date().toISOString()
    }));
  }
  else if (path === '/api/social-proof-metrics' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      metrics: {
        totalUsers: 1250,
        activeToday: 68,
        conversions: 32,
        conversionRate: '2.6%',
        lastUpdated: new Date().toISOString()
      },
      success: true
    }));
  }
  else if (path === '/api/track-event' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log('Track event received:', body);
      res.writeHead(200);
      res.end(JSON.stringify({ 
        success: true, 
        eventId: 'evt_' + Date.now(),
        message: 'Event tracked successfully'
      }));
    });
  }
  else if (path === '/api/trigger-campaign' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log('Campaign trigger received:', body);
      res.writeHead(200);
      res.end(JSON.stringify({ 
        success: true, 
        campaignId: 'camp_' + Date.now(),
        status: 'triggered',
        message: 'Campaign triggered successfully'
      }));
    });
  }
  else if (path === '/api/user/plan' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      plan: 'free',
      features: ['basic-automation', 'limited-workflows', 'social-proof'],
      limits: {
        workflows: 10,
        monthly_executions: 100,
        storage_mb: 50
      },
      usage: {
        workflows: 3,
        monthly_executions: 15,
        storage_mb: 12
      },
      upgrade_url: '/upgrade'
    }));
  }
  else {
    // 404 for unknown routes
    res.writeHead(404);
    res.end(JSON.stringify({ 
      error: 'Not Found',
      message: `Route ${method} ${path} not found`,
      availableRoutes: [
        'GET /api/health',
        'GET /api/social-proof-metrics',
        'POST /api/track-event',
        'POST /api/trigger-campaign',
        'GET /api/user/plan'
      ]
    }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Simple backend server running on http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Social proof: http://localhost:${PORT}/api/social-proof-metrics`);
  console.log(`👤 User plan: http://localhost:${PORT}/api/user/plan`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
});