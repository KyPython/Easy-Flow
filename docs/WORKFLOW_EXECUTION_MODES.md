# Workflow Execution Modes - Power/Performance Trade-offs

## 🎯 Core Insight: Voltage Squared Effect Applied to Workflows

Just like hardware power optimization (P = V² × f), workflow execution has a similar trade-off:

**Latency vs Throughput (Energy Efficiency)**
- **High Performance Mode**: Fast execution, higher compute cost
- **Eco Mode**: Slower execution, lower compute cost

## 📊 Execution Mode Strategy

### Mode 1: **Real-Time Mode** (High Performance)
**Use Case:** User-facing workflows, interactive tasks, time-sensitive operations

**Characteristics:**
- ✅ Low latency (fast response)
- ❌ Higher compute cost
- ✅ Immediate execution
- ✅ Priority queue placement

**Example Workflows:**
- User clicks "Run Now" button
- Interactive form submissions
- Real-time data fetching for dashboards
- User-triggered automations

**Implementation:**
- Execute immediately
- Use high-performance worker pool
- Shorter timeouts
- Higher priority in queue

### Mode 2: **Eco Mode** (Low Power)
**Use Case:** Batch jobs, scheduled workflows, non-time-sensitive tasks

**Characteristics:**
- ✅ Lower compute cost (~50% savings)
- ❌ Higher latency (acceptable for batch)
- ✅ Better resource utilization
- ✅ Can run during off-peak hours

**Example Workflows:**
- Scheduled daily reports
- Overnight data processing
- Bulk invoice downloads
- Background data synchronization
- Weekly analytics generation

**Implementation:**
- Queue for off-peak execution
- Use lower-performance worker pool
- Longer timeouts (acceptable)
- Lower priority in queue
- Batch multiple tasks together

### Mode 3: **Balanced Mode** (Default)
**Use Case:** Most workflows, standard operations

**Characteristics:**
- ✅ Balanced latency and cost
- ✅ Standard execution
- ✅ Normal priority

## 🏗️ Architecture Design

### Workflow Metadata Enhancement

Add `execution_mode` field to workflows:

```javascript
{
  id: "workflow-123",
  name: "Daily Invoice Download",
  execution_mode: "eco", // "real-time" | "eco" | "balanced"
  deadline: null, // Optional: ISO timestamp for hard deadline
  cost_priority: "low", // "low" | "normal" | "high"
  // ... existing fields
}
```

### Execution Mode Logic

```javascript
// In workflowExecutor.js
function determineExecutionMode(workflow, context) {
  // 1. Explicit mode from workflow
  if (workflow.execution_mode) {
    return workflow.execution_mode;
  }
  
  // 2. Auto-detect from context
  if (context.triggeredBy === 'user' || context.triggeredBy === 'manual') {
    return 'real-time'; // User wants immediate results
  }
  
  if (context.triggeredBy === 'schedule') {
    return 'eco'; // Scheduled = can wait, save cost
  }
  
  // 3. Check deadline
  if (workflow.deadline && isNearDeadline(workflow.deadline)) {
    return 'real-time'; // Approaching deadline, need speed
  }
  
  // 4. Default
  return 'balanced';
}
```

### Worker Pool Configuration

```python
# In production_automation_service.py

# Real-time pool: Fast, high concurrency
REALTIME_MAX_WORKERS = int(os.getenv('REALTIME_MAX_WORKERS', '5'))
realtime_executor = ThreadPoolExecutor(max_workers=REALTIME_MAX_WORKERS)

# Eco pool: Slower, lower concurrency, can batch
ECO_MAX_WORKERS = int(os.getenv('ECO_MAX_WORKERS', '2'))
eco_executor = ThreadPoolExecutor(max_workers=ECO_MAX_WORKERS)

# Balanced pool: Standard
BALANCED_MAX_WORKERS = int(os.getenv('BALANCED_MAX_WORKERS', '3'))
balanced_executor = ThreadPoolExecutor(max_workers=BALANCED_MAX_WORKERS)
```

### Queue Management

