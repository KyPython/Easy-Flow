"""
Example Python Kafka consumer that extracts tenant header and sets DB session tenant.
Requires confluent-kafka or kafka-python; this example uses kafka-python-like interface.
"""
from kafka import KafkaConsumer
from rpa_system.worker.set_tenant import set_tenant

def process_message(db_pool, message):
    # placeholder
    pass

def run_consumer(topic, db_pool, bootstrap_servers='localhost:9092'):
    consumer = KafkaConsumer(topic, bootstrap_servers=bootstrap_servers, auto_offset_reset='earliest')
    for msg in consumer:
        tenant = None
        # kafka-python stores headers as list of tuples
        if msg.headers:
            for k, v in msg.headers:
                if k.decode() if isinstance(k, bytes) else k == 'tenant-id':
                    tenant = v.decode() if isinstance(v, bytes) else v
                    break

        payload = None
        try:
            payload = msg.value.decode() if isinstance(msg.value, bytes) else msg.value
        except Exception:
            payload = msg.value

        with db_pool.connection() as conn:
            with set_tenant(conn, tenant or 'unknown'):
                process_message(conn, payload)
