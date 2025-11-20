
const { logger, getLogger } = require('../utils/logger');
/**
 * ROI Analytics API Routes
 * Tracks automation performance, time savings, and business value metrics
 */


const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { auditLogger } = require('../utils/auditLogger');
const { requireFeature } = require('../middleware/planEnforcement');

// Safe supabase client (may be null when env vars aren't set)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/**
 * GET /api/roi-analytics/dashboard
 * Get comprehensive ROI dashboard data
 */
router.get('/dashboard', requireFeature('analytics'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { timeframe = '30d' } = req.query;
    const timeframes = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '365d': 365
    };
    
    const days = timeframes[timeframe] || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get automation execution data
    const { data: automations, error: automationError } = await supabase
      .from('automation_executions')
      .select(`
        id, task_type, status, execution_time, 
        created_at, result, estimated_time_saved
      `)
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (automationError) throw automationError;

    // Calculate ROI metrics
    const metrics = calculateROIMetrics(automations || []);
    
    // Get cost analysis
    const costAnalysis = await calculateCostAnalysis(userId, days);
    
    // Get productivity trends
    const trends = calculateProductivityTrends(automations || [], days);
    
    // Get task type breakdown
    const taskTypeBreakdown = calculateTaskTypeBreakdown(automations || []);

    const dashboardData = {
      timeframe,
      period_days: days,
      metrics,
      cost_analysis: costAnalysis,
      trends,
      task_breakdown: taskTypeBreakdown,
      total_automations: automations?.length || 0,
      generated_at: new Date().toISOString()
    };

    // Log analytics access
    await auditLogger.logDataAccess(userId, 'roi_analytics', 'read', {
      timeframe,
      total_automations: automations?.length || 0
    });

    res.json(dashboardData);
  } catch (error) {
    logger.error('ROI dashboard error:', error);
    
    if (req.user?.id) {
      await auditLogger.logSystemEvent('error', 'roi_dashboard_failed', {
        error: error.message
      }, req.user.id);
    }
    
    res.status(500).json({ error: 'Failed to generate ROI dashboard' });
  }
});

/**
 * GET /api/roi-analytics/time-savings
 * Get detailed time savings analysis
 */
router.get('/time-savings', requireFeature('analytics'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { timeframe = '30d', task_type } = req.query;
    const days = parseInt(timeframe.replace('d', '')) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let query = supabase
      .from('automation_executions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (task_type) {
      query = query.eq('task_type', task_type);
    }

    const { data: executions, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const timeSavingsAnalysis = {
      total_time_saved_minutes: 0,
      total_time_saved_hours: 0,
      average_time_per_automation: 0,
      most_time_saving_task_type: null,
      daily_savings: {},
      weekly_savings: {},
      by_task_type: {}
    };

    let totalEstimatedSaved = 0;
    let totalExecutions = executions?.length || 0;
    const taskTypeSavings = {};
    const dailySavings = {};

    executions?.forEach(exec => {
      const savedMinutes = exec.estimated_time_saved || getDefaultTimeSaving(exec.task_type);
      totalEstimatedSaved += savedMinutes;

      // By task type
      if (!taskTypeSavings[exec.task_type]) {
        taskTypeSavings[exec.task_type] = { total: 0, count: 0 };
      }
      taskTypeSavings[exec.task_type].total += savedMinutes;
      taskTypeSavings[exec.task_type].count += 1;

      // By day
      const day = exec.created_at.split('T')[0];
      dailySavings[day] = (dailySavings[day] || 0) + savedMinutes;
    });

    timeSavingsAnalysis.total_time_saved_minutes = totalEstimatedSaved;
    timeSavingsAnalysis.total_time_saved_hours = Math.round((totalEstimatedSaved / 60) * 100) / 100;
    timeSavingsAnalysis.average_time_per_automation = totalExecutions > 0 
      ? Math.round((totalEstimatedSaved / totalExecutions) * 100) / 100 
      : 0;

    // Find most time-saving task type
    let maxSavings = 0;
    let mostSavingType = null;
    for (const [taskType, data] of Object.entries(taskTypeSavings)) {
      if (data.total > maxSavings) {
        maxSavings = data.total;
        mostSavingType = taskType;
      }
      timeSavingsAnalysis.by_task_type[taskType] = {
        total_saved_minutes: data.total,
        total_saved_hours: Math.round((data.total / 60) * 100) / 100,
        count: data.count,
        average_per_execution: Math.round((data.total / data.count) * 100) / 100
      };
    }

    timeSavingsAnalysis.most_time_saving_task_type = mostSavingType;
    timeSavingsAnalysis.daily_savings = dailySavings;

    // Calculate weekly savings
    const weeklySavings = {};
    for (const [day, savings] of Object.entries(dailySavings)) {
      const date = new Date(day);
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
      const weekKey = weekStart.toISOString().split('T')[0];
      weeklySavings[weekKey] = (weeklySavings[weekKey] || 0) + savings;
    }
    timeSavingsAnalysis.weekly_savings = weeklySavings;

    res.json(timeSavingsAnalysis);
  } catch (error) {
    logger.error('Time savings analysis error:', error);
    res.status(500).json({ error: 'Failed to generate time savings analysis' });
  }
});

