FROM prom/prometheus:v2.47.2

# Copy configuration files
COPY prometheus-production.yml /etc/prometheus/prometheus.yml
COPY slo-recording-rules-simple.yml /etc/prometheus/slo-recording-rules-simple.yml

# Expose port
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9090/-/healthy || exit 1

