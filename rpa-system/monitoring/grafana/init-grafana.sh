#!/bin/bash
# Wait for Grafana to be ready
sleep 10

# Reset admin password
grafana cli admin reset-admin-password admin123

echo "Admin password set to: admin123"

