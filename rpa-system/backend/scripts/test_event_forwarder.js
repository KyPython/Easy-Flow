
const { logger, getLogger } = require('../utils/logger');
const { enqueueEvent, __internal } = require('../event_forwarder');
async function run() {
  enqueueEvent({ id: 'test-1', url: 'https://httpbin.org/post', method: 'post', body: { hello: 'world' } });
  // wait a bit for flush interval, then call internal flush to force send
  await new Promise(r => setTimeout(r, 500));
  if (typeof __internal.flush === 'function') await __internal.flush();
  logger.info('flushed queue length:', __internal.queue.length);
}
run().catch(e=>logger.error(e));
