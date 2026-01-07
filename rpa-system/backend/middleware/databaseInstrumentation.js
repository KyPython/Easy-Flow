/**
 * Database Instrumentation Wrapper for Supabase Operations
 * Provides automatic span creation for all database queries with trace context
 */

const { createClient } = require('@supabase/supabase-js');
const { getCurrentTraceContext, createContextLogger } = require('../middleware/traceContext');

// ✅ INSTRUCTION 1: Import OpenTelemetry for database span instrumentation
const { trace, SpanStatusCode, SpanKind } = require('@opentelemetry/api');

class InstrumentedSupabaseClient {
  constructor(supabaseUrl, supabaseKey, options = {}) {
    try {
      this.client = createClient(supabaseUrl, supabaseKey, options);

      // ✅ FIX: Validate that the client was created successfully
      if (!this.client) {
        throw new Error('Supabase client creation failed - client is null/undefined');
      }

    } catch (error) {
      // If client creation fails, create a null client
      this.client = null;
      // Logger not available yet, will log in next block
    }

    this.logger = createContextLogger('database.supabase');

    // ✅ Log initialization failure after logger is available
    if (!this.client) {
      this.logger.error('Failed to create Supabase client - client is null');
    }

    // ✅ INSTRUCTION 1: Get tracer for database operations
    this.tracer = trace.getTracer('database.supabase');

    // Log initialization status
    if (this.client) {
      this.logger.info('Instrumented Supabase client initialized', {
        has_rpc: typeof this.client.rpc === 'function',
        has_from: typeof this.client.from === 'function'
      });
    } else {
      this.logger.warn('Supabase client is null - operations will fail');
    }
  }

  /**
   * Create an instrumented table reference with automatic span tracking
   */
  from(tableName) {
    return new InstrumentedTable(this.client.from(tableName), tableName, this.logger);
  }

  /**
   * Direct client access for non-table operations
   */
  get auth() {
    return this.client.auth;
  }

  get storage() {
    return this.client.storage;
  }

