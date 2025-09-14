const express = require('express');
const { TriggerService } = require('../services/triggerService');

const router = express.Router();
const triggerService = new TriggerService();

// Webhook trigger endpoint - no auth required for external webhooks
router.post('/trigger/:token', async (req, res) => {
  const startTime = Date.now();
  const { token } = req.params;
  const payload = req.body;
  const headers = req.headers;

  console.log(`[WebhookRoutes] Webhook trigger received: ${token}`);

  try {
    // Validate token format
    if (!token || token.length !== 64) {
      return res.status(400).json({
        error: 'Invalid webhook token format',
        code: 'INVALID_TOKEN'
      });
    }

    // Execute webhook trigger
    const result = await triggerService.executeWebhookTrigger(token, payload, headers);
    
    const duration = Date.now() - startTime;
    
    res.status(200).json({
      success: true,
      execution_id: result.executionId,
      workflow_name: result.workflowName,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[WebhookRoutes] Webhook execution failed:`, error);
    
    // Don't expose internal errors to external callers
    const isInternalError = error.message.includes('Database') || error.message.includes('Internal');
    const errorMessage = isInternalError ? 'Webhook execution failed' : error.message;
    
    res.status(400).json({
      success: false,
      error: errorMessage,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });
  }
});

// Get webhook trigger URL for a schedule (authenticated)
router.get('/schedule/:scheduleId/webhook', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get schedule details
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
    );

    const { data: schedule, error } = await supabase
      .from('workflow_schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('user_id', userId)
      .eq('schedule_type', 'webhook')
      .single();

    if (error || !schedule) {
      return res.status(404).json({ error: 'Webhook schedule not found' });
    }

    const baseUrl = process.env.WEBHOOK_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${baseUrl}/api/webhooks/trigger/${schedule.webhook_token}`;

    res.json({
      schedule_id: schedule.id,
      webhook_url: webhookUrl,
      webhook_token: schedule.webhook_token,
      has_secret: !!schedule.webhook_secret,
      is_active: schedule.is_active,
      created_at: schedule.created_at
    });

  } catch (error) {
    console.error('[WebhookRoutes] Error getting webhook URL:', error);
    res.status(500).json({ error: 'Failed to get webhook URL' });
  }
});

// Test webhook endpoint (authenticated)
router.post('/test/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const testPayload = req.body || { test: true, timestamp: new Date().toISOString() };
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify user owns this webhook token
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
    );

    const { data: schedule, error } = await supabase
      .from('workflow_schedules')
      .select('user_id')
      .eq('webhook_token', token)
      .single();

    if (error || !schedule || schedule.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized webhook access' });
    }

    // Execute test webhook
    const result = await triggerService.executeWebhookTrigger(token, testPayload, {
      'x-test-webhook': 'true',
      'user-agent': 'EasyFlow-Webhook-Tester/1.0'
    });

    res.json({
      success: true,
      message: 'Test webhook executed successfully',
      execution_id: result.executionId,
      workflow_name: result.workflowName,
      test_payload: testPayload
    });

  } catch (error) {
    console.error('[WebhookRoutes] Test webhook failed:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;