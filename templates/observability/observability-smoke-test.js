// Minimal observability smoke test template
// Usage: node observability-smoke-test.js --url=https://your.prod

const axios = require('axios');

async function run() {
  const url = process.env.PRODUCTION_URL || process.argv.find(a=>a.startsWith('--url='))?.split('=')[1];
  if (!url) {
    console.error('Please provide PRODUCTION_URL env or --url param');
    process.exit(2);
  }

  const testRequestId = `smoke_${Date.now()}`;
  console.log('Sending smoke request', testRequestId);
  try {
    await axios.post(`${url}/api/__smoke`, { testRequestId }, { timeout: 5000 });
  } catch (e) {
    console.error('Smoke request failed', e.message);
    process.exit(1);
  }

  console.log('Waiting 10s for telemetry to ingest...');
  await new Promise(r=>setTimeout(r,10000));

  console.log('This template assumes you will query your observability backend for the testRequestId');
  console.log('✔ Replace with New Relic/Datadog/OTel query to confirm ingestion');
}

run().catch(e=>{ console.error(e); process.exit(1); });