  /**
   * ✅ INSTRUCTION 1: Instrumented RPC access with span creation
   * RPC calls work like: client.rpc('function_name', params)
   */
  rpc(functionName, params = {}) {
    // ✅ FIX: Check if the underlying client has rpc method before proceeding
    if (!this.client || typeof this.client.rpc !== 'function') {
      const error = new Error('Supabase client RPC method not available');
      this.logger.error('RPC method not available on client', {
        has_client: !!this.client,
        client_type: this.client ? typeof this.client : 'undefined',
        has_rpc: this.client && typeof this.client.rpc
      });
      return Promise.reject(error);
    }

    const tracer = this.tracer;
    const logger = this.logger;
    const originalRpc = this.client.rpc.bind(this.client);

    // Create span for RPC call
    return tracer.startActiveSpan(
      `supabase.rpc.${functionName}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'supabase_postgres',
          'db.operation': 'rpc',
          'db.name': 'supabase',
          'db.supabase.function': functionName,
          'db.supabase.has_params': Object.keys(params).length > 0
        }
      },
      async (span) => {
        const startTime = Date.now();

        try {
          logger.info(`RPC function call started: ${functionName}`, {
            database: {
              system: 'supabase_postgres',
              operation: 'rpc',
              function: functionName
            }
          });

          // Execute the RPC call
          const result = await originalRpc(functionName, params);
          const duration = Date.now() - startTime;

          span.setStatus({ code: SpanStatusCode.OK });
          span.setAttribute('db.supabase.duration_ms', duration);
          span.setAttribute('db.supabase.has_error', !!result.error);

          logger.info(`RPC function call completed: ${functionName}`, {
            database: {
              system: 'supabase_postgres',
              operation: 'rpc',
              function: functionName
            },
            performance: { duration }
          });

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message
          });
          span.setAttribute('db.supabase.duration_ms', duration);

          logger.error(`RPC function call failed: ${functionName}`, {
            database: {
              system: 'supabase_postgres',
              operation: 'rpc',
              function: functionName
            },
            error: {
              message: error.message,
              type: error.constructor.name
            },
            performance: { duration }
          });

          throw error;
        } finally {
          span.end();
        }
      }
    );
  }
}

class InstrumentedTable {
  constructor(table, tableName, logger) {
    this.table = table;
    this.tableName = tableName;
    this.logger = logger;
  }

  /**
   * Instrument SELECT operations
   */
  select(columns = '*') {
    return new InstrumentedQuery(
      this.table.select(columns),
      'SELECT',
      this.tableName,
      { columns: columns === '*' ? 'all' : columns },
      this.logger
    );
  }

  /**
   * Instrument INSERT operations
   */
  insert(data) {
    return this._executeOperation('INSERT', () => this.table.insert(data), {
      recordCount: Array.isArray(data) ? data.length : 1,
      hasData: !!data
    });
  }

  /**
   * Instrument UPDATE operations
   */
  update(data) {
    return new InstrumentedQuery(
      this.table.update(data),
      'UPDATE',
      this.tableName,
      { hasData: !!data },
      this.logger
    );
  }

  /**
   * Instrument DELETE operations
   */
  delete() {
    return new InstrumentedQuery(
      this.table.delete(),
      'DELETE',
      this.tableName,
      {},
      this.logger
    );
  }

  /**
   * Instrument UPSERT operations
   */
  upsert(data) {
    return this._executeOperation('UPSERT', () => this.table.upsert(data), {
      recordCount: Array.isArray(data) ? data.length : 1,
      hasData: !!data
    });
  }

  /**
   * ✅ INSTRUCTION 1: Execute database operation with OpenTelemetry span instrumentation
   * Creates proper spans with standard db.* semantic conventions
   */
  async _executeOperation(operation, queryFn, attributes = {}) {
    const startTime = Date.now();
    const traceContext = getCurrentTraceContext();

    // ✅ INSTRUCTION 1: Create OpenTelemetry span with standard db.* attributes
    const tracer = trace.getTracer('database.supabase');

    return await tracer.startActiveSpan(
      `supabase.${operation.toLowerCase()}.${this.tableName}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'supabase_postgres',
          'db.operation': operation,
          'db.name': 'supabase',
          'db.supabase.table': this.tableName,
          'db.supabase.record_count': attributes.recordCount || null,
          'db.supabase.has_data': attributes.hasData || false
        }
      },
      async (span) => {
        // Create span context for logging
        const spanContext = {
          operation,
          table: this.tableName,
          startTime: new Date().toISOString(),
          ...attributes
        };

        this.logger.info(`Database ${operation} started`, {
          span: spanContext,
          database: {
            system: 'supabase_postgres',
            name: 'supabase',
            table: this.tableName,
            operation
          }
        });

        try {
          const result = await queryFn();
          const duration = Date.now() - startTime;

          // ✅ Set span status and attributes on success
          span.setStatus({ code: SpanStatusCode.OK });
          span.setAttribute('db.supabase.duration_ms', duration);
          span.setAttribute('db.supabase.rows_affected', result?.data ? result.data.length : 0);
          span.setAttribute('db.supabase.has_error', !!result?.error);

          // Log successful operation
          this.logger.info(`Database ${operation} completed`, {
            span: { ...spanContext, duration, status: 'success' },
            database: {
              system: 'supabase_postgres',
              name: 'supabase',
              table: this.tableName,
              operation,
              rowsAffected: result?.data ? result.data.length : 0
            },
            performance: { duration }
          });

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          // ✅ Record exception and set error status
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message
          });
          span.setAttribute('db.supabase.duration_ms', duration);
          span.setAttribute('error', true);

          // Log failed operation
          this.logger.error(`Database ${operation} failed`, {
            span: { ...spanContext, duration, status: 'error' },
            database: {
              system: 'supabase_postgres',
              name: 'supabase',
              table: this.tableName,
              operation
            },
            error: {
              message: error.message,
              type: error.constructor.name
            },
            performance: { duration }
          });

          throw error;
        } finally {
          span.end();
        }
      }
    );
  }
}

class InstrumentedQuery {
  constructor(query, operation, tableName, attributes, logger) {
    this.query = query;
    this.operation = operation;
    this.tableName = tableName;
    this.attributes = attributes;
    this.logger = logger;
    this.filters = [];
  }

  /**
   * Add filter tracking for better observability
   */
  eq(column, value) {
    this.filters.push({ type: 'eq', column, value: typeof value });
    this.query = this.query.eq(column, value);
    return this;
  }

  neq(column, value) {
    this.filters.push({ type: 'neq', column, value: typeof value });
    this.query = this.query.neq(column, value);
    return this;
  }

  gt(column, value) {
    this.filters.push({ type: 'gt', column, value: typeof value });
    this.query = this.query.gt(column, value);
    return this;
  }

  gte(column, value) {
    this.filters.push({ type: 'gte', column, value: typeof value });
    this.query = this.query.gte(column, value);
    return this;
  }

