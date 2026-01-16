/**
 * Natural Language Cron Parser
 *
 * Translates human-readable schedule descriptions into cron expressions.
 * Enables the AI agent to understand "every 15 mins" -> cron expression
 *
 * Examples:
 * - "every 15 mins" -> converts to cron expression for every 15 minutes
 * - "every hour" -> converts to cron expression for hourly
 * - "daily at 9am" -> converts to cron expression for daily at 9am
 * - "weekly on Monday at 8am" -> converts to cron expression for weekly on Monday
 */

const logger = require('./logger').logger || console;

/**
 * Parse natural language schedule into cron expression
 * @param {string} naturalLanguage - Human-readable schedule description
 * @param {Object} options - Additional options (timezone, defaultTime)
 * @returns {Object} - { cronExpression, description, isValid }
 */
function parseNaturalLanguageCron(naturalLanguage, options = {}) {
  if (!naturalLanguage || typeof naturalLanguage !== 'string') {
    return { cronExpression: null, description: null, isValid: false, error: 'Invalid input' };
  }

  const input = naturalLanguage.toLowerCase().trim();
  const { timezone = 'UTC', defaultTime = '09:00' } = options;

  try {
    // Pattern 1: "every X minutes/mins/min"
    const everyMinutesMatch = input.match(/every\s+(\d+)\s*(?:minutes?|mins?|min)\s*/i);
    if (everyMinutesMatch) {
      const minutes = parseInt(everyMinutesMatch[1], 10);
      if (minutes < 1 || minutes > 59) {
        return { cronExpression: null, description: null, isValid: false, error: `Invalid minutes: ${minutes} (must be 1-59)` };
      }
      return {
        cronExpression: `*/${minutes} * * * *`,
        description: `Every ${minutes} minute${minutes !== 1 ? 's' : ''}`,
        isValid: true,
        scheduleType: 'interval_minutes',
        intervalMinutes: minutes
      };
    }

    // Pattern 2: "every hour/hours"
    if (input.match(/every\s+(?:1\s+)?hours?/i)) {
      return {
        cronExpression: '0 * * * *',
        description: 'Every hour',
        isValid: true,
        scheduleType: 'hourly'
      };
    }

    // Pattern 3: "every X hours"
    const everyHoursMatch = input.match(/every\s+(\d+)\s+hours?/i);
    if (everyHoursMatch) {
      const hours = parseInt(everyHoursMatch[1], 10);
      if (hours < 1 || hours > 23) {
        return { cronExpression: null, description: null, isValid: false, error: `Invalid hours: ${hours} (must be 1-23)` };
      }
      return {
        cronExpression: `0 */${hours} * * *`,
        description: `Every ${hours} hour${hours !== 1 ? 's' : ''}`,
        isValid: true,
        scheduleType: 'interval_hours',
        intervalHours: hours
      };
    }

    // Pattern 4: "daily/daily at X" or "every day/every day at X"
    const dailyMatch = input.match(/(?:daily|every\s+day)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
    if (dailyMatch) {
      let hour = 9; // Default 9 AM
      let minute = 0;

      if (dailyMatch[1]) {
        hour = parseInt(dailyMatch[1], 10);
        minute = dailyMatch[2] ? parseInt(dailyMatch[2], 10) : 0;

        // Handle AM/PM
        if (dailyMatch[3]) {
          const ampm = dailyMatch[3].toLowerCase();
          if (ampm === 'pm' && hour !== 12) hour += 12;
          if (ampm === 'am' && hour === 12) hour = 0;
        }

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
          return { cronExpression: null, description: null, isValid: false, error: 'Invalid time' };
        }
      } else {
        // Use defaultTime if provided
        const defaultMatch = defaultTime.match(/(\d{1,2}):(\d{2})/);
        if (defaultMatch) {
          hour = parseInt(defaultMatch[1], 10);
          minute = parseInt(defaultMatch[2], 10);
        }
      }

      return {
        cronExpression: `${minute} ${hour} * * *`,
        description: `Daily at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        isValid: true,
        scheduleType: 'daily',
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      };
    }

    // Pattern 5: "weekly/every week on DAY at TIME"
    const weeklyMatch = input.match(/(?:weekly|every\s+week)(?:\s+on\s+(\w+))?(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
    if (weeklyMatch) {
      const dayName = weeklyMatch[1] || 'monday';
      const dayNumber = parseDayOfWeek(dayName);

      if (dayNumber === null) {
        return { cronExpression: null, description: null, isValid: false, error: `Invalid day: ${dayName}` };
      }

      let hour = 9;
      let minute = 0;

      if (weeklyMatch[2]) {
        hour = parseInt(weeklyMatch[2], 10);
        minute = weeklyMatch[3] ? parseInt(weeklyMatch[3], 10) : 0;

        if (weeklyMatch[4]) {
          const ampm = weeklyMatch[4].toLowerCase();
          if (ampm === 'pm' && hour !== 12) hour += 12;
          if (ampm === 'am' && hour === 12) hour = 0;
        }

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
          return { cronExpression: null, description: null, isValid: false, error: 'Invalid time' };
        }
      }

      return {
        cronExpression: `${minute} ${hour} * * ${dayNumber}`,
        description: `Weekly on ${dayName} at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        isValid: true,
        scheduleType: 'weekly',
        dayOfWeek: dayNumber,
        dayName: dayName,
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      };
    }

    // Pattern 6: "monthly/every month on DAY at TIME"
    const monthlyMatch = input.match(/(?:monthly|every\s+month)(?:\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?)?(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
    if (monthlyMatch) {
      const dayOfMonth = monthlyMatch[1] ? parseInt(monthlyMatch[1], 10) : 1;

      if (dayOfMonth < 1 || dayOfMonth > 31) {
        return { cronExpression: null, description: null, isValid: false, error: `Invalid day of month: ${dayOfMonth}` };
      }

      let hour = 9;
      let minute = 0;

      if (monthlyMatch[2]) {
        hour = parseInt(monthlyMatch[2], 10);
        minute = monthlyMatch[3] ? parseInt(monthlyMatch[3], 10) : 0;

        if (monthlyMatch[4]) {
          const ampm = monthlyMatch[4].toLowerCase();
          if (ampm === 'pm' && hour !== 12) hour += 12;
          if (ampm === 'am' && hour === 12) hour = 0;
        }

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
          return { cronExpression: null, description: null, isValid: false, error: 'Invalid time' };
        }
      }

      return {
        cronExpression: `${minute} ${hour} ${dayOfMonth} * *`,
        description: `Monthly on day ${dayOfMonth} at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        isValid: true,
        scheduleType: 'monthly',
        dayOfMonth: dayOfMonth,
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      };
    }

    // Pattern 7: Already a cron expression? Validate it
    const cron = require('node-cron');
    if (cron.validate(input)) {
      return {
        cronExpression: input,
        description: `Custom cron: ${input}`,
        isValid: true,
        scheduleType: 'cron'
      };
    }

    // No match found
    return {
      cronExpression: null,
      description: null,
      isValid: false,
      error: `Could not parse schedule: "${naturalLanguage}". Supported formats: "every X mins", "every hour", "daily at 9am", "weekly on Monday at 8am", "monthly on the 1st at 9am", or cron expression.`
    };

  } catch (error) {
    logger.error('[CronParser] Error parsing natural language cron', { error: error.message, input: naturalLanguage });
    return {
      cronExpression: null,
      description: null,
      isValid: false,
      error: error.message
    };
  }
}

/**
 * Parse day of week name to cron day number (0 = Sunday, 1 = Monday, etc.)
 * @param {string} dayName - Day name (monday, tuesday, etc.)
 * @returns {number|null} - Cron day number or null if invalid
 */
function parseDayOfWeek(dayName) {
  const days = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'tues': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6
  };

  const normalized = dayName.toLowerCase().trim();
  return days[normalized] !== undefined ? days[normalized] : null;
}

/**
 * Validate cron expression
 * @param {string} cronExpression - Cron expression to validate
 * @returns {boolean} - True if valid
 */
function validateCronExpression(cronExpression) {
  try {
    const cron = require('node-cron');
    return cron.validate(cronExpression);
  } catch (error) {
    return false;
  }
}

module.exports = {
  parseNaturalLanguageCron,
  parseDayOfWeek,
  validateCronExpression
};
