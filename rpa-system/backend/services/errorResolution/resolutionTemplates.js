/**
 * Error Resolution Templates
 * 
 * Comprehensive resolution templates for all error categories.
 * Each template provides:
 * - what: What happened (in user terms)
 * - why: Why it happened (their action or environment)
 * - action: Exactly what to do next
 */

const { ErrorCategory, getFriendlyServiceName } = require('./errorCategories');

/**
 * Generate resolution template with variable substitution
 * @param {Object} template - Base template
 * @param {Object} context - Variables to substitute
 * @returns {Object} Resolved template
 */
function resolveTemplate(template, context = {}) {
  let resolved = JSON.parse(JSON.stringify(template)); // Deep clone
  
  // Substitute in what
  if (resolved.what && context.service) {
    resolved.what = resolved.what.replace('{service}', context.service);
  }
  if (resolved.what && context.element) {
    resolved.what = resolved.what.replace('{element}', context.element);
  }
  if (resolved.what && context.duration) {
    resolved.what = resolved.what.replace('{duration}', context.duration);
  }
  
  // Substitute in why
  if (resolved.why) {
    resolved.why = resolved.why
      .replace('{service}', context.service || 'the service')
      .replace('{limit}', context.limit || 'the limit')
      .replace('{count}', context.count || 'the count')
      .replace('{unit}', context.unit || 'minute')
      .replace('{timeout}', context.timeout || '30')
      .replace('{element}', context.element || 'the element')
      .replace('{duration}', context.duration || 'the expected time');
  }
  
  // Substitute in action steps
  if (resolved.action?.steps) {
    resolved.action.steps = resolved.action.steps.map(step => ({
      ...step,
      description: substituteVariables(step.description, context),
      action: substituteVariables(step.action, context)
    }));
  }
  
  return resolved;
}

function substituteVariables(text, context) {
  if (!text) return text;
  return text
    .replace('{service}', context.service || 'the service')
    .replace('{limit}', context.limit || 'the limit')
    .replace('{count}', context.count || 'the count')
    .replace('{time}', context.time || 'the reset time')
    .replace('{duration}', context.duration || 'the expected time');
}

/**
 * Resolution templates for all error categories
 */
