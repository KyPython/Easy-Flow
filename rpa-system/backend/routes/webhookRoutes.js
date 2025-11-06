const express = require('express');
const { TriggerService } = require('../services/triggerService');

// ✅ INSTRUCTION 2: Import OpenTelemetry for root span generation
const { trace, context, propagation, SpanStatusCode } = require('@opentelemetry/api');

const router = express.Router();
const triggerService = new TriggerService();

// Get tracer for webhook operations
const tracer = trace.getTracer('webhook-handler');

// Webhook trigger endpoint - no auth required for external webhooks
router.post('/trigger/:token', async (req, res) => {
  const startTime = Date.now();
  const { token } = req.params;
  const payload = req.body;
  const headers = req.headers;

  // ✅ INSTRUCTION 2: Check for incoming trace headers and extract or create new root span
  let extractedContext = context.active();
  let isExternalTrace = false;
  
  // Try to extract existing trace context from headers
  const carrier = {};
  if (headers.traceparent) carrier.traceparent = headers.traceparent;
  if (headers.tracestate) carrier.tracestate = headers.tracestate;
  if (headers['x-trace-id']) carrier.traceid = headers['x-trace-id'];
  
  if (Object.keys(carrier).length > 0) {
    try {
      extractedContext = propagation.extract(context.active(), carrier);
      isExternalTrace = true;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[WebhookRoutes] Extracted trace context from webhook: ${carrier.traceparent || carrier.traceid}`);
      }
    } catch (err) {
      console.warn(`[WebhookRoutes] Failed to extract trace context:`, err.message);
    }
  }

  // ✅ INSTRUCTION 2: Create root span for webhook processing
  return await context.with(extractedContext, async () => {
    return await tracer.startActiveSpan(
      'webhook.trigger',
      {
        kind: 1, // SpanKind.SERVER
        attributes: {
          'http.method': 'POST',
          'http.route': '/api/webhooks/trigger/:token',
          'webhook.token_length': token?.length || 0,
          'webhook.has_payload': !!payload,
          'webhook.payload_size': JSON.stringify(payload || {}).length,
          'webhook.external_trace': isExternalTrace
        }
      },
      async (span) => {
        try {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[WebhookRoutes] Webhook trigger received: ${token} (trace_id: ${span.spanContext().traceId})`);
          }

          // Validate token format
          if (!token || token.length !== 64) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Invalid token format' });
            span.setAttribute('error', true);
            span.setAttribute('error.type', 'INVALID_TOKEN');
            
            res.status(400).json({
              error: 'Invalid webhook token format',
              code: 'INVALID_TOKEN'
            });
            span.end();
            return;
          }

          // Execute webhook trigger (this will inherit the current span as parent)
          const result = await triggerService.executeWebhookTrigger(token, payload, headers);
          
          const duration = Date.now() - startTime;
          
          // Add result attributes to span
          span.setAttribute('webhook.execution_id', result.executionId);
          span.setAttribute('webhook.workflow_name', result.workflowName);
          span.setAttribute('webhook.duration_ms', duration);
          span.setStatus({ code: SpanStatusCode.OK });
          
          // ✅ INSTRUCTION 2: Include trace ID in response headers
          res.set('X-Trace-ID', span.spanContext().traceId);
          res.set('X-Span-ID', span.spanContext().spanId);
          
          res.status(200).json({
            success: true,
            execution_id: result.executionId,
            workflow_name: result.workflowName,
            duration_ms: duration,
            timestamp: new Date().toISOString(),
            trace_id: span.spanContext().traceId
          });

        } catch (error) {
          const duration = Date.now() - startTime;
          
          // Record exception in span
          span.recordException(error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          span.setAttribute('error', true);
          span.setAttribute('error.type', error.constructor.name);
          span.setAttribute('webhook.duration_ms', duration);
          
          console.error(`[WebhookRoutes] Webhook execution failed:`, error);
          
          // Don't expose internal errors to external callers
          const isInternalError = error.message.includes('Database') || error.message.includes('Internal');
          const errorMessage = isInternalError ? 'Webhook execution failed' : error.message;
          
          // ✅ INSTRUCTION 2: Include trace ID in error response
          res.set('X-Trace-ID', span.spanContext().traceId);
          res.set('X-Span-ID', span.spanContext().spanId);
          
          res.status(400).json({
            success: false,
            error: errorMessage,
            duration_ms: duration,
            timestamp: new Date().toISOString(),
            trace_id: span.spanContext().traceId
          });
        } finally {
          span.end();
        }
      }
    );
  });
});

// Get webhook trigger URL for a schedule (authenticated)
const requireFeature = require('../middleware/planEnforcement');

router.get('/schedule/:scheduleId/webhook', requireFeature('webhooks'), async (req, res) => {
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
router.post('/test/:token', requireFeature('webhooks'), async (req, res) => {
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