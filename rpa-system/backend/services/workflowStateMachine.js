/**
 * Workflow Execution State Machine
 *
 * State transitions:
 * PENDING -> RUNNING -> COMPLETED | RETRYING | FAILED
 *
 * RETRYING -> RUNNING -> COMPLETED | RETRYING | FAILED
 */

const { logger } = require('../utils/logger');

// Valid states
const STATES = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  RETRYING: 'RETRYING',
  FAILED: 'FAILED'
};

// Valid state transitions
const VALID_TRANSITIONS = {
  [STATES.PENDING]: [STATES.RUNNING, STATES.FAILED], // Can fail immediately if validation fails
  [STATES.RUNNING]: [STATES.COMPLETED, STATES.RETRYING, STATES.FAILED],
  [STATES.RETRYING]: [STATES.RUNNING, STATES.FAILED], // Retrying -> Running -> ...
  [STATES.COMPLETED]: [], // Terminal state
  [STATES.FAILED]: [STATES.RETRYING] // Can retry from failed
};

class WorkflowStateMachine {
  /**
   * Validate if a state transition is allowed
   * @param {string} currentState - Current state
   * @param {string} newState - Desired new state
   * @returns {boolean} - True if transition is valid
   */
  static canTransition(currentState, newState) {
    if (!STATES[newState]) {
      logger.warn('Invalid state', { state: newState });
      return false;
    }

    const allowedStates = VALID_TRANSITIONS[currentState] || [];
    return allowedStates.includes(newState);
  }

  /**
   * Transition state with validation
   * @param {string} currentState - Current state
   * @param {string} newState - Desired new state
   * @returns {Object} - { valid: boolean, error?: string }
   */
  static validateTransition(currentState, newState) {
    if (!currentState) {
      return { valid: true }; // Initial state assignment
    }

    if (currentState === newState) {
      return { valid: true }; // No-op transition
    }

    if (!this.canTransition(currentState, newState)) {
      return {
        valid: false,
        error: `Invalid state transition: ${currentState} -> ${newState}. Allowed transitions: ${VALID_TRANSITIONS[currentState]?.join(', ') || 'none'}`
      };
    }

    return { valid: true };
  }

  /**
   * Check if state is terminal (no further transitions)
   * @param {string} state - State to check
   * @returns {boolean}
   */
  static isTerminal(state) {
    return state === STATES.COMPLETED || state === STATES.FAILED;
  }

  /**
   * Check if state is active (can still transition)
   * @param {string} state - State to check
   * @returns {boolean}
   */
  static isActive(state) {
    return state === STATES.RUNNING || state === STATES.RETRYING;
  }

  /**
   * Get all valid next states for a given state
   * @param {string} state - Current state
   * @returns {string[]} - Array of valid next states
   */
  static getNextStates(state) {
    return VALID_TRANSITIONS[state] || [];
  }
}

module.exports = {
  WorkflowStateMachine,
  STATES
};

