# Startup Optimization Guide

## Why `./start-dev.sh` Takes Time

The startup script performs several sequential operations that can take 2-4 minutes:

### Main Bottlenecks

1. **Kafka Health Check** (up to 30s)
 - Waits for Kafka broker to be fully ready
 - Includes retry logic for stale Zookeeper nodes

2. **Grafana Startup** (up to 60s)
 - Waits for Grafana API to be ready
 - 30 iterations × 2s = 60s max

3. **Prometheus Scraping** (up to 85s)
 - Waits for Prometheus to be ready (30s)
 - Waits for critical targets (40s)
 - Waits for business metrics scrape (10s + up to 60s)

4. **Backend/Automation Health** (up to 60s combined)
 - Backend: up to 30s
 - Automation: up to 30s

5. **Dependency Installation** (variable)
 - npm installs if packages are missing/outdated
 - Usually fast if dependencies are cached

### Overall Time Breakdown

- **Best case**: ~30-60 seconds (services already running, dependencies cached)
- **Typical case**: ~90-120 seconds (fresh start, dependencies cached)
- **Worst case**: ~180-240 seconds (fresh start, slow Docker, all waits hit max)

---

## Quick Optimizations

### 1. Skip Non-Critical Waits (Fastest)

Add environment variable to skip long waits:

```bash
SKIP_LONG_WAITS=true ./start-dev.sh
```

This would:
- Skip Prometheus business metrics wait (saves 60s)
- Reduce Grafana wait timeout (saves 30s)
- Continue even if some services aren't fully ready

### 2. Start Services in Parallel

Currently services start sequentially. Could be parallelized:
- Kafka + Observability stack can start in parallel
- Backend + Automation can start while Prometheus initializes

### 3. Cache Dependencies

Ensure npm cache is working:
```bash
npm config set cache ~/.npm
```

### 4. Keep Docker Containers Running

If you're restarting frequently, keep containers running:
```bash
# Don't stop containers between restarts
docker compose -f rpa-system/docker-compose.monitoring.yml stop # Instead of down
```

### 5. Reduce Health Check Timeouts

For development, reduce timeouts:
- Kafka: 30s -> 15s
- Grafana: 60s -> 30s
- Prometheus: 85s -> 30s

---

## Recommended: Fast Start Mode

Create a `start-dev-fast.sh` that:
1. Skips dependency checks (assumes installed)
2. Reduces all timeouts by 50%
3. Skips Prometheus business metrics wait
4. Starts services in parallel where possible

**Estimated time**: 30-60 seconds instead of 90-240 seconds

---

## Current Wait Times (from script)

| Step | Max Wait | Typical |
|------|----------|---------|
| Kafka containers | 15s | 5-10s |
| Kafka health | 30s | 10-15s |
| Grafana | 60s | 20-30s |
| Backend health | 30s | 5-10s |
| Automation health | 30s | 5-10s |
| Prometheus ready | 30s | 5-10s |
| Prometheus targets | 40s | 10-20s |
| Business metrics | 60s | 10-20s |

**Maximum potential wait**: ~235 seconds (worst case)

---

## Why These Waits Exist

- **Kafka**: Must be fully ready before apps can connect
- **Grafana**: Needs to initialize datasources
- **Prometheus**: Business metrics scrape every 60s, so we wait to ensure data
- **Backend/Automation**: Must be healthy before continuing

Most waits are necessary for reliability, but can be optimized for development speed.

