# Firebase Authentication Integration for EasyFlow

This document describes the complete Firebase authentication integration that bridges Supabase authentication with Firebase Realtime Database for secure notifications.

## Overview

The solution provides secure, production-ready authentication by:
1. Using Firebase Admin SDK to generate custom tokens based on Supabase authentication
2. Implementing automatic token refresh to handle Firebase custom token expiration
3. Enforcing secure database rules that validate Supabase user identity
4. Providing fallback mechanisms for robust error handling

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Firebase      │
│   (React)       │    │   (Express)     │    │   (Database)    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Supabase Auth │───▶│ • Verify Token  │───▶│ • Custom Token  │
│ • Get FB Token  │    │ • Generate FB   │    │ • Auth Rules    │
│ • Auto Refresh  │◀───│   Custom Token  │    │ • User Data     │
│ • Error Handle  │    │ • Error Handle  │    │ • Notifications │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components

### 1. Backend Firebase Admin Service

**File**: `backend/utils/firebaseAdmin.js`

**Key Features**:
- Custom token generation with Supabase UID claims
- Firebase user record management
- Token verification for debugging
- Custom claims management

**Key Methods**:
```javascript
// Generate Firebase custom token for Supabase user
await firebaseNotificationService.generateCustomToken(userId, additionalClaims)

// Create Firebase user record (optional)
await firebaseNotificationService.createFirebaseUser(userId, userProfile)

// Verify Firebase ID token
await firebaseNotificationService.verifyCustomToken(idToken)
```

### 2. Backend API Endpoints

**File**: `backend/app.js`

**Endpoints**:
- `POST /api/firebase/token` - Generate custom token
- `POST /api/firebase/verify-token` - Verify ID token (debugging)
- `PUT /api/firebase/claims` - Update user claims

**Security**:
- All endpoints require Supabase authentication
- Rate limiting applied
- Input validation and sanitization
- Comprehensive error handling

### 3. Frontend Notification Service

**File**: `rpa-dashboard/src/utils/notificationService.js`

**Key Features**:
- Automatic Firebase authentication using custom tokens
- Token refresh every 50 minutes (before 1-hour expiration)
- Fallback authentication for error resilience
- Enhanced error handling with specific error type responses

**Authentication Flow**:
1. Get Supabase session
2. Request custom token from backend
3. Authenticate with Firebase using custom token
4. Schedule automatic token refresh
5. Handle authentication errors gracefully

### 4. Secure Firebase Rules

**File**: `firebase-rules-secure.json`

**Security Model**:
- Users can only access their own notifications
- Authentication required for all operations
- Custom token claims validation (supabase_uid)
- Data structure validation
- Read-only system announcements and feature flags

**Key Rules**:
```json
{
  "notifications": {
    "$userId": {
      ".read": "auth != null && auth.uid == $userId && auth.token.supabase_uid == $userId",
      ".write": "auth != null && auth.uid == $userId && auth.token.supabase_uid == $userId"
    }
  }
}
```

## Setup Instructions

### 1. Backend Configuration

Ensure these environment variables are set:
```bash
# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com/

# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE=your-supabase-service-role-key
```

### 2. Frontend Configuration

Update `rpa-dashboard/src/utils/firebaseConfig.js`:
```javascript
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  // ... other config
};
```

### 3. Deploy Firebase Rules

```bash
# Method 1: Using deployment script
node deploy-firebase-rules.js --deploy

# Method 2: Manual deployment
firebase login
firebase init database
firebase deploy --only database
```

## Usage Examples

### Generate Custom Token (Backend)

```javascript
app.post('/api/firebase/token', authMiddleware, async (req, res) => {
  const result = await firebaseNotificationService.generateCustomToken(
    req.user.id,
    { email: req.user.email, role: 'user' }
  );
  
  if (result.success) {
    res.json({
      token: result.token,
      expiresIn: result.expiresIn,
      claims: result.claims
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});
```

### Authenticate Frontend