const ResolutionTemplates = {
  // =====================================================
  // RATE LIMITING & QUOTAS
  // =====================================================
  
  [ErrorCategory.RATE_LIMIT_EXCEEDED]: {
    what: 'Your workflow hit a rate limit from {service}',
    why: '{service} allows only {limit} requests per {unit}. Your workflow sent {count} requests in the last {unit}.',
    action: {
      primary: 'Upgrade or reduce execution frequency',
      secondary: 'Wait for the rate limit to reset',
      steps: [
        {
          step: 1,
          description: 'Upgrade your plan for higher rate limits',
          action: 'Navigate to /pricing to see plan options',
          estimatedEffort: '2 min',
          type: 'upgrade'
        },
        {
          step: 2,
          description: 'Reduce workflow frequency',
          action: 'Edit your workflow and add delays between service calls',
          estimatedEffort: '5 min',
          type: 'modify'
        },
        {
          step: 3,
          description: 'Wait for automatic reset',
          action: 'No action needed - rate limits reset automatically',
          estimatedEffort: 'Variable',
          type: 'wait'
        }
      ]
    },
    retryAfter: 30 * 60 * 1000, // 30 minutes
    helpLinks: [
      { text: 'Rate Limits Documentation', url: '/docs/rate-limits' },
      { text: 'Upgrade Your Plan', url: '/pricing' },
      { text: 'Contact Support', url: '/support' }
    ]
  },
  
  [ErrorCategory.QUOTA_EXCEEDED]: {
    what: 'You\'ve reached your {service} quota',
    why: 'Your current plan includes {limit} {quota} per month.',
    action: {
      primary: 'Upgrade your plan for higher quotas',
      secondary: 'Wait until next month for quota reset',
      steps: [
        {
          step: 1,
          description: 'Upgrade your plan',
          action: 'Navigate to /pricing to see plan options',
          estimatedEffort: '2 min',
          type: 'upgrade'
        },
        {
          step: 2,
          description: 'Check your current usage',
          action: 'View your usage dashboard to understand your consumption',
          estimatedEffort: '3 min',
          type: 'review'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Plan Comparison', url: '/pricing' },
      { text: 'Usage Dashboard', url: '/app/usage' },
      { text: 'Contact Sales', url: '/contact' }
    ]
  },
  
  [ErrorCategory.MONTHLY_LIMIT_REACHED]: {
    what: 'You\'ve used all {limit} {resource} this month',
    why: 'Your {plan} plan includes {limit} {resource} per billing cycle.',
    action: {
      primary: 'Upgrade your plan for higher limits',
      secondary: 'Wait until next month for reset',
      steps: [
        {
          step: 1,
          description: 'Upgrade to a higher plan',
          action: 'Navigate to /pricing and select a plan with higher limits',
          estimatedEffort: '3 min',
          type: 'upgrade'
        },
        {
          step: 2,
          description: 'Review your usage patterns',
          action: 'Check your analytics to optimize resource usage',
          estimatedEffort: '5 min',
          type: 'review'
        }
      ]
    },
    retryAfter: 'next billing cycle',
    helpLinks: [
      { text: 'Pricing Plans', url: '/pricing' },
      { text: 'Usage Analytics', url: '/app/analytics' }
    ]
  },

  // =====================================================
  // AUTHENTICATION & AUTHORIZATION
  // =====================================================
  
  [ErrorCategory.AUTH_TOKEN_EXPIRED]: {
    what: 'Your session has expired',
    why: 'You haven\'t been active for {duration}. For security, sessions automatically expire.',
    action: {
      primary: 'Sign in again to continue',
      secondary: 'Enable "Remember me" for longer sessions',
      steps: [
        {
          step: 1,
          description: 'Sign in to your account',
          action: 'Click the "Sign In" button and enter your credentials',
          estimatedEffort: '1 min',
          type: 'auth'
        },
        {
          step: 2,
          description: 'Stay logged in longer',
          action: 'On the login screen, check "Remember me" to extend your session',
          estimatedEffort: '30 sec',
          type: 'setting'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Sign In', url: '/login' },
      { text: 'Session Settings', url: '/app/settings/security' }
    ]
  },
  
  [ErrorCategory.AUTH_INVALID_CREDENTIALS]: {
    what: 'Login failed - incorrect username or password',
    why: 'The credentials you provided don\'t match our records.',
    action: {
      primary: 'Check your credentials and try again',
      secondary: 'Reset your password if needed',
      steps: [
        {
          step: 1,
          description: 'Verify your email address',
          action: 'Make sure you\'re using the correct email associated with your account',
          estimatedEffort: '1 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Reset your password',
          action: 'Click "Forgot Password" to receive a reset link',
          estimatedEffort: '2 min',
          type: 'reset'
        },
        {
          step: 3,
          description: 'Check for typos',
          action: 'Ensure Caps Lock is off and there are no extra spaces',
          estimatedEffort: '30 sec',
          type: 'verify'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Forgot Password', url: '/forgot-password' },
      { text: 'Sign In', url: '/login' }
    ]
  },
  
  [ErrorCategory.AUTH_INSUFFICIENT_PERMISSIONS]: {
    what: 'You don\'t have permission to do this',
    why: 'Your current role or plan doesn\'t include access to this feature.',
    action: {
      primary: 'Upgrade your plan or contact your admin',
      secondary: 'Request access from your team admin',
      steps: [
        {
          step: 1,
          description: 'Check your current plan',
          action: 'Navigate to /app/settings/billing to see your plan features',
          estimatedEffort: '2 min',
          type: 'review'
        },
        {
          step: 2,
          description: 'Upgrade your plan',
          action: 'Navigate to /pricing to see plans with this feature',
          estimatedEffort: '3 min',
          type: 'upgrade'
        },
        {
          step: 3,
          description: 'Contact your team admin',
          action: 'If you\'re on a team plan, ask your admin for access',
          estimatedEffort: '1 min',
          type: 'contact'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Plan Features', url: '/pricing' },
      { text: 'Team Management', url: '/app/team' }
    ]
  },
  
  [ErrorCategory.AUTH_MFA_REQUIRED]: {
    what: 'Two-factor authentication is required',
    why: 'Your account has 2FA enabled for extra security.',
    action: {
      primary: 'Complete two-factor authentication',
      secondary: 'Use your authenticator app or backup code',
      steps: [
        {
          step: 1,
          description: 'Open your authenticator app',
          action: 'Use Google Authenticator, Authy, or your preferred 2FA app',
          estimatedEffort: '30 sec',
          type: 'auth'
        },
        {
          step: 2,
          description: 'Enter the verification code',
          action: 'Type the 6-digit code from your authenticator app',
          estimatedEffort: '30 sec',
          type: 'auth'
        },
        {
          step: 3,
          description: 'Use a backup code',
          action: 'If you don\'t have your authenticator, use a backup code',
          estimatedEffort: '1 min',
          type: 'backup'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: '2FA Setup Guide', url: '/docs/two-factor-auth' },
      { text: 'Backup Codes', url: '/app/settings/security' }
    ]
  },

  // =====================================================
  // WORKFLOW EXECUTION
  // =====================================================
  
  [ErrorCategory.WORKFLOW_TIMEOUT]: {
    what: 'Your workflow timed out after {duration}',
    why: 'The operation took longer than the {timeout}-second limit.',
    action: {
      primary: 'Increase timeout or simplify your workflow',
      secondary: 'Retry the operation',
      steps: [
        {
          step: 1,
          description: 'Increase the timeout setting',
          action: 'Edit your workflow and increase the timeout in settings',
          estimatedEffort: '2 min',
          type: 'modify'
        },
        {
          step: 2,
          description: 'Simplify your workflow',
          action: 'Break complex workflows into smaller steps',
          estimatedEffort: '10 min',
          type: 'optimize'
        },
        {
          step: 3,
          description: 'Retry the operation',
          action: 'Click "Retry" to run the workflow again',
          estimatedEffort: '1 min',
          type: 'retry'
        }
      ]
    },
    retryAfter: 60 * 1000, // 1 minute
    helpLinks: [
      { text: 'Workflow Timeout Settings', url: '/docs/workflow-settings' },
      { text: 'Optimization Tips', url: '/docs/workflow-optimization' }
    ]
  },
  
  [ErrorCategory.WORKFLOW_ELEMENT_NOT_FOUND]: {
    what: 'We couldn\'t find "{element}" on the page',
    why: 'The website structure may have changed or the element was removed.',
    action: {
      primary: 'Update your workflow with new selectors',
      secondary: 'Verify the page URL and element location',
      steps: [
        {
          step: 1,
          description: 'Check the page URL',
          action: 'Verify you\'re targeting the correct page',
          estimatedEffort: '1 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Update the element selector',
          action: 'Use the workflow editor to select the new element location',
          estimatedEffort: '5 min',
          type: 'modify'
        },
        {
          step: 3,
          description: 'Test the updated workflow',
          action: 'Run a test execution to verify the fix',
          estimatedEffort: '2 min',
          type: 'test'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Selector Guide', url: '/docs/element-selectors' },
      { text: 'Troubleshooting', url: '/docs/troubleshooting' }
    ]
  },
  
  [ErrorCategory.WORKFLOW_PAGE_LOAD_FAILED]: {
    what: 'The page didn\'t load completely',
    why: 'The website took too long to respond or returned an error.',
    action: {
      primary: 'Verify the URL and retry',
      secondary: 'Add wait conditions for slow pages',
      steps: [
        {
          step: 1,
          description: 'Check the URL',
          action: 'Verify the website URL is correct and accessible',
          estimatedEffort: '1 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Add wait conditions',
          action: 'Add "wait for element" steps to handle slow-loading pages',
          estimatedEffort: '5 min',
          type: 'modify'
        },
        {
          step: 3,
          description: 'Retry the workflow',
          action: 'Run the workflow again - the issue may be temporary',
          estimatedEffort: '1 min',
          type: 'retry'
        }
      ]
    },
    retryAfter: 30 * 1000, // 30 seconds
    helpLinks: [
      { text: 'Handling Slow Pages', url: '/docs/page-load-issues' },
      { text: 'Wait Conditions', url: '/docs/wait-conditions' }
    ]
  },
  
  [ErrorCategory.WORKFLOW_NAVIGATION_FAILED]: {
    what: 'Failed to navigate to the next page',
    why: 'The navigation action didn\'t complete as expected.',
    action: {
      primary: 'Check the navigation target and retry',
      secondary: 'Use explicit wait for navigation to complete',
      steps: [
        {
          step: 1,
          description: 'Verify the navigation URL',
          action: 'Check that the target page URL is correct',
          estimatedEffort: '1 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Add navigation wait',
          action: 'Configure the workflow to wait for the new page to load',
          estimatedEffort: '3 min',
          type: 'modify'
        },
        {
          step: 3,
          description: 'Retry navigation',
          action: 'Run the workflow step again',
          estimatedEffort: '1 min',
          type: 'retry'
        }
      ]
    },
    retryAfter: 30 * 1000,
    helpLinks: [
      { text: 'Navigation Actions', url: '/docs/navigation' }
    ]
  },
  
  [ErrorCategory.WORKFLOW_VALIDATION_FAILED]: {
    what: 'The data validation failed',
    why: 'The input data doesn\'t match the expected format or values.',
    action: {
      primary: 'Fix the data format or validation rules',
      secondary: 'Review the input data and try again',
      steps: [
        {
          step: 1,
          description: 'Check the input data',
          action: 'Review the data you\'re passing to the workflow',
          estimatedEffort: '3 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Update validation rules',
          action: 'Adjust the validation rules to accept your data format',
          estimatedEffort: '5 min',
          type: 'modify'
        },
        {
          step: 3,
          description: 'Retry with corrected data',
          action: 'Run the workflow with properly formatted input',
          estimatedEffort: '2 min',
          type: 'retry'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Data Validation', url: '/docs/data-validation' },
      { text: 'Input Data Format', url: '/docs/input-formats' }
    ]
  },
  
  [ErrorCategory.WORKFLOW_ASSERTION_FAILED]: {
    what: 'Expected condition was not met',
    why: 'The assertion or condition check failed.',
    action: {
      primary: 'Update the assertion or verify the condition',
      secondary: 'Adjust the workflow logic',
      steps: [
        {
          step: 1,
          description: 'Check the assertion condition',
          action: 'Review what the assertion is checking for',
          estimatedEffort: '2 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Update the assertion',
          action: 'Modify the condition to match the actual state',
          estimatedEffort: '5 min',
          type: 'modify'
        }
      ]
    },
    retryAfter: 30 * 1000,
    helpLinks: [
      { text: 'Assertions Guide', url: '/docs/assertions' }
    ]
  },

  // =====================================================
  // EXTERNAL SERVICES
  // =====================================================
  
  [ErrorCategory.SERVICE_RATE_LIMIT]: {
    what: '{service} is rate limiting requests',
    why: '{service} limits how many requests can be made in a time period.',
    action: {
      primary: 'Reduce request frequency or upgrade your {service} plan',
      secondary: 'Wait for rate limit to reset',
      steps: [
        {
          step: 1,
          description: 'Reduce request frequency',
          action: 'Add delays between requests to stay within limits',
          estimatedEffort: '5 min',
          type: 'modify'
        },
        {
          step: 2,
          description: 'Check {service} limits',
          action: 'Review {service}\'s API documentation for rate limits',
          estimatedEffort: '5 min',
          type: 'review'
        },
        {
          step: 3,
          description: 'Wait for reset',
          action: 'Rate limits typically reset within a few minutes',
          estimatedEffort: 'Variable',
          type: 'wait'
        }
      ]
    },
    retryAfter: 60 * 1000,
    helpLinks: [
      { text: '{service} API Limits', url: '/docs/external-services' }
    ]
  },
  
  [ErrorCategory.SERVICE_UNAVAILABLE]: {
    what: '{service} is temporarily unavailable',
    why: 'The service is experiencing issues or undergoing maintenance.',
    action: {
      primary: 'Wait for the service to recover',
      secondary: 'Check service status pages',
      steps: [
        {
          step: 1,
          description: 'Check service status',
          action: 'Visit the service\'s status page for updates',
          estimatedEffort: '1 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Wait and retry',
          action: 'Most service issues are resolved within a few minutes',
          estimatedEffort: '5-15 min',
          type: 'wait'
        }
      ]
    },
    retryAfter: 5 * 60 * 1000,
    helpLinks: [
      { text: 'Service Status', url: 'https://status.example.com' }
    ]
  },
  
  [ErrorCategory.SERVICE_AUTH_FAILED]: {
    what: 'Authentication with {service} failed',
    why: 'Your {service} credentials have expired or been revoked.',
    action: {
      primary: 'Reconnect your {service} integration',
      secondary: 'Check your {service} account permissions',
      steps: [
        {
          step: 1,
          description: 'Reconnect {service}',
          action: 'Go to Settings > Integrations and reconnect {service}',
          estimatedEffort: '3 min',
          type: 'reconnect'
        },
        {
          step: 2,
          description: 'Check account permissions',
          action: 'Verify your {service} account has necessary permissions',
          estimatedEffort: '5 min',
          type: 'verify'
        },
        {
          step: 3,
          description: 'Test the connection',
          action: 'Run a simple test to verify authentication works',
          estimatedEffort: '1 min',
          type: 'test'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Integration Setup', url: '/docs/integrations' },
      { text: '{service} Permissions', url: '/docs/service-permissions' }
    ]
  },
  
  [ErrorCategory.SERVICE_PERMISSION_DENIED]: {
    what: '{service} access was denied',
    why: 'Your {service} account doesn\'t have permission for this action.',
    action: {
      primary: 'Update your {service} permissions',
      secondary: 'Contact your {service} admin',
      steps: [
        {
          step: 1,
          description: 'Check required permissions',
          action: 'Review what permissions the workflow needs',
          estimatedEffort: '2 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Update account permissions',
          action: 'In your {service} account, grant necessary permissions',
          estimatedEffort: '5 min',
          type: 'modify'
        },
        {
          step: 3,
          description: 'Contact admin if needed',
          action: 'If on a team account, ask your admin for access',
          estimatedEffort: '1 min',
          type: 'contact'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Permission Requirements', url: '/docs/permissions' }
    ]
  },

  // =====================================================
  // DATA & CONFIGURATION
  // =====================================================
  
  [ErrorCategory.DATA_NOT_FOUND]: {
    what: 'The requested data wasn\'t found',
    why: 'The record or file you\'re looking for doesn\'t exist.',
    action: {
      primary: 'Verify the data exists and check your filters',
      secondary: 'Create the data if it\'s missing',
      steps: [
        {
          step: 1,
          description: 'Check the data source',
          action: 'Verify the data exists in the source system',
          estimatedEffort: '2 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Verify your filters',
          action: 'Check if filters are too restrictive',
          estimatedEffort: '2 min',
          type: 'verify'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Data Sources', url: '/docs/data-sources' }
    ]
  },
  
  [ErrorCategory.DATA_VALIDATION_FAILED]: {
    what: 'The data format is invalid',
    why: 'The data doesn\'t match the expected format.',
    action: {
      primary: 'Fix the data format',
      secondary: 'Update validation rules if needed',
      steps: [
        {
          step: 1,
          description: 'Check the expected format',
          action: 'Review the documentation for required data format',
          estimatedEffort: '2 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Transform the data',
          action: 'Convert your data to the required format',
          estimatedEffort: '5 min',
          type: 'modify'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Data Formats', url: '/docs/data-formats' }
    ]
  },
  
  [ErrorCategory.DATA_EXPORT_FAILED]: {
    what: 'Failed to export your data',
    why: 'There was an error processing your export request.',
    action: {
      primary: 'Try the export again',
      secondary: 'Reduce the amount of data or try a different format',
      steps: [
        {
          step: 1,
          description: 'Retry the export',
          action: 'The issue may be temporary - try again',
          estimatedEffort: '1 min',
          type: 'retry'
        },
        {
          step: 2,
          description: 'Reduce data scope',
          action: 'Export a smaller dataset or time range',
          estimatedEffort: '3 min',
          type: 'modify'
        }
      ]
    },
    retryAfter: 60 * 1000,
    helpLinks: [
      { text: 'Export Guide', url: '/docs/exporting-data' }
    ]
  },
  
  [ErrorCategory.CONFIG_INVALID]: {
    what: 'Your workflow configuration has errors',
    why: 'One or more settings are invalid or conflicting.',
    action: {
      primary: 'Fix the configuration errors',
      secondary: 'Review and update your workflow settings',
      steps: [
        {
          step: 1,
          description: 'Check configuration panel',
          action: 'Open the workflow settings and look for error indicators',
          estimatedEffort: '2 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Fix invalid settings',
          action: 'Update the problematic configuration values',
          estimatedEffort: '5 min',
          type: 'modify'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Workflow Configuration', url: '/docs/workflow-config' }
    ]
  },
  
  [ErrorCategory.CONFIG_MISSING_FIELD]: {
    what: 'Required information is missing',
    why: 'A field that\'s needed for this action wasn\'t provided.',
    action: {
      primary: 'Fill in the missing information',
      secondary: 'Check the workflow step configuration',
      steps: [
        {
          step: 1,
          description: 'Identify missing fields',
          action: 'Review the error message for specific missing fields',
          estimatedEffort: '1 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Add the missing information',
          action: 'Fill in the required field in the workflow step',
          estimatedEffort: '3 min',
          type: 'modify'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Required Fields', url: '/docs/required-fields' }
    ]
  },

  // =====================================================
  // SYSTEM ERRORS
  // =====================================================
  
  [ErrorCategory.SYSTEM_OVERLOAD]: {
    what: 'The system is busy',
    why: 'We\'re experiencing higher than normal demand.',
    action: {
      primary: 'Wait a moment and try again',
      secondary: 'The system will recover shortly',
      steps: [
        {
          step: 1,
          description: 'Wait and retry',
          action: 'Most overload situations resolve within a few minutes',
          estimatedEffort: '2-5 min',
          type: 'wait'
        }
      ]
    },
    retryAfter: 2 * 60 * 1000,
    helpLinks: [
      { text: 'Status Page', url: '/status' }
    ]
  },
  
  [ErrorCategory.SYSTEM_MAINTENANCE]: {
    what: 'Scheduled maintenance in progress',
    why: 'We\'re performing planned updates to improve the service.',
    action: {
      primary: 'Wait for maintenance to complete',
      secondary: 'Check back after the maintenance window',
      steps: [
        {
          step: 1,
          description: 'Check status page',
          action: 'Visit /status for maintenance updates',
          estimatedEffort: '1 min',
          type: 'verify'
        },
        {
          step: 2,
          description: 'Try again later',
          action: 'The system will be back online when maintenance completes',
          estimatedEffort: 'Variable',
          type: 'wait'
        }
      ]
    },
    retryAfter: 'end of maintenance window',
    helpLinks: [
      { text: 'Status Page', url: '/status' },
      { text: 'Maintenance Schedule', url: '/docs/maintenance' }
    ]
  },
  
  [ErrorCategory.SYSTEM_INTERNAL_ERROR]: {
    what: 'Something went wrong on our end',
    why: 'An unexpected error occurred while processing your request.',
    action: {
      primary: 'Try again in a few moments',
      secondary: 'Contact support if the issue persists',
      steps: [
        {
          step: 1,
          description: 'Retry the operation',
          action: 'The issue may be temporary - try again',
          estimatedEffort: '1 min',
          type: 'retry'
        },
        {
          step: 2,
          description: 'Contact support if persistent',
          action: 'Email support with the error details',
          estimatedEffort: '3 min',
          type: 'contact'
        }
      ]
    },
    retryAfter: 5 * 60 * 1000,
    helpLinks: [
      { text: 'Contact Support', url: '/support' }
    ]
  },

  // =====================================================
  // USER ACTIONS
  // =====================================================
  
  [ErrorCategory.USER_CANCELLED]: {
    what: 'The operation was cancelled',
    why: 'You or another user cancelled this action.',
    action: {
      primary: 'Start the operation again if needed',
      secondary: 'No action required',
      steps: [
        {
          step: 1,
          description: 'Restart if needed',
          action: 'Run the workflow or operation again',
          estimatedEffort: '1 min',
          type: 'retry'
        }
      ]
    },
    retryAfter: false,
    helpLinks: []
  },
  
  [ErrorCategory.USER_TIMEOUT]: {
    what: 'You took too long to respond',
    why: 'The system waited for input but didn\'t receive a response.',
    action: {
      primary: 'Complete the action again',
      secondary: 'Be ready to respond within the time limit',
      steps: [
        {
          step: 1,
          description: 'Retry the action',
          action: 'Start the workflow or operation again',
          estimatedEffort: '1 min',
          type: 'retry'
        },
        {
          step: 2,
          description: 'Respond faster',
          action: 'Complete required actions within the time limit',
          estimatedEffort: 'Variable',
          type: 'modify'
        }
      ]
    },
    retryAfter: false,
    helpLinks: [
      { text: 'Time Limits', url: '/docs/time-limits' }
    ]
  },

  // =====================================================
  // BOUNDARY VIOLATIONS
  // =====================================================
  
  [ErrorCategory.BOUNDARY_AUTO_THROTTLED]: {
    what: 'Your workflow was temporarily paused due to high frequency',
    why: 'You ran {count} workflows in {time}, exceeding the safety limit.',
    action: {
      primary: 'Wait for automatic reset',
      secondary: 'Upgrade for higher limits or reduce frequency',
      steps: [
        {
          step: 1,
          description: `Wait ${30} minutes`,
          action: 'No action needed - workflows will resume automatically',
          estimatedEffort: '30 min',
          type: 'wait'
        },
        {
          step: 2,
          description: 'Review your workflow frequency',
          action: 'Check if you can reduce execution frequency',
          estimatedEffort: '5 min',
          type: 'review'
        },
        {
          step: 3,
          description: 'Upgrade for higher limits',
          action: 'Navigate to /pricing to see plan options',
          estimatedEffort: '2 min',
          type: 'upgrade'
        }
      ]
    },
    retryAfter: 30 * 60 * 1000,
    boundaryStatus: {
      isThrottled: true,
      throttleDuration: 30 * 60 * 1000,
      autoPauseEnabled: true,
      autoDisableThreshold: 5
    },
    helpLinks: [
      { text: 'Rate Limits', url: '/docs/rate-limits' },
      { text: 'Upgrade Plan', url: '/pricing' }
    ]
  },
  
  [ErrorCategory.BOUNDARY_AUTO_PAUSED]: {
    what: 'Your workflow was automatically paused',
    why: 'This workflow failed {count} times in a row. We paused it to prevent further issues.',
    action: {
      primary: 'Fix the issue and manually resume',
      secondary: 'Contact support if you need help',
      steps: [
        {
          step: 1,
          description: 'Check recent execution logs',
          action: 'View the failed executions to understand what went wrong',
          estimatedEffort: '5 min',
          type: 'review'
        },
        {
          step: 2,
          description: 'Fix the underlying issue',
          action: 'Address the root cause of the failures',
          estimatedEffort: '10-30 min',
          type: 'fix'
        },
        {
          step: 3,
          description: 'Resume the workflow',
          action: 'Click "Resume" on the workflow page',
          estimatedEffort: '1 min',
          type: 'resume'
        }
      ]
    },
    retryAfter: false,
    boundaryStatus: {
      isPaused: true,
      failureCount: 5,
      requiresManualResume: true
    },
    helpLinks: [
      { text: 'Troubleshooting Guide', url: '/docs/troubleshooting' },
      { text: 'Contact Support', url: '/support' }
    ]
  },
  
  [ErrorCategory.BOUNDARY_AUTO_DISABLED]: {
    what: 'Your account was temporarily disabled',
    why: 'Due to repeated workflow failures, your account has been paused for safety.',
    action: {
      primary: 'Contact support to re-enable your account',
      secondary: 'Review and fix the underlying issues',
      steps: [
        {
          step: 1,
          description: 'Contact our support team',
          action: 'Email support with your account email',
          estimatedEffort: '2 min',
          type: 'contact'
        },
        {
          step: 2,
          description: 'Review failure patterns',
          action: 'Check your workflow execution history for common issues',
          estimatedEffort: '10 min',
          type: 'review'
        },
        {
          step: 3,
          description: 'Implement fixes',
          action: 'Address the root causes of the failures',
          estimatedEffort: '30 min',
          type: 'fix'
        }
      ]
    },
    retryAfter: false,
    boundaryStatus: {
      isDisabled: true,
      requiresSupport: true,
      estimatedRecoveryTime: '24 hours'
    },
    helpLinks: [
      { text: 'Contact Support', url: '/support' },
      { text: 'Best Practices', url: '/docs/best-practices' }
    ]
  },

  // =====================================================
  // LEGACY / UNKNOWN
  // =====================================================
  
  [ErrorCategory.UNKNOWN_ERROR]: {
    what: 'An unexpected error occurred',
    why: 'We couldn\'t determine the cause of this error.',
    action: {
      primary: 'Try again',
      secondary: 'Contact support if the issue persists',
      steps: [
        {
          step: 1,
          description: 'Retry the operation',
          action: 'Try the action again - it may work this time',
          estimatedEffort: '1 min',
          type: 'retry'
        },
        {
          step: 2,
          description: 'Contact support if persistent',
          action: 'Email support with the error details and resolution ID',
          estimatedEffort: '3 min',
          type: 'contact'
        }
      ]
    },
    retryAfter: 60 * 1000,
    helpLinks: [
      { text: 'Contact Support', url: '/support' }
    ]
  }
};

/**
 * Get resolution template for a category
 * @param {string} category - Error category
 * @returns {Object} Resolution template
 */
function getResolutionTemplate(category) {
  return ResolutionTemplates[category] || ResolutionTemplates[ErrorCategory.UNKNOWN_ERROR];
}

module.exports = {
  ResolutionTemplates,
  resolveTemplate,
  getResolutionTemplate
};
