const { createLogger } = require('../middleware/structuredLogging');
const { getSupabase } = require('../utils/supabaseClient');
const decisionLogService = require('./decisionLogService');

const logger = createLogger('service.businessRules');

/**
 * Business Rules Service
 * Manages reusable business rules that can be applied across multiple workflows
 * 
 * Rules are defined in plain English and can be reused:
 * - "VIP client = contract value > $5,000"
 * - "High-value lead = form submission with budget > $10,000"
 * - "Churn risk = user inactive > 30 days"
 */
class BusinessRulesService {
  constructor() {
    this.supabase = getSupabase();
  }

  /**
   * Get all rules for a user
   */
  async getUserRules(userId) {
    try {
      const { data, error } = await this.supabase
        .from('business_rules')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching user rules:', { error: error.message, userId });
        throw error;
      }

      logger.info('Fetched user rules', { userId, count: data?.length || 0 });
      return data || [];
    } catch (error) {
      logger.error('Failed to get user rules:', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get a single rule by ID
   */
  async getRuleById(ruleId, userId) {
    try {
      const { data, error } = await this.supabase
        .from('business_rules')
        .select('*')
        .eq('id', ruleId)
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.error('Error fetching rule:', { error: error.message, ruleId, userId });
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get rule:', { error: error.message, ruleId, userId });
      throw error;
    }
  }

  /**
   * Create a new rule
   * @param {Object} ruleData - Rule data
   * @param {string} ruleData.name - Rule name (e.g., "VIP Client")
   * @param {string} ruleData.description - Plain English description (e.g., "VIP client = contract value > $5,000")
   * @param {string} ruleData.condition - JSON condition object
   * @param {string} ruleData.action - What happens when rule matches (optional)
   * @param {string} userId - User ID
   */
  async createRule(ruleData, userId) {
    try {
      const { name, description, condition, action, category } = ruleData;

      if (!name || !description) {
        throw new Error('Rule name and description are required');
      }

      // Parse condition if it's a string
      let conditionObj = condition;
      if (typeof condition === 'string') {
        try {
          conditionObj = JSON.parse(condition);
        } catch (e) {
          // If not JSON, create a simple condition structure
          conditionObj = { type: 'custom', expression: condition };
        }
      }

      const { data, error } = await this.supabase
        .from('business_rules')
        .insert({
          user_id: userId,
          name,
          description,
          condition: conditionObj,
          action: action || null,
          category: category || 'general',
          is_active: true
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating rule:', { error: error.message, userId });
        throw error;
      }

      logger.info('Created business rule', { ruleId: data.id, name, userId });
      return data;
    } catch (error) {
      logger.error('Failed to create rule:', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update an existing rule
   */
  async updateRule(ruleId, ruleData, userId) {
    try {
      // First verify the rule belongs to the user
      const existingRule = await this.getRuleById(ruleId, userId);
      if (!existingRule) {
        throw new Error('Rule not found or access denied');
      }

      const updateData = {};
      if (ruleData.name !== undefined) updateData.name = ruleData.name;
      if (ruleData.description !== undefined) updateData.description = ruleData.description;
      if (ruleData.condition !== undefined) {
        updateData.condition = typeof ruleData.condition === 'string' 
          ? JSON.parse(ruleData.condition) 
          : ruleData.condition;
      }
      if (ruleData.action !== undefined) updateData.action = ruleData.action;
      if (ruleData.category !== undefined) updateData.category = ruleData.category;
      if (ruleData.is_active !== undefined) updateData.is_active = ruleData.is_active;

      const { data, error } = await this.supabase
        .from('business_rules')
        .update(updateData)
        .eq('id', ruleId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating rule:', { error: error.message, ruleId, userId });
        throw error;
      }

      logger.info('Updated business rule', { ruleId, userId });
      return data;
    } catch (error) {
      logger.error('Failed to update rule:', { error: error.message, ruleId, userId });
      throw error;
    }
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId, userId) {
    try {
      // First verify the rule belongs to the user
      const existingRule = await this.getRuleById(ruleId, userId);
      if (!existingRule) {
        throw new Error('Rule not found or access denied');
      }

      const { error } = await this.supabase
        .from('business_rules')
        .delete()
        .eq('id', ruleId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error deleting rule:', { error: error.message, ruleId, userId });
        throw error;
      }

      logger.info('Deleted business rule', { ruleId, userId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete rule:', { error: error.message, ruleId, userId });
      throw error;
    }
  }

  /**
   * Get workflows that use a specific rule
   */
  async getRuleUsage(ruleId, userId) {
    try {
      // Verify rule belongs to user
      const rule = await this.getRuleById(ruleId, userId);
      if (!rule) {
        throw new Error('Rule not found or access denied');
      }

      // Query workflows that reference this rule
      // This assumes workflows have a rules field or workflow_steps reference rules
      const { data, error } = await this.supabase
        .from('workflows')
        .select('id, name, status, created_at')
        .eq('user_id', userId)
        .contains('rules', [ruleId])
        .order('created_at', { ascending: false });

      if (error) {
        // If the query fails (e.g., rules column doesn't exist), return empty array
        logger.warn('Could not query rule usage (rules column may not exist):', { error: error.message });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get rule usage:', { error: error.message, ruleId, userId });
      return [];
    }
  }

  /**
   * Evaluate a rule against data
   * This is used during workflow execution to check if a rule matches
   * @param {string} ruleId - Rule ID to evaluate
   * @param {Object} data - Data to evaluate against
   * @param {string} userId - User ID
   * @param {Object} options - Optional context for decision logging
   * @param {string} options.executionId - Workflow execution ID (for decision logs)
   * @param {string} options.stepId - Step execution ID (for decision logs)
   * @param {Object} options.outputData - Output data after rule application (for decision logs)
   */
  async evaluateRule(ruleId, data, userId, options = {}) {
    try {
      const rule = await this.getRuleById(ruleId, userId);
      if (!rule || !rule.is_active) {
        return { matches: false, reason: 'Rule not found or inactive' };
      }

      // Simple rule evaluation based on condition type
      const condition = rule.condition;
      let matches = false;
      let reason = '';

      if (condition.type === 'comparison') {
        // Example: { type: 'comparison', field: 'contract_value', operator: '>', value: 5000 }
        const fieldValue = data[condition.field];
        const ruleValue = condition.value;

        switch (condition.operator) {
          case '>':
            matches = fieldValue > ruleValue;
            reason = matches 
              ? `${condition.field} (${fieldValue}) > ${ruleValue}` 
              : `${condition.field} (${fieldValue}) <= ${ruleValue}`;
            break;
          case '<':
            matches = fieldValue < ruleValue;
            reason = matches 
              ? `${condition.field} (${fieldValue}) < ${ruleValue}` 
              : `${condition.field} (${fieldValue}) >= ${ruleValue}`;
            break;
          case '>=':
            matches = fieldValue >= ruleValue;
            reason = matches 
              ? `${condition.field} (${fieldValue}) >= ${ruleValue}` 
              : `${condition.field} (${fieldValue}) < ${ruleValue}`;
            break;
          case '<=':
            matches = fieldValue <= ruleValue;
            reason = matches 
              ? `${condition.field} (${fieldValue}) <= ${ruleValue}` 
              : `${condition.field} (${fieldValue}) > ${ruleValue}`;
            break;
          case '==':
            matches = fieldValue == ruleValue;
            reason = matches 
              ? `${condition.field} (${fieldValue}) == ${ruleValue}` 
              : `${condition.field} (${fieldValue}) != ${ruleValue}`;
            break;
          default:
            matches = false;
            reason = `Unknown operator: ${condition.operator}`;
        }
      } else if (condition.type === 'custom') {
        // For custom expressions, we'd need a more sophisticated evaluator
        // For now, just check if the expression is in the description
        matches = condition.expression && rule.description.includes(condition.expression);
        reason = matches ? `Custom condition matched: ${condition.expression}` : 'Custom condition did not match';
      }

      const result = {
        matches,
        reason,
        rule: {
          id: rule.id,
          name: rule.name,
          description: rule.description
        }
      };

      // ✅ DECISION LOGS: Log rule evaluation if execution context provided
      if (options.executionId && matches) {
        // Only log when rule matches (to avoid log spam)
        await decisionLogService.logRuleDecision(
          options.executionId,
          options.stepId || null,
          result,
          data,
          options.outputData || null
        );
      }

      return result;
    } catch (error) {
      logger.error('Failed to evaluate rule:', { error: error.message, ruleId, userId });
      return { matches: false, reason: `Error evaluating rule: ${error.message}` };
    }
  }
}

module.exports = new BusinessRulesService();

