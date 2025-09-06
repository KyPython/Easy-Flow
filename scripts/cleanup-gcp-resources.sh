#!/bin/bash

# Google Cloud VM Cleanup Script
# This script helps you clean up Google Cloud resources safely

echo "🗑️  Google Cloud VM Cleanup Helper"
echo "=================================="
echo ""
echo "⚠️  WARNING: This will help you identify resources to delete."
echo "   Always verify before deleting to avoid data loss!"
echo ""

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI not found."
    echo "   Install from: https://cloud.google.com/sdk/docs/install"
    echo "   Or use the Google Cloud Console web interface."
    echo ""
    echo "🌐 Manual cleanup via Google Cloud Console:"
    echo "   1. Go to https://console.cloud.google.com/"
    echo "   2. Follow the steps in VM_DECOMMISSION_GUIDE.md"
    exit 1
fi

echo "🔍 Checking for Google Cloud resources..."
echo ""

# Set your project ID (replace with your actual project ID)
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo "❌ No Google Cloud project configured."
    echo "   Run: gcloud config set project YOUR_PROJECT_ID"
    echo "   Or use the Google Cloud Console web interface."
    exit 1
fi

echo "📋 Current project: $PROJECT_ID"
echo ""

# Check VM instances
echo "1. 🖥️  VM Instances:"
gcloud compute instances list --format="table(name,zone,status,machineType)" 2>/dev/null || echo "   No instances found or permission denied"
echo ""

# Check persistent disks
echo "2. 💾 Persistent Disks:"
gcloud compute disks list --format="table(name,zone,sizeGb,status)" 2>/dev/null || echo "   No disks found or permission denied"
echo ""

# Check static IPs
echo "3. 🌐 Static IP Addresses:"
gcloud compute addresses list --format="table(name,region,address,status)" 2>/dev/null || echo "   No addresses found or permission denied"
echo ""

# Check firewall rules
echo "4. 🔥 Custom Firewall Rules:"
gcloud compute firewall-rules list --format="table(name,direction,priority,sourceRanges.list():label=SRC_RANGES,allowed[].map().firewall_rule().list():label=ALLOW)" --filter="NOT name:default-" 2>/dev/null || echo "   No custom rules found or permission denied"
echo ""

# Check load balancers
echo "5. ⚖️  Load Balancers:"
gcloud compute url-maps list --format="table(name,defaultService)" 2>/dev/null || echo "   No load balancers found or permission denied"
echo ""

# Check forwarding rules
echo "6. 🔀 Forwarding Rules:"
gcloud compute forwarding-rules list --format="table(name,region,IPAddress,target)" 2>/dev/null || echo "   No forwarding rules found or permission denied"
echo ""

echo "=================================================="
echo "🛠️  To delete resources, you can use these commands:"
echo ""
echo "Delete VM instance:"
echo "   gcloud compute instances delete INSTANCE_NAME --zone=ZONE"
echo ""
echo "Delete persistent disk:"
echo "   gcloud compute disks delete DISK_NAME --zone=ZONE"
echo ""
echo "Release static IP:"
echo "   gcloud compute addresses delete ADDRESS_NAME --region=REGION"
echo ""
echo "Delete firewall rule:"
echo "   gcloud compute firewall-rules delete RULE_NAME"
echo ""
echo "Delete load balancer (URL map):"
echo "   gcloud compute url-maps delete URL_MAP_NAME"
echo ""
echo "=================================================="
echo "🌐 Or use the Google Cloud Console web interface:"
echo "   https://console.cloud.google.com/"
echo ""
echo "⚠️  IMPORTANT: Always verify what you're deleting!"
echo "   Some resources may have important data."
echo ""
echo "💰 Set up billing alerts to monitor costs:"
echo "   https://console.cloud.google.com/billing"
echo ""