/**
 * GET /api/roi-analytics/cost-benefit
 * Get cost-benefit analysis
 */
router.get('/cost-benefit', requireFeature('analytics'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { timeframe = '30d' } = req.query;
    const days = parseInt(timeframe.replace('d', '')) || 30;
    
    // Get user's plan for cost calculation
    const { data: planData } = await supabase.rpc('get_user_plan_details', {
      user_uuid: userId
    });

    const monthlyCost = planData?.plan_limits?.monthly_cost || 0;
    const dailyCost = monthlyCost / 30;
    const periodCost = dailyCost * days;

    // Get automation data
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { data: executions } = await supabase
      .from('automation_executions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    // Calculate labor cost savings
    const hourlyRate = parseFloat(process.env.DEFAULT_HOURLY_RATE) || 25; // Default $25/hour
    let totalTimeSavedHours = 0;

    executions?.forEach(exec => {
      const savedMinutes = exec.estimated_time_saved || getDefaultTimeSaving(exec.task_type);
      totalTimeSavedHours += savedMinutes / 60;
    });

    const laborCostSaved = totalTimeSavedHours * hourlyRate;
    const roi = periodCost > 0 ? ((laborCostSaved - periodCost) / periodCost) * 100 : 0;
    const paybackPeriodDays = laborCostSaved > 0 ? (periodCost / laborCostSaved) * days : -1;

    const costBenefitAnalysis = {
      period_days: days,
      period_cost: Math.round(periodCost * 100) / 100,
      monthly_subscription_cost: monthlyCost,
      total_time_saved_hours: Math.round(totalTimeSavedHours * 100) / 100,
      hourly_rate_used: hourlyRate,
      labor_cost_saved: Math.round(laborCostSaved * 100) / 100,
      net_benefit: Math.round((laborCostSaved - periodCost) * 100) / 100,
      roi_percentage: Math.round(roi * 100) / 100,
      payback_period_days: paybackPeriodDays > 0 ? Math.round(paybackPeriodDays) : null,
      break_even: roi >= 0,
      total_automations: executions?.length || 0
    };

    res.json(costBenefitAnalysis);
  } catch (error) {
    logger.error('Cost-benefit analysis error:', error);
    res.status(500).json({ error: 'Failed to generate cost-benefit analysis' });
  }
});

/**
 * POST /api/roi-analytics/custom-hourly-rate
 * Set custom hourly rate for ROI calculations
 */
router.post('/custom-hourly-rate', requireFeature('analytics'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { hourly_rate } = req.body;
    
    if (!hourly_rate || hourly_rate < 0 || hourly_rate > 1000) {
      return res.status(400).json({ error: 'Invalid hourly rate (must be between 0-1000)' });
    }

    // Store in user preferences
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        preference_key: 'custom_hourly_rate',
        preference_value: hourly_rate.toString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,preference_key'
      });

    if (error) throw error;

    await auditLogger.logUserAction(userId, 'update_hourly_rate', {
      new_rate: hourly_rate
    }, req);

    res.json({ 
      success: true, 
      hourly_rate: hourly_rate 
    });
  } catch (error) {
    logger.error('Failed to update hourly rate:', error);
    res.status(500).json({ error: 'Failed to update hourly rate' });
  }
});

/**
 * GET /api/roi-analytics/export
 * Export ROI data as CSV or JSON
 */
router.get('/export', requireFeature('analytics'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { format = 'csv', timeframe = '30d' } = req.query;
    const days = parseInt(timeframe.replace('d', '')) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data: executions } = await supabase
      .from('automation_executions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    const filename = `roi_analytics_${userId.split('-')[0]}_${timeframe}`;

    if (format.toLowerCase() === 'csv') {
      const csv = convertExecutionsToCSV(executions || []);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json({
        timeframe,
        export_date: new Date().toISOString(),
        total_records: executions?.length || 0,
        executions: executions || []
      });
    }

    await auditLogger.logDataAccess(userId, 'roi_analytics', 'export', {
      format,
      timeframe,
      record_count: executions?.length || 0
    });

  } catch (error) {
    logger.error('ROI export error:', error);
    res.status(500).json({ error: 'Failed to export ROI data' });
  }
});

// Helper Functions

