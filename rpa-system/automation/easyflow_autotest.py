#!/usr/bin/env python3
import os,sys,json,time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

env_path=os.path.expanduser('~/rpa-system/.env')
if not os.path.exists(env_path):
 print('ERR: .env not found at', env_path); sys.exit(1)
from typing import Dict, Optional

vals: Dict[str, str] = {}
with open(env_path) as f:
 for line in f:
 if '=' in line:
 k,v=line.rstrip('\n').split('=',1)
 vals[k]=v
SUPABASE_URL: Optional[str] = vals.get('SUPABASE_URL')
SUPABASE_ANON_KEY: Optional[str] = vals.get('SUPABASE_ANON_KEY')
SUPABASE_SERVICE_ROLE: Optional[str] = vals.get('SUPABASE_SERVICE_ROLE')
if not SUPABASE_URL or not SUPABASE_ANON_KEY or not SUPABASE_SERVICE_ROLE:
 print('ERR: missing SUPABASE_* in .env'); sys.exit(2)

# create test user
ts=int(time.time())
email=f'test+autotest_{ts}@example.com'
# ✅ SECURITY: Use environment variable for test password (fallback for local testing only)
password=os.getenv('TEST_USER_PASSWORD', 'TempPassw0rd!') # Test password - use env var in CI/CD
print('Creating test user:', email)
create_payload: Dict[str, object] = {'email': email, 'password': password, 'email_confirm': True}
create_out='/tmp/create_user.json'
try:
 req=Request(f"{SUPABASE_URL}/auth/v1/admin/users", data=json.dumps(create_payload).encode('utf-8'), headers={'Authorization':f'Bearer {SUPABASE_SERVICE_ROLE}','Content-Type':'application/json'}, method='POST')
 resp=urlopen(req, timeout=15)
 body=resp.read().decode('utf-8')
 code=resp.getcode()
except HTTPError as e:
 code=e.code
 body=e.read().decode('utf-8')
except URLError as e:
 print('ERR: network/URL error during create_user:', e)
 sys.exit(4)
open(create_out,'w').write(body)
print('create_user HTTP status:', code)

# exchange token
token_out='/tmp/token.json'
try:
 token_payload={'email':email,'password':password}
 req2=Request(f"{SUPABASE_URL}/auth/v1/token?grant_type=password", data=json.dumps(token_payload).encode('utf-8'), headers={'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json'}, method='POST')
 resp2=urlopen(req2, timeout=15)
 body2=resp2.read().decode('utf-8')
 code2=resp2.getcode()
except HTTPError as e:
 code2=e.code
 body2=e.read().decode('utf-8')
except URLError as e:
 print('ERR: network/URL error during token exchange:', e); sys.exit(5)
open(token_out,'w').write(body2)
print('token endpoint HTTP status:', code2)
try:
 token_json=json.loads(body2)
 access_token=token_json.get('access_token','')
except Exception:
 access_token=''
if not access_token:
 print('ERR: no access token; token response first 400 chars:')
 print(body2[:400])
 sys.exit(3)
print('got access token tail (masked): **'+access_token[-6:])

# call backend protected endpoint
prot_out='/tmp/prot.json'
try:
 req3=Request('http://localhost:3001/api/logs?limit=1', headers={'Authorization':f'Bearer {access_token}'})
 resp3=urlopen(req3, timeout=15)
 body3=resp3.read().decode('utf-8')
 code3=resp3.getcode()
except HTTPError as e:
 code3=e.code
 body3=e.read().decode('utf-8')
except URLError as e:
 print('ERR: network/URL error calling backend:', e); sys.exit(6)
open(prot_out,'w').write(body3)
print('protected endpoint HTTP status:', code3)
print('protected endpoint response (first 800 chars):')
print(body3[:800])
