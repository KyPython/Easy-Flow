/**
 * Cost Savings Calculator
 *
 * Calculates potential cost savings from execution mode optimization
 * Based on quantization analysis: 21% savings on background workflows
 */

const { ExecutionModeService, EXECUTION_MODES } = require('./executionModeService');

class CostSavingsCalculator {
  constructor() {
    this.modeService = new ExecutionModeService();
  }

  /**
   * Calculate monthly cost savings for a user
   *
   * @param {number} totalWorkflows - Total workflows per month
   * @param {number} backgroundPercentage - Percentage that are background (0-100)
   * @returns {Object} Cost breakdown and savings
   */
  calculateMonthlySavings(totalWorkflows, backgroundPercentage = 50) {
    const backgroundCount = Math.floor(totalWorkflows * (backgroundPercentage / 100));
    const timeSensitiveCount = totalWorkflows - backgroundCount;

    // Real-time cost: $0.10 per execution
    const realtimeCost = 0.10;
    // Eco mode cost: 21% cheaper = $0.079 per execution
    const ecoCost = realtimeCost * 0.79;

    // Current cost (all real-time)
    const currentCost = totalWorkflows * realtimeCost;

    // Optimized cost
    const optimizedCost = (timeSensitiveCount * realtimeCost) + (backgroundCount * ecoCost);

    // Savings
    const monthlySavings = currentCost - optimizedCost;
    const savingsPercentage = ((monthlySavings / currentCost) * 100).toFixed(1);

    return {
      totalWorkflows,
      backgroundPercentage,
      breakdown: {
        timeSensitive: {
          count: timeSensitiveCount,
          cost: timeSensitiveCount * realtimeCost,
          costPerExecution: realtimeCost
        },
        background: {
          count: backgroundCount,
          cost: backgroundCount * ecoCost,
          costPerExecution: ecoCost,
          savingsPerExecution: realtimeCost - ecoCost
        }
      },
      costs: {
        current: currentCost,
        optimized: optimizedCost,
        monthlySavings: monthlySavings,
        savingsPercentage: `${savingsPercentage}%`
      },
      annual: {
        savings: monthlySavings * 12
      }
    };
  }

  /**
   * Calculate savings for multiple scenarios
   */
  calculateScenarios() {
    const scenarios = [
      { workflows: 100, background: 50, label: 'Small User' },
      { workflows: 1000, background: 50, label: 'Medium User' },
      { workflows: 10000, background: 50, label: 'Large User' },
      { workflows: 1000, background: 30, label: 'Mostly User-Triggered' },
      { workflows: 1000, background: 70, label: 'Heavy Background Usage' }
    ];

    return scenarios.map(scenario => ({
      label: scenario.label,
      ...this.calculateMonthlySavings(scenario.workflows, scenario.background)
    }));
  }

  /**
   * Calculate aggregate savings across all users
   *
   * @param {Array} users - Array of { totalWorkflows, backgroundPercentage }
   * @returns {Object} Aggregate savings
   */
  calculateAggregateSavings(users) {
    let totalCurrentCost = 0;
    let totalOptimizedCost = 0;
    let totalWorkflows = 0;
    let totalBackgroundWorkflows = 0;

    users.forEach(user => {
      const result = this.calculateMonthlySavings(
        user.totalWorkflows,
        user.backgroundPercentage || 50
      );

      totalCurrentCost += result.costs.current;
      totalOptimizedCost += result.costs.optimized;
      totalWorkflows += result.totalWorkflows;
      totalBackgroundWorkflows += result.breakdown.background.count;
    });

    return {
      users: users.length,
      totalWorkflows,
      totalBackgroundWorkflows,
      backgroundPercentage: ((totalBackgroundWorkflows / totalWorkflows) * 100).toFixed(1),
      costs: {
        current: totalCurrentCost,
        optimized: totalOptimizedCost,
        monthlySavings: totalCurrentCost - totalOptimizedCost,
        annualSavings: (totalCurrentCost - totalOptimizedCost) * 12
      },
      savingsPercentage: (((totalCurrentCost - totalOptimizedCost) / totalCurrentCost) * 100).toFixed(1) + '%'
    };
  }
}

module.exports = { CostSavingsCalculator };

