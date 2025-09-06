# VM Decommissioning Guide

## 🚨 IMPORTANT: Complete VM Shutdown Required

This document outlines the steps to properly decommission the Google Cloud VM and prevent any charges.

## Current Status

- **Date:** September 6, 2025
- **Migration:** Moving from Google Cloud VM to Render.com + Vercel
- **Old Workflows:** Disabled and moved to `.github/workflows/disabled/`

## Step-by-Step VM Decommissioning

### 1. ✅ GitHub Actions (COMPLETED)

- [x] Moved `deploy-to-vm.yml` to disabled folder
- [x] Moved `deploy-frontend-to-vm.yml` to disabled folder
- [x] Active workflow is now `deploy-modern.yml` (Render + Vercel)

### 2. 🔧 Google Cloud Console Actions (REQUIRED)

#### A. Stop the VM Instance

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Compute Engine** → **VM instances**
3. Find your EasyFlow VM instance
4. Click the **3 dots menu** → **Stop**
5. Confirm the shutdown

#### B. Delete the VM Instance (Recommended)

1. After stopping, click **3 dots menu** → **Delete**
2. **⚠️ WARNING:** This is permanent - ensure all data is backed up
3. Confirm deletion

#### C. Clean Up Associated Resources

1. **Persistent Disks:**
   - Go to **Compute Engine** → **Disks**
   - Delete any disks not attached to other instances
2. **Static IP Addresses:**
   - Go to **VPC Network** → **External IP addresses**
   - Release any static IPs for the EasyFlow project
3. **Firewall Rules:**
   - Go to **VPC Network** → **Firewall**
   - Delete custom firewall rules for EasyFlow (keep default rules)
4. **Load Balancers:**
   - Go to **Network Services** → **Load balancing**
   - Delete any EasyFlow-related load balancers

### 3. 🔐 GitHub Secrets Cleanup (REQUIRED)

#### Remove VM-Related Secrets

Go to your GitHub repository settings and delete these secrets:

- `VM_HOST`
- `VM_USER`
- `SSH_PRIVATE_KEY`
- `SSH_PORT`
- Any GCP service account keys related to the VM

#### Keep These Secrets (for new deployment)

- `RENDER_API_KEY`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VERCEL_TOKEN`
- `SUPABASE_*` secrets
- `FIREBASE_*` secrets

### 4. 💰 Cost Monitoring (RECOMMENDED)

#### Set Up Billing Alerts

1. Go to **Billing** in Google Cloud Console
2. Set up **Budget alerts** for $0.01 to catch any unexpected charges
3. Enable **Billing export** to track usage

#### Verify No Running Resources

1. Go to **Billing** → **Reports**
2. Check current month usage is $0
3. Review **Cost Table** for any active services

### 5. 🔍 Final Verification Steps

#### Check Google Cloud Console

- [ ] No running VM instances
- [ ] No attached persistent disks
- [ ] No reserved IP addresses
- [ ] No active load balancers
- [ ] No compute engine usage in billing

#### Check GitHub Actions

- [ ] No VM workflows in active workflows folder
- [ ] `deploy-modern.yml` is the only deployment workflow
- [ ] VM secrets removed from repository settings

#### Test New Deployment

- [ ] Push to main branch
- [ ] Verify only `deploy-modern.yml` runs
- [ ] Confirm Render.com and Vercel deployments work

## 🚀 New Deployment Architecture

### Active Services

- **Backend:** Render.com (automated deployment)
- **Frontend:** Vercel (automated deployment)
- **Database:** Supabase (managed service)
- **Notifications:** Firebase (managed service)

### Active GitHub Workflow

- **File:** `.github/workflows/deploy-modern.yml`
- **Triggers:** Push to main branch
- **Deploys:** Backend to Render, Frontend to Vercel

## Emergency Contacts

If you encounter issues:

1. **Google Cloud Support:** Available through console
2. **Render Support:** support@render.com
3. **Vercel Support:** support@vercel.com

## Cost Comparison

### Old VM Setup (Monthly)

- VM Instance: ~$25-50/month (after free credits expire)
- Load Balancer: ~$18/month
- Storage: ~$10/month
- **Total: ~$53-78/month**

### New Modern Setup (Monthly)

- Render.com: $7/month (Starter plan)
- Vercel: $0/month (Hobby plan with generous limits)
- Supabase: $0/month (Free tier, $25/month if upgraded)
- Firebase: $0/month (Free tier)
- **Total: $7-32/month** (67-90% cost reduction!)

---

## ⚠️ Action Required

**You must complete Steps 2-4 to avoid future charges once your Google Cloud credits expire.**

The VM workflows are now disabled, but the actual VM resources may still be running in Google Cloud.
