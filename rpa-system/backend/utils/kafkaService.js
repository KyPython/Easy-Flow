
// ✅ OBSERVABILITY: Use structured logger for full observability integration
const logger = require('../middleware/structuredLogging');
let Kafka;
let ConfluentKafka;
let uuidv4;
let axios;

// Lazy-load usage tracker and notification services
let usageTracker = null;
let NotificationTemplates = null;
let firebaseNotificationService = null;
let aiDataExtractor = null;
try {
 // Try to use the new Confluent Kafka client first
 ConfluentKafka = require('@confluentinc/kafka-javascript').KafkaJS.Kafka;
 logger.info('✅ Using Confluent Kafka JavaScript client');
} catch (e) {
 logger.info('⚠️ Confluent Kafka client not available, falling back to kafkajs');
 ConfluentKafka = null;
}

try {
 Kafka = require('kafkajs').Kafka;
 uuidv4 = require('uuid').v4;
 axios = require('axios');
} catch (e) {
 logger.warn('⚠️ kafkajs, uuid, or axios not available; Kafka will be disabled in this environment');
 Kafka = null;
 uuidv4 = () => 'uuid-missing-' + Date.now();
 axios = null;
}

// Import trace context utilities
let traceContext = null;
try {
 traceContext = require('../middleware/traceContext');
} catch (e) {
 logger.warn('⚠️ Trace context not available, Kafka messages will not include correlation headers');
}

class KafkaService {
 constructor() {
 // Check if Kafka should be enabled (disabled by default on Render)
 this.kafkaEnabled = process.env.KAFKA_ENABLED === 'true';

 // Check if using Upstash REST API or native Kafka
 this.useUpstash = process.env.UPSTASH_KAFKA_REST_URL && process.env.UPSTASH_KAFKA_REST_USERNAME && process.env.UPSTASH_KAFKA_REST_PASSWORD;

 if (!this.kafkaEnabled) {
 logger.info('🔇 Kafka disabled via KAFKA_ENABLED environment variable');
 this.kafka = null;
 this.producer = null;
 this.consumer = null;
 this.isConnected = false;
 return;
 }

 this.kafka = null;
 this.producer = null;
 this.consumer = null;
 this.isConnected = false;

 // Configuration for traditional Kafka
 // Default to localhost for development, but require explicit configuration for production
 const defaultBroker = process.env.NODE_ENV === 'development' ? 'localhost:9092' : null;
 this.brokers = process.env.KAFKA_BOOTSTRAP_SERVERS || process.env.KAFKA_BROKERS || defaultBroker;
 this.taskTopic = process.env.KAFKA_TASK_TOPIC || 'automation-tasks';
 this.resultTopic = process.env.KAFKA_RESULT_TOPIC || 'automation-results';
 this.consumerGroup = process.env.KAFKA_CONSUMER_GROUP || 'backend-service';

 // Configuration for Upstash
 this.upstashConfig = {
 restUrl: process.env.UPSTASH_KAFKA_REST_URL,
 username: process.env.UPSTASH_KAFKA_REST_USERNAME,
 password: process.env.UPSTASH_KAFKA_REST_PASSWORD
 };

 this.resultCallbacks = new Map(); // Store callbacks for task results

 // If using Upstash, check axios availability
 if (this.useUpstash && !axios) {
 logger.error('⚠️ axios not available; Upstash REST API requires axios');
 this.kafkaEnabled = false;
 this.isConnected = false;
 return;
 }

 // If using traditional Kafka, check kafkajs availability and broker configuration
 if (!this.useUpstash && (!Kafka || !this.brokers)) {
 if (!Kafka) {
 logger.warn('⚠️ Kafka client not present; Kafka functionality disabled');
 }
 if (!this.brokers) {
 logger.warn('⚠️ KAFKA_BOOTSTRAP_SERVERS or KAFKA_BROKERS not configured; Kafka functionality disabled');
 logger.warn(' Set KAFKA_BOOTSTRAP_SERVERS to your Kafka broker URL (e.g., my-kafka.render.com:9092)');
 }
 this.kafkaEnabled = false;
 this.kafka = null;
 this.producer = null;
 this.consumer = null;
 this.isConnected = false;
 return;
 }

 // ✅ FIX: Initialize asynchronously and log errors
 this.initialize().catch(err => {
 logger.error('[KafkaService] Initialization failed:', err);
 this.isConnected = false;
 });
 }

 async initialize() {
 if (!this.kafkaEnabled) {
 logger.info('🔇 Kafka initialization skipped - service disabled');
 return;
 }

 if (this.useUpstash) {
 await this.initializeUpstash();
 } else {
 await this.initializeTraditionalKafka();
 }
 }

