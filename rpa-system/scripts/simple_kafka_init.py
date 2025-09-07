#!/usr/bin/env python3
"""
Simple Kafka Initialization Check for Python Services
Compatible with current environment and handles missing dependencies gracefully
"""

import os
import sys
import time
import json
import socket
from typing import Optional, Dict, Any

def check_kafka_connectivity(host: str = "localhost", port: int = 9092, timeout: int = 5) -> bool:
    """
    Simple socket-based Kafka connectivity check
    """
    try:
        sock = socket.create_connection((host, port), timeout)
        sock.close()
        return True
    except (socket.error, OSError):
        return False

def check_kafka_python_package() -> bool:
    """
    Check if kafka-python package is available and working
    """
    try:
        import kafka
        return True
    except ImportError:
        print("❌ kafka-python package not available")
        print("💡 Install with: pip install kafka-python==2.0.2")
        return False
    except Exception as e:
        print(f"❌ kafka-python package error: {e}")
        return False

def get_environment_config() -> Dict[str, Any]:
    """
    Get Kafka configuration from environment variables
    """
    return {
        'enabled': os.getenv('KAFKA_ENABLED', 'true').lower() == 'true',
        'bootstrap_servers': os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092'),
        'task_topic': os.getenv('KAFKA_TASK_TOPIC', 'automation-tasks'),
        'result_topic': os.getenv('KAFKA_RESULT_TOPIC', 'automation-results'),
        'consumer_group': os.getenv('KAFKA_CONSUMER_GROUP', 'automation-workers'),
        'retry_attempts': int(os.getenv('KAFKA_RETRY_ATTEMPTS', '5')),
        'retry_delay': int(os.getenv('KAFKA_RETRY_DELAY', '10'))
    }

def test_basic_connectivity() -> bool:
    """
    Test basic Kafka connectivity without requiring kafka-python
    """
    config = get_environment_config()
    
    if not config['enabled']:
        print("🔇 Kafka is disabled (KAFKA_ENABLED=false)")
        return True
    
    # Parse bootstrap servers
    servers = config['bootstrap_servers'].split(',')
    
    print(f"📡 Testing connectivity to Kafka servers: {servers}")
    
    for server in servers:
        if ':' in server:
            host, port = server.split(':')
            port = int(port)
        else:
            host = server
            port = 9092
        
        print(f"🔍 Checking {host}:{port}...")
        
        if check_kafka_connectivity(host, port):
            print(f"✅ Connection successful to {host}:{port}")
            return True
        else:
            print(f"❌ Connection failed to {host}:{port}")
    
    return False

def initialize_kafka_simple() -> bool:
    """
    Simple Kafka initialization that doesn't require complex dependencies
    """
    print("🚀 Simple Kafka Initialization for Python Services")
    print("=" * 60)
    
    # Check environment configuration
    config = get_environment_config()
    
    print(f"🔧 Configuration:")
    print(f"   Enabled: {config['enabled']}")
    print(f"   Bootstrap Servers: {config['bootstrap_servers']}")
    print(f"   Task Topic: {config['task_topic']}")
    print(f"   Result Topic: {config['result_topic']}")
    print(f"   Consumer Group: {config['consumer_group']}")
    print()
    
    if not config['enabled']:
        print("✅ Kafka disabled - initialization complete")
        return True
    
    # Test basic connectivity
    if not test_basic_connectivity():
        print("❌ Kafka connectivity test failed")
        
        # Check if Kafka is required
        kafka_required = os.getenv('KAFKA_REQUIRED', 'true').lower() == 'true'
        if kafka_required:
            print("🚨 Kafka is required but unavailable")
            return False
        else:
            print("⚠️ Kafka unavailable but not required - continuing")
            return True
    
    # Check Python package availability
    if not check_kafka_python_package():
        print("⚠️ kafka-python package not available")
        print("🔧 Your service will run in HTTP-only mode")
        return True
    
    print("✅ Basic Kafka initialization successful")
    print("🎉 Python services can attempt Kafka connections")
    
    return True

def main():
    """
    Main initialization function
    """
    success = initialize_kafka_simple()
    
    if success:
        print("\n🎉 Kafka initialization completed!")
        sys.exit(0)
    else:
        print("\n❌ Kafka initialization failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