```javascript
// Priority-based queue with execution mode
class WorkflowQueue {
  constructor() {
    this.realtimeQueue = new PriorityQueue(); // High priority
    this.balancedQueue = new PriorityQueue(); // Normal priority
    this.ecoQueue = new PriorityQueue(); // Low priority, can batch
  }
  
  enqueue(workflow, executionMode) {
    const queue = this.getQueue(executionMode);
    const priority = this.calculatePriority(workflow, executionMode);
    queue.enqueue(workflow, priority);
  }
  
  getNextJob() {
    // 1. Check real-time queue first
    if (!this.realtimeQueue.isEmpty()) {
      return this.realtimeQueue.dequeue();
    }
    
    // 2. Check balanced queue
    if (!this.balancedQueue.isEmpty()) {
      return this.balancedQueue.dequeue();
    }
    
    // 3. Check eco queue (can batch multiple)
    if (!this.ecoQueue.isEmpty()) {
      // In eco mode, can batch multiple tasks
      return this.batchEcoJobs();
    }
    
    return null;
  }
}
```

## 💰 Cost Optimization Strategy

### Eco Mode Savings

**Assumptions:**
- Real-time: 5 workers, 100% CPU utilization
- Eco: 2 workers, 50% CPU utilization (slower execution)

**Cost Calculation:**
```
Real-time cost per hour: 5 workers × $0.10/hour = $0.50/hour
Eco cost per hour: 2 workers × $0.10/hour = $0.20/hour

Savings: 60% reduction in compute cost
```

**Trade-off:**
- Real-time: 35ms per inference
- Eco: 70ms per inference (2x latency, but acceptable for batch)

### Implementation Example

```javascript
// In workflowExecutor.js
async executeWorkflow(workflow, context) {
  const executionMode = determineExecutionMode(workflow, context);
  
  const executionConfig = {
    mode: executionMode,
    timeout: executionMode === 'eco' ? 300000 : 60000, // 5min vs 1min
    workerPool: executionMode === 'real-time' ? 'realtime' : 'eco',
    priority: executionMode === 'real-time' ? 'high' : 'low',
    batchable: executionMode === 'eco' // Can batch with other eco jobs
  };
  
  // Route to appropriate queue
  await this.queueManager.enqueue(workflow, executionConfig);
}
```

## 🎯 Real-World Application

### Scenario 1: User Clicks "Run Now"
```javascript
// User wants immediate results
executionMode = 'real-time';
// → Fast execution, higher cost, user happy
```

### Scenario 2: Scheduled Daily Report
```javascript
// Runs at 2 AM, no one waiting
executionMode = 'eco';
// → Slower execution, 60% cost savings, runs overnight
```

### Scenario 3: Approaching Deadline
```javascript
// Workflow has deadline in 1 hour
if (timeUntilDeadline < 3600000) {
  executionMode = 'real-time'; // Switch to fast mode
}
```

## 📈 Metrics to Track

1. **Cost Savings**
   - Compute hours saved by eco mode
   - Cost per workflow execution by mode

2. **Performance Impact**
   - Average latency by mode
   - User satisfaction (for real-time)

3. **Resource Utilization**
   - Worker pool utilization
   - Queue depth by mode

## 🚀 Implementation Plan

### Phase 1: Metadata & Detection
- [ ] Add `execution_mode` field to workflows table
- [ ] Add `deadline` field (optional)
- [ ] Implement auto-detection logic

### Phase 2: Queue Management
- [ ] Create priority queues by mode
- [ ] Implement batch processing for eco mode
- [ ] Add queue metrics

### Phase 3: Worker Pools
- [ ] Configure separate worker pools
- [ ] Implement mode-based routing
- [ ] Add worker pool metrics

### Phase 4: Cost Tracking
- [ ] Track compute costs by mode
- [ ] Report savings to users
- [ ] Optimize mode selection

## 💡 Key Takeaways

1. **Voltage Squared Effect**: Small voltage reduction = large power savings
   - Applied: Small latency increase = large cost savings

2. **Latency vs Throughput**: Not all workflows need speed
   - Batch jobs: Can wait → Use eco mode
   - User-facing: Need speed → Use real-time mode

3. **Smart Defaults**: Auto-detect mode from context
   - User-triggered → Real-time
   - Scheduled → Eco
   - Has deadline → Real-time

4. **Cost Transparency**: Show users the trade-off
   - "Run now: $0.10, Run overnight: $0.04"

---

**This architecture allows EasyFlow to optimize compute costs while maintaining user experience for time-sensitive workflows.**

