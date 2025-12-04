// Quick diagnostic script to check realtime status
// Run this in browser console

(async function diagnose() {
  console.log('=== REALTIME DIAGNOSTICS ===\n');
  
  // 1. Check if supabase client exists
  const client = window._supabase;
  if (!client) {
    console.error('❌ Supabase client not found on window._supabase');
    return;
  }
  console.log('✅ Supabase client found');
  
  // 2. Check authentication
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.error('❌ Session error:', error.message);
    } else if (data?.session) {
      console.log('✅ Active session found');
      console.log('   User ID:', data.session.user.id);
      console.log('   Token expires:', new Date(data.session.expires_at * 1000).toISOString());
      
      // Check if token is expired
      const now = Date.now() / 1000;
      if (data.session.expires_at < now) {
        console.warn('⚠️  Token is EXPIRED');
      } else {
        const ttl = Math.round((data.session.expires_at - now) / 60);
        console.log(`   Token valid for ${ttl} more minutes`);
      }
    } else {
      console.error('❌ No active session');
    }
  } catch (e) {
    console.error('❌ Error checking session:', e.message);
  }
  
  // 3. Check realtime connection
  const realtime = client.realtime;
  if (!realtime) {
    console.error('❌ Realtime not available');
    return;
  }
  console.log('✅ Realtime object exists');
  
  // 4. Check realtime auth token
  const realtimeToken = realtime._accessToken || realtime.accessToken;
  if (realtimeToken) {
    console.log('✅ Realtime has auth token set');
  } else {
    console.warn('⚠️  Realtime auth token MISSING');
    console.log('   Attempting to set token...');
    try {
      const { data } = await client.auth.getSession();
      if (data?.session?.access_token) {
        client.realtime.setAuth(data.session.access_token);
        console.log('✅ Token set successfully');
      }
    } catch (e) {
      console.error('❌ Failed to set token:', e.message);
    }
  }
  
  // 5. Check active channels
  const channels = Object.keys(realtime.channels || {});
  console.log(`\n📡 Active channels (${channels.length}):`);
  
  if (channels.length === 0) {
    console.warn('⚠️  No channels subscribed');
  } else {
    channels.forEach(channelName => {
      const channel = realtime.channels[channelName];
      const state = channel?.state || 'unknown';
      const stateEmoji = state === 'joined' ? '✅' : state === 'joining' ? '🔄' : '❌';
      console.log(`   ${stateEmoji} ${channelName}: ${state}`);
    });
  }
  
  // 6. Check environment variables
  console.log('\n🔧 Environment:');
  const url = client.supabaseUrl;
  const hasKey = !!client.supabaseKey;
  console.log('   URL:', url);
  console.log('   Has Key:', hasKey);
  
  console.log('\n=== END DIAGNOSTICS ===');
  console.log('\nTo fix common issues, try:');
  console.log('1. If no session: Sign out and back in');
  console.log('2. If token missing: Run fix script');
  console.log('3. If channels not joined: Check browser console for errors');
})();
