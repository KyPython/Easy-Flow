// Cleanup script for stale tasks
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { getSupabase } = require('../utils/supabaseClient');

async function cleanupStaleTasks() {
  const supabase = getSupabase();

  if (!supabase) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 Finding stale tasks...\n');

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: staleTasks, error: findError } = await supabase
    .from('automation_runs')
    .select('id, started_at, result, automation_tasks(name, url)')
    .eq('status', 'running')
    .lt('started_at', oneHourAgo);

  if (findError) {
    console.error('❌ Error finding tasks:', findError);
    return;
  }

  if (!staleTasks || staleTasks.length === 0) {
    console.log('✅ No stale tasks found. Queue is clean!');
    return;
  }

  console.log(`📊 Found ${staleTasks.length} stale task(s)\n`);

  staleTasks.forEach((task, i) => {
    const age = Math.round((Date.now() - new Date(task.started_at).getTime()) / 60000);
    console.log(`${i + 1}. Task ID: ${task.id}`);
    console.log(`   Started: ${task.started_at} (${age} minutes ago)`);
    console.log(`   Task: ${task.automation_tasks?.name || 'Unknown'}`);
    console.log(`   URL: ${task.automation_tasks?.url || 'N/A'}\n`);
  });

  console.log(`🗑️  Marking ${staleTasks.length} tasks as failed...\n`);

  const taskIds = staleTasks.map(t => t.id);

  const { data: updated, error: updateError } = await supabase
    .from('automation_runs')
    .update({
      status: 'failed',
      ended_at: new Date().toISOString(),
      result: {
        error: 'Task expired',
        message: 'Task was queued before Kafka pipeline was enabled and will never process. Please resubmit.',
        expired_at: new Date().toISOString(),
        reason: 'kafka_disabled_during_submission'
      }
    })
    .in('id', taskIds)
    .select();

  if (updateError) {
    console.error('❌ Error updating tasks:', updateError);
    return;
  }

  console.log(`✅ Successfully cleaned up ${updated?.length || 0} stale tasks`);
  console.log('\n📋 Summary:');
  console.log(`   - Total stale tasks: ${staleTasks.length}`);
  console.log(`   - Marked as failed: ${updated?.length || 0}`);
  console.log('   - Status: Queue cleaned');
  console.log('\n💡 Users can now resubmit these tasks and they will process correctly.');
}

cleanupStaleTasks()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Cleanup failed:', err);
    process.exit(1);
  });
