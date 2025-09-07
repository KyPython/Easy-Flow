# EasyFlow Deployment Guide

Simple deployment guide for Render and Vercel platforms.

## Render Deployment (Recommended)

1. **Connect Repository**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Create new Web Service from your GitHub repo
   - Root directory: `rpa-system`

2. **Configure Service**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Copy all variables from `.env.render`

3. **Required Environment Variables** (from `.env.render`):
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`
   - `API_KEY`, `ADMIN_API_SECRET`, `SESSION_SECRET`
   - `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (if using email)

## Vercel Deployment

1. **Deploy**
   ```bash
   npm i -g vercel
   vercel
   ```

2. **Environment Variables**
   - Add all variables from `.env.vercel` in Vercel dashboard
   - Redeploy: `vercel --prod`

## Post-Deployment

Test these endpoints:
- `https://your-app.com/health` - Should return `{"ok": true}`
- `https://your-app.com/api/health/databases` - Database status
