
const { logger } = require('../utils/logger');
/**
 * Competitive Intelligence System - Rockefeller Operating System
 *
 * "Know your competitors better than they know themselves"
 * - Rockefeller had "Oil Inspectors" gathering intelligence
 * - You have this system
 */

const express = require('express');
const router = express.Router();
const { getSupabase } = require('../utils/supabaseClient');
const { auditLogger } = require('../utils/auditLogger');

// Competitor tracking list (customize based on your market)
const DEFAULT_COMPETITORS = [
  { name: 'Zapier', focus_areas: ['pricing', 'features', 'marketing'] },
  { name: 'Make.com', focus_areas: ['pricing', 'positioning', 'user_experience'] },
  { name: 'n8n', focus_areas: ['community', 'features', 'open_source'] },
  { name: 'IFTTT', focus_areas: ['user_complaints', 'limitations', 'pricing'] }
];

/**
 * GET /api/competitive-intel/competitors
 * List all tracked competitors
 */
router.get('/competitors', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    res.json({
      competitors: DEFAULT_COMPETITORS,
      tracking_schedule: {
        monday: 'Check competitor subreddits for user pain points',
        tuesday: 'Review competitor social media and announcements',
        wednesday: 'Analyze user feedback vs competitor reviews',
        thursday: 'Update competitive positioning doc',
        friday: 'Identify one thing you can do better'
      }
    });

  } catch (error) {
    logger.error('Competitors list error:', error);
    res.status(500).json({ error: 'Failed to load competitors' });
  }
});

/**
 * POST /api/competitive-intel/observation
 * Log a new competitive intelligence observation
 */
router.post('/observation', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      competitor_name,
      category,
      observation,
      source_url,
      impact_level,
      action_items
    } = req.body;

    if (!competitor_name || !category || !observation) {
      return res.status(400).json({
        error: 'Missing required fields: competitor_name, category, observation'
      });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('competitive_intelligence')
      .insert({
        user_id: userId,
        competitor_name,
        category,
        observation,
        source_url,
        impact_level: impact_level || 'medium',
        action_items: action_items || [],
        status: 'new',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'log_competitive_intel', {
      competitor: competitor_name,
      category,
      impact_level
    }, req);

    res.json({
      success: true,
      observation: data,
      message: 'Competitive intelligence logged'
    });

  } catch (error) {
    logger.error('Failed to log observation:', error);
    res.status(500).json({ error: 'Failed to log observation' });
  }
});

/**
 * GET /api/competitive-intel/observations
 * Get all competitive intelligence observations
 */
router.get('/observations', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      competitor,
      category,
      status,
      impact_level,
      limit = 50
    } = req.query;

    const supabase = getSupabase();
    let query = supabase
      .from('competitive_intelligence')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (competitor) query = query.eq('competitor_name', competitor);
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (impact_level) query = query.eq('impact_level', impact_level);

    const { data: observations, error } = await query;
    if (error) throw error;

    // Group by competitor for easy analysis
    const byCompetitor = {};
    const byCriticalImpact = [];

    observations?.forEach(obs => {
      if (!byCompetitor[obs.competitor_name]) {
        byCompetitor[obs.competitor_name] = [];
      }
      byCompetitor[obs.competitor_name].push(obs);

      if (obs.impact_level === 'high' || obs.impact_level === 'critical') {
        byCriticalImpact.push(obs);
      }
    });

    res.json({
      total: observations?.length || 0,
      observations: observations || [],
      by_competitor: byCompetitor,
      critical_items: byCriticalImpact,
      needs_action: observations?.filter(o => o.status === 'new' && o.impact_level === 'high').length || 0
    });

  } catch (error) {
    logger.error('Failed to get observations:', error);
    res.status(500).json({ error: 'Failed to get observations' });
  }
});

/**
 * PATCH /api/competitive-intel/observation/:id
 * Update observation status or add action items
 */
router.patch('/observation/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    const { status, action_items, notes } = req.body;

    const supabase = getSupabase();
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (status) updates.status = status;
    if (action_items) updates.action_items = action_items;
    if (notes) updates.notes = notes;

    const { data, error } = await supabase
      .from('competitive_intelligence')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'update_competitive_intel', {
      observation_id: id,
      new_status: status
    }, req);

    res.json({
      success: true,
      observation: data
    });

  } catch (error) {
    logger.error('Failed to update observation:', error);
    res.status(500).json({ error: 'Failed to update observation' });
  }
});