 async initializeUpstash() {
 try {
 logger.info('[KafkaService] Initializing Upstash Kafka REST API');

 // Test connection to Upstash
 const response = await this.makeUpstashRequest('GET', '/');
 logger.info('[KafkaService] Upstash connection test successful');

 this.isConnected = true;
 logger.info('[KafkaService] Successfully connected to Upstash Kafka');

 } catch (error) {
 logger.error('[KafkaService] Failed to initialize Upstash Kafka:', error);
 this.isConnected = false;
 }
 }

 async initializeTraditionalKafka() {
 let admin = null;
 try {
 logger.info(`[KafkaService] Initializing Kafka with brokers: ${this.brokers}`);

 const kafkaConfig = {
 clientId: 'backend-service',
 brokers: this.brokers.split(','),
 retry: {
 initialRetryTime: 100,
 retries: 8
 },
 // ✅ Suppress KafkaJS internal connection logs in development
 logLevel: process.env.NODE_ENV === 'development' ? 3 : 2, // 3=WARN, 2=ERROR
 logCreator: () => ({ namespace, level, label, log }) => {
 // Only log WARN and ERROR from KafkaJS library
 if (level >= 3) { // 3=WARN, 4=ERROR
 const { message, ...extra } = log;
 logger.warn(`[KafkaJS:${label}] ${message}`, extra);
 }
 }
 };

 // Add SSL/SASL configuration for cloud Kafka providers
 if (process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD) {
 kafkaConfig.ssl = true;
 kafkaConfig.sasl = {
 mechanism: 'plain',
 username: process.env.KAFKA_USERNAME,
 password: process.env.KAFKA_PASSWORD
 };
 logger.info('[KafkaService] Using SSL/SASL authentication with PLAIN mechanism');
 }

 // Use Confluent client if available, otherwise fall back to kafkajs
 const KafkaClient = ConfluentKafka || Kafka;
 this.kafka = new KafkaClient(kafkaConfig);

 // Create admin client for topic management
 admin = this.kafka.admin();
 await admin.connect();
 logger.info('[KafkaService] Admin client connected');

 // Define required topics
 // ✅ FIX: Use replicationFactor: 1 for local development (single broker)
 // In production with multiple brokers, this should be 3
 const isLocalDev = this.brokers.includes('localhost') || this.brokers.includes('127.0.0.1');
 const replicationFactor = isLocalDev ? 1 : 3;

 const requiredTopics = [
 {
 topic: this.taskTopic,
 numPartitions: 1,
 replicationFactor: replicationFactor,
 configEntries: [
 { name: 'cleanup.policy', value: 'delete' },
 { name: 'retention.ms', value: '604800000' } // 7 days
 ]
 },
 {
 topic: this.resultTopic,
 numPartitions: 1,
 replicationFactor: replicationFactor,
 configEntries: [
 { name: 'cleanup.policy', value: 'delete' },
 { name: 'retention.ms', value: '604800000' } // 7 days
 ]
 },
 {
 topic: 'workflow-events',
 numPartitions: 1,
 replicationFactor: replicationFactor,
 configEntries: [
 { name: 'cleanup.policy', value: 'delete' },
 { name: 'retention.ms', value: '604800000' } // 7 days
 ]
 },
 {
 topic: 'status-updates',
 numPartitions: 1,
 replicationFactor: replicationFactor,
 configEntries: [
 { name: 'cleanup.policy', value: 'delete' },
 { name: 'retention.ms', value: '86400000' } // 1 day
 ]
 }
 ];

 // Check existing topics
 const existingTopics = await admin.listTopics();
 logger.info('[KafkaService] Existing topics:', existingTopics);

 // Filter topics that need to be created
 const topicsToCreate = requiredTopics.filter(topicConfig =>
 !existingTopics.includes(topicConfig.topic)
 );

 if (topicsToCreate.length > 0) {
 logger.info('[KafkaService] Creating missing topics:', topicsToCreate.map(t => t.topic));

 try {
 await admin.createTopics({
 topics: topicsToCreate,
 waitForLeaders: true,
 timeout: 30000
 });
 logger.info('[KafkaService] Successfully created topics:', topicsToCreate.map(t => t.topic));
 } catch (createError) {
 // Handle case where topics might already exist (race condition)
 if (createError.message && createError.message.includes('already exists')) {
 logger.info('[KafkaService] Topics already exist (created by another process)');
 } else {
 logger.warn('[KafkaService] Failed to create some topics, continuing anyway:', createError.message);
 }
 }
 } else {
 logger.info('[KafkaService] All required topics already exist');
 }

 this.producer = this.kafka.producer({
 maxInFlightRequests: 1,
 idempotent: true,
 transactionTimeout: 30000
 });

 this.consumer = this.kafka.consumer({
 groupId: this.consumerGroup,
 sessionTimeout: 30000,
 rebalanceTimeout: 60000,
 heartbeatInterval: 3000,
 // ✅ FIX: Keep auto-commit enabled (default) - offsets are committed after processing
 // The state-based check will skip already-processed messages to prevent duplicate processing
 allowAutoTopicCreation: true
 });

 await this.producer.connect();
 await this.consumer.connect();

 // Subscribe to result topic
 // ✅ FIX: Use fromBeginning: true to ensure we don't miss any messages
 // The state-based check in eachMessage will skip already-processed runs (completed/failed)
 // This ensures we process all messages, even if they were published while the consumer was down
 await this.consumer.subscribe({ topic: this.resultTopic, fromBeginning: true });

 // Start consuming results
 // ✅ FIX: Don't await - consumer.run() runs indefinitely
 // Start it asynchronously so we can continue initialization
 this.startConsumingResults().catch(error => {
 logger.error('[KafkaService] Failed to start consumer:', {
 error: error.message,
 stack: error.stack
 });
 });

 this.isConnected = true;
 logger.info('[KafkaService] Successfully connected to Kafka with auto-topic creation');

 } catch (error) {
 // ✅ FIX: Log at appropriate level based on environment and expectation
 // In development with default localhost:9092, this is expected if Kafka isn't running
 const isDevelopmentDefault = process.env.NODE_ENV === 'development' &&
 this.brokers && this.brokers.includes('localhost:9092');

 if (isDevelopmentDefault) {
 logger.info('[KafkaService] Kafka not available (expected in local development without Kafka running)');
 logger.info('[KafkaService] To enable: Install Kafka or set KAFKA_ENABLED=false to suppress this');
 } else {
 logger.error('[KafkaService] Failed to initialize Kafka:', error);
 }
 this.isConnected = false;
 } finally {
 // Always disconnect admin client
 if (admin) {
 try {
 await admin.disconnect();
 logger.info('[KafkaService] Admin client disconnected');
 } catch (disconnectError) {
 logger.warn('[KafkaService] Error disconnecting admin client:', disconnectError);
 }
 }
 }
 }

