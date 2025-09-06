# Firebase Real-time Notifications Setup

This guide will help you set up Firebase Cloud Messaging (FCM) and Realtime Database for real-time notifications in EasyFlow.

## Prerequisites

- Firebase account
- EasyFlow project with backend and frontend already configured

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name: `easyflow-notifications` (or your preferred name)
4. Enable Google Analytics if desired
5. Click "Create project"

## Step 2: Enable Required Services

### Authentication
1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable your preferred sign-in methods (Email/Password recommended)

### Realtime Database
1. Go to **Realtime Database**
2. Click "Create Database"
3. Choose "Start in test mode" for now
4. Select a location (choose closest to your users)
5. Update the rules to:

```json
{
  "rules": {
    "notifications": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "system": {
      ".read": "auth != null",
      ".write": false
    }
  }
}
```

### Cloud Messaging
1. Go to **Project Settings** > **Cloud Messaging**
2. Generate a new key pair for VAPID if not exists
3. Note down the **VAPID Key**

## Step 3: Get Configuration Values

### Web App Configuration (Frontend)
1. Go to **Project Settings** > **General**
2. In "Your apps" section, click **Web app** icon (`</>`)
3. Register app name: `easyflow-dashboard`
4. Copy the config object values:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456",
  measurementId: "G-ABCD123456"
};
```

### Service Account (Backend)
1. Go to **Project Settings** > **Service Accounts**
2. Click **Generate new private key**
3. Download the JSON file
4. Save it as `backend/config/firebase-service-account.json`

Or use individual environment variables (see `.env.firebase.example`).

## Step 4: Configure Environment Variables

### Backend Environment Variables
Copy `.env.firebase.example` to `.env` in the backend folder and fill in your values:

```bash
# Frontend Firebase Config
REACT_APP_FIREBASE_API_KEY=your-api-key-here
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef123456
REACT_APP_FIREBASE_MEASUREMENT_ID=G-ABCD123456

# VAPID Key for FCM
REACT_APP_FIREBASE_VAPID_KEY=your-vapid-key-here

# Backend Firebase Admin Config
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

# Or use individual variables:
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR-PRIVATE-KEY-HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/
```

### Frontend Environment Variables
In the frontend root (`rpa-dashboard/.env`):

```bash
REACT_APP_FIREBASE_API_KEY=your-api-key-here
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef123456
REACT_APP_FIREBASE_MEASUREMENT_ID=G-ABCD123456
REACT_APP_FIREBASE_VAPID_KEY=your-vapid-key-here
```

## Step 5: Test the Integration

1. **Test Firebase setup:**
   ```bash
   node test-firebase-integration.js
   ```

2. **Start the development servers:**
   ```bash
   # Backend
   cd backend && npm run dev
   
   # Frontend (new terminal)
   cd rpa-dashboard && npm start
   ```

3. **Test notifications:**
   - Sign up/login to the app
   - Complete the onboarding process (should trigger welcome notification)
   - Create and run an automation task (should trigger completion notification)

## Step 6: Verify Notifications

### Browser Notifications
1. When you first visit the app, you should see a browser permission request
2. Click "Allow" to enable notifications
3. Check the notification center (bell icon) in the header

### Real-time Updates
1. Open the app in multiple browser tabs
2. Actions in one tab should show real-time updates in others
3. Check the browser console for Firebase connection logs

### Database Verification
1. Go to Firebase Console > Realtime Database
2. You should see a `notifications` node with user-specific data
3. Notifications should appear here when triggered

## Troubleshooting

### Common Issues

**"Firebase not configured" error:**
- Check environment variables are properly set
- Ensure service account file exists and is valid
- Verify project ID matches Firebase console

**"Permission denied" errors:**
- Update Realtime Database rules
- Check user authentication status
- Verify user ID format in database rules

**Notifications not appearing:**
- Check browser permissions for notifications
- Verify VAPID key configuration
- Check browser console for FCM errors

**Real-time updates not working:**
- Check Realtime Database connection
- Verify database rules allow read/write
- Check network connectivity

### Debug Commands

```bash
# Check Firebase service status
node -e "console.log(require('./backend/utils/firebaseAdmin').firebaseNotificationService.getStatus())"

# Test notification templates
node -e "console.log(require('./backend/utils/firebaseAdmin').NotificationTemplates.welcome('Test'))"

# Check environment variables
node -e "console.log({firebase: Object.keys(process.env).filter(k => k.includes('FIREBASE'))})"
```

### Getting Help

- Check Firebase Console for error messages
- Review browser console for client-side errors
- Check backend logs for server-side issues
- Verify all configuration steps were completed

## Production Considerations

1. **Security Rules:** Update Realtime Database rules for production
2. **API Keys:** Use different Firebase projects for dev/staging/production
3. **Rate Limiting:** Configure appropriate rate limits for notifications
4. **Monitoring:** Set up Firebase Performance Monitoring
5. **Analytics:** Enable Firebase Analytics for usage insights

## Features Enabled

After completing this setup, you'll have:

✅ **Real-time notifications** for task completion/failure  
✅ **Browser push notifications** when app is closed  
✅ **Notification center** with unread counts  
✅ **Welcome notifications** for new users  
✅ **System alerts** for important messages  
✅ **Notification history** with read/unread status  
✅ **Cross-tab real-time updates**  

The notification system integrates with:
- User onboarding process
- Task automation completion/failure
- Email campaign triggers
- System maintenance alerts