```javascript
// In notificationService.js
const response = await fetch('/api/firebase/token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseAccessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ additionalClaims: { email: user.email } })
});

const { token } = await response.json();
await signInWithCustomToken(auth, token);
```

### Send Notification

```javascript
// Backend
const notification = {
  title: 'Task Completed',
  body: 'Your automation task has finished successfully',
  type: 'task_completed',
  priority: 'normal'
};

await firebaseNotificationService.sendAndStoreNotification(userId, notification);
```

## Security Considerations

### Authentication Chain
1. **Supabase Authentication**: Primary authentication layer
2. **Custom Token Generation**: Server-side verification of Supabase session
3. **Firebase Authentication**: Secondary authentication for database access
4. **Database Rules**: Final authorization layer

### Token Security
- Custom tokens expire in 1 hour
- Automatic refresh prevents token expiration
- Supabase UID claim ensures user identity consistency
- Fallback authentication maintains service availability

### Database Security
- User isolation: Each user can only access their own data
- Claim verification: supabase_uid must match the requesting user
- Data validation: Strict schema enforcement
- Read-only system data: Announcements and feature flags

## Error Handling

### Authentication Failures
- **Token Generation**: Falls back to application-level auth
- **Network Errors**: Automatic retry with backoff
- **Rate Limiting**: Queues requests and retries
- **Permission Denied**: Attempts token refresh

### Token Refresh
- **Scheduled Refresh**: 50 minutes (before 1-hour expiration)
- **Error Recovery**: 5-minute retry on failure
- **Session Validation**: Checks Supabase session before refresh
- **Event Emission**: Notifies UI of refresh status

## Testing

### Test Custom Token Generation

```bash
# Test endpoint with curl
curl -X POST http://localhost:3030/api/firebase/token \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"additionalClaims": {"email": "test@example.com"}}'
```

### Test Database Rules

Use Firebase Console Rules Playground:
1. Go to Firebase Console → Database → Rules
2. Click "Rules Playground"
3. Test with authentication token containing supabase_uid claim
4. Verify access patterns work as expected

### Test Token Refresh

```javascript
// In browser console
notificationService.refreshFirebaseToken(user)
  .then(success => console.log('Refresh result:', success))
  .catch(error => console.error('Refresh error:', error));
```

## Monitoring

### Logs to Monitor
- Token generation requests and errors
- Authentication failures and retries
- Token refresh cycles and failures
- Database permission denials
- Network connectivity issues

### Health Checks
- `GET /api/health/databases` - Check Firebase and Supabase connectivity
- Firebase Console - Monitor authentication events
- Database usage statistics and error rates

## Troubleshooting

### Common Issues

**"Permission denied" errors**:
1. Check Firebase rules are deployed correctly
2. Verify custom token contains supabase_uid claim
3. Ensure user is authenticated with correct UID

**Token generation failures**:
1. Verify Firebase Admin SDK environment variables
2. Check Supabase session is valid
3. Confirm Firebase project configuration

**Token refresh failures**:
1. Check network connectivity
2. Verify Supabase session hasn't expired
3. Monitor rate limiting on backend endpoints

### Debug Commands

```javascript
// Check service status
console.log(notificationService.getStatus());

// Check Firebase auth state
console.log('Firebase user:', notificationService.firebaseAuthUser);

// Check last token refresh
console.log('Last refresh:', notificationService.lastTokenRefresh);
```

## Migration from Open Rules

1. **Deploy secure rules**: Use `deploy-firebase-rules.js`
2. **Test authentication**: Verify users can still access their data
3. **Monitor logs**: Check for permission denials
4. **Rollback plan**: Keep `firebase-rules-supabase-auth.json` as fallback

## Production Deployment

1. **Environment Variables**: Set all required Firebase and Supabase variables
2. **Firebase Rules**: Deploy secure rules to production project
3. **Rate Limiting**: Configure appropriate limits for token generation
4. **Monitoring**: Set up alerts for authentication failures
5. **Testing**: Run end-to-end tests to verify functionality

This integration provides a secure, scalable solution for bridging Supabase authentication with Firebase Realtime Database while maintaining the benefits of both platforms.