 async makeUpstashRequest(method, endpoint, data = null) {
 const config = {
 method,
 url: `${this.upstashConfig.restUrl}${endpoint}`,
 headers: {
 'Authorization': `Basic ${Buffer.from(`${this.upstashConfig.username}:${this.upstashConfig.password}`).toString('base64')}`,
 'Content-Type': 'application/json'
 }
 };

 if (data) {
 config.data = data;
 }

 const response = await axios(config);
 return response.data;
 }

 async sendToUpstash(topic, message, traceHeaders = {}) {
 // ✅ Include trace headers for correlation propagation
 const payload = {
 topic,
 value: Buffer.from(JSON.stringify(message)).toString('base64'),
 headers: {
 'content-type': 'application/json',
 'timestamp': Date.now().toString(),
 'source': 'backend-service',
 ...traceHeaders // CRITICAL: Propagate trace context through Upstash
 }
 };

 return await this.makeUpstashRequest('POST', '/produce', payload);
 }

 async consumeFromUpstash(topic, consumerGroup = this.consumerGroup) {
 const payload = {
 topic,
 'consumer.group': consumerGroup,
 'auto.offset.reset': 'latest',
 'enable.auto.commit': true
 };

 return await this.makeUpstashRequest('POST', '/consume', payload);
 }

