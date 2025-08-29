#!/usr/bin/env bash
set -euo pipefail
# Create firewall rules (HTTP/HTTPS) and reserve the VM's external IP as a static address.
# Usage: ./gcloud_setup.sh --instance INSTANCE_NAME --zone ZONE --reserve-name RESNAME

INSTANCE="instance-20250827-203325"
ZONE="us-central1-c"
RESERVE_NAME="easyflow-static-ip"

# parse opts (basic)
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --instance) INSTANCE="$2"; shift 2;;
    --zone) ZONE="$2"; shift 2;;
    --reserve-name) RESERVE_NAME="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

echo "Using INSTANCE=$INSTANCE ZONE=$ZONE RESERVE_NAME=$RESERVE_NAME"

# Ensure gcloud is installed
if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found. Install Google Cloud SDK and authenticate first." >&2
  exit 2
fi

# Get current external IP of the instance
IP=$(gcloud compute instances describe "$INSTANCE" --zone="$ZONE" --format='get(networkInterfaces[0].accessConfigs[0].natIP)') || true
if [ -z "$IP" ]; then
  echo "Could not find external IP for $INSTANCE in $ZONE" >&2
  exit 3
fi

echo "Instance external IP: $IP"

# Create firewall rules if missing
for RULE in allow-http-easyflow allow-https-easyflow; do
  if ! gcloud compute firewall-rules list --filter="name=$RULE" --format='get(name)' | grep -q "${RULE}" 2>/dev/null; then
    if [ "$RULE" = "allow-http-easyflow" ]; then
      echo "Creating firewall rule: $RULE (tcp:80)"
      gcloud compute firewall-rules create $RULE --direction=INGRESS --priority=1000 --network=default --action=ALLOW --rules=tcp:80 --source-ranges=0.0.0.0/0 --quiet
    else
      echo "Creating firewall rule: $RULE (tcp:443)"
      gcloud compute firewall-rules create $RULE --direction=INGRESS --priority=1000 --network=default --action=ALLOW --rules=tcp:443 --source-ranges=0.0.0.0/0 --quiet
    fi
  else
    echo "Firewall rule $RULE already exists"
  fi
done

# Reserve the IP in the region derived from zone (drop final -[a-z])
REGION=$(echo "$ZONE" | sed 's/-[a-z]$//')

# Check if address already reserved
if gcloud compute addresses list --regions=$REGION --filter="address=$IP" --format='get(name)' | grep -q .; then
  echo "Address $IP already reserved in region $REGION"
else
  echo "Reserving static address $RESERVE_NAME for IP $IP in region $REGION"
  gcloud compute addresses create "$RESERVE_NAME" --addresses="$IP" --region="$REGION" --quiet
  echo "Reserved $IP as $RESERVE_NAME"
fi

echo "Done. Verify in Cloud Console -> VPC network -> External IP addresses."
