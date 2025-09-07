// Debug environment variables
console.log('🔍 Environment Debug Information:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
console.log('SUPABASE_SERVICE_ROLE exists:', !!process.env.SUPABASE_SERVICE_ROLE);
console.log('API_KEY exists:', !!process.env.API_KEY);
console.log('SESSION_SECRET exists:', !!process.env.SESSION_SECRET);

// Show first/last few characters of keys for verification (don't log full keys)
if (process.env.SUPABASE_URL) {
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL.substring(0, 30) + '...');
}
if (process.env.SUPABASE_ANON_KEY) {
    console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY.substring(0, 10) + '...' + process.env.SUPABASE_ANON_KEY.slice(-10));
}

console.log('🔍 Environment debug complete\n');
