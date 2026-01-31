// Lightweight LangSmith stub: posts trace if LANGSMITH_API_KEY provided
const axios = require('axios');

async function sendTrace(trace) {
  if (!process.env.LANGSMITH_API_KEY || !process.env.LANGSMITH_API_URL) return;
  try {
    await axios.post(process.env.LANGSMITH_API_URL, trace, {
      headers: { Authorization: `Bearer ${process.env.LANGSMITH_API_KEY}` }
    });
  } catch (e) {
    // don't fail the request for trace errors
    console.warn('LangSmith trace failed', e?.message || e);
  }
}

module.exports = { sendTrace };
