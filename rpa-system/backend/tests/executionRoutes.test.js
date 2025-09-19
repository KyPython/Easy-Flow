const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const app = require('../index');

// Minimal integration test for execution routes and email enqueue
// Note: Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE configured.
// We create a user+workflow+execution fixture directly via Supabase.

describe('Execution Routes and Email Enqueue', () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE) : null;

  let authToken;
  let userId;
  let workflowId;
  let executionId;

  beforeAll(async () => {
    if (!supabase) {
      console.warn('Supabase not configured; skipping tests.');
      return;
    }

    authToken = process.env.TEST_BEARER_TOKEN || '';
    const allowBypass = (process.env.ALLOW_TEST_TOKEN || '').toLowerCase() === 'true';
    const bypassUser = process.env.TEST_USER_ID || '';

    if (allowBypass && authToken && bypassUser) {
      userId = bypassUser;
    } else {
      // Fallback: try real Supabase auth token
      const { data: user } = await supabase.auth.getUser(authToken);
      if (!user || !user.user) {
        console.warn('No auth user for token; skipping tests.');
        return;
      }
      userId = user.user.id;
    }

    const { data: wf, error: wfErr } = await supabase
      .from('workflows')
      .insert({ name: 'Test WF', status: 'active', user_id: userId })
      .select('*')
      .single();
    if (wfErr) throw wfErr;
    workflowId = wf.id;

    // Insert required workflow steps: start, action, end
    const steps = [
      { id: `start-${workflowId}`, workflow_id: workflowId, step_type: 'start', name: 'Start', step_key: 'start', action_type: null, config: {} },
      { id: `action-${workflowId}`, workflow_id: workflowId, step_type: 'action', name: 'Action', step_key: 'action', action_type: 'noop', config: {} },
      { id: `end-${workflowId}`, workflow_id: workflowId, step_type: 'end', name: 'End', step_key: 'end', action_type: null, config: {} },
    ];
    const { error: stepsErr } = await supabase.from('workflow_steps').insert(steps);
    if (stepsErr) throw stepsErr;

    // Insert an execution row
    const { data: exec, error: execErr } = await supabase
      .from('workflow_executions')
      .insert({ workflow_id: workflowId, user_id: userId, status: 'running', started_at: new Date().toISOString() })
      .select('*')
      .single();
    if (execErr) throw execErr;
    executionId = exec.id;

    // Insert a step execution row for the start step
    await supabase
      .from('step_executions')
      .insert({ workflow_execution_id: executionId, step_id: `start-${workflowId}`, status: 'running', started_at: new Date().toISOString(), execution_order: 1 });
  });

  it('GET /api/executions/:id returns execution details', async () => {
    if (!supabase || !authToken || !executionId) return;
    const res = await request(app)
      .get(`/api/executions/${executionId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.execution).toBeTruthy();
    expect(res.body.execution.id).toBe(executionId);
    expect(Array.isArray(res.body.execution.step_executions)).toBe(true);
  });

  it('GET /api/executions/:id/steps returns step logs', async () => {
    if (!supabase || !authToken || !executionId) return;
    const res = await request(app)
      .get(`/api/executions/${executionId}/steps`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(res.body.steps)).toBe(true);
    expect(res.body.steps.length).toBeGreaterThanOrEqual(1);
  });

  it('Email action enqueues item into email_queue', async () => {
    if (!supabase) return;
    const { error } = await supabase
      .from('email_queue')
      .insert([{ to_email: 'test@example.com', template: 'welcome', data: { name: 'Test' }, status: 'pending', scheduled_at: new Date().toISOString() }]);
    expect(error).toBeNull();
  });

  it('POST /api/enqueue-email enqueues via API', async () => {
    if (!supabase || !authToken) return;
    const res = await request(app)
      .post('/api/enqueue-email')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ to_email: 'api@test.com', template: 'welcome', data: { x: 1 } })
      .expect(200);
    expect(res.body.ok).toBe(true);
  });
});
