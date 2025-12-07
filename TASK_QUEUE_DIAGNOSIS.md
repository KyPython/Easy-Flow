# Task Queue Diagnosis - Why Tasks Are Stuck in "Queued"

## Root Cause Identified

### Problem 1: Consumer Not Subscribing to Partitions ✅ FIXED
- **Issue**: Kafka consumer had no partitions assigned (`set()`)
- **Cause**: Consumer was created with topic in constructor but wasn't explicitly subscribing
- **Fix**: Added explicit `consumer.subscribe([KAFKA_TASK_TOPIC])` call

### Problem 2: Consumer Only Reading New Messages ✅ FIXED  
- **Issue**: `auto_offset_reset='latest'` meant consumer only read messages AFTER it started
- **Cause**: Old queued messages were ignored
- **Fix**: Changed to `auto_offset_reset='earliest'` to process queued messages

## Current Status

### Services
- ✅ Backend: Running (port 3030)
- ✅ Automation Worker: Running (port 7001) 
- ✅ Kafka: Running (Docker)
- ✅ Kafka Topic: `automation-tasks` exists

### Consumer Status
- ✅ Consumer now explicitly subscribes to topic
- ✅ Consumer set to read from `earliest` offset
- ⚠️ **Note**: Existing consumer group may have committed offsets, so old messages might still be skipped

## Why Old Tasks Are Still Queued

The tasks you see in the UI (queued 8m, 459m, 468m ago) were likely:
1. **Never sent to Kafka** - Backend Kafka producer might not have been connected
2. **Sent but already consumed** - Consumer group committed offsets but didn't process them
3. **In database but not in Kafka** - Tasks were created in DB but Kafka send failed silently

## Solution for Old Tasks

### Option 1: Submit New Tasks (Recommended)
- New tasks will be processed immediately with the fixed consumer
- Old tasks can be manually cancelled/deleted from the UI

### Option 2: Reset Consumer Group (Advanced)
If you need to reprocess old messages:
```bash
# Reset consumer group offsets to earliest
docker exec easy-flow-kafka-1 kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group automation-workers \
  --reset-offsets \
  --to-earliest \
  --topic automation-tasks \
  --execute
```

### Option 3: Check Backend Kafka Connection
Verify backend is actually sending tasks:
- Check backend logs for "Task sent to Kafka successfully"
- Check for "Kafka service is not connected" errors
- Verify `KAFKA_ENABLED=true` in backend `.env`

## Verification

To verify the fix is working:
1. Submit a new task from the UI
2. Check worker logs for: `"📨 Received Kafka task: {task_id}"`
3. Task should process within seconds, not stay queued

## Observability

All logs are now structured and include:
- Trace context (trace_id, span_id)
- Task IDs
- Kafka message details
- Consumer group status

Check logs with:
- Backend: Structured logs with `logger.info('Task sent to Kafka successfully')`
- Worker: Structured logs with `logger.info('📨 Received Kafka task')`

