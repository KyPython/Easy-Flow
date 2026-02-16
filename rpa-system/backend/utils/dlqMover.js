/**
 * dlqMover - small utility to call the Postgres RPC `resubmit_dead_letters`
 * with simple retry/backoff behavior. Intended for tests and safe scheduled
 * jobs that re-enqueue dead-lettered tasks.
 */
async function resubmitDeadLetters({ supabase, maxAttempts = 5, baseDelayMs = 200 } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    throw new Error('supabase client with rpc() is required');
  }

  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const resp = await supabase.rpc('resubmit_dead_letters');
      // supabase.rpc returns { data, error } in our test stubs
      if (resp && resp.error) {
        throw resp.error;
      }
      return { success: true, attempts: attempt, resp };
    } catch (err) {
      if (attempt >= maxAttempts) {
        return { success: false, attempts: attempt, error: err };
      }
      // exponential backoff with jitter
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 5000);
      await new Promise(r => setTimeout(r, delay + Math.floor(Math.random() * 50)));
    }
  }
}

module.exports = { resubmitDeadLetters };
