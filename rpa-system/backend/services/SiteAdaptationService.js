/**
 * Site Adaptation Service
 * Makes EasyFlow dynamically adapt to website changes over time
 * Part of EasyFlow's intelligent automation system
 */

const { logger } = require('../utils/logger');
const { getSupabase } = require('../utils/supabaseClient');

class SiteAdaptationService {
  constructor() {
    this.supabase = getSupabase();
    
    // Learning patterns for site changes
    this.adaptationStrategies = {
      selectorVariations: [
        // Try multiple selector strategies
        'id',
        'name',
        'class',
        'data-attribute',
        'aria-label',
        'text-content',
        'xpath',
        'css-combinator'
      ],
      fallbackSelectors: [
        // Common fallback patterns
        'input[type="email"]',
        'input[type="password"]',
        'input[name*="email"]',
        'input[name*="user"]',
        'input[id*="email"]',
        'input[id*="user"]',
        'form input',
        '[role="textbox"]'
      ]
    };
  }

  /**
   * Learn from successful automation runs
   * Stores patterns that worked for future use
   */
  async learnFromSuccess(runData) {
    try {
      const {
        siteUrl,
        taskType,
        selectorsUsed,
        workflowSteps,
        executionTime,
        successPattern
      } = runData;

      logger.info('[SiteAdaptation] Learning from successful run', {
        siteUrl,
        taskType,
        selectorsCount: selectorsUsed?.length || 0
      });

      // Store successful patterns in database
      const { error } = await this.supabase
        .from('site_patterns')
        .upsert({
          site_url: siteUrl,
          task_type: taskType,
          selectors: selectorsUsed,
          workflow_steps: workflowSteps,
          success_count: 1,
          last_success_at: new Date().toISOString(),
          average_execution_time: executionTime,
          pattern_hash: this._hashPattern(successPattern),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'site_url,task_type'
        });

      if (error) {
        logger.error('[SiteAdaptation] Error storing pattern:', error);
      } else {
        logger.info('[SiteAdaptation] Successfully stored pattern for future use');
      }
    } catch (error) {
      logger.error('[SiteAdaptation] Error learning from success:', error);
    }
  }

  /**
   * Learn from failures and adapt
   * When automation fails, try alternative strategies
   */
  async learnFromFailure(failureData) {
    try {
      const {
        siteUrl,
        taskType,
        errorMessage,
        attemptedSelectors,
        pageStructure
      } = failureData;

      logger.info('[SiteAdaptation] Learning from failure', {
        siteUrl,
        taskType,
        error: errorMessage
      });

      // Store failure pattern to avoid repeating
      await this.supabase
        .from('site_failures')
        .insert({
          site_url: siteUrl,
          task_type: taskType,
          error_message: errorMessage,
          attempted_selectors: attemptedSelectors,
          page_structure: pageStructure,
          occurred_at: new Date().toISOString()
        });

      // Try to find alternative selectors based on page structure
      const alternativeSelectors = await this._findAlternativeSelectors(pageStructure);
      
      if (alternativeSelectors.length > 0) {
        logger.info('[SiteAdaptation] Found alternative selectors', {
          count: alternativeSelectors.length
        });
        
        // Store alternatives for next attempt
        await this.supabase
          .from('site_adaptations')
          .upsert({
            site_url: siteUrl,
            task_type: taskType,
            original_selectors: attemptedSelectors,
            alternative_selectors: alternativeSelectors,
            adaptation_reason: errorMessage,
            created_at: new Date().toISOString()
          }, {
            onConflict: 'site_url,task_type'
          });
      }
    } catch (error) {
      logger.error('[SiteAdaptation] Error learning from failure:', error);
    }
  }

