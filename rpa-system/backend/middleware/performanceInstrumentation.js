/**
 * Performance Instrumentation Utility
 * Provides span creation for CPU-intensive operations
 */

const { getCurrentTraceContext, createContextLogger } = require('./traceContext');

class PerformanceSpan {
  constructor(operation, attributes = {}) {
    this.operation = operation;
    this.attributes = attributes;
    this.startTime = Date.now();
    this.traceContext = getCurrentTraceContext();
    this.logger = createContextLogger('performance');

    // Log span start
    this.logger.info(`Performance span started: ${operation}`, {
      span: {
        operation,
        startTime: new Date(this.startTime).toISOString(),
        ...attributes
      },
      performance: {
        spanType: 'custom',
        category: 'cpu_intensive'
      }
    });
  }

  /**
   * Add additional attributes during span lifecycle
   */
  addAttribute(key, value) {
    this.attributes[key] = value;
  }

  /**
   * Add multiple attributes at once
   */
  addAttributes(attributes) {
    Object.assign(this.attributes, attributes);
  }

  /**
   * Record an event during the span
   */
  addEvent(name, attributes = {}) {
    const eventTime = Date.now();
    this.logger.info(`Span event: ${name}`, {
      span: {
        operation: this.operation,
        event: name,
        eventTime: new Date(eventTime).toISOString(),
        elapsedMs: eventTime - this.startTime,
        ...attributes
      },
      performance: {
        spanType: 'event',
        parentOperation: this.operation
      }
    });
  }

  /**
   * End the span and log completion
   */
  end(result = {}) {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    this.logger.info(`Performance span completed: ${this.operation}`, {
      span: {
        operation: this.operation,
        duration,
        endTime: new Date(endTime).toISOString(),
        status: 'success',
        ...this.attributes,
        ...result
      },
      performance: {
        duration,
        spanType: 'custom',
        category: 'cpu_intensive'
      }
    });

    return { duration, ...result };
  }

  /**
   * End the span with an error
   */
  endWithError(error) {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    this.logger.error(`Performance span failed: ${this.operation}`, {
      span: {
        operation: this.operation,
        duration,
        endTime: new Date(endTime).toISOString(),
        status: 'error',
        ...this.attributes
      },
      error: {
        message: error.message,
        type: error.constructor.name
      },
      performance: {
        duration,
        spanType: 'custom',
        category: 'cpu_intensive'
      }
    });

    return { duration, error: error.message };
  }
}

/**
 * Decorator function to automatically instrument functions
 */
function instrument(operationName, options = {}) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      const span = new PerformanceSpan(operationName, {
        method: propertyKey,
        className: target.constructor.name,
        ...options
      });

      try {
        const result = await originalMethod.apply(this, args);
        span.end({ resultSize: JSON.stringify(result || {}).length });
        return result;
      } catch (error) {
        span.endWithError(error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Higher-order function to wrap any function with instrumentation
 */
function withPerformanceSpan(operationName, fn, attributes = {}) {
  return async function(...args) {
    const span = new PerformanceSpan(operationName, attributes);

    try {
      const result = await fn.apply(this, args);

      // Add result metrics if possible
      const resultMetrics = {};
      if (typeof result === 'object' && result !== null) {
        if (Array.isArray(result)) {
          resultMetrics.itemCount = result.length;
        } else {
          resultMetrics.fieldCount = Object.keys(result).length;
        }
      }

      span.end(resultMetrics);
      return result;
    } catch (error) {
      span.endWithError(error);
      throw error;
    }
  };
}

/**
 * Synchronous version for non-async operations
 */
function withPerformanceSpanSync(operationName, fn, attributes = {}) {
  return function(...args) {
    const span = new PerformanceSpan(operationName, attributes);

    try {
      const result = fn.apply(this, args);

      // Add result metrics
      const resultMetrics = {};
      if (typeof result === 'object' && result !== null) {
        if (Array.isArray(result)) {
          resultMetrics.itemCount = result.length;
        } else {
          resultMetrics.fieldCount = Object.keys(result).length;
        }
      }

      span.end(resultMetrics);
      return result;
    } catch (error) {
      span.endWithError(error);
      throw error;
    }
  };
}

/**
 * Utility for bulk operations with progress tracking
 */
class BulkOperationSpan {
  constructor(operation, totalItems, attributes = {}) {
    this.operation = operation;
    this.totalItems = totalItems;
    this.processedItems = 0;
    this.failedItems = 0;
    this.startTime = Date.now();
    this.attributes = attributes;
    this.logger = createContextLogger('performance.bulk');

    this.logger.info(`Bulk operation started: ${operation}`, {
      span: {
        operation,
        totalItems,
        startTime: new Date(this.startTime).toISOString(),
        ...attributes
      },
      performance: {
        spanType: 'bulk_operation',
        category: 'batch_processing'
      }
    });
  }

  /**
   * Record progress during bulk operation
   */
  recordProgress(processed, failed = 0) {
    this.processedItems = processed;
    this.failedItems = failed;

    const progress = Math.round((processed / this.totalItems) * 100);
    const elapsed = Date.now() - this.startTime;
    const rate = processed / (elapsed / 1000); // items per second

    this.logger.info(`Bulk operation progress: ${this.operation}`, {
      span: {
        operation: this.operation,
        progress: `${processed}/${this.totalItems}`,
        progressPercent: progress,
        failedItems: failed,
        elapsedMs: elapsed,
        processingRate: rate
      },
      performance: {
        spanType: 'bulk_progress',
        category: 'batch_processing'
      }
    });
  }

  /**
   * End bulk operation
   */
  end() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    const successRate = ((this.processedItems - this.failedItems) / this.processedItems) * 100;

    this.logger.info(`Bulk operation completed: ${this.operation}`, {
      span: {
        operation: this.operation,
        duration,
        totalItems: this.totalItems,
        processedItems: this.processedItems,
        failedItems: this.failedItems,
        successRate: Math.round(successRate),
        avgTimePerItem: duration / this.processedItems,
        endTime: new Date(endTime).toISOString(),
        status: 'success'
      },
      performance: {
        duration,
        spanType: 'bulk_operation',
        category: 'batch_processing'
      }
    });

    return {
      duration,
      totalItems: this.totalItems,
      processedItems: this.processedItems,
      failedItems: this.failedItems,
      successRate
    };
  }
}

module.exports = {
  PerformanceSpan,
  instrument,
  withPerformanceSpan,
  withPerformanceSpanSync,
  BulkOperationSpan
};