 async startConsumingResults() {
 try {
 logger.info('[KafkaService] Starting consumer for results topic', {
 topic: this.resultTopic,
 consumerGroup: this.consumerGroup
 });

 // ✅ FIX: Start consumer.run() without await - it runs indefinitely
 // The consumer will process messages asynchronously
 // We don't await this because it blocks forever, but we need to catch startup errors
 this.consumer.run({
 eachMessage: async ({ topic, partition, message }) => {
 try {
 // ✅ OBSERVABILITY: Always log raw message receipt
 logger.info('[KafkaService] Raw message received', {
 topic,
 partition,
 offset: message.offset,
 key: message.key?.toString(),
 valueLength: message.value?.length,
 timestamp: message.timestamp
 });

 const result = JSON.parse(message.value.toString());
 const taskId = result.task_id;
 const runId = result.run_id;

 // ✅ FIX: Check if this run has already been processed to avoid duplicate processing
 // This is the proper way to handle message processing - check actual state, not hardcoded offsets
 if (runId) {
 try {
 const { getSupabase } = require('./supabaseClient');
 const supabase = getSupabase();
 if (supabase) {
 const { data: existingRun } = await supabase
 .from('automation_runs')
 .select('id, status, updated_at')
 .eq('id', runId)
 .single();

 // If run exists and is already completed/failed (not running), skip processing
 // This prevents reprocessing messages that were already handled
 if (existingRun && existingRun.status !== 'running' && existingRun.status !== 'queued') {
 logger.info('[KafkaService] Skipping already-processed run', {
 runId,
 currentStatus: existingRun.status,
 offset: message.offset
 });
 return; // Skip - already processed
 }
 }
 } catch (checkError) {
 // If check fails, continue processing (fail open)
 logger.warn('[KafkaService] Could not check run status, proceeding with processing', {
 runId,
 error: checkError?.message
 });
 }
 }

 // Extract result data for artifact URL checking
 const resultData = result.result || result;
 const artifactUrl = resultData?.data?.artifact_url || resultData?.artifact_url;

 logger.info('[KafkaService] Received result for task', {
 task_id: taskId,
 status: result.status,
 success: resultData?.success || 'N/A',
 hasArtifact: !!artifactUrl,
 artifact_url: artifactUrl || null,
 has_run_id: !!result.run_id,
 run_id: result.run_id || null,
 result_structure: {
 has_result: !!result.result,
 has_data: !!(resultData?.data),
 result_keys: resultData ? Object.keys(resultData).slice(0, 10) : []
 }
 });

 // ✅ PROGRESS: Update status when task starts processing
 if (runId) {
 try {
 const { getSupabase } = require('./supabaseClient');
 const supabase = getSupabase();
 if (!supabase) return;

 const { data: runData } = await supabase
 .from('automation_runs')
 .select('result, status')
 .eq('id', runId)
 .single();

 if (runData && (runData.status === 'queued' || runData.status === 'running')) {
 const currentResult = typeof runData.result === 'string'
 ? JSON.parse(runData.result || '{}')
 : (runData.result || {});

 // Only update if not already processing
 if (!currentResult.status_message || currentResult.status_message.includes('queued')) {
 currentResult.status_message = '⚙️ Processing task...';
 currentResult.progress = 80;

 await supabase
 .from('automation_runs')
 .update({
 result: JSON.stringify(currentResult),
 updated_at: new Date().toISOString()
 })
 .eq('id', runId);
 }
 }
 } catch (progressError) {
 logger.debug('[KafkaService] Failed to update processing status:', progressError.message);
 }
 }


 // ✅ FIX: Get run_record_id from multiple sources (taskStatusStore, Kafka message, or database lookup)
 let runRecordId = null;

 // Method 1: Try taskStatusStore first (for /api/automation/execute endpoint)
 try {
 const taskStatusStore = require('./taskStatusStore');
 if (taskId) {
 const statusData = await taskStatusStore.get(taskId);
 runRecordId = statusData?.run_record_id;

 // Update taskStatusStore
 await taskStatusStore.set(taskId, {
 ...statusData, // Preserve existing data
 status: result.status || 'finished',
 result: result.result || result,
 updated_at: new Date().toISOString(),
 worker_id: result.worker_id,
 error: result.error,
 run_record_id: runRecordId // Preserve run_record_id
 });
 }
 } catch (taskStoreError) {
 logger.warn('[KafkaService] Error accessing taskStatusStore, will try other methods', {
 error: taskStoreError?.message
 });
 }

 // Method 2: Try Kafka message run_id field (for /api/run-task-with-ai endpoint)
 if (!runRecordId && result.run_id) {
 runRecordId = result.run_id;
 logger.info('[KafkaService] Using run_id from Kafka message', { runRecordId });
 }

 // Method 3: Look up by task_id in database (fallback)
 if (!runRecordId && taskId) {
 try {
 const { getSupabase } = require('../utils/supabaseClient');
 const supabase = getSupabase();
 if (supabase) {
 // Find the most recent running run for this task_id
 const { data: runData, error: lookupError } = await supabase
 .from('automation_runs')
 .select('id')
 .eq('task_id', taskId)
 .in('status', ['running', 'queued'])
 .order('created_at', { ascending: false })
 .limit(1)
 .single();

 if (!lookupError && runData?.id) {
 runRecordId = runData.id;
 logger.info('[KafkaService] Found run_record_id via database lookup', {
 taskId,
 runRecordId
 });
 }
 }
 } catch (dbLookupError) {
 logger.warn('[KafkaService] Database lookup for run_record_id failed', {
 error: dbLookupError?.message
 });
 }
 }

 // ✅ FIX: Log if runRecordId not found (for debugging)
 if (!runRecordId) {
 logger.warn('[KafkaService] Could not find run_record_id for task result', {
 taskId,
 hasRunIdInMessage: !!result.run_id,
 messageStructure: {
 has_task_id: !!result.task_id,
 has_run_id: !!result.run_id,
 has_result: !!result.result
 }
 });
 }

 // ✅ FIX: Update automation_runs database record if we have run_record_id
 if (runRecordId) {
 try {
 const { getSupabase } = require('../utils/supabaseClient');
 const supabase = getSupabase();
 if (!supabase) {
 logger.error('[KafkaService] Supabase client not available for result update');
 return;
 }

 const dbStatus = result.status === 'completed' ? 'completed' :
 result.status === 'failed' ? 'failed' : 'running';

 // Extract artifact_url from result if available (for invoice downloads)
 const resultData = result.result || result;
 const artifactUrl = resultData?.data?.artifact_url || resultData?.artifact_url;

 // ✅ FIX: Ensure stored result includes status field for frontend consistency
 // The Kafka message has status at the top level, but result.result might not
 // Include status in the stored result so frontend can check result.status
 const resultToStore = {
 ...resultData,
 status: result.status || dbStatus // Preserve status from Kafka message
 };

 const updateData = {
 status: dbStatus,
 ended_at: new Date().toISOString(),
 result: JSON.stringify(resultToStore)
 };

 // Set artifact_url if available
 if (artifactUrl) {
 updateData.artifact_url = artifactUrl;
 logger.info(`[KafkaService] Setting artifact_url for run ${runRecordId}: ${artifactUrl}`);
 }

 // ✅ FIX: Create file record in files table if automation downloaded a file
 // This ensures files appear automatically in the Files page
 const storagePath = resultData?.data?.storage_path || resultData?.storage_path;
 const downloadPath = resultData?.data?.download_path || resultData?.download_path;
 const fileName = resultData?.data?.filename || resultData?.filename;
 const fileSize = resultData?.data?.file_size || resultData?.file_size;

 if (storagePath && dbStatus === 'completed') {
 try {
 // Get user_id from the run record
 const { data: runRecord } = await supabase
 .from('automation_runs')
 .select('user_id')
 .eq('id', runRecordId)
 .single();

 if (runRecord?.user_id) {
 // Check if file record already exists
 const { data: existingFile } = await supabase
 .from('files')
 .select('id')
 .eq('storage_path', storagePath)
 .eq('user_id', runRecord.user_id)
 .single();

 if (!existingFile) {
 // Create file record so it appears in Files page
 const fileRecord = {
 user_id: runRecord.user_id,
 original_name: fileName || storagePath.split('/').pop() || 'automation_file.pdf',
 display_name: fileName || storagePath.split('/').pop() || 'automation_file.pdf',
 storage_path: storagePath,
 storage_bucket: 'user-files',
 file_size: fileSize || 0,
 mime_type: 'application/pdf',
 file_extension: 'pdf',
 folder_path: '/invoices',
 tags: ['automation', 'invoice'],
 metadata: {
 source: 'automation',
 task_type: resultData?.data?.task_type || 'invoice_download',
 run_id: runRecordId
 }
 };

 const { data: newFileRecord, error: fileError } = await supabase
 .from('files')
 .insert(fileRecord)
 .select()
 .single();

 if (fileError) {
 logger.warn(`[KafkaService] Failed to create file record: ${fileError.message}`, {
 runId: runRecordId,
 storagePath,
 error: fileError
 });
 } else {
 logger.info(`[KafkaService] ✅ Created file record in Files page: ${newFileRecord.id}`, {
 runId: runRecordId,
 fileId: newFileRecord.id,
 storagePath
 });
 }
 } else {
 logger.info(`[KafkaService] File record already exists: ${existingFile.id}`);
 }
 }
 } catch (fileRecordError) {
 // Don't fail the task if file record creation fails
 logger.warn(`[KafkaService] Error creating file record (non-fatal): ${fileRecordError.message}`, {
 runId: runRecordId,
 error: fileRecordError
 });
 }
 }

 // ✅ AI EXTRACTION: Process AI extraction if enabled and task completed successfully
 // Get task parameters from automation_tasks table to check if AI extraction was enabled
 if (dbStatus === 'completed' && runRecordId) {
 try {
 // Get the task record to check for enableAI and extractionTargets
 const { data: runData } = await supabase
 .from('automation_runs')
 .select('task_id')
 .eq('id', runRecordId)
 .single();

 if (runData?.task_id) {
 const { data: taskData } = await supabase
 .from('automation_tasks')
 .select('parameters')
 .eq('id', runData.task_id)
 .single();

 if (taskData?.parameters) {
 const params = typeof taskData.parameters === 'string'
 ? JSON.parse(taskData.parameters)
 : taskData.parameters;

 if (params.enableAI && params.extractionTargets && params.extractionTargets.length > 0) {
 // Lazy-load AIDataExtractor
 if (!aiDataExtractor) {
 const { AIDataExtractor } = require('../services/aiDataExtractor');
 aiDataExtractor = new AIDataExtractor();
 }

 logger.info(`[KafkaService] Processing AI extraction for run ${runRecordId}`, {
 runId: runRecordId,
 extractionTargets: params.extractionTargets
 });

 // Get the artifact (PDF or HTML content) for extraction
 if (artifactUrl) {
 // Download the artifact for extraction
 const artifactResponse = await axios.get(artifactUrl, { responseType: 'arraybuffer' });
 const artifactBuffer = Buffer.from(artifactResponse.data);

 // Determine if it's a PDF or HTML
 const fileName = artifactUrl.split('/').pop() || 'file';
 let aiExtractionResult = null;

 if (fileName.toLowerCase().endsWith('.pdf')) {
 // Extract from PDF (invoice extraction)
 aiExtractionResult = await aiDataExtractor.extractInvoiceData(artifactBuffer, fileName);
 } else {
 // Extract from HTML/web page
 const htmlContent = artifactBuffer.toString('utf-8');
 aiExtractionResult = await aiDataExtractor.extractWebPageData(htmlContent, params.extractionTargets);
 }

 // Add AI extraction result to stored result
 resultToStore.aiExtraction = aiExtractionResult;
 updateData.result = JSON.stringify(resultToStore);

 logger.info(`[KafkaService] ✅ AI extraction completed for run ${runRecordId}`, {
 runId: runRecordId,
 success: aiExtractionResult?.success,
 extractedFields: aiExtractionResult?.extractedData ? Object.keys(aiExtractionResult.extractedData) : null
 });
 } else {
 logger.warn(`[KafkaService] AI extraction requested but no artifact URL available for run ${runRecordId}`);
 }
 }
 }
 }
 } catch (aiError) {
 // Don't fail the whole task if AI extraction fails
 logger.error('[KafkaService] AI extraction failed (non-fatal):', {
 error: aiError?.message || aiError,
 runId: runRecordId,
 stack: aiError?.stack
 });
 // Store error in result but don't fail the task
 resultToStore.aiExtraction = {
 success: false,
 error: aiError?.message || 'AI extraction failed'
 };
 updateData.result = JSON.stringify(resultToStore);
 }
 }

 const { error: updateError } = await supabase
 .from('automation_runs')
 .update(updateData)
 .eq('id', runRecordId);

 if (updateError) {
 logger.error('[KafkaService] Error updating automation_runs', {
 run_record_id: runRecordId,
 database_error: updateError
 });
 } else {
 // ✅ PROGRESS: Update status message based on result
 let statusMessage = '✅ Task completed';
 let progress = 100;

 if (dbStatus === 'completed') {
 if (artifactUrl) {
 statusMessage = `✅ Downloaded ${resultData?.files_downloaded || 1} file(s) successfully!`;
 } else if (resultData?.success) {
 statusMessage = '✅ Task completed successfully';
 }
 } else if (dbStatus === 'failed') {
 statusMessage = `❌ Task failed: ${resultData?.error || resultData?.message || 'Unknown error'}`;
 progress = 90;
 }

 // Update result with progress message
 try {
 const currentResult = typeof result === 'string' ? JSON.parse(result) : (result || {});
 currentResult.status_message = statusMessage;
 currentResult.progress = progress;

 await supabase
 .from('automation_runs')
 .update({
 result: JSON.stringify(currentResult),
 updated_at: new Date().toISOString()
 })
 .eq('id', runRecordId);
 } catch (progressError) {
 logger.debug('[KafkaService] Failed to update progress message:', progressError.message);
 }

 // ✅ OBSERVABILITY: Log completion with artifact info
 logger.info(`[KafkaService] Task ${runRecordId} ${dbStatus}`, {
 runId: runRecordId,
 status: dbStatus,
 hasArtifact: !!artifactUrl,
 artifact_url: artifactUrl || null,
 task_id: taskId,
 success: resultData?.success,
 result_status: resultData?.status
 });

 // Get user_id from automation_runs table (most reliable) - do this first
 let userId = null;
 if (runRecordId) {
 const { data: runData } = await supabase
 .from('automation_runs')
 .select('user_id')
 .eq('id', runRecordId)
 .single();
 userId = runData?.user_id || resultData?.user_id;
 } else {
 userId = resultData?.user_id;
 }

 // ✅ UNIVERSAL LEARNING: Learn from this automation run
 try {
 const { getUniversalLearningService } = require('../services/UniversalLearningService');
 const learningService = getUniversalLearningService();

 // Get task details for learning
 const { data: taskRecord } = await supabase
 .from('automation_tasks')
 .select('task_type, url, parameters')
 .eq('id', taskId)
 .single();

 if (taskRecord) {
 const taskType = taskRecord.task_type || 'general';
 const siteUrl = taskRecord.url || '';
 const params = typeof taskRecord.parameters === 'string'
 ? JSON.parse(taskRecord.parameters)
 : taskRecord.parameters || {};

 const executionTime = resultData?.execution_time_ms ||
 (resultData?.duration ? resultData.duration * 1000 : null);

 if (dbStatus === 'completed') {
 // Learn from success
 await learningService.learnFromAutomationSuccess({
 automationType: 'web_automation',
 siteUrl: siteUrl,
 taskType: taskType,
 selectorsUsed: resultData?.selectors_used || params.selectors || [],
 config: params,
 executionTime: executionTime,
 resultData: resultData,
 userId: userId
 });
 } else {
 // Learn from failure
 await learningService.learnFromAutomationFailure({
 automationType: 'web_automation',
 siteUrl: siteUrl,
 taskType: taskType,
 errorMessage: resultData?.error || resultData?.message || 'Task failed',
 attemptedConfig: params,
 executionTime: executionTime,
 userId: userId
 });
 }
 }
 } catch (learningError) {
 // Don't fail the task if learning fails
 logger.warn('[KafkaService] Error learning from automation (non-fatal):', {
 error: learningError?.message,
 runRecordId
 });
 }

 // ✅ FIX: Track usage and send notifications (moved from queueTaskRun)
 // Lazy-load services to avoid circular dependencies
 try {
 if (!usageTracker) {
 usageTracker = require('./usageTracker').default || require('./usageTracker');
 }

 // userId already retrieved above

 if (userId && usageTracker && usageTracker.trackAutomationRun) {
 // Only track completed runs (failed runs don't count)
 if (dbStatus === 'completed') {
 await usageTracker.trackAutomationRun(userId, runRecordId, 'completed');
 logger.info(`[KafkaService] Usage tracked for completed task ${runRecordId}`);
 }
 }

 // Send notifications based on status
 // Lazy-load Firebase notification services from firebaseAdmin.js
 if (!NotificationTemplates || !firebaseNotificationService) {
 const firebaseAdmin = require('../utils/firebaseAdmin');
 NotificationTemplates = firebaseAdmin.NotificationTemplates;
 firebaseNotificationService = firebaseAdmin.firebaseNotificationService;
 }

 if (userId && NotificationTemplates && firebaseNotificationService) {
 const taskName = resultData?.title || resultData?.task_name || 'Automation Task';

 if (dbStatus === 'completed') {
 const notification = NotificationTemplates.taskCompleted(taskName);
 await firebaseNotificationService.sendAndStoreNotification(userId, notification);
 logger.info(`[KafkaService] 🔔 Completion notification sent for task ${runRecordId}`);
 } else if (dbStatus === 'failed') {
 const errorMessage = resultData?.error || resultData?.message || 'Task failed';
 const notification = NotificationTemplates.taskFailed(taskName, errorMessage);
 await firebaseNotificationService.sendAndStoreNotification(userId, notification);
 logger.info(`[KafkaService] 🔔 Failure notification sent for task ${runRecordId}`);
 }
 }
 } catch (trackingError) {
 // Don't fail the whole Kafka processing if tracking/notifications fail
 logger.error('[KafkaService] Error tracking usage or sending notifications:', {
 error: trackingError?.message || trackingError,
 runRecordId,
 dbStatus
 });
 }
 }
 } catch (dbError) {
 logger.error('[KafkaService] Could not update automation_runs:', dbError);
 }
 }

 // Check if we have a callback for this task
 if (this.resultCallbacks.has(taskId)) {
 const callback = this.resultCallbacks.get(taskId);
 callback(result);
 this.resultCallbacks.delete(taskId);
 }

 } catch (error) {
 logger.error('[KafkaService] Error processing result message:', {
 error: error.message,
 stack: error.stack,
 topic,
 partition,
 offset: message?.offset
 });
 }
 }
 }).catch(error => {
 // ✅ FIX: Catch errors from consumer.run() - it runs asynchronously
 logger.error('[KafkaService] Consumer run error:', {
 error: error.message,
 stack: error.stack,
 topic: this.resultTopic
 });
 });

 logger.info('[KafkaService] Consumer started successfully and listening for messages');
 } catch (error) {
 logger.error('[KafkaService] Error starting result consumer:', {
 error: error.message,
 stack: error.stack,
 topic: this.resultTopic
 });
 }
 }

