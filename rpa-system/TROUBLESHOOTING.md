# Troubleshooting Guide

## Common Issues and Solutions

### Analytics Blocking (Status: 0)

**Issue**: Google Analytics requests show status 0 in browser console.

**Cause**: This is expected behavior when using ad blockers (uBlock Origin, Privacy Badger, etc.) or privacy extensions.

**Solution**: 
- This is normal for local development and can be safely ignored
- Analytics will work in production for users without ad blockers
- To test analytics locally, temporarily disable ad blockers

**Status**: ✅ Expected behavior - no action needed

---

### Firebase Authentication 401 Errors

**Issue**: `signInWithCustomToken` returns 401 Unauthorized.

**Possible Causes**:
1. **Expired Token**: Custom tokens expire after 1 hour
2. **Invalid Service Account**: Firebase service account credentials are incorrect or missing
3. **Clock Skew**: Server time is significantly out of sync with Google's servers
4. **Token Used After Expiration**: Token was generated but not used immediately

**Solutions**:
1. **Check Firebase Configuration**:
   ```bash
   # Verify environment variables are set
   echo $FIREBASE_PROJECT_ID
   echo $FIREBASE_CLIENT_EMAIL
   echo $FIREBASE_PRIVATE_KEY
   ```

2. **Check Server Time**:
   ```bash
   # Ensure server time is synchronized
   date
   # If using Docker, ensure container time matches host
   ```

3. **Regenerate Token**: The frontend automatically requests a new token when the current one expires

4. **Check Logs**: Look for Firebase initialization errors in backend logs:
   ```bash
   docker compose logs backend | grep -i firebase
   ```

**Status**: ✅ Error handling improved - tokens auto-refresh

---

### Content Security Policy (CSP) Violations

**Issue**: Scripts or frames from external services are blocked.

**Fixed Domains**:
- ✅ `ipapi.co` - IP geolocation service
- ✅ `sdk.dfktv2.com` - Chat/support widget
- ✅ `*.dfktv2.com` - Chat widget subdomains
- ✅ `*.uchat.com.au` - Chat widget domains

**Status**: ✅ Fixed in both frontend (index.html) and backend (app.js)

---

### Missing API Endpoints

**Fixed Endpoints**:
- ✅ `/api/capture-email` - Email capture for lead nurturing

**Status**: ✅ All endpoints implemented

---

### Social Proof Data Structure

**Issue**: Frontend expected `{ metrics: { ... } }` but backend returned `{ totalUsers, ... }`.

**Status**: ✅ Fixed - Backend now returns correct structure matching frontend expectations