  /**
   * Get adapted selectors for a site
   * Returns learned patterns or falls back to defaults
   */
  async getAdaptedSelectors(siteUrl, taskType) {
    try {
      // Check for stored adaptations
      const { data: adaptation } = await this.supabase
        .from('site_adaptations')
        .select('alternative_selectors')
        .eq('site_url', siteUrl)
        .eq('task_type', taskType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (adaptation && adaptation.alternative_selectors) {
        logger.info('[SiteAdaptation] Using adapted selectors', {
          siteUrl,
          taskType,
          selectorCount: adaptation.alternative_selectors.length
        });
        return adaptation.alternative_selectors;
      }

      // Check for successful patterns
      const { data: pattern } = await this.supabase
        .from('site_patterns')
        .select('selectors')
        .eq('site_url', siteUrl)
        .eq('task_type', taskType)
        .order('last_success_at', { ascending: false })
        .limit(1)
        .single();

      if (pattern && pattern.selectors) {
        logger.info('[SiteAdaptation] Using learned pattern', {
          siteUrl,
          taskType
        });
        return pattern.selectors;
      }

      // Return default selectors
      logger.info('[SiteAdaptation] Using default selectors', { siteUrl, taskType });
      return this._getDefaultSelectors(taskType);
    } catch (error) {
      logger.error('[SiteAdaptation] Error getting adapted selectors:', error);
      return this._getDefaultSelectors(taskType);
    }
  }

  /**
   * Detect if site structure has changed
   * Compares current page structure with known patterns
   */
  async detectSiteChange(siteUrl, currentStructure) {
    try {
      // Get last known successful structure
      const { data: knownPattern } = await this.supabase
        .from('site_patterns')
        .select('page_structure, last_success_at')
        .eq('site_url', siteUrl)
        .order('last_success_at', { ascending: false })
        .limit(1)
        .single();

      if (!knownPattern) {
        return { changed: false, confidence: 0 }; // No baseline to compare
      }

      // Compare structures
      const similarity = this._compareStructures(knownPattern.page_structure, currentStructure);
      const changed = similarity < 0.7; // Less than 70% similar = changed

      if (changed) {
        logger.warn('[SiteAdaptation] Site structure change detected', {
          siteUrl,
          similarity: (similarity * 100).toFixed(1) + '%',
          lastSuccess: knownPattern.last_success_at
        });
      }

      return {
        changed,
        confidence: 1 - similarity,
        similarity,
        lastKnownSuccess: knownPattern.last_success_at
      };
    } catch (error) {
      logger.error('[SiteAdaptation] Error detecting site change:', error);
      return { changed: false, confidence: 0, error: error.message };
    }
  }

  /**
   * Self-heal: Automatically try alternative strategies when current one fails
   */
  async selfHeal(siteUrl, taskType, failedSelector, pageStructure) {
    try {
      logger.info('[SiteAdaptation] Attempting self-healing', {
        siteUrl,
        taskType,
        failedSelector
      });

      // Try alternative selectors
      const alternatives = await this._findAlternativeSelectors(pageStructure);
      
      // Try fallback strategies
      const fallbacks = this.adaptationStrategies.fallbackSelectors;

      // Combine all options
      const healingStrategies = [
        ...alternatives,
        ...fallbacks,
        ...this._generateSelectorVariations(failedSelector)
      ];

      logger.info('[SiteAdaptation] Generated healing strategies', {
        count: healingStrategies.length
      });

      return {
        strategies: healingStrategies,
        shouldRetry: true,
        maxRetries: 3
      };
    } catch (error) {
      logger.error('[SiteAdaptation] Error in self-healing:', error);
      return { strategies: [], shouldRetry: false };
    }
  }

  /**
   * Find alternative selectors based on page structure
   */
  async _findAlternativeSelectors(pageStructure) {
    const alternatives = [];
    
    // Analyze page structure for potential selectors
    if (pageStructure?.forms) {
      for (const form of pageStructure.forms) {
        if (form.inputs) {
          for (const input of form.inputs) {
            if (input.type === 'email' || input.name?.includes('email')) {
              alternatives.push(`input[name="${input.name}"]`);
              if (input.id) alternatives.push(`#${input.id}`);
            }
            if (input.type === 'password') {
              alternatives.push(`input[name="${input.name}"]`);
              if (input.id) alternatives.push(`#${input.id}`);
            }
          }
        }
      }
    }

    return [...new Set(alternatives)]; // Remove duplicates
  }

  /**
   * Generate selector variations
   */
  _generateSelectorVariations(originalSelector) {
    const variations = [];
    
    // Try different attribute combinations
    if (originalSelector.includes('#')) {
      const id = originalSelector.replace('#', '');
      variations.push(`[id="${id}"]`);
      variations.push(`input#${id}`);
    }
    
    if (originalSelector.includes('.')) {
      const className = originalSelector.replace('.', '');
      variations.push(`[class*="${className}"]`);
      variations.push(`input.${className}`);
    }

    return variations;
  }

  /**
   * Compare two page structures for similarity
   */
  _compareStructures(structure1, structure2) {
    if (!structure1 || !structure2) return 0;

    // Simple similarity based on key elements
    const keys1 = Object.keys(structure1);
    const keys2 = Object.keys(structure2);
    
    const commonKeys = keys1.filter(k => keys2.includes(k));
    const similarity = commonKeys.length / Math.max(keys1.length, keys2.length);

    return similarity;
  }

  /**
   * Hash pattern for storage
   */
  _hashPattern(pattern) {
    // Simple hash for pattern identification
    return Buffer.from(JSON.stringify(pattern)).toString('base64').substring(0, 32);
  }

  /**
   * Get default selectors for a task type
   */
  _getDefaultSelectors(taskType) {
    const defaults = {
      login: [
        'input[type="email"]',
        'input[type="text"][name*="email"]',
        'input[type="password"]',
        'button[type="submit"]'
      ],
      invoice_download: [
        'a[href*=".pdf"]',
        'a[href*="invoice"]',
        'a[href*="download"]'
      ],
      form_submission: [
        'form',
        'input[type="text"]',
        'input[type="email"]',
        'button[type="submit"]'
      ]
    };

    return defaults[taskType] || defaults.login;
  }
}

module.exports = { SiteAdaptationService };

