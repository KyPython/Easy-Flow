/**
 * Test-only message processor that demonstrates idempotent processing
 * logic used by consumers: check DB state before applying work so that
 * replayed messages are skipped.
 */
async function processMessages(messages = [], { supabase, onProcess } = {}) {
  if (!Array.isArray(messages)) throw new Error('messages must be an array');
  if (!supabase || typeof supabase.from !== 'function') throw new Error('supabase client required');

  const processed = [];

  for (const msg of messages) {
    const runId = msg.run_id || msg.id || msg.runId;
    if (!runId) continue;

    const { data: existingRun, error } = await supabase
      .from('automation_runs')
      .select('id, status')
      .eq('id', runId)
      .single();

    if (error) {
      // Fail-open in real code may process; for tests we surface the error
      throw error;
    }

    // If run exists and is completed/failed, skip (idempotency)
    if (existingRun && existingRun.status && !['running', 'queued'].includes(existingRun.status)) {
      continue;
    }

    // Process the message (simulated by calling onProcess)
    if (typeof onProcess === 'function') {
      await onProcess(msg);
    }

    // Mark as completed in DB (simulated)
    if (supabase) {
      await supabase.from('automation_runs').update({ status: 'completed' }).eq('id', runId);
    }

    processed.push(runId);
  }

  return processed;
}

module.exports = { processMessages };
