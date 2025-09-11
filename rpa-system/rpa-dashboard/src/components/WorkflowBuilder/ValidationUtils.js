// Validation utilities for workflow forms

export const validators = {
  required: (value, message = 'This field is required') => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return message;
    }
    return null;
  },

  email: (value, message = 'Please enter a valid email address') => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return message;
    }
    return null;
  },

  url: (value, message = 'Please enter a valid URL') => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return message;
    }
  },

  minLength: (min, message) => (value) => {
    if (!value) return null;
    if (value.length < min) {
      return message || `Must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (max, message) => (value) => {
    if (!value) return null;
    if (value.length > max) {
      return message || `Must be no more than ${max} characters`;
    }
    return null;
  },

  number: (value, message = 'Please enter a valid number') => {
    if (!value) return null;
    if (isNaN(value)) {
      return message;
    }
    return null;
  },

  min: (min, message) => (value) => {
    if (!value) return null;
    const num = parseFloat(value);
    if (isNaN(num) || num < min) {
      return message || `Must be at least ${min}`;
    }
    return null;
  },

  max: (max, message) => (value) => {
    if (!value) return null;
    const num = parseFloat(value);
    if (isNaN(num) || num > max) {
      return message || `Must be no more than ${max}`;
    }
    return null;
  },

  cronExpression: (value, message = 'Please enter a valid cron expression') => {
    if (!value) return null;
    
    // Basic cron validation (5 or 6 parts)
    const parts = value.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      return message;
    }
    
    // Check for valid characters
    const cronRegex = /^[0-9\*\-\,\/\?LW#]+$/;
    for (const part of parts) {
      if (!cronRegex.test(part)) {
        return message;
      }
    }
    
    return null;
  },

  json: (value, message = 'Please enter valid JSON') => {
    if (!value) return null;
    try {
      JSON.parse(value);
      return null;
    } catch {
      return message;
    }
  },

  arrayNotEmpty: (value, message = 'At least one item is required') => {
    if (!Array.isArray(value) || value.length === 0) {
      return message;
    }
    return null;
  }
};

// Compose multiple validators
export const compose = (...validators) => (value) => {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
};

// Validate an object against a schema
export const validateObject = (obj, schema) => {
  const errors = {};
  
  for (const [field, validator] of Object.entries(schema)) {
    const value = obj[field];
    const error = validator(value);
    if (error) {
      errors[field] = error;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Common validation schemas
export const schemas = {
  schedule: {
    name: compose(
      validators.required('Schedule name is required'),
      validators.minLength(3, 'Schedule name must be at least 3 characters'),
      validators.maxLength(100, 'Schedule name must be less than 100 characters')
    ),
    cronExpression: (value, data) => {
      if (data.scheduleType === 'cron') {
        return compose(
          validators.required('Cron expression is required'),
          validators.cronExpression()
        )(value);
      }
      return null;
    },
    intervalSeconds: (value, data) => {
      if (data.scheduleType === 'interval') {
        return compose(
          validators.required('Interval is required'),
          validators.number(),
          validators.min(60, 'Interval must be at least 60 seconds')
        )(value);
      }
      return null;
    },
    maxExecutions: (value) => {
      if (value) {
        return compose(
          validators.number(),
          validators.min(1, 'Must be at least 1')
        )(value);
      }
      return null;
    }
  },

  stepConfig: {
    url: (value, data) => {
      if (['web_scrape', 'api_call'].includes(data.stepType)) {
        return compose(
          validators.required('URL is required'),
          validators.url()
        )(value);
      }
      return null;
    },
    method: (value, data) => {
      if (data.stepType === 'api_call') {
        return validators.required('HTTP method is required')(value);
      }
      return null;
    },
    to: (value, data) => {
      if (data.stepType === 'email') {
        if (!Array.isArray(value) || value.length === 0) {
          return 'At least one recipient is required';
        }
        for (const email of value) {
          const emailError = validators.email(email);
          if (emailError) return `Invalid email: ${email}`;
        }
      }
      return null;
    },
    subject: (value, data) => {
      if (data.stepType === 'email') {
        return validators.required('Subject is required')(value);
      }
      return null;
    },
    durationSeconds: (value, data) => {
      if (data.stepType === 'delay') {
        return compose(
          validators.required('Duration is required'),
          validators.number(),
          validators.min(1, 'Duration must be at least 1 second'),
          validators.max(3600, 'Duration must be less than 1 hour')
        )(value);
      }
      return null;
    }
  },

  workflow: {
    name: compose(
      validators.required('Workflow name is required'),
      validators.minLength(3, 'Workflow name must be at least 3 characters'),
      validators.maxLength(100, 'Workflow name must be less than 100 characters')
    ),
    description: validators.maxLength(500, 'Description must be less than 500 characters')
  }
};

// Hook for form validation
export const useFormValidation = (initialValues, schema) => {
  const [values, setValues] = React.useState(initialValues);
  const [errors, setErrors] = React.useState({});
  const [touched, setTouched] = React.useState({});

  const validate = React.useCallback((fieldName, value) => {
    if (schema[fieldName]) {
      const error = schema[fieldName](value, values);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error
      }));
      return error;
    }
    return null;
  }, [schema, values]);

  const validateAll = React.useCallback(() => {
    const newErrors = {};
    let isValid = true;

    for (const [fieldName, validator] of Object.entries(schema)) {
      const error = validator(values[fieldName], values);
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [schema, values]);

  const setValue = React.useCallback((fieldName, value) => {
    setValues(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Validate field if it has been touched
    if (touched[fieldName]) {
      validate(fieldName, value);
    }
  }, [touched, validate]);

  const setTouched = React.useCallback((fieldName) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));
    validate(fieldName, values[fieldName]);
  }, [validate, values]);

  const reset = React.useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    setValue,
    setTouched,
    validate,
    validateAll,
    reset,
    isValid: Object.keys(errors).length === 0
  };
};