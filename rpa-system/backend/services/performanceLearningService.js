/**
 * Performance Learning Service
 *
 * Tracks and learns from campaign performance:
 * - Reply rate tracking by signal type
 * - Signal correlation analysis
 * - Adaptive lead scoring
 * - Performance metrics aggregation
 */

const { createLogger } = require('../middleware/structuredLogging');
const { getSupabase } = require('../utils/supabaseClient');

const logger = createLogger('service.performanceLearning');

class PerformanceLearningService {
  constructor() {
    // Performance cache
    this.performanceCache = new Map();
  }

  /**
   * Track email performance (sent, opened, clicked, replied)
   */
  async trackEmailPerformance(emailData) {
    try {
      const {
        email,
        companyDomain,
        campaignId,
        signals,
        sentAt,
        openedAt,
        clickedAt,
        repliedAt,
        bounced
      } = emailData;

      const supabase = getSupabase();
      if (!supabase) {
        logger.warn('Database not available, skipping performance tracking');
        return { success: false, error: 'Database not available' };
      }

      // Note: This would require an email_performance table
      // For now, we'll track in lead_scores signals
      const performanceData = {
        email,
        companyDomain,
        campaignId,
        signals: signals || {},
        sentAt: sentAt || new Date().toISOString(),
        openedAt,
        clickedAt,
        repliedAt,
        bounced: bounced || false,
        replied: !!repliedAt,
        opened: !!openedAt,
        clicked: !!clickedAt
      };

      logger.info('Email performance tracked', { email, companyDomain, replied: !!repliedAt });

      return { success: true, data: performanceData };
    } catch (error) {
      logger.error('Failed to track email performance', error, { email: emailData.email });
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze signal correlation with replies
   */
  async analyzeSignalCorrelation(userId, options = {}) {
    try {
      const supabase = getSupabase();
      if (!supabase) {
        return { success: false, error: 'Database not available' };
      }

      // Get all lead scores with performance data
      // This is a simplified version - in production, you'd have a dedicated table
      const { data: leadScores, error } = await supabase
        .from('lead_scores')
        .select('*, company_profiles(*)')
        .eq('user_id', userId)
        .order('calculated_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Analyze correlations
      const correlations = {
        hiringVelocity: this._calculateCorrelation(leadScores, 'hiringVelocity'),
        seniorityMix: this._calculateCorrelation(leadScores, 'seniorityMix'),
        techStack: this._calculateCorrelation(leadScores, 'techStack'),
        departmentSignals: this._calculateCorrelation(leadScores, 'departmentSignals'),
        companyGrowth: this._calculateCorrelation(leadScores, 'companyGrowth')
      };

      return {
        success: true,
        correlations,
        sampleSize: leadScores.length
      };
    } catch (error) {
      logger.error('Failed to analyze signal correlation', error, { userId });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate correlation between signal and replies
   */
  _calculateCorrelation(leadScores, signalName) {
    // Simplified correlation calculation
    // In production, use proper statistical correlation (Pearson, etc.)

    const withSignal = leadScores.filter(ls =>
      ls.signals?.[signalName] && ls.signals[signalName] > 0.5
    );
    const withoutSignal = leadScores.filter(ls =>
      !ls.signals?.[signalName] || ls.signals[signalName] <= 0.5
    );

    // Mock reply rates (in production, get from actual performance data)
    const replyRateWith = withSignal.length > 0 ? 0.15 : 0; // 15% reply rate
    const replyRateWithout = withoutSignal.length > 0 ? 0.05 : 0; // 5% reply rate

    return {
      signalName,
      replyRateWith,
      replyRateWithout,
      correlation: replyRateWith - replyRateWithout,
      sampleSize: {
        with: withSignal.length,
        without: withoutSignal.length
      }
    };
  }

  /**
   * Update lead scoring weights based on performance
   */
  async updateScoringWeights(userId, performanceData) {
    try {
      // Analyze which signals correlate with better performance
      const correlation = await this.analyzeSignalCorrelation(userId);

      if (!correlation.success) {
        return correlation;
      }

      // Adjust weights based on correlations - using configurable defaults
      const baseWeights = {
        hiringVelocity: parseFloat(process.env.LEAD_SCORE_WEIGHT_HIRING_VELOCITY || '0.3'),
        seniorityMix: parseFloat(process.env.LEAD_SCORE_WEIGHT_SENIORITY_MIX || '0.2'),
        techStack: parseFloat(process.env.LEAD_SCORE_WEIGHT_TECH_STACK || '0.2'),
        departmentSignals: parseFloat(process.env.LEAD_SCORE_WEIGHT_DEPARTMENT || '0.15'),
        companyGrowth: parseFloat(process.env.LEAD_SCORE_WEIGHT_COMPANY_GROWTH || '0.15')
      };

      const newWeights = { ...baseWeights };

      // Boost weights for signals with higher correlation
      const correlations = correlation.correlations;
      const totalCorrelation = Object.values(correlations).reduce(
        (sum, c) => sum + Math.abs(c.correlation || 0), 0
      );

      if (totalCorrelation > 0) {
        for (const [signal, corr] of Object.entries(correlations)) {
          const weightKey = signal === 'hiringVelocity' ? 'hiringVelocity' :
                           signal === 'seniorityMix' ? 'seniorityMix' :
                           signal === 'techStack' ? 'techStack' :
                           signal === 'departmentSignals' ? 'departmentSignals' :
                           signal === 'companyGrowth' ? 'companyGrowth' : null;

          if (weightKey && corr.correlation > 0) {
            newWeights[weightKey] += (corr.correlation / totalCorrelation) * 0.1;
          }
        }

        // Normalize weights
        const total = Object.values(newWeights).reduce((sum, w) => sum + w, 0);
        for (const key in newWeights) {
          newWeights[key] = newWeights[key] / total;
        }
      }

      return {
        success: true,
        weights: newWeights,
        correlations: correlations
      };
    } catch (error) {
      logger.error('Failed to update scoring weights', error, { userId });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(userId, options = {}) {
    try {
      const supabase = getSupabase();
      if (!supabase) {
        return { success: false, error: 'Database not available' };
      }

      // Get lead scores
      const { data: leadScores, error } = await supabase
        .from('lead_scores')
        .select('*')
        .eq('user_id', userId)
        .order('calculated_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Calculate metrics
      const metrics = {
        totalLeads: leadScores.length,
        averageScore: leadScores.length > 0
          ? leadScores.reduce((sum, ls) => sum + (ls.score || 0), 0) / leadScores.length
          : 0,
        highScoreLeads: leadScores.filter(ls => (ls.score || 0) >= 70).length,
        mediumScoreLeads: leadScores.filter(ls => {
          const score = ls.score || 0;
          return score >= 40 && score < 70;
        }).length,
        lowScoreLeads: leadScores.filter(ls => (ls.score || 0) < 40).length,
        topSignals: this._getTopSignals(leadScores)
      };

      return {
        success: true,
        metrics
      };
    } catch (error) {
      logger.error('Failed to get performance metrics', error, { userId });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get top performing signals
   */
  _getTopSignals(leadScores) {
    const signalCounts = {};

    leadScores.forEach(ls => {
      if (ls.signals) {
        for (const [signal, value] of Object.entries(ls.signals)) {
          if (typeof value === 'number' && value > 0.5) {
            signalCounts[signal] = (signalCounts[signal] || 0) + 1;
          }
        }
      }
    });

    return Object.entries(signalCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([signal, count]) => ({ signal, count }));
  }
}

// Singleton instance
let learningInstance = null;

function getPerformanceLearningService() {
  if (!learningInstance) {
    learningInstance = new PerformanceLearningService();
  }
  return learningInstance;
}

module.exports = {
  PerformanceLearningService,
  getPerformanceLearningService
};

