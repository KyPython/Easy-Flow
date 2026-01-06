/**
 * Tracking API Routes
 * Centralized tracking endpoints for analytics, feature usage, and business metrics
 */

const express = require('express');
const router = express.Router();
const { getSupabase } = require('../utils/supabaseClient');
const { logger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');
const axios = require('axios');

/**
 * POST /api/tracking/event
 * Track a single event (alternative to /api/track-event for consistency)
 */
router.post('/event', async (req, res) => {
  try {
    const { user_id, event_name, event, properties, utm } = req.body || {};
    const finalEventName = event_name || event;
    
    if (!finalEventName) {
      return res.status(400).json({ error: 'event_name or event is required' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      logger.warn('[tracking/event] Supabase not available');
      return res.status(503).json({ error: 'Database not available' });
    }

    // Insert event into marketing_events
    const insertResult = await supabase.from('marketing_events').insert([{
      user_id: user_id || null,
      event_name: finalEventName,
      properties: properties || {},
      utm: utm || {},
      created_at: new Date().toISOString()
    }]);

    // ✅ OBSERVABILITY: Log all tracked events for diagnostic purposes
    if (insertResult.error) {
      logger.error('[tracking/event] Failed to insert event', {
        event_name: finalEventName,
        user_id: user_id || null,
        error: insertResult.error.message,
        error_code: insertResult.error.code
      });
      return res.status(500).json({ 
        error: 'Failed to track event', 
        details: insertResult.error.message 
      });
    }

    logger.debug('[tracking/event] Event tracked', {
      event_name: finalEventName,
      user_id: user_id || null,
      has_properties: !!properties,
      property_keys: properties ? Object.keys(properties) : []
    });

    // Forward to external analytics asynchronously (non-blocking)
    (async () => {
      try {
        if (process.env.MIXPANEL_TOKEN && process.env.NODE_ENV !== 'test') {
          const mp = {
            event: finalEventName,
            properties: Object.assign({
              token: process.env.MIXPANEL_TOKEN,
              distinct_id: user_id || null,
              time: Math.floor(Date.now() / 1000)
            }, properties || {}, { utm: utm || {} }),
          };
          await axios.post('https://api.mixpanel.com/track', {
            data: Buffer.from(JSON.stringify([mp])).toString('base64')
          }, { timeout: 3000 });
        }
      } catch (e) {
        logger.warn('[tracking/event] External analytics forward failed', e?.message || e);
      }
    })();

    return res.json({ 
      ok: true, 
      event_name: finalEventName,
      tracked_at: new Date().toISOString()
    });
  } catch (e) {
    logger.error('[POST /api/tracking/event] Error:', e?.message || e);
    return res.status(500).json({ error: 'Failed to track event', details: e.message });
  }
});

/**
 * POST /api/tracking/events
 * Track multiple events in a batch
 */
router.post('/events', async (req, res) => {
  try {
    const { events } = req.body || {};
    
    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      logger.warn('[tracking/events] Supabase not available');
      return res.status(503).json({ error: 'Database not available' });
    }

    // Process events in parallel
    const eventPromises = events.map(async (eventData) => {
      const { user_id, event_name, event, properties, utm } = eventData || {};
      const finalEventName = event_name || event;
      
      if (!finalEventName) {
        logger.warn('[tracking/events] Skipping event without event_name:', eventData);
        return null;
      }

      try {
        const insertResult = await supabase.from('marketing_events').insert([{
          user_id: user_id || null,
          event_name: finalEventName,
          properties: properties || {},
          utm: utm || {},
          created_at: new Date().toISOString()
        }]);

        if (insertResult.error) {
          logger.error('[tracking/events] Failed to insert event', {
            event_name: finalEventName,
            error: insertResult.error.message
          });
        }

        return { success: true, event_name: finalEventName };
      } catch (error) {
        logger.error('[tracking/events] Event processing error', {
          event_name: finalEventName,
          error: error.message
        });
        return { success: false, event_name: finalEventName, error: error.message };
      }
    });

    const results = await Promise.all(eventPromises);
    const successful = results.filter(r => r && r.success).length;
    const failed = results.length - successful;

    logger.info('[tracking/events] Batch tracking completed', {
      total: events.length,
      successful,
      failed
    });

    return res.json({
      ok: true,
      total: events.length,
      successful,
      failed,
      results: results.filter(r => r !== null)
    });
  } catch (e) {
    logger.error('[POST /api/tracking/events] Error:', e?.message || e);
    return res.status(500).json({ error: 'Failed to track events', details: e.message });
  }
});

/**
 * POST /api/tracking/feature
 * Convenience endpoint specifically for feature usage tracking
 */
router.post('/feature', authMiddleware, async (req, res) => {
  try {
    const { feature, action, ...additionalProps } = req.body || {};
    
    if (!feature) {
      return res.status(400).json({ error: 'feature name is required' });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const eventData = {
      user_id: req.user?.id || null,
      event_name: 'feature_used',
      properties: {
        feature,
        action: action || 'used',
        timestamp: new Date().toISOString(),
        ...additionalProps
      },
      created_at: new Date().toISOString()
    };

    const insertResult = await supabase.from('marketing_events').insert([eventData]);

    if (insertResult.error) {
      logger.error('[tracking/feature] Failed to track feature usage', {
        feature,
        user_id: req.user?.id,
        error: insertResult.error.message
      });
      return res.status(500).json({ 
        error: 'Failed to track feature usage', 
        details: insertResult.error.message 
      });
    }

    logger.debug('[tracking/feature] Feature usage tracked', {
      feature,
      action: action || 'used',
      user_id: req.user?.id
    });

    return res.json({ 
      ok: true, 
      feature,
      tracked_at: new Date().toISOString()
    });
  } catch (e) {
    logger.error('[POST /api/tracking/feature] Error:', e?.message || e);
    return res.status(500).json({ error: 'Failed to track feature', details: e.message });
  }
});

/**
 * GET /api/tracking/health
 * Health check endpoint for tracking system
 */
router.get('/health', async (req, res) => {
  try {
    const supabase = getSupabase();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: supabase ? 'connected' : 'disconnected',
      external_analytics: {
        mixpanel: !!process.env.MIXPANEL_TOKEN,
        enabled: process.env.NODE_ENV !== 'test' && !!process.env.MIXPANEL_TOKEN
      }
    };

    // Test database connection if available
    if (supabase) {
      try {
        const { error } = await supabase
          .from('marketing_events')
          .select('id')
          .limit(1);
        
        if (error) {
          health.database = 'error';
          health.database_error = error.message;
        }
      } catch (e) {
        health.database = 'error';
        health.database_error = e.message;
      }
    }

    const statusCode = health.database === 'connected' ? 200 : 503;
    return res.status(statusCode).json(health);
  } catch (e) {
    logger.error('[GET /api/tracking/health] Error:', e?.message || e);
    return res.status(500).json({ 
      status: 'error',
      error: e.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/tracking/stats
 * Get tracking statistics (requires authentication)
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days, 10));

    // Get user's event count
    const { count: userEventCount, error: countError } = await supabase
      .from('marketing_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .gte('created_at', startDate.toISOString());

    // Get feature usage breakdown
    const { data: featureEvents, error: featureError } = await supabase
      .from('marketing_events')
      .select('properties')
      .eq('user_id', req.user.id)
      .eq('event_name', 'feature_used')
      .gte('created_at', startDate.toISOString());

    const featureCounts = {};
    if (featureEvents && !featureError) {
      featureEvents.forEach(event => {
        const featureName = event.properties?.feature || 'unknown';
        featureCounts[featureName] = (featureCounts[featureName] || 0) + 1;
      });
    }

    return res.json({
      timeframe_days: parseInt(days, 10),
      total_events: userEventCount || 0,
      feature_usage: featureCounts,
      top_features: Object.entries(featureCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([feature, count]) => ({ feature, count })),
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    logger.error('[GET /api/tracking/stats] Error:', e?.message || e);
    return res.status(500).json({ error: 'Failed to fetch tracking stats', details: e.message });
  }
});

module.exports = router;