  lt(column, value) {
    this.filters.push({ type: 'lt', column, value: typeof value });
    this.query = this.query.lt(column, value);
    return this;
  }

  lte(column, value) {
    this.filters.push({ type: 'lte', column, value: typeof value });
    this.query = this.query.lte(column, value);
    return this;
  }

  like(column, pattern) {
    this.filters.push({ type: 'like', column, pattern: 'string' });
    this.query = this.query.like(column, pattern);
    return this;
  }

  in(column, values) {
    this.filters.push({ type: 'in', column, count: Array.isArray(values) ? values.length : 1 });
    this.query = this.query.in(column, values);
    return this;
  }
  or(filters, options) {
    this.filters.push({ type: 'or', filters: 'string' });
    this.query = this.query.or(filters, options);
    return this;
  }
  order(column, options) {
    this.filters.push({ type: 'order', column, ...options });
    this.query = this.query.order(column, options);
    return this;
  }

  limit(count) {
    this.filters.push({ type: 'limit', count });
    this.query = this.query.limit(count);
    return this;
  }

  single() {
    this.filters.push({ type: 'single' });
    this.query = this.query.single();
    return this;
  }

  maybeSingle() {
    this.filters.push({ type: 'maybeSingle' });
    this.query = this.query.maybeSingle();
    return this;
  }

  /**
   * ✅ INSTRUCTION 1: Execute the query with OpenTelemetry span instrumentation
   * Creates spans with filter details and performance metrics
   */
  async execute() {
    const startTime = Date.now();
    const traceContext = getCurrentTraceContext();

    // ✅ INSTRUCTION 1: Create OpenTelemetry span for query execution
    const tracer = trace.getTracer('database.supabase');

    return await tracer.startActiveSpan(
      `supabase.query.${this.operation.toLowerCase()}.${this.tableName}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'supabase_postgres',
          'db.operation': this.operation,
          'db.name': 'supabase',
          'db.supabase.table': this.tableName,
          'db.supabase.filter_count': this.filters.length,
          'db.supabase.columns': this.attributes.columns || 'all'
        }
      },
      async (span) => {
        // Create comprehensive span context
        const spanContext = {
          operation: this.operation,
          table: this.tableName,
          startTime: new Date().toISOString(),
          filterCount: this.filters.length,
          ...this.attributes
        };

        // Log query start with filters (sanitized)
        this.logger.info(`Database ${this.operation} query started`, {
          span: spanContext,
          database: {
            system: 'supabase_postgres',
            name: 'supabase',
            table: this.tableName,
            operation: this.operation,
            filters: this.filters.map(f => ({
              type: f.type,
              column: f.column,
              // Don't log actual values for security
              hasValue: f.value !== undefined || f.pattern !== undefined || f.count !== undefined
            }))
          }
        });

        try {
          const result = await this.query;
          const duration = Date.now() - startTime;

          // ✅ Set span status and attributes on success
          span.setStatus({ code: SpanStatusCode.OK });
          span.setAttribute('db.supabase.duration_ms', duration);
          span.setAttribute('db.supabase.rows_returned', result?.data ? result.data.length : 0);
          span.setAttribute('db.supabase.has_error', !!result?.error);

          // Log successful query
          this.logger.info(`Database ${this.operation} query completed`, {
            span: { ...spanContext, duration, status: 'success' },
            database: {
              system: 'supabase_postgres',
              name: 'supabase',
              table: this.tableName,
              operation: this.operation,
              rowsReturned: result?.data ? result.data.length : 0,
              hasError: !!result?.error
            },
            performance: { duration }
          });

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          // ✅ Record exception and set error status
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message
          });
          span.setAttribute('db.supabase.duration_ms', duration);
          span.setAttribute('error', true);

          // Log failed query
          this.logger.error(`Database ${this.operation} query failed`, {
            span: { ...spanContext, duration, status: 'error' },
            database: {
              system: 'supabase_postgres',
              name: 'supabase',
              table: this.tableName,
              operation: this.operation
            },
            error: {
              message: error.message,
              type: error.constructor.name
            },
            performance: { duration }
          });

          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  // Alias for execute to match Supabase API
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.execute().catch(onRejected);
  }
}

/**
 * Factory function to create instrumented Supabase client
 */
function createInstrumentedSupabaseClient(url, key, options = {}) {
  return new InstrumentedSupabaseClient(url, key, options);
}

module.exports = {
  InstrumentedSupabaseClient,
  createInstrumentedSupabaseClient
};
