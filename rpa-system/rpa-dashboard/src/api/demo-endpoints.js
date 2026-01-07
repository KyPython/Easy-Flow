/**
 * Demo Booking and Email Capture API Endpoints
 * 
 * These are example implementations. Choose your preferred method:
 * 1. Save to Supabase (recommended for EasyFlow)
 * 2. Send to external service (Zapier, Make, etc.)
 * 3. Email directly to yourself
 * 4. Save to your existing database
 */

// OpenTelemetry is optional for trace propagation. Use dynamic import to avoid
// pulling the OTEL packages into the main bundle at module-eval time.

/**
 * ✅ INSTRUCTION 3: Helper function to inject trace context into fetch/axios headers
 * This should be called before every API request to propagate frontend trace context
 */
const getTraceHeaders = () => {
  const headers = {};
  
  try {
    // Attempt to load OpenTelemetry API dynamically. If not present or not
    // initialized, this will silently fall back.
    const opentelemetry = await import('@opentelemetry/api').catch(() => null);
    if (!opentelemetry) return headers;

    // Get active context (if OpenTelemetry is initialized in the frontend)
    const { context, propagation, trace } = opentelemetry;
    const activeContext = context.active();
    const carrier = {};

    // Inject trace context into carrier
    propagation.inject(activeContext, carrier);
    
    // Add trace headers if they exist
    if (carrier.traceparent) {
      headers['traceparent'] = carrier.traceparent;
    }
    if (carrier.tracestate) {
      headers['tracestate'] = carrier.tracestate;
    }
    
    // Also get current span context if available
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      headers['x-trace-id'] = spanContext.traceId;
      headers['x-span-id'] = spanContext.spanId;
    }
  } catch (err) {
    // Silently fail if OpenTelemetry is not initialized
    console.warn('Trace context injection failed:', err.message);
  }
  
  return headers;
};

/**
 * ✅ INSTRUCTION 3: Enhanced fetch wrapper that automatically injects trace context
 * Use this instead of raw fetch() for all API calls
 */
const tracedFetch = async (url, options = {}) => {
  // Inject trace headers into request
  const traceHeaders = getTraceHeaders();
  
  const enhancedOptions = {
    ...options,
    headers: {
      ...options.headers,
      ...traceHeaders
    }
  };

  // Ensure cookies are included for same-site auth flows by default
  if (!('credentials' in enhancedOptions)) {
    enhancedOptions.credentials = 'include';
  }
  
  // Log trace injection for debugging
  if (process.env.NODE_ENV !== 'production' && traceHeaders.traceparent) {
    console.log(`[API] Injecting trace context: ${traceHeaders.traceparent}`);
  }

  // Use a safe fetch reference -- support SSR/tests where fetch may be polyfilled or missing
  const fnFetch = (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function')
    ? globalThis.fetch.bind(globalThis)
    : (typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : null);

  if (!fnFetch) {
    console.warn('[API] fetch() not available in this environment -- request aborted');
    return Promise.reject(new Error('fetch not available in this environment'));
  }

  return fnFetch(url, enhancedOptions);
};

// Option 1: Supabase Integration (Recommended)
export const saveDemoRequestToSupabase = async (demoData) => {
  const { supabase } = require('../utils/supabaseClient');
  
  try {
    // ✅ Note: Supabase client requests should also be instrumented
    // This may require configuring Supabase to use a custom fetch implementation
    const { data, error } = await supabase
      .from('demo_requests') // Create this table in Supabase
      .insert([{
        name: demoData.name,
        email: demoData.email,
        company: demoData.company,
        message: demoData.message,
        preferred_time: demoData.preferredTime,
        source: demoData.source,
        user_plan: demoData.userPlan,
        created_at: new Date().toISOString()
      }]);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Supabase demo request error:', error);
    return { success: false, error: error.message };
  }
};

export const saveEmailCaptureToSupabase = async (emailData) => {
  const { supabase } = require('../utils/supabaseClient');
  
  try {
    const { data, error } = await supabase
      .from('email_captures') // Create this table in Supabase
      .insert([{
        email: emailData.email,
        source: emailData.source,
        session_count: emailData.sessionCount,
        user_plan: emailData.userPlan,
        created_at: new Date().toISOString()
      }]);

    if (error) {
      // Check if email already exists
      if (error.code === '23505') { // Unique constraint violation
        return { success: false, error: 'Email already exists', code: 409 };
      }
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Supabase email capture error:', error);
    return { success: false, error: error.message };
  }
};

// Option 2: Zapier Webhook Integration
export const sendDemoRequestToZapier = async (demoData) => {
  const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/YOUR_HOOK_ID/';
  
  try {
    // ✅ INSTRUCTION 3: Use tracedFetch for automatic trace propagation
    const response = await tracedFetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'demo_request',
        ...demoData,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) throw new Error('Zapier webhook failed');
    
    return { success: true };
  } catch (error) {
    console.error('Zapier demo request error:', error);
    return { success: false, error: error.message };
  }
};

export const sendEmailCaptureToZapier = async (emailData) => {
  const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/YOUR_HOOK_ID/';
  
  try {
    // ✅ INSTRUCTION 3: Use tracedFetch for automatic trace propagation
    const response = await tracedFetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'email_capture',
        ...emailData,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) throw new Error('Zapier webhook failed');
    
    return { success: true };
  } catch (error) {
    console.error('Zapier email capture error:', error);
    return { success: false, error: error.message };
  }
};

// Main handler functions (choose your preferred method)
export const handleDemoRequest = async (demoData) => {
  // Method 1: Supabase (recommended)
  return await saveDemoRequestToSupabase(demoData);
  
  // Method 2: Zapier
  // return await sendDemoRequestToZapier(demoData);
  
  // Method 4: LocalStorage backup for testing
  // return saveToLocalStorage('demo_requests', demoData);
};

export const handleEmailCapture = async (emailData) => {
  // Method 1: Supabase (recommended)
  return await saveEmailCaptureToSupabase(emailData);
  
  // Method 2: Zapier  
  // return await sendEmailCaptureToZapier(emailData);
};