#!/usr/bin/env python3
"""
DLQ Inspection Tool
View failed jobs and replay them from the command line

Usage:
  python inspect_dlq.py list                    # List failed jobs
  python inspect_dlq.py show <job_id>           # Show job details
  python inspect_dlq.py replay <job_id>         # Replay a job
  python inspect_dlq.py stats                   # Show DLQ statistics
  python inspect_dlq.py categories              # List error categories

Environment:
  SUPABASE_URL - Supabase project URL
  SUPABASE_KEY - Supabase service role key (or anon key for read-only)
"""

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase package not installed. Run: pip install supabase")
    sys.exit(1)


class DLQInspector:
    """CLI tool for inspecting and managing the Dead Letter Queue"""
    
    def __init__(self):
        self.supabase: Optional[Client] = None
        self._init_client()
    
    def _init_client(self):
        """Initialize Supabase client from environment"""
        url = os.environ.get('SUPABASE_URL')
        key = os.environ.get('SUPABASE_KEY')
        
        if not url or not key:
            print("Error: SUPABASE_URL and SUPABASE_KEY environment variables required")
            print("Set them with:")
            print("  export SUPABASE_URL='https://your-project.supabase.co'")
            print("  export SUPABASE_KEY='your-service-role-key'")
            sys.exit(1)
        
        try:
            self.supabase = create_client(url, key)
        except Exception as e:
            print(f"Error connecting to Supabase: {e}")
            sys.exit(1)
    
    def _get_user_id(self) -> str:
        """Get user ID - in production, this would use auth"""
        # For CLI, we need to either use service role or have user context
        # This is a simplified version - in production, you'd authenticate
        user_id = os.environ.get('EASYFLOW_USER_ID')
        if not user_id:
            print("Error: EASYFLOW_USER_ID environment variable required for CLI operations")
            sys.exit(1)
        return user_id
    
    def list_jobs(self, limit: int = 50, offset: int = 0, 
                  workflow_id: Optional[str] = None,
                  category: Optional[str] = None):
        """List failed jobs in the DLQ"""
        user_id = self._get_user_id()
        
        query = self.supabase.table('workflow_executions') \
            .select('''
                id,
                workflow_id,
                workflows(name),
                retry_count,
                max_retries,
                last_error,
                error_category,
                created_at,
                last_error_at
            ''') \
            .eq('state', 'FAILED') \
            .eq('user_id', user_id) \
            .order('last_error_at', desc=True) \
            .range(offset, offset + limit - 1)
        
        if workflow_id:
            query = query.eq('workflow_id', workflow_id)
        if category:
            query = query.eq('error_category', category)
        
        result = query.execute()
        
        jobs = result.data or []
        
        print(f"\n{'='*100}")
        print(f"FAILED JOBS (DLQ) - Showing {len(jobs)} jobs")
        print(f"{'='*100}")
        print(f"{'Job ID':<40} {'Workflow':<25} {'Category':<18} {'Retries':<8} {'Failed At'}")
        print(f"{'-'*100}")
        
        for job in jobs:
            workflow_name = job.get('workflows', {}).get('name', 'Unknown') if job.get('workflows') else 'Unknown'
            job_id = job['id'][:36] + '...' if len(job['id']) > 36 else job['id']
            category = job.get('error_category', 'unknown') or 'unknown'
            retries = f"{job.get('retry_count', 0)}/{job.get('max_retries', 'N/A')}"
            failed_at = job.get('last_error_at', job.get('created_at', 'N/A'))[:19]
            
            print(f"{job_id:<40} {workflow_name:<25} {category:<18} {retries:<8} {failed_at}")
        
        print(f"\nTotal jobs shown: {len(jobs)}")
        
        return jobs
    
    def show_job(self, job_id: str):
        """Show detailed information about a failed job"""
        user_id = self._get_user_id()
        
        result = self.supabase.table('workflow_executions') \
            .select('''
                *,
                workflows(*),
                step_executions(*)
            ''') \
            .eq('id', job_id) \
            .eq('user_id', user_id) \
            .eq('state', 'FAILED') \
            .single() \
            .execute()
        
        if not result.data:
            print(f"Job {job_id} not found in DLQ")
            return None
        
        job = result.data
        
        print(f"\n{'='*100}")
        print(f"JOB DETAILS: {job_id}")
        print(f"{'='*100}")
        
        print(f"\n📋 Basic Information:")
        print(f"   Workflow: {job.get('workflows', {}).get('name', 'Unknown')} ({job.get('workflow_id', 'N/A')})")
        print(f"   Status: {job['state']}")
        print(f"   Execution Mode: {job.get('execution_mode', 'N/A')}")
        print(f"   Triggered By: {job.get('triggered_by', 'N/A')}")
        
        print(f"\n🔄 Retry Information:")
        print(f"   Retry Count: {job.get('retry_count', 0)}/{job.get('max_retries', 'N/A')}")
        print(f"   Created: {job.get('created_at', 'N/A')}")
        print(f"   Started: {job.get('started_at', 'N/A')}")
        print(f"   Completed: {job.get('completed_at', 'N/A')}")
        
        print(f"\n❌ Failure Information:")
        print(f"   Error Category: {job.get('error_category', 'unknown')}")
        print(f"   Last Error: {job.get('last_error', 'N/A')}")
        print(f"   Failed At: {job.get('last_error_at', 'N/A')}")
        
        if job.get('trigger_data'):
            print(f"\n📝 Trigger Data:")
            trigger_data = job.get('trigger_data')
            if isinstance(trigger_data, str):
                trigger_data = json.loads(trigger_data)
            for key, value in trigger_data.items():
                print(f"   {key}: {value}")
        
        if job.get('step_executions'):
            print(f"\n📊 Step Executions:")
            for step in sorted(job.get('step_executions', []), key=lambda x: x.get('execution_order', 0)):
                status_emoji = "✅" if step.get('status') == 'completed' else "❌" if step.get('status') == 'failed' else "⏳"
                print(f"   {status_emoji} {step.get('step_id', 'unknown')}: {step.get('status', 'unknown')}")
                if step.get('error_message'):
                    print(f"      Error: {step.get('error_message')}")
        
        print(f"\n📥 Input Data:")
        input_data = job.get('input_data', {})
        if isinstance(input_data, str):
            input_data = json.loads(input_data)
        if input_data:
            print(json.dumps(input_data, indent=2))
        else:
            print("   (No input data)")
        
        return job
    
    def replay_job(self, job_id: str, new_input_data: Optional[dict] = None):
        """Replay a failed job from the DLQ"""
        user_id = self._get_user_id()
        
        # First, get the job to verify it exists
        result = self.supabase.table('workflow_executions') \
            .select('id, workflow_id, input_data, execution_mode, max_retries') \
            .eq('id', job_id) \
            .eq('user_id', user_id) \
            .eq('state', 'FAILED') \
            .single() \
            .execute()
        
        if not result.data:
            print(f"Error: Job {job_id} not found in DLQ")
            return None
        
        job = result.data
        
        # Merge input data
        original_input = job.get('input_data', {})
        if isinstance(original_input, str):
            original_input = json.loads(original_input)
        
        merged_input = {**original_input, **(new_input_data or {})}
        
        print(f"\n🔁 Replaying Job: {job_id}")
        print(f"   Workflow: {job.get('workflow_id')}")
        print(f"   New Input Data: {json.dumps(merged_input, indent=2) if merged_input else '(original)'}")
        
        # In production, this would call the backend API
        # For CLI, we'll show what would be created
        
        print(f"\n✅ Would create new execution with:")
        print(f"   workflow_id: {job.get('workflow_id')}")
        print(f"   input_data: {json.dumps(merged_input, indent=2)}")
        print(f"   triggered_by: 'dlq_replay'")
        print(f"   trigger_data.replay_of: '{job_id}'")
        print(f"   max_retries: {job.get('max_retries', 3)}")
        
        # For demo purposes, create the new execution via backend
        # In production, call: POST /api/dlq/{jobId}/replay
        print(f"\n⚠️  Note: This is a dry-run. In production, call:")
        print(f"   curl -X POST http://localhost:3000/api/dlq/{job_id}/replay \\")
        print(f"     -H 'Authorization: Bearer YOUR_TOKEN' \\")
        print(f"     -H 'Content-Type: application/json'")
        
        return {
            original_job_id: job_id,
            workflow_id: job.get('workflow_id'),
            input_data: merged_input
        }
    
    def get_stats(self):
        """Get DLQ statistics"""
        user_id = self._get_user_id()
        
        # Get total count
        total_result = self.supabase.table('workflow_executions') \
            .select('id', count='exact') \
            .eq('state', 'FAILED') \
            .eq('user_id', user_id) \
            .execute()
        
        total_failed = total_result.count or 0
        
        # Get recent failures (last 24h)
        recent_threshold = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        recent_result = self.supabase.table('workflow_executions') \
            .select('id', count='exact') \
            .eq('state', 'FAILED') \
            .eq('user_id', user_id) \
            .gte('created_at', recent_threshold.isoformat()) \
            .execute()
        
        recent_failures = recent_result.count or 0
        
        # Get error category breakdown
        category_result = self.supabase.table('workflow_executions') \
            .select('error_category') \
            .eq('state', 'FAILED') \
            .eq('user_id', user_id) \
            .execute()
        
        categories = {}
        for row in category_result.data or []:
            cat = row.get('error_category') or 'unknown'
            categories[cat] = categories.get(cat, 0) + 1
        
        print(f"\n{'='*60}")
        print(f"DLQ STATISTICS")
        print(f"{'='*60}")
        print(f"\n📊 Overview:")
        print(f"   Total Failed Jobs: {total_failed}")
        print(f"   Failed in Last 24h: {recent_failures}")
        
        print(f"\n📈 Error Categories:")
        for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
            pct = (count / total_failed * 100) if total_failed > 0 else 0
            bar = '█' * int(pct / 5) + '░' * (20 - int(pct / 5))
            print(f"   {cat:<20} {count:>5} ({pct:>5.1f}%) {bar}")
        
        return {
            total_failed,
            recent_failures,
            by_category: categories
        }
    
    def get_categories(self):
        """Get list of error categories"""
        user_id = self._get_user_id()
        
        result = self.supabase.table('workflow_executions') \
            .select('error_category') \
            .eq('state', 'FAILED') \
            .eq('user_id', user_id) \
            .not_('error_category', 'is', None) \
            .execute()
        
        categories = sorted(list(set(row['error_category'] for row in result.data or [])))
        
        print(f"\n📋 Available Error Categories:")
        for cat in categories:
            print(f"   - {cat}")
        
        return categories
    
    def bulk_replay(self, job_ids: list, new_input_data: Optional[dict] = None):
        """Bulk replay multiple failed jobs"""
        user_id = self._get_user_id()
        
        print(f"\n🔁 Bulk Replay: {len(job_ids)} jobs")
        
        successful = 0
        failed = 0
        
        for job_id in job_ids:
            try:
                self.replay_job(job_id, new_input_data)
                successful += 1
            except Exception as e:
                print(f"   ❌ {job_id}: {e}")
                failed += 1
        
        print(f"\n✅ Results: {successful} successful, {failed} failed")
        
        return {'successful': successful, 'failed': failed}


