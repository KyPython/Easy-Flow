// ...existing code...
const axios = require('axios');

const BATCH_SIZE = Number(process.env.FORWARD_BATCH_SIZE || 10);
const FLUSH_MS = Number(process.env.FORWARD_FLUSH_MS || 1000);
const CONCURRENCY = Number(process.env.FORWARD_CONCURRENCY || 4);
const MAX_RETRIES = Number(process.env.FORWARD_MAX_RETRIES || 5);
const RETRY_BASE_MS = Number(process.env.FORWARD_RETRY_BASE_MS || 500);

const queue = [];
let inFlight = 0;
const recentIds = new Map();
const ID_TTL_MS = Number(process.env.FORWARD_ID_TTL_MS || 1000 * 60 * 60);

function now() { return Date.now(); }
let flushTimer = null;
function scheduleFlush() { if (flushTimer) return; flushTimer = setInterval(flush, FLUSH_MS); }
function cleanupIds() { const t = now(); for (const [k, exp] of recentIds.entries()) if (exp <= t) recentIds.delete(k); }
setInterval(cleanupIds, Math.max(1000, ID_TTL_MS / 4));

function backoffMs(attempt) { return Math.round(RETRY_BASE_MS * Math.pow(2, attempt)); }

async function processItem(item) {
  if (inFlight >= CONCURRENCY) { queue.unshift(item); return; }
  inFlight++;
  try {
    const res = await axios({ method: item.method || 'post', url: item.url, data: item.body, headers: Object.assign({}, item.headers || {}) });
    if (item.id) recentIds.set(item.id, now() + ID_TTL_MS);
    return res;
  } catch (err) {
    const status = err?.response?.status;
    const isRetryable = !status || (status >= 500 && status < 600);
    item.attempt = (item.attempt || 0) + 1;
    if (isRetryable && item.attempt <= MAX_RETRIES) {
      const wait = backoffMs(item.attempt);
      setTimeout(() => queue.push(item), wait);
    } else {
      console.error('[event_forwarder] final failure for', item.url, item.id || '', err?.message || err);
    }
  } finally { inFlight--; }
}

async function flush() {
  if (!queue.length) return;
  const batch = queue.splice(0, BATCH_SIZE);
  await Promise.all(batch.map(processItem));
}

function enqueueEvent({ id, url, body, headers, method }) {
  if (id && recentIds.has(id)) return false;
  queue.push({ id, url, body, headers, method, attempt: 0 });
  if (!flushTimer) scheduleFlush();
  if (queue.length >= BATCH_SIZE) flush();
  return true;
}

module.exports = { enqueueEvent, __internal: { queue, flush } };
// ...existing code...