/**
 * GET /api/competitive-intel/weekly-report
 * Generate weekly competitive intelligence summary
 */
router.get('/weekly-report', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabase();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: observations, error } = await supabase
      .from('competitive_intelligence')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Analyze trends
    const report = {
      week_ending: new Date().toISOString().split('T')[0],
      total_observations: observations?.length || 0,
      by_competitor: {},
      by_category: {},
      critical_threats: [],
      opportunities: [],
      action_required: []
    };

    observations?.forEach(obs => {
      // By competitor
      if (!report.by_competitor[obs.competitor_name]) {
        report.by_competitor[obs.competitor_name] = 0;
      }
      report.by_competitor[obs.competitor_name]++;

      // By category
      if (!report.by_category[obs.category]) {
        report.by_category[obs.category] = 0;
      }
      report.by_category[obs.category]++;

      // Critical items
      if (obs.impact_level === 'critical' || obs.impact_level === 'high') {
        if (obs.category === 'pricing' || obs.category === 'feature') {
          report.critical_threats.push({
            competitor: obs.competitor_name,
            observation: obs.observation,
            impact: obs.impact_level
          });
        }
      }

      // Action required
      if (obs.status === 'new' && obs.impact_level !== 'low') {
        report.action_required.push({
          id: obs.id,
          competitor: obs.competitor_name,
          observation: obs.observation,
          suggested_actions: obs.action_items
        });
      }
    });

    // Generate insights
    report.insights = generateInsights(report);

    res.json(report);

  } catch (error) {
    logger.error('Weekly report error:', error);
    res.status(500).json({ error: 'Failed to generate weekly report' });
  }
});

/**
 * GET /api/competitive-intel/positioning-analysis
 * Analyze your positioning vs competitors
 */
router.get('/positioning-analysis', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabase();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: observations } = await supabase
      .from('competitive_intelligence')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Analyze competitive advantages and gaps
    const analysis = {
      your_strengths: [
        'Visual, intuitive workflow builder',
        'AI-assisted automation setup',
        'Sovereignty positioning (unique)',
        'Founder-led authentic brand',
        'Reddit-first community approach'
      ],
      competitor_strengths: {},
      gaps_to_address: [],
      opportunities_identified: [],
      recommended_actions: []
    };

    // Analyze observations to identify patterns
    observations?.forEach(obs => {
      if (obs.category === 'pricing' && obs.impact_level === 'high') {
        analysis.gaps_to_address.push({
          area: 'pricing',
          competitor: obs.competitor_name,
          issue: obs.observation
        });
      }

      if (obs.category === 'user_feedback') {
        analysis.opportunities_identified.push({
          opportunity: `Address pain point: ${obs.observation}`,
          source: obs.competitor_name
        });
      }
    });

    // Generate recommendations
    analysis.recommended_actions = [
      'Emphasize simplicity vs Zapier complexity in all marketing',
      'Highlight sovereignty angle - unique positioning',
      'Target users complaining about competitor pricing on Reddit',
      'Build features addressing top competitor pain points',
      'Create comparison content showing your advantages'
    ];

    res.json(analysis);

  } catch (error) {
    logger.error('Positioning analysis error:', error);
    res.status(500).json({ error: 'Failed to generate positioning analysis' });
  }
});

// Helper function to generate insights
function generateInsights(report) {
  const insights = [];

  // Most active competitor
  const topCompetitor = Object.entries(report.by_competitor)
    .sort((a, b) => b[1] - a[1])[0];

  if (topCompetitor) {
    insights.push({
      type: 'competitor_activity',
      message: `${topCompetitor[0]} had the most activity this week (${topCompetitor[1]} observations)`,
      action: `Deep dive into ${topCompetitor[0]}'s recent moves`
    });
  }

  // Critical threats
  if (report.critical_threats.length > 0) {
    insights.push({
      type: 'threat_alert',
      message: `${report.critical_threats.length} critical competitive threats identified`,
      action: 'Review and plan counter-strategies immediately'
    });
  }

  // Action items
  if (report.action_required.length > 0) {
    insights.push({
      type: 'action_needed',
      message: `${report.action_required.length} observations require action`,
      action: 'Update status and implement responses'
    });
  }

  // Low activity warning
  if (report.total_observations < 3) {
    insights.push({
      type: 'tracking_warning',
      message: 'Low competitive intelligence activity this week',
      action: 'Schedule time for competitive research (Rockefeller daily checklist)'
    });
  }

  return insights;
}

module.exports = router;
