const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Get execution details with step_executions
router.get('/:executionId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { executionId } = req.params;
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

    const { data: execution, error } = await supabase
      .from('workflow_executions')
      .select(`*, step_executions(*)`)
      .eq('id', executionId)
      .single();

    if (error || !execution) return res.status(404).json({ error: 'Execution not found' });
    if (execution.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    return res.json({ execution });
  } catch (e) {
    console.error('[ExecutionRoutes] Get details error:', e);
    return res.status(500).json({ error: 'Failed to fetch execution' });
  }
});

// Get execution step logs
router.get('/:executionId/steps', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { executionId } = req.params;
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

    // Verify ownership via execution
    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .select('id,user_id')
      .eq('id', executionId)
      .single();
    if (execError || !execution) return res.status(404).json({ error: 'Execution not found' });
    if (execution.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    const { data: steps, error } = await supabase
      .from('step_executions')
      .select(`*`)
      .eq('workflow_execution_id', executionId)
      .order('execution_order', { ascending: true });
    if (error) throw error;

    return res.json({ steps: steps || [] });
  } catch (e) {
    console.error('[ExecutionRoutes] Get steps error:', e);
    return res.status(500).json({ error: 'Failed to fetch steps' });
  }
});

// Cancel a running execution
router.post('/:executionId/cancel', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { executionId } = req.params;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    // Verify execution exists and belongs to user
    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .select('id, user_id, status')
      .eq('id', executionId)
      .single();

    if (execError || !execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    if (execution.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (execution.status !== 'running') {
      return res.status(400).json({ error: `Cannot cancel execution in status: ${execution.status}` });
    }

    // Mark as cancelled
    const { error: updateError } = await supabase
      .from('workflow_executions')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Execution cancelled by user'
      })
      .eq('id', executionId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[ExecutionRoutes] Cancel error:', error);
    return res.status(500).json({ error: 'Failed to cancel execution' });
  }
});

module.exports = router;
