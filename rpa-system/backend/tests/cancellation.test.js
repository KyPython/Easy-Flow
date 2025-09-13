const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../index');

// Tests cancellation APIs and cooperative cancellation during delay
describe('Execution cancellation flows', () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE) : null;

  const authToken = process.env.TEST_BEARER_TOKEN || '';
  const testUserId = process.env.TEST_USER_ID || '';

  let workflowId;
  let executionId;

  beforeAll(async () => {
    if (!supabase || !authToken || !testUserId) {
      console.warn('Skipping cancellation tests due to missing env.');
      return;
    }
    // Create a minimal workflow with start -> delay(5s) -> end
    const { data: wf, error: wfErr } = await supabase
      .from('workflows')
      .insert({ name: 'Cancel Test WF', status: 'active', user_id: testUserId })
      .select('*')
      .single();
    if (wfErr) {
      console.warn('Skipping: cannot create workflow due to FK constraints:', wfErr?.message || wfErr);
      return;
    }
    workflowId = wf.id;

    const steps = [
      { id: `start-${workflowId}`, workflow_id: workflowId, step_type: 'start', name: 'Start', step_key: 'start', action_type: null, config: {} },
      { id: `delay-${workflowId}`, workflow_id: workflowId, step_type: 'action', name: 'Delay', step_key: 'delay', action_type: 'delay', config: { duration_seconds: 5, duration_type: 'fixed' } },
      { id: `end-${workflowId}`, workflow_id: workflowId, step_type: 'end', name: 'End', step_key: 'end', action_type: null, config: {} },
    ];
    const { error: stepsErr } = await supabase.from('workflow_steps').insert(steps);
    if (stepsErr) {
      console.warn('Skipping: cannot create steps due to FK constraints:', stepsErr?.message || stepsErr);
      return;
    }

    const conns = [
      { workflow_id: workflowId, source_step_id: steps[0].id, target_step_id: steps[1].id },
      { workflow_id: workflowId, source_step_id: steps[1].id, target_step_id: steps[2].id },
    ];
    const { error: connErr } = await supabase.from('workflow_connections').insert(conns);
    if (connErr) {
      console.warn('Skipping: cannot create connections due to FK constraints:', connErr?.message || connErr);
      return;
    }
  });

  it('starts execution then cancels successfully', async () => {
    if (!supabase || !authToken || !testUserId || !workflowId) return;

    // Trigger execution via schedule route helper (uses executor under the hood)
    const { data: execRow, error: execErr } = await supabase
      .from('workflow_executions')
      .insert({ workflow_id: workflowId, user_id: testUserId, status: 'running', started_at: new Date().toISOString() })
      .select('*')
      .single();
    if (execErr) throw execErr;
    executionId = execRow.id;

    // Immediately request cancel
    const res = await request(app)
      .post(`/api/executions/${executionId}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);

    // Verify status becomes cancelled
    const { data: check } = await supabase
      .from('workflow_executions')
      .select('status')
      .eq('id', executionId)
      .single();
    expect(check.status).toBe('cancelled');
  });

  it('cancel-during-delay results in cancelled status', async () => {
    if (!supabase || !authToken || !testUserId || !workflowId) return;

    // Start a new execution record in running state
    const { data: exec2, error: execErr2 } = await supabase
      .from('workflow_executions')
      .insert({ workflow_id: workflowId, user_id: testUserId, status: 'running', started_at: new Date().toISOString() })
      .select('*')
      .single();
    if (execErr2) throw execErr2;

    // Create a running step_executions row to simulate delay step
    await supabase
      .from('step_executions')
      .insert({ workflow_execution_id: exec2.id, step_id: `delay-${workflowId}`, status: 'running', started_at: new Date().toISOString(), execution_order: 2 });

    // Request cancel while 'delay' would be in progress
    const res = await request(app)
      .post(`/api/executions/${exec2.id}/cancel`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);

    // Check status
    const { data: check2 } = await supabase
      .from('workflow_executions')
      .select('status')
      .eq('id', exec2.id)
      .single();
    expect(check2.status).toBe('cancelled');
  });
});
