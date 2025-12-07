# 🚀 Resume Work Session Guide

## Quick Start Commands

### Start All Services
```bash
cd /Users/ky/Easy-Flow

# 1. Start Docker (Kafka & Zookeeper)
docker-compose up -d kafka zookeeper

# 2. Start Backend (port 3030)
cd rpa-system/backend
npm start > ../../logs/backend.log 2>&1 &

# 3. Start Frontend (port 3000)
cd ../rpa-dashboard
npm start > ../../logs/frontend.log 2>&1 &

# 4. Start Automation Worker (port 7001)
cd ../../automation/automation-service
KAFKA_BOOTSTRAP_SERVERS=localhost:9092 python3 production_automation_service.py > ../../../logs/automation-worker.log 2>&1 &
```

### Verify Everything is Running
```bash
# Check services
curl http://localhost:3030/api/health/supabase  # Backend
curl http://localhost:7001/health                 # Automation Worker
lsof -i :3000                                      # Frontend
docker ps | grep kafka                            # Kafka

# Check Kafka connection
curl http://localhost:3030/api/kafka/health
```

## ✅ Current Configuration

### Environment Variables (Backend)
Located in: `rpa-system/backend/.env`
```
KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
AUTOMATION_URL=http://localhost:7001
```

### Service Ports
- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:3030`
- **Automation Worker**: `http://localhost:7001`
- **Kafka**: `localhost:9092`

## 🔧 What Was Fixed Today

### 1. API Proxy Configuration
- ✅ Created `rpa-system/rpa-dashboard/src/setupProxy.js`
- ✅ Installed `http-proxy-middleware`
- ✅ Frontend now proxies `/api/*` requests to backend

### 2. Fragment Import Fix
- ✅ Fixed missing `Fragment` import in `TaskList.jsx`

### 3. Auto-Refresh UX Improvement
- ✅ Increased refresh interval from 5s to 10s
- ✅ Pauses refresh when user is interacting (text selection, mouse, keyboard)
- ✅ Only auto-refreshes if there are active tasks (queued/running)

### 4. Kafka Configuration
- ✅ Fixed replication factor (1 for local dev, 3 for production)
- ✅ Backend configured with `KAFKA_ENABLED=true`
- ✅ Worker connected to Kafka successfully

### 5. Workflow Execution
- ✅ Added `AUTOMATION_URL=http://localhost:7001` to backend `.env`
- ✅ Workflow executor can now call automation service for web scraping

## 📋 Known Issues & Status

### ✅ Resolved
- API proxy working
- Kafka connected
- Worker connected to Kafka
- Backend configured for workflows

### ⚠️ Pending
- **Old queued tasks won't process** - They were submitted when Kafka was down. Submit new tasks instead.
- **Backend Kafka connection** - May need to verify it's actually connected (check `/api/kafka/health`)

## 🧪 Testing Checklist

When you resume, test these:

1. **Submit a new task** (Invoice Download or Web Scraping)
   - Should appear in History immediately
   - Should process within seconds
   - Status should update from "Queued" → "Running" → "Completed"

2. **Run a workflow**
   - Create a simple workflow with "Web Scraping" step
   - Click "Start Execution"
   - Should execute and show progress

3. **Verify auto-refresh**
   - Highlight text on History page
   - Should NOT clear your selection
   - Should only refresh if there are active tasks

## 📁 Important Files Modified

- `rpa-system/rpa-dashboard/src/setupProxy.js` - API proxy configuration
- `rpa-system/rpa-dashboard/src/components/TaskList/TaskList.jsx` - Fragment import fix
- `rpa-system/rpa-dashboard/src/pages/HistoryPage.jsx` - Smart auto-refresh
- `rpa-system/backend/utils/kafkaService.js` - Replication factor fix
- `rpa-system/backend/.env` - Added Kafka and Automation URL config

## 🐛 Debugging Commands

### Check Backend Logs
```bash
tail -f /Users/ky/Easy-Flow/logs/backend.log
```

### Check Worker Logs
```bash
tail -f /Users/ky/Easy-Flow/logs/automation-worker.log
```

### Check Kafka Status
```bash
docker exec easy-flow-kafka-1 kafka-run-class kafka.tools.GetOffsetShell --broker-list localhost:9092 --topic automation-tasks
docker exec easy-flow-kafka-1 kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group automation-workers
```

### Check Service Health
```bash
# Backend
curl http://localhost:3030/api/health/supabase

# Automation Worker
curl http://localhost:7001/health

# Kafka
curl http://localhost:3030/api/kafka/health
```

## 🎯 Next Steps (When You Resume)

1. **Start all services** (use Quick Start commands above)
2. **Verify everything is running** (use Verify commands)
3. **Test with a new task** - Submit a simple Invoice Download task
4. **Test workflow execution** - Run a workflow with Web Scraping step
5. **If issues persist**:
   - Check logs in `/Users/ky/Easy-Flow/logs/`
   - Verify environment variables are set
   - Check Docker is running (`docker ps`)

## 💡 Quick Tips

- **Kafka not connecting?** Make sure Docker is running and Kafka container is up
- **Backend not starting?** Check if port 3030 is already in use: `lsof -i :3030`
- **Worker not processing?** Check if it's connected to Kafka in the logs
- **Workflow failing?** Verify `AUTOMATION_URL` is set in backend `.env`

## 📝 Environment Setup Summary

All required environment variables are now in:
- `rpa-system/backend/.env` - Backend configuration
- Frontend uses `setupProxy.js` for API proxying (no env needed)

---

**Last Updated**: December 6, 2025
**Status**: All services configured and ready to run

