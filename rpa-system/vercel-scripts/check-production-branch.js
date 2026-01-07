#!/usr/bin/env node
// Check if attempting to deploy dev branch to production
if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_GIT_COMMIT_REF === 'dev') {
 console.error('❌ ERROR: Production deployments from dev branch are BLOCKED.');
 console.error(' Change Vercel Production Branch to main in dashboard.');
 process.exit(1);
}