def main():
    parser = argparse.ArgumentParser(
        description='DLQ Inspection Tool - Manage failed workflow executions',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List failed jobs
  python inspect_dlq.py list
  
  # List with pagination
  python inspect_dlq.py list --limit 20 --offset 20
  
  # Filter by workflow
  python inspect_dlq.py list --workflow-id abc123
  
  # Show job details
  python inspect_dlq.py show abc123-def456
  
  # Replay a job
  python inspect_dlq.py replay abc123-def456
  
  # Get DLQ statistics
  python inspect_dlq.py stats
  
  # List error categories
  python inspect_dlq.py categories
        """
    )
    
    parser.add_argument('command', choices=['list', 'show', 'replay', 'stats', 'categories'],
                       help='Command to execute')
    parser.add_argument('job_id', nargs='?', help='Job ID for show/replay')
    parser.add_argument('--limit', type=int, default=50, help='Limit results (default: 50)')
    parser.add_argument('--offset', type=int, default=0, help='Offset for pagination')
    parser.add_argument('--workflow-id', help='Filter by workflow ID')
    parser.add_argument('--category', help='Filter by error category')
    parser.add_argument('--input', '-i', help='JSON input data for replay (file or string)')
    
    args = parser.parse_args()
    
    inspector = DLQInspector()
    
    # Parse input data for replay
    new_input_data = None
    if args.input:
        if os.path.exists(args.input):
            with open(args.input) as f:
                new_input_data = json.load(f)
        else:
            try:
                new_input_data = json.loads(args.input)
            except json.JSONDecodeError as e:
                print(f"Error: Invalid JSON input: {e}")
                sys.exit(1)
    
    if args.command == 'list':
        inspector.list_jobs(args.limit, args.offset, args.workflow_id, args.category)
    elif args.command == 'show':
        if not args.job_id:
            parser.error('Job ID required for show command')
        inspector.show_job(args.job_id)
    elif args.command == 'replay':
        if not args.job_id:
            parser.error('Job ID required for replay command')
        inspector.replay_job(args.job_id, new_input_data)
    elif args.command == 'stats':
        inspector.get_stats()
    elif args.command == 'categories':
        inspector.get_categories()


if __name__ == '__main__':
    main()
