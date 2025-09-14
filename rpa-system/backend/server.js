// Minimal HTTP server bootstrap for production
const app = require('./app');

const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`[server] EasyFlow backend listening on http://${HOST}:${PORT}`);
});
