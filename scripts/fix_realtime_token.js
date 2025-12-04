// Fix realtime token issue
// Copy and paste this into browser console

(async function fixRealtimeToken() {
  console.log('�� Attempting to fix realtime token...\n');
  
  const client = window._supabase;
  if (!client) {
    console.error('❌ Supabase client not found');
    return;
  }
  
  try {
    // Get current session
    const { data, error } = await client.auth.getSession();
    
    if (error) {
      console.error('❌ Error getting session:', error.message);
      console.log('\n💡 Solution: Sign out and back in');
      return;
    }
    
    if (!data?.session) {
      console.error('❌ No active session found');
      console.log('\n💡 Solution: Please sign in first');
      return;
    }
    
    const token = data.session.access_token;
    console.log('✅ Found session token');
    
    // Set the token on realtime
    if (client.realtime && typeof client.realtime.setAuth === 'function') {
      client.realtime.setAuth(token);
      console.log('✅ Token set on realtime connection');
    } else {
      console.warn('⚠️  Realtime.setAuth not available');
    }
    
    // Store in localStorage for persistence
    const storageKey = 'sb-auth-token';
    const currentStorage = localStorage.getItem(storageKey);
    
    if (currentStorage) {
      console.log('✅ Token already in localStorage');
    } else {
      localStorage.setItem(storageKey, JSON.stringify({
        access_token: token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }));
      console.log('✅ Token saved to localStorage');
    }
    
    console.log('\n🎉 Fix complete! Refreshing page to reconnect channels...');
    setTimeout(() => window.location.reload(), 2000);
    
  } catch (e) {
    console.error('❌ Fix failed:', e.message);
    console.log('\n💡 Try signing out and back in manually');
  }
})();
