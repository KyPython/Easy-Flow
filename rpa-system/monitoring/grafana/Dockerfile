FROM grafana/grafana:10.2.0

# Copy provisioning configuration
COPY provisioning /etc/grafana/provisioning
COPY dashboards /var/lib/grafana/dashboards

# Copy custom configuration
COPY grafana.ini /etc/grafana/grafana.ini

# Set permissions
USER root
RUN chown -R grafana:grafana /etc/grafana/provisioning /var/lib/grafana/dashboards
USER grafana

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

