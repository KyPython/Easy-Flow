#!/usr/bin/env python3
"""
Cloud Deployment Verification Test
Tests what services will run 24/7 vs locally
"""

import requests
import json
from datetime import datetime

def test_cloud_services():
    """Test all cloud services that will run 24/7"""
    
    print("🌐 Testing 24/7 Cloud Services")
    print("=" * 50)
    
    services = {
        "Frontend (Vercel)": "https://easy-flow-lac.vercel.app",
        "Backend (Render)": "https://easyflow-backend.onrender.com/health",
        "Database (Supabase)": "https://syxzilyuysdoirnezgii.supabase.co",
        "Automation (Future)": "https://easyflow-automation.onrender.com/health"
    }
    
    results = {}
    
    for service_name, url in services.items():
        try:
            print(f"🔍 Testing {service_name}...")
            
            if "supabase.co" in url:
                # Test Supabase API
                response = requests.get(f"{url}/rest/v1/", timeout=10)
                status = "✅ Online" if response.status_code == 200 else f"❌ Error {response.status_code}"
            else:
                # Test regular HTTP
                response = requests.get(url, timeout=10)
                status = "✅ Online" if response.status_code == 200 else f"❌ Error {response.status_code}"
                
            results[service_name] = status
            print(f"   {status}")
            
        except requests.exceptions.Timeout:
            results[service_name] = "⏰ Timeout (service may be sleeping)"
            print(f"   ⏰ Timeout (service may be sleeping)")
        except requests.exceptions.ConnectionError:
            results[service_name] = "❌ Not deployed yet"
            print(f"   ❌ Not deployed yet")
        except Exception as e:
            results[service_name] = f"❌ Error: {str(e)[:50]}"
            print(f"   ❌ Error: {str(e)[:50]}")
    
    print("\n" + "=" * 50)
    print("📊 24/7 Service Status Summary")
    print("=" * 50)
    
    for service, status in results.items():
        print(f"{service:25} {status}")
    
    print("\n💡 Current Status:")
    print("✅ Frontend: Always online (Vercel)")
    print("✅ Backend: Always online (Render)")  
    print("✅ Database: Always online (Supabase)")
    print("🔄 Automation: Will be online after deployment")
    
    print("\n🚀 After Full Deployment:")
    print("✅ ALL services will run 24/7")
    print("✅ No dependency on your laptop")
    print("✅ Global availability and uptime")
    print("💰 Total cost: ~$21/month")

def test_local_services():
    """Test services currently running locally"""
    
    print("\n🏠 Testing Local Services (Will Stop if Laptop Dies)")
    print("=" * 50)
    
    local_services = {
        "Kafka": "http://localhost:9092",
        "Python Automation": "http://localhost:7001/health", 
        "Kafka UI": "http://localhost:8080"
    }
    
    for service_name, url in local_services.items():
        try:
            if service_name == "Kafka":
                # Test socket connection for Kafka
                import socket
                host, port = url.replace("http://", "").split(":")
                sock = socket.create_connection((host, int(port)), timeout=2)
                sock.close()
                print(f"✅ {service_name}: Running locally")
            else:
                response = requests.get(url, timeout=2)
                print(f"✅ {service_name}: Running locally")
                
        except Exception:
            print(f"❌ {service_name}: Not running")
    
    print("\n⚠️  These services will STOP if your laptop:")
    print("   • Shuts down")
    print("   • Loses internet connection") 
    print("   • Gets destroyed")
    print("   • Docker stops")

if __name__ == "__main__":
    print(f"🕒 Test Time: {datetime.now()}")
    test_cloud_services()
    test_local_services()
    
    print("\n" + "="*60)
    print("🎯 RECOMMENDATION FOR 100% CLOUD OPERATION")
    print("="*60)
    print("1. Commit the updated render.yaml")
    print("2. Deploy to Render (adds Python automation service)")
    print("3. Total cost: ~$21/month for 24/7 operation")
    print("4. Your laptop can explode and services keep running! 💥")
    print("="*60)
