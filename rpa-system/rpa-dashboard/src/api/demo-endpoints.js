/**
 * Demo Booking and Email Capture API Endpoints
 * 
 * These are example implementations. Choose your preferred method:
 * 1. Save to Supabase (recommended for EasyFlow)
 * 2. Send to external service (Zapier, Make, etc.)
 * 3. Email directly to yourself
 * 4. Save to your existing database
 */

// Option 1: Supabase Integration (Recommended)
export const saveDemoRequestToSupabase = async (demoData) => {
  const { supabase } = require('../utils/supabaseClient');
  
  try {
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
    const response = await fetch(ZAPIER_WEBHOOK_URL, {
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
    const response = await fetch(ZAPIER_WEBHOOK_URL, {
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