 async sendAutomationTask(taskData) {
 // ✅ Get trace context BEFORE creating logger (must be in AsyncLocalStorage context)
 const currentTraceContext = traceContext ? traceContext.getCurrentTraceContext() : null;

 // ✅ Create context-aware logger with business attributes
 const logger = traceContext ? traceContext.createContextLogger({
 operation: 'kafka_send_task',
 taskId: taskData.task_id,
 taskType: taskData.task_type,
 userId: taskData.user_id
 }) : null;

 if (!this.kafkaEnabled) {
 if (logger) {
 logger.info('Kafka automation task skipped - service disabled');
 } else {
 logger.info('🔇 Kafka automation task skipped - service disabled');
 }
 return {
 success: true,
 task_id: taskData.task_id || 'disabled-' + Date.now(),
 message: 'Kafka disabled - task processed without queueing'
 };
 }

 if (!this.isConnected) {
 const error = new Error('Kafka service is not connected');
 if (logger) {
 logger.error('Kafka service not connected', error);
 }
 throw error;
 }

 const taskId = taskData.task_id || uuidv4();
 const taskWithId = { ...taskData, task_id: taskId };

 try {
 // ✅ Get trace headers for correlation propagation
 // Use the trace context we captured at the start of the function
 let kafkaTraceHeaders = {};
 if (traceContext && currentTraceContext) {
 // Build headers from the captured trace context
 kafkaTraceHeaders = {
 'traceparent': currentTraceContext.traceparent,
 'x-trace-id': currentTraceContext.traceId,
 'x-request-id': currentTraceContext.requestId,
 'x-span-id': currentTraceContext.spanId,
 'x-user-id': currentTraceContext.userId || '',
 'x-user-tier': currentTraceContext.userTier || 'unknown'
 };
 }

 if (logger) {
 logger.info('Sending automation task to Kafka', {
 taskId,
 taskType: taskData.task_type,
 topic: this.taskTopic,
 useUpstash: this.useUpstash,
 traceHeaders: Object.keys(kafkaTraceHeaders).length > 0 ? 'present' : 'missing'
 });
 } else {
 logger.info(`[KafkaService] Sending automation task ${taskId}:`, taskWithId);
 }

 let result;
 if (this.useUpstash) {
 result = await this.sendToUpstash(this.taskTopic, taskWithId, kafkaTraceHeaders);
 } else {
 if (!this.producer) {
 throw new Error('Kafka producer is not available');
 }

 // ✅ Include trace headers in Kafka message headers
 const messageHeaders = {
 'content-type': 'application/json',
 'timestamp': Date.now().toString(),
 'source': 'backend-service',
 ...kafkaTraceHeaders // CRITICAL: Propagate trace context
 };

 result = await this.producer.send({
 topic: this.taskTopic,
 messages: [{
 key: taskId,
 value: JSON.stringify(taskWithId),
 headers: messageHeaders
 }]
 });
 }

 logger.info(`[KafkaService] Task ${taskId} sent successfully:`, result);
 return { taskId, success: true, result };

 } catch (error) {
 logger.error(`[KafkaService] Failed to send task ${taskId}:`, error);
 throw error;
 }
 }

