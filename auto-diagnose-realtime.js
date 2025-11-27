// ============================================
// AUTOMATIC SUPABASE REALTIME DIAGNOSTIC
// ============================================
// Paste this entire script into your browser console
// It will automatically run all diagnostics and output a complete report

(async () => {
  console.clear();
  console.log('%c🔍 SUPABASE REALTIME DIAGNOSTIC', 'font-size: 16px; font-weight: bold; color: #00ff00;');
  console.log('='.repeat(60));

  const report = {
    timestamp: new Date().toISOString(),
    summary: { passed: 0, failed: 0, warnings: 0 },
    sections: []
  };

  function addSection(name, status, data, message) {
    const section = { name, status, data, message };
    report.sections.push(section);

    if (status === 'PASS') report.summary.passed++;
    else if (status === 'FAIL') report.summary.failed++;
    else if (status === 'WARN') report.summary.warnings++;

    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️ ';
    console.log(`\n${emoji} ${name}`);
    if (message) console.log(`   ${message}`);
    if (data) console.log('   Data:', data);
  }

  // ============================================
  // 1. Check Supabase Client
  // ============================================
  try {
    if (!window._supabase) {
      addSection('Supabase Client', 'FAIL', null, 'window._supabase not found');
      console.log('\n📊 DIAGNOSTIC COMPLETE - See report above');
      return report;
    }
    addSection('Supabase Client', 'PASS', null, 'Client initialized');
  } catch (e) {
    addSection('Supabase Client', 'FAIL', { error: e.message });
    return report;
  }

  // ============================================
  // 2. Check Session & JWT
  // ============================================
  let session, jwtPayload, userId;
  try {
    const { data: { session: s } } = await window._supabase.auth.getSession();
    session = s;

    if (!session || !session.access_token) {
      addSection('Session & JWT', 'FAIL', null, 'No active session found');
      console.log('\n📊 DIAGNOSTIC COMPLETE - See report above');
      return report;
    }

    const token = session.access_token;
    jwtPayload = JSON.parse(atob(token.split('.')[1]));
    userId = session.user.id;

    const jwtUserId = jwtPayload.sub;
    const now = Date.now();
    const expiresAt = jwtPayload.exp * 1000;
    const minutesRemaining = Math.floor((expiresAt - now) / 60000);
    const isExpired = now > expiresAt;
    const userIdsMatch = jwtUserId === userId;

    const status = (isExpired || !userIdsMatch) ? 'FAIL' : 'PASS';
    let message = '';
    if (isExpired) message += 'JWT IS EXPIRED! ';
    if (!userIdsMatch) message += 'JWT sub does not match session user ID! ';
    if (status === 'PASS') message = `Valid JWT, expires in ${minutesRemaining} minutes`;

    addSection('Session & JWT', status, {
      userId,
      jwtUserId,
      userIdsMatch,
      role: jwtPayload.role,
      expiresAt: new Date(expiresAt).toLocaleString(),
      minutesRemaining,
      isExpired
    }, message);
  } catch (e) {
    addSection('Session & JWT', 'FAIL', { error: e.message });
    return report;
  }

  // ============================================
  // 3. Check Realtime Connection
  // ============================================
  try {
    const realtime = window._supabase.realtime;

    if (!realtime) {
      addSection('Realtime Connection', 'FAIL', null, 'Realtime not initialized');
    } else {
      const connectionState = realtime.connectionState?.() || 'unknown';
      const channels = realtime.channels || [];

      const channelDetails = channels.map(ch => ({
        topic: ch.topic,
        state: ch.state,
        joinRef: ch.joinRef,
        // Check for postgres_changes bindings
        hasPostgresBindings: ch.bindings && Object.keys(ch.bindings).some(k => k.includes('postgres_changes'))
      }));

      const status = channels.length > 0 ? 'PASS' : 'WARN';
      const message = channels.length > 0
        ? `${channels.length} channel(s) created`
        : 'No channels created yet';

      addSection('Realtime Connection', status, {
        connectionState,
        channelCount: channels.length,
        channels: channelDetails
      }, message);
    }
  } catch (e) {
    addSection('Realtime Connection', 'FAIL', { error: e.message });
  }

  // ============================================
  // 4. Test Database Access with Current Auth
  // ============================================
  try {
    console.log('\n🔍 Testing database access with current JWT...');

    // Test profiles table (should have RLS for own profile)
    const { data: profileData, error: profileError } = await window._supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      addSection('Database Access (profiles)', 'FAIL', {
        error: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint
      }, 'Query failed - RLS may be blocking');
    } else {
      const status = profileData ? 'PASS' : 'WARN';
      const message = profileData
        ? 'Profile found - RLS working correctly'
        : 'No profile found for current user';
      addSection('Database Access (profiles)', status, { profileFound: !!profileData }, message);
    }

    // Test usage_tracking table
    const { data: usageData, error: usageError } = await window._supabase
      .from('usage_tracking')
      .select('id, user_id')
      .eq('user_id', userId)
      .limit(1);

    if (usageError) {
      addSection('Database Access (usage_tracking)', 'FAIL', {
        error: usageError.code,
        message: usageError.message
      }, 'Query failed - RLS may be blocking');
    } else {
      const status = usageData && usageData.length > 0 ? 'PASS' : 'WARN';
      const message = usageData && usageData.length > 0
        ? 'Usage records found - RLS working'
        : 'No usage records (may be expected for new user)';
      addSection('Database Access (usage_tracking)', status, {
        recordCount: usageData?.length || 0
      }, message);
    }
  } catch (e) {
    addSection('Database Access', 'FAIL', { error: e.message });
  }

  // ============================================
  // 5. Check for Common Issues
  // ============================================
  try {
    const issues = [];

    // Check if JWT is close to expiring
    if (jwtPayload) {
      const minutesRemaining = Math.floor((jwtPayload.exp * 1000 - Date.now()) / 60000);
      if (minutesRemaining < 5) {
        issues.push(`JWT expires in ${minutesRemaining} minutes - may cause issues soon`);
      }
    }

    // Check if auth token was set on realtime
    const realtime = window._supabase.realtime;
    if (realtime && realtime.accessToken) {
      const rtTokenPayload = JSON.parse(atob(realtime.accessToken.split('.')[1]));
      const rtUserId = rtTokenPayload.sub;
      if (rtUserId !== userId) {
        issues.push('Realtime connection token user ID does not match session user ID!');
      }
    }

    if (issues.length > 0) {
      addSection('Common Issues Check', 'WARN', { issues }, `Found ${issues.length} potential issue(s)`);
    } else {
      addSection('Common Issues Check', 'PASS', null, 'No common issues detected');
    }
  } catch (e) {
    addSection('Common Issues Check', 'FAIL', { error: e.message });
  }

  // ============================================
  // 6. Generate Report Summary
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${report.summary.passed}`);
  console.log(`❌ Failed: ${report.summary.failed}`);
  console.log(`⚠️  Warnings: ${report.summary.warnings}`);

  if (report.summary.failed > 0) {
    console.log('\n❌ CRITICAL ISSUES FOUND:');
    report.sections.filter(s => s.status === 'FAIL').forEach(s => {
      console.log(`   - ${s.name}: ${s.message || JSON.stringify(s.data)}`);
    });
  }

  // ============================================
  // 7. Next Steps Guidance
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('💡 NEXT STEPS');
  console.log('='.repeat(60));

  if (report.summary.failed === 0) {
    console.log('✅ All critical checks passed!');
    console.log('\n🔍 To diagnose the "mismatch" error, check WebSocket frames:');
    console.log('   1. DevTools → Network → WS tab');
    console.log('   2. Click "realtime" connection');
    console.log('   3. Go to Messages tab');
    console.log('   4. Look for frames with "event":"phx_error" or "status":"error"');
    console.log('   5. Copy the EXACT error message here');
    console.log('\n💡 The error message in the WebSocket frame will reveal the true cause');
  } else {
    console.log('Fix the failed checks above first');
  }

  console.log('\n📋 Full Report (copy this):');
  console.log(JSON.stringify(report, null, 2));

  return report;
})();
