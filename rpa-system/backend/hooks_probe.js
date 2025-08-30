const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/hooks/email', (req, res) => {
  console.log('[hooks_probe] received POST /hooks/email');
  console.log('headers:', JSON.stringify(req.headers));
  console.log('body:', JSON.stringify(req.body).slice(0, 4000));
  res.json({ ok: true });
});

app.get('/health', (req, res) => res.send('ok'));

const port = process.env.PORT || 4001;
app.listen(port, '0.0.0.0', () => console.log(`hooks_probe listening on ${port}`));