function calculateROIMetrics(executions) {
  const metrics = {
    total_executions: executions.length,
    successful_executions: 0,
    failed_executions: 0,
    success_rate_percent: 0,
    average_execution_time_seconds: 0,
    total_time_saved_minutes: 0,
    productivity_score: 0
  };

  let totalExecutionTime = 0;
  let totalTimeSaved = 0;

  executions.forEach(exec => {
    if (exec.status === 'completed' || exec.status === 'success') {
      metrics.successful_executions++;
    } else {
      metrics.failed_executions++;
    }

    totalExecutionTime += exec.execution_time || 0;
    totalTimeSaved += exec.estimated_time_saved || getDefaultTimeSaving(exec.task_type);
  });

  if (executions.length > 0) {
    metrics.success_rate_percent = Math.round((metrics.successful_executions / executions.length) * 100);
    metrics.average_execution_time_seconds = Math.round(totalExecutionTime / executions.length);
  }

  metrics.total_time_saved_minutes = totalTimeSaved;
  
  // Productivity score (0-100 based on time saved vs execution time)
  if (totalExecutionTime > 0) {
    metrics.productivity_score = Math.min(100, Math.round((totalTimeSaved * 60) / totalExecutionTime));
  }

  return metrics;
}

async function calculateCostAnalysis(userId, days) {
  // This would integrate with your billing system
  const monthlyCost = 29.99; // Example cost
  const periodCost = (monthlyCost / 30) * days;

  return {
    period_cost: Math.round(periodCost * 100) / 100,
    monthly_cost: monthlyCost,
    cost_per_day: Math.round((monthlyCost / 30) * 100) / 100
  };
}

function calculateProductivityTrends(executions, days) {
  const dailyStats = {};
  
  executions.forEach(exec => {
    const day = exec.created_at.split('T')[0];
    if (!dailyStats[day]) {
      dailyStats[day] = { count: 0, time_saved: 0, avg_execution_time: 0, total_execution_time: 0 };
    }
    
    dailyStats[day].count++;
    dailyStats[day].time_saved += exec.estimated_time_saved || getDefaultTimeSaving(exec.task_type);
    dailyStats[day].total_execution_time += exec.execution_time || 0;
  });

  // Calculate averages
  Object.keys(dailyStats).forEach(day => {
    const stats = dailyStats[day];
    stats.avg_execution_time = stats.count > 0 ? Math.round(stats.total_execution_time / stats.count) : 0;
  });

  return dailyStats;
}

function calculateTaskTypeBreakdown(executions) {
  const breakdown = {};
  
  executions.forEach(exec => {
    if (!breakdown[exec.task_type]) {
      breakdown[exec.task_type] = {
        count: 0,
        success_count: 0,
        total_time_saved: 0,
        avg_execution_time: 0,
        total_execution_time: 0
      };
    }
    
    const stats = breakdown[exec.task_type];
    stats.count++;
    
    if (exec.status === 'completed' || exec.status === 'success') {
      stats.success_count++;
    }
    
    stats.total_time_saved += exec.estimated_time_saved || getDefaultTimeSaving(exec.task_type);
    stats.total_execution_time += exec.execution_time || 0;
  });

  // Calculate averages and success rates
  Object.keys(breakdown).forEach(taskType => {
    const stats = breakdown[taskType];
    stats.success_rate = stats.count > 0 ? Math.round((stats.success_count / stats.count) * 100) : 0;
    stats.avg_execution_time = stats.count > 0 ? Math.round(stats.total_execution_time / stats.count) : 0;
    stats.avg_time_saved = stats.count > 0 ? Math.round(stats.total_time_saved / stats.count) : 0;
  });

  return breakdown;
}

function getDefaultTimeSaving(taskType) {
  const defaults = {
    'web_automation': 15, // 15 minutes
    'data_extraction': 10, // 10 minutes
    'form_submission': 8, // 8 minutes
    'invoice_download': 5, // 5 minutes
    'email_automation': 12, // 12 minutes
    'file_processing': 20 // 20 minutes
  };
  
  return defaults[taskType] || 10; // Default 10 minutes
}

function convertExecutionsToCSV(executions) {
  const headers = [
    'id', 'task_type', 'status', 'execution_time_seconds', 
    'estimated_time_saved_minutes', 'created_at', 'result_summary'
  ];
  
  const csvRows = [headers.join(',')];
  
  executions.forEach(exec => {
    const row = [
      exec.id || '',
      exec.task_type || '',
      exec.status || '',
      exec.execution_time || 0,
      exec.estimated_time_saved || getDefaultTimeSaving(exec.task_type),
      exec.created_at || '',
      (exec.result && typeof exec.result === 'object' ? JSON.stringify(exec.result).substring(0, 100) : exec.result || '')
    ];
    
    const escapedRow = row.map(field => {
      const fieldStr = String(field);
      if (fieldStr.includes(',') || fieldStr.includes('"')) {
        return `"${fieldStr.replace(/"/g, '""')}"`;
      }
      return fieldStr;
    });
    
    csvRows.push(escapedRow.join(','));
  });
  
  return csvRows.join('\n');
}

module.exports = router;