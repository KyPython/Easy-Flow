"""
Helper to set Postgres session tenant from a worker process.
Usage example:
    with set_tenant(conn, tenant_id):
        conn.execute("INSERT INTO ...")

This uses psycopg (psycopg3) or psycopg2-compatible cursor.execute.
"""
from contextlib import contextmanager

@contextmanager
def set_tenant(conn, tenant_id):
    """Set `app.current_tenant` on a given DB connection for the context.

    conn can be a psycopg3 connection or a psycopg2 connection with .cursor()
    """
    cur = None
    try:
        # psycopg3: conn.execute
        try:
            conn.execute("SELECT set_config('app.current_tenant', %s, true)", (str(tenant_id),))
        except Exception:
            # Try cursor-based API
            cur = conn.cursor()
            cur.execute("SELECT set_config('app.current_tenant', %s, true)", (str(tenant_id),))
        yield
    finally:
        # Optionally clear tenant
        try:
            if cur:
                cur.execute("SELECT set_config('app.current_tenant', '', true)")
            else:
                conn.execute("SELECT set_config('app.current_tenant', '', true)")
        except Exception:
            # best-effort
            pass


def example_worker_loop(db_pool, kafka_consumer):
    """Example: fetch Kafka message, set tenant on DB, process."""
    for msg in kafka_consumer:
        # prefer tenant header, fallback to msg value tenant field
        tenant = None
        if hasattr(msg, 'headers') and msg.headers:
            for k, v in msg.headers:
                if k.lower() == 'tenant-id':
                    tenant = v.decode() if isinstance(v, bytes) else v
                    break

        if not tenant and hasattr(msg, 'value'):
            tenant = getattr(msg.value, 'tenant_id', None) or (msg.value.get('tenant_id') if isinstance(msg.value, dict) else None)

        with db_pool.connection() as conn:
            with set_tenant(conn, tenant or 'unknown'):
                # do DB processing here using conn
                pass
