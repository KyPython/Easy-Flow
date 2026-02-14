import os
import json
import requests

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE = os.getenv('SUPABASE_SERVICE_ROLE')

def meter_action(user_id=None, workflow_execution_id=None, action_type='unknown', payload=None):
    """Record an action into Supabase actions table via REST API.
    Safe no-op if env missing.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE:
        return {'error': 'missing_env'}
    try:
        url = SUPABASE_URL.rstrip('/') + '/rest/v1/actions'
        record = {
            'user_id': user_id,
            'workflow_execution_id': workflow_execution_id,
            'action_type': action_type,
            'payload': payload or {},
            'created_at': __import__('datetime').datetime.utcnow().isoformat() + 'Z'
        }
        headers = {
            'apikey': SUPABASE_SERVICE_ROLE,
            'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
        resp = requests.post(url, headers=headers, data=json.dumps(record), timeout=10)
        if resp.status_code >= 300:
            return {'error': f'http_{resp.status_code}', 'details': resp.text}
        try:
            data = resp.json()
        except Exception:
            data = None
        return {'data': data}
    except Exception as e:
        return {'error': str(e)}
