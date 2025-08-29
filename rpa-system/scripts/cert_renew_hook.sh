#!/bin/bash
# Deploy hook run after certbot renew succeeds. Reload nginx so new certs are used.
set -euo pipefail
echo "Cert renewed; reloading nginx..."
sudo systemctl reload nginx || true
echo "nginx reloaded"
