#!/usr/bin/env python3
"""
Complete Notion Life Operating System Setup
Creates all databases, relations, and dashboards for managing:
- Business (projects, clients, tasks, decisions)
- Personal (health, finance, relationships, goals)
- Creative (ideas, learning, knowledge)
- Automation and integrations
"""

import os
import requests
import json
from datetime import datetime

NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_WORKSPACE_PAGE_ID = os.getenv("NOTION_WORKSPACE_PAGE_ID")  # Parent page where everything will be created

# If no workspace page ID provided, we'll create one

# Color constants for Notion
COLORS = {
    "blue": "blue",
    "brown": "brown",
    "gray": "gray",
    "green": "green",
    "orange": "orange",
    "pink": "pink",
    "purple": "purple",
    "red": "red",
    "yellow": "yellow"
}

def create_database(title, properties, parent_id, description=None):
    """Create a Notion database with properties"""
    url = "https://api.notion.com/v1/databases"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    
    data = {
        "parent": {
            "type": "page_id",
            "page_id": parent_id
        },
        "title": [{"text": {"content": title}}],
        "properties": properties
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        result = response.json()
        db_id = result["id"]
        print(f"✅ Created '{title}' database")
        print(f"   ID: {db_id}")
        if description:
            print(f"   📝 {description}")
        return db_id
    else:
        print(f"❌ Error creating '{title}': {response.status_code}")
        print(f"   Response: {response.text}")
        return None

def create_page(title, parent_id, content_blocks=None):
    """Create a Notion page"""
    url = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    
    children = []
    if content_blocks:
        children = content_blocks
    else:
        children = [{
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": ""}}]
            }
        }]
    
    data = {
        "parent": {
            "type": "page_id",
            "page_id": parent_id
        },
        "properties": {
            "title": {
                "title": [{"text": {"content": title}}]
            }
        },
        "children": children
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        result = response.json()
        page_id = result["id"]
        print(f"✅ Created page '{title}'")
        return page_id
    else:
        print(f"❌ Error creating page '{title}': {response.status_code}")
        print(f"   Response: {response.text}")
        return None

def search_for_workspace_page():
    """Search for an existing workspace page or create one"""
    url = "https://api.notion.com/v1/search"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    
    # Search for pages with "Life OS" or "Workspace" in title
    data = {
        "query": "Life OS",
        "filter": {"property": "object", "value": "page"},
        "sort": {"direction": "descending", "timestamp": "last_edited_time"}
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        results = response.json().get("results", [])
        if results:
            page_id = results[0]["id"]
            print(f"✅ Found existing workspace page: {results[0].get('properties', {}).get('title', {}).get('title', [{}])[0].get('plain_text', 'Untitled')}")
            return page_id
    
    # If no existing page found, try to get root pages
    data = {"filter": {"property": "object", "value": "page"}}
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 200:
        results = response.json().get("results", [])
        if results:
            # Use the first accessible page as parent
            page_id = results[0]["id"]
            print(f"✅ Using existing page as workspace")
            return page_id
    
    return None

def main():
    if not NOTION_API_KEY:
        print("❌ NOTION_API_KEY not set")
        print("   Set it with: export NOTION_API_KEY='your-token'")
        return
    
    workspace_page_id = NOTION_WORKSPACE_PAGE_ID
    
    if not workspace_page_id:
        print("🔍 No workspace page ID provided, searching for existing page...")
        workspace_page_id = search_for_workspace_page()
        
        if not workspace_page_id:
            print("❌ Could not find a workspace page")
            print("   Please provide NOTION_WORKSPACE_PAGE_ID or create a page in Notion first")
            print("   Get the page ID from the URL: https://www.notion.so/YOUR-PAGE-NAME-XXXXXXXXXXXXXX")
            return
        else:
            print(f"   Using page ID: {workspace_page_id}\n")
    
    print("🚀 Creating Complete Notion Life Operating System...\n")
    print("=" * 70)
    
    # ============================================
    # 1. CORE BUSINESS DATABASES
    # ============================================
    print("\n📊 BUSINESS DATABASES")
    print("-" * 70)
    
    # Projects Database
    projects_props = {
        "Name": {"title": {}},
        "Status": {
            "select": {
                "options": [
                    {"name": "Planning", "color": "yellow"},
                    {"name": "Active", "color": "blue"},
                    {"name": "On Hold", "color": "gray"},
                    {"name": "Completed", "color": "green"},
                    {"name": "Cancelled", "color": "red"}
                ]
            }
        },
        "Priority": {
            "select": {
                "options": [
                    {"name": "Critical", "color": "red"},
                    {"name": "High", "color": "orange"},
                    {"name": "Medium", "color": "yellow"},
                    {"name": "Low", "color": "gray"}
                ]
            }
        },
        "Client": {"rich_text": {}},
        "Start Date": {"date": {}},
        "Due Date": {"date": {}},
        "Progress": {"number": {}},
        "Budget": {"number": {}},
        "Time Spent": {"number": {}},
        "Tags": {"multi_select": {}},
        "Notes": {"rich_text": {}},
        "Created": {"created_time": {}},
        "Last Updated": {"last_edited_time": {}}
    }
    projects_db_id = create_database(
        "Projects",
        projects_props,
        workspace_page_id,
        "All business and personal projects"
    )
    
    # Tasks Database (linked to Projects)
    tasks_props = {
        "Task": {"title": {}},
        "Project": {
            "relation": {
                "database_id": projects_db_id if projects_db_id else "",
                "type": "dual_property",
                "dual_property": {"synced_property_name": "Tasks"}
            }
        },
        "Status": {
            "select": {
                "options": [
                    {"name": "Not Started", "color": "gray"},
                    {"name": "In Progress", "color": "blue"},
                    {"name": "Blocked", "color": "red"},
                    {"name": "Done", "color": "green"}
                ]
            }
        },
        "Priority": {
            "select": {
                "options": [
                    {"name": "P0 - Critical", "color": "red"},
                    {"name": "P1 - High", "color": "orange"},
                    {"name": "P2 - Medium", "color": "yellow"},
                    {"name": "P3 - Low", "color": "gray"}
                ]
            }
        },
        "Due Date": {"date": {}},
        "Time Estimate": {"number": {}},
        "Time Actual": {"number": {}},
        "Assignee": {"rich_text": {}},
        "Context": {
            "select": {
                "options": [
                    {"name": "Work", "color": "blue"},
                    {"name": "Personal", "color": "green"},
                    {"name": "Health", "color": "pink"},
                    {"name": "Learning", "color": "purple"},
                    {"name": "Creative", "color": "orange"}
                ]
            }
        },
        "Energy Level": {
            "select": {
                "options": [
                    {"name": "High Energy", "color": "green"},
                    {"name": "Medium Energy", "color": "yellow"},
                    {"name": "Low Energy", "color": "orange"},
                    {"name": "Deep Work", "color": "blue"}
                ]
            }
        },
        "Tags": {"multi_select": {}},
        "Notes": {"rich_text": {}}
    }
    tasks_db_id = create_database(
        "Tasks",
        tasks_props,
        workspace_page_id,
        "All actionable tasks across all areas of life"
    )
    
    # Clients Database
    clients_props = {
        "Name": {"title": {}},
        "Status": {
            "select": {
                "options": [
                    {"name": "Prospect", "color": "yellow"},
                    {"name": "Active", "color": "green"},
                    {"name": "On Hold", "color": "gray"},
                    {"name": "Past", "color": "blue"}
                ]
            }
        },
        "Contact Email": {"email": {}},
        "Contact Phone": {"phone_number": {}},
        "Company": {"rich_text": {}},
        "Industry": {"rich_text": {}},
        "Value": {"number": {}},
        "Last Contact": {"date": {}},
        "Next Follow-up": {"date": {}},
        "Notes": {"rich_text": {}}
    }
    clients_db_id = create_database(
        "Clients",
        clients_props,
        workspace_page_id,
        "All clients and business relationships"
    )
    
    # ============================================
    # 2. DECISION-MAKING & STRATEGY
    # ============================================
    print("\n🎯 DECISION-MAKING DATABASES")
    print("-" * 70)
    
    # Decisions Database
    decisions_props = {
        "Name": {"title": {}},  # Notion requires title property
        "Status": {
            "select": {
                "options": [
                    {"name": "Pending", "color": "yellow"},
                    {"name": "Decided", "color": "green"},
                    {"name": "Deferred", "color": "gray"},
                    {"name": "Rejected", "color": "red"}
                ]
            }
        },
        "Decision Date": {"date": {}},
        "Urgency": {
            "select": {
                "options": [
                    {"name": "Immediate", "color": "red"},
                    {"name": "This Week", "color": "orange"},
                    {"name": "This Month", "color": "yellow"},
                    {"name": "No Rush", "color": "gray"}
                ]
            }
        },
        "Impact": {
            "select": {
                "options": [
                    {"name": "High", "color": "red"},
                    {"name": "Medium", "color": "yellow"},
                    {"name": "Low", "color": "gray"}
                ]
            }
        },
        "Options": {"rich_text": {}},
        "Pros": {"rich_text": {}},
        "Cons": {"rich_text": {}},
        "Decision": {"rich_text": {}},
        "Rationale": {"rich_text": {}},
        "Outcome": {"rich_text": {}}
    }
    decisions_db_id = create_database(
        "Decisions",
        decisions_props,
        workspace_page_id,
        "Track all decisions, options, and outcomes"
    )
    
    # Goals Database
    goals_props = {
        "Goal": {"title": {}},
        "Category": {
            "select": {
                "options": [
                    {"name": "Business", "color": "blue"},
                    {"name": "Health", "color": "pink"},
                    {"name": "Financial", "color": "green"},
                    {"name": "Learning", "color": "purple"},
                    {"name": "Creative", "color": "orange"},
                    {"name": "Relationships", "color": "red"}
                ]
            }
        },
        "Status": {
            "select": {
                "options": [
                    {"name": "Not Started", "color": "gray"},
                    {"name": "In Progress", "color": "blue"},
                    {"name": "Achieved", "color": "green"},
                    {"name": "Paused", "color": "yellow"}
                ]
            }
        },
        "Target Date": {"date": {}},
        "Progress": {"number": {}},
        "Success Metrics": {"rich_text": {}},
        "Current Status": {"rich_text": {}},
        "Next Steps": {"rich_text": {}}
    }
    goals_db_id = create_database(
        "Goals",
        goals_props,
        workspace_page_id,
        "Long-term and short-term goals across all areas"
    )
    
    # ============================================
    # 3. PERSONAL LIFE MANAGEMENT
    # ============================================
    print("\n💚 PERSONAL LIFE DATABASES")
    print("-" * 70)
    
    # Health Database
    health_props = {
        "Date": {"date": {}},
        "Type": {
            "select": {
                "options": [
                    {"name": "Exercise", "color": "green"},
                    {"name": "Nutrition", "color": "orange"},
                    {"name": "Sleep", "color": "blue"},
                    {"name": "Mental Health", "color": "purple"},
                    {"name": "Medical", "color": "red"}
                ]
            }
        },
        "Activity": {"title": {}},
        "Duration": {"number": {}},
        "Intensity": {
            "select": {
                "options": [
                    {"name": "Low", "color": "gray"},
                    {"name": "Medium", "color": "yellow"},
                    {"name": "High", "color": "red"}
                ]
            }
        },
        "Notes": {"rich_text": {}}
    }
    health_db_id = create_database(
        "Health",
        health_props,
        workspace_page_id,
        "Track exercise, nutrition, sleep, and wellness"
    )
    
    # Finance Database
    finance_props = {
        "Transaction": {"title": {}},
        "Type": {
            "select": {
                "options": [
                    {"name": "Income", "color": "green"},
                    {"name": "Expense", "color": "red"},
                    {"name": "Investment", "color": "blue"},
                    {"name": "Transfer", "color": "gray"}
                ]
            }
        },
        "Category": {
            "select": {
                "options": [
                    {"name": "Business", "color": "blue"},
                    {"name": "Personal", "color": "green"},
                    {"name": "Health", "color": "pink"},
                    {"name": "Education", "color": "purple"},
                    {"name": "Entertainment", "color": "orange"}
                ]
            }
        },
        "Amount": {"number": {}},
        "Date": {"date": {}},
        "Account": {"rich_text": {}},
        "Notes": {"rich_text": {}}
    }
    finance_db_id = create_database(
        "Finance",
        finance_props,
        workspace_page_id,
        "Track all income, expenses, and financial goals"
    )
    
    # Relationships Database
    relationships_props = {
        "Name": {"title": {}},
        "Type": {
            "select": {
                "options": [
                    {"name": "Family", "color": "red"},
                    {"name": "Friend", "color": "blue"},
                    {"name": "Professional", "color": "green"},
                    {"name": "Mentor", "color": "purple"},
                    {"name": "Mentee", "color": "orange"}
                ]
            }
        },
        "Last Contact": {"date": {}},
        "Next Contact": {"date": {}},
        "Contact Method": {
            "select": {
                "options": [
                    {"name": "In Person", "color": "green"},
                    {"name": "Phone", "color": "blue"},
                    {"name": "Email", "color": "yellow"},
                    {"name": "Text", "color": "gray"}
                ]
            }
        },
        "Notes": {"rich_text": {}}
    }
    relationships_db_id = create_database(
        "Relationships",
        relationships_props,
        workspace_page_id,
        "Track important relationships and contact frequency"
    )
    
    # ============================================
    # 4. CREATIVE & LEARNING
    # ============================================
    print("\n🎨 CREATIVE & LEARNING DATABASES")
    print("-" * 70)
    
    # Ideas Database
    ideas_props = {
        "Idea": {"title": {}},
        "Status": {
            "select": {
                "options": [
                    {"name": "Seed", "color": "gray"},
                    {"name": "Developing", "color": "yellow"},
                    {"name": "Ready to Execute", "color": "blue"},
                    {"name": "Executed", "color": "green"},
                    {"name": "Archived", "color": "red"}
                ]
            }
        },
        "Category": {
            "select": {
                "options": [
                    {"name": "Business", "color": "blue"},
                    {"name": "Product", "color": "green"},
                    {"name": "Creative", "color": "orange"},
                    {"name": "Learning", "color": "purple"},
                    {"name": "Life Improvement", "color": "pink"}
                ]
            }
        },
        "Potential Impact": {
            "select": {
                "options": [
                    {"name": "High", "color": "red"},
                    {"name": "Medium", "color": "yellow"},
                    {"name": "Low", "color": "gray"}
                ]
            }
        },
        "Effort": {
            "select": {
                "options": [
                    {"name": "Low", "color": "green"},
                    {"name": "Medium", "color": "yellow"},
                    {"name": "High", "color": "red"}
                ]
            }
        },
        "Description": {"rich_text": {}},
        "Next Steps": {"rich_text": {}}
    }
    ideas_db_id = create_database(
        "Ideas",
        ideas_props,
        workspace_page_id,
        "Capture and develop all ideas"
    )
    
    # Learning Database
    learning_props = {
        "Topic": {"title": {}},
        "Status": {
            "select": {
                "options": [
                    {"name": "Want to Learn", "color": "yellow"},
                    {"name": "Learning", "color": "blue"},
                    {"name": "Practicing", "color": "orange"},
                    {"name": "Proficient", "color": "green"},
                    {"name": "Mastered", "color": "purple"}
                ]
            }
        },
        "Category": {
            "select": {
                "options": [
                    {"name": "Technical", "color": "blue"},
                    {"name": "Business", "color": "green"},
                    {"name": "Creative", "color": "orange"},
                    {"name": "Personal Development", "color": "purple"}
                ]
            }
        },
        "Start Date": {"date": {}},
        "Target Date": {"date": {}},
        "Resources": {"rich_text": {}},
        "Progress": {"number": {}},
        "Notes": {"rich_text": {}}
    }
    learning_db_id = create_database(
        "Learning",
        learning_props,
        workspace_page_id,
        "Track all learning goals and progress"
    )
    
    # Knowledge Base Database
    knowledge_props = {
        "Title": {"title": {}},
        "Category": {
            "select": {
                "options": [
                    {"name": "Technical", "color": "blue"},
                    {"name": "Business", "color": "green"},
                    {"name": "Personal", "color": "pink"},
                    {"name": "Reference", "color": "gray"}
                ]
            }
        },
        "Tags": {"multi_select": {}},
        "Content": {"rich_text": {}},
        "Source": {"rich_text": {}},
        "Date Added": {"date": {}}
    }
    knowledge_db_id = create_database(
        "Knowledge Base",
        knowledge_props,
        workspace_page_id,
        "Store all important knowledge and references"
    )
    
    # ============================================
    # 5. TIME & CALENDAR INTEGRATION
    # ============================================
    print("\n📅 TIME MANAGEMENT DATABASES")
    print("-" * 70)
    
    # Calendar Events Database
    calendar_props = {
        "Event": {"title": {}},
        "Date": {"date": {}},
        "Time": {"rich_text": {}},
        "Type": {
            "select": {
                "options": [
                    {"name": "Meeting", "color": "blue"},
                    {"name": "Work Session", "color": "green"},
                    {"name": "Personal", "color": "pink"},
                    {"name": "Health", "color": "orange"},
                    {"name": "Learning", "color": "purple"}
                ]
            }
        },
        "Location": {"rich_text": {}},
        "Attendees": {"rich_text": {}},
        "Notes": {"rich_text": {}}
    }
    calendar_db_id = create_database(
        "Calendar",
        calendar_props,
        workspace_page_id,
        "Track all scheduled events and appointments"
    )
    
    # Time Tracking Database
    time_tracking_props = {
        "Activity": {"title": {}},
        "Date": {"date": {}},
        "Start Time": {"rich_text": {}},
        "End Time": {"rich_text": {}},
        "Duration": {"number": {}},
        "Category": {
            "select": {
                "options": [
                    {"name": "Work", "color": "blue"},
                    {"name": "Personal", "color": "green"},
                    {"name": "Health", "color": "pink"},
                    {"name": "Learning", "color": "purple"},
                    {"name": "Creative", "color": "orange"}
                ]
            }
        },
        "Project": {
            "relation": {
                "database_id": projects_db_id if projects_db_id else "",
                "type": "dual_property",
                "dual_property": {"synced_property_name": "Time Logs"}
            }
        },
        "Notes": {"rich_text": {}}
    }
    time_tracking_db_id = create_database(
        "Time Tracking",
        time_tracking_props,
        workspace_page_id,
        "Track how time is spent across all activities"
    )
    
    # ============================================
    # 6. MASTER DASHBOARD PAGE
    # ============================================
    print("\n📊 CREATING MASTER DASHBOARD")
    print("-" * 70)
    
    dashboard_content = [
        {
            "object": "block",
            "type": "heading_1",
            "heading_1": {
                "rich_text": [{"type": "text", "text": {"content": "🎯 Life Operating System Dashboard"}}]
            }
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"}}]
            }
        },
        {
            "object": "block",
            "type": "divider",
            "divider": {}
        },
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "📊 Today's Focus"}}]
            }
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": "View your tasks, calendar, and priorities for today."}}]
            }
        },
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "🎯 Active Projects"}}]
            }
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": "All active projects across business and personal life."}}]
            }
        },
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "💡 Decisions Pending"}}]
            }
        },
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": "Decisions that need to be made and their impact."}}]
            }
        },
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "📚 Quick Links"}}]
            }
        },
        {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [{"type": "text", "text": {"content": "Tasks - What needs to be done"}}]
            }
        },
        {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [{"type": "text", "text": {"content": "Projects - All active initiatives"}}]
            }
        },
        {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [{"type": "text", "text": {"content": "Decisions - Track all decisions and outcomes"}}]
            }
        },
        {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [{"type": "text", "text": {"content": "Goals - Long-term and short-term objectives"}}]
            }
        },
        {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [{"type": "text", "text": {"content": "Health - Wellness and fitness tracking"}}]
            }
        },
        {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [{"type": "text", "text": {"content": "Finance - Income, expenses, and financial goals"}}]
            }
        },
        {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [{"type": "text", "text": {"content": "Ideas - Capture and develop all ideas"}}]
            }
        },
        {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [{"type": "text", "text": {"content": "Learning - Track learning progress"}}]
            }
        },
        {
            "object": "block",
            "type": "bulleted_list_item",
            "bulleted_list_item": {
                "rich_text": [{"type": "text", "text": {"content": "Knowledge Base - Store important information"}}]
            }
        }
    ]
    
    dashboard_page_id = create_page(
        "🎯 Life OS Dashboard",
        workspace_page_id,
        dashboard_content
    )
    
    # ============================================
    # SUMMARY
    # ============================================
    print("\n" + "=" * 70)
    print("✅ SETUP COMPLETE!")
    print("=" * 70)
    print("\n📋 DATABASE IDs (save these for automation):")
    print("-" * 70)
    
    databases = {
        "PROJECTS_DB_ID": projects_db_id,
        "TASKS_DB_ID": tasks_db_id,
        "CLIENTS_DB_ID": clients_db_id,
        "DECISIONS_DB_ID": decisions_db_id,
        "GOALS_DB_ID": goals_db_id,
        "HEALTH_DB_ID": health_db_id,
        "FINANCE_DB_ID": finance_db_id,
        "RELATIONSHIPS_DB_ID": relationships_db_id,
        "IDEAS_DB_ID": ideas_db_id,
        "LEARNING_DB_ID": learning_db_id,
        "KNOWLEDGE_DB_ID": knowledge_db_id,
        "CALENDAR_DB_ID": calendar_db_id,
        "TIME_TRACKING_DB_ID": time_tracking_db_id,
        "DASHBOARD_PAGE_ID": dashboard_page_id
    }
    
    for name, db_id in databases.items():
        if db_id:
            print(f"{name} = {db_id}")
    
    print("\n" + "=" * 70)
    print("🎉 Your Life Operating System is ready!")
    print("=" * 70)
    print("\n📝 NEXT STEPS:")
    print("1. Go to your Notion workspace and find the new databases")
    print("2. Open the '🎯 Life OS Dashboard' page")
    print("3. Create views in each database (Today, This Week, By Status, etc.)")
    print("4. Set up automations using the database IDs above")
    print("5. Link databases together using relations")
    print("\n💡 TIP: Create filtered views for:")
    print("   - Today's Tasks (Status != Done, Due Date = Today)")
    print("   - This Week's Priorities (Priority = P0 or P1)")
    print("   - Pending Decisions (Status = Pending)")
    print("   - Active Projects (Status = Active)")
    print("\n")

if __name__ == "__main__":
    main()
