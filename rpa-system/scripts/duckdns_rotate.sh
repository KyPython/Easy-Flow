#!/usr/bin/env bash
set -euo pipefail
# Rotate / update DuckDNS token and set domain IP. This script cannot rotate token on DuckDNS (requires login).
# It helps you update DNS records using an existing token.
# Usage: export DUCK_TOKEN=yourtoken; ./duckdns_rotate.sh domain1 domain2 ...

if [ -z "${DUCK_TOKEN:-}" ]; then
  echo "Please export DUCK_TOKEN (your DuckDNS token) before running."
  echo "You can get or rotate the token at https://www.duckdns.org/"
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 domain1 [domain2 ...]"
  exit 1
fi

# Get public IP (optional override with $IP)
IP=${IP:-$(curl -s https://api.ipify.org)}

echo "Updating DuckDNS for domains: $* -> $IP"
for domain in "$@"; do
  echo "Updating $domain"
  resp=$(curl -s "https://www.duckdns.org/update?domains=${domain}&token=${DUCK_TOKEN}&ip=${IP}")
  echo "DuckDNS response for $domain: $resp"
done

echo "Done. If you need to rotate token, log into https://www.duckdns.org and generate a new token, then export DUCK_TOKEN and run this script."