 async sendAutomationTaskWithCallback(taskData, timeoutMs = 60000) {
 const taskId = taskData.task_id || uuidv4();

 return new Promise((resolve, reject) => {
 // Set up timeout
 const timeout = setTimeout(() => {
 this.resultCallbacks.delete(taskId);
 reject(new Error(`Task ${taskId} timed out after ${timeoutMs}ms`));
 }, timeoutMs);

 // Set up result callback
 this.resultCallbacks.set(taskId, (result) => {
 clearTimeout(timeout);
 resolve(result);
 });

 // Send the task
 this.sendAutomationTask({ ...taskData, task_id: taskId })
 .catch((error) => {
 clearTimeout(timeout);
 this.resultCallbacks.delete(taskId);
 reject(error);
 });
 });
 }

 async getHealth() {
 return {
 connected: this.isConnected,
 enabled: this.kafkaEnabled,
 useUpstash: this.useUpstash,
 brokers: this.useUpstash ? 'Upstash REST API' : this.brokers,
 taskTopic: this.taskTopic,
 resultTopic: this.resultTopic,
 consumerGroup: this.consumerGroup,
 pendingCallbacks: this.resultCallbacks.size,
 upstashConfigured: !!(this.upstashConfig.restUrl && this.upstashConfig.username && this.upstashConfig.password)
 };
 }

 async disconnect() {
 try {
 if (this.useUpstash) {
 // No explicit disconnect needed for REST API
 this.isConnected = false;
 logger.info('[KafkaService] Disconnected from Upstash Kafka');
 } else {
 if (this.producer) {
 await this.producer.disconnect();
 }
 if (this.consumer) {
 await this.consumer.disconnect();
 }
 this.isConnected = false;
 logger.info('[KafkaService] Disconnected from Kafka');
 }
 } catch (error) {
 logger.error('[KafkaService] Error disconnecting from Kafka:', error);
 }
 }
}

// Singleton instance
let kafkaService = null;

function getKafkaService() {
 if (!kafkaService) {
 kafkaService = new KafkaService();
 }
 return kafkaService;
}

module.exports = {
 KafkaService,
 getKafkaService
};
