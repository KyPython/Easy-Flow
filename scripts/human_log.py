import datetime

def log(message, status="INFO"):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {status} {message}")

def actionable_log(message, status, action=None):
    log(message, status)
    if action:
        print(f"  ➡️  Action: {action}")
