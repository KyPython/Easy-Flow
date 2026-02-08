# EasyFlow Mobile App Store Deployment Plan

## Overview
Deploy the EasyFlow React Native (Expo) mobile app to:
- **Apple App Store** (iOS)
- **Google Play Store** (Android)

## Current State Assessment

### ✅ Already Configured
- App name: "EasyFlow"
- Bundle ID: `com.tryeasyflow.app`
- Package: `com.tryeasyflow.app`
- Version: 1.0.0
- Basic app structure with screens (Dashboard, Analytics, Automations, Files, Settings, Login)
- Authentication context integrated with backend
- Push notifications plugin configured

### ⚠️ Missing / Needs Completion
- No `eas.json` (Expo build configuration)
- No app store assets (screenshots, promotional images)
- No privacy policy URL
- No App Store Connect credentials configured
- No Google Play Console credentials configured
- No FCM (Firebase Cloud Messaging) for push notifications fully configured
- No release build scripts

---

## Phase 1: Prerequisites & Account Setup

### 1.1 Apple Developer Program
- [ ] Purchase Apple Developer Program membership ($99/year)
- [ ] Create App Store Connect record for "EasyFlow"
- [ ] Generate iOS Distribution Certificate
- [ ] Create iOS Provisioning Profile
- [ ] Set up App Store metadata:
  - App name: "EasyFlow"
  - Description
  - Keywords
  - Support URL
  - Privacy Policy URL
  - Category: Business

### 1.2 Google Play Console
- [ ] Create Google Play Console developer account ($25 one-time)
- [ ] Create new application "EasyFlow"
- [ ] Set up app listing:
  - Short description
  - Full description
  - Screenshots (phone, tablet)
  - Feature graphic
  - Privacy policy URL
  - Category: Business

### 1.3 Firebase Setup (Push Notifications)
- [ ] Create Firebase project
- [ ] Add iOS app with bundle ID `com.tryeasyflow.app`
- [ ] Add Android app with package `com.tryeasyflow.app`
- [ ] Download `GoogleService-Info.plist` for iOS
- [ ] Download `google-services.json` for Android
- [ ] Enable FCM in Firebase console
- [ ] Get FCM server key for backend integration

---

## Phase 2: App Configuration Updates

### 2.1 Update app.json for Store Submission
```json
{
  "expo": {
    "name": "EasyFlow",
    "slug": "easyflow-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0f172a"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.tryeasyflow.app",
      "infoPlist": {
        "NSCameraUsageDescription": "EasyFlow needs camera access to capture documents and photos for automation tasks.",
        "NSPhotoLibraryUsageDescription": "EasyFlow needs photo library access to upload files for automation tasks.",
        "NSAppTransportSecurity": {
          "NSAllowsArbitraryLoads": false
        }
      },
      "buildNumber": "1"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0f172a"
      },
      "package": "com.tryeasyflow.app",
      "edgeToEdgeEnabled": true,
      "versionCode": 1,
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "plugins": [
      ["expo-notifications", {
        "icon": "./assets/icon.png",
        "color": "#3b82f6",
        "pushMode": "experience"
      }],
      ["expo-image-picker", {
        "photosPermission": "Allow EasyFlow to access your photos for file uploads.",
        "cameraPermission": "Allow EasyFlow to access your camera to capture photos."
      }]
    ],
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "updates": {
      "url": "https://u.expo.dev/YOUR_PROJECT_ID"
    },
    "extra": {
      "eas": {
        "projectId": "YOUR_EXPO_PROJECT_ID"
      }
    },
    "web": { "favicon": "./assets/favicon.png" }
  }
}
```

### 2.2 Create eas.json
```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "ios": {
        "enterpriseDistribution": false
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "YOUR_ASC_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json"
      }
    }
  }
}
```

### 2.3 Environment Configuration
- [ ] Update `.env` with production API URL
- [ ] Create production environment variables:
  - `EXPO_PUBLIC_API_URL=https://api.tryeasyflow.com`
  - `EXPO_PUBLIC_ENV=production`

---

## Phase 3: App Store Assets

### 3.1 Required Assets

#### iOS App Store
- [ ] 1024x1024 app icon
- [ ] 6-10 screenshots for each supported device size:
  - 6.5" (iPhone 14 Pro Max, etc.)
  - 5.5" (iPhone 8 Plus, etc.)
- [ ] App preview video (optional but recommended)
- [ ] Promotional text
- [ ] Keywords

#### Google Play Store
- [ ] 512x512 icon
- [ ] 1024x500 feature graphic
- [ ] Phone screenshots (2-8)
- [ ] 7" tablet screenshots (2-8)
- [ ] 10" tablet screenshots (2-8)
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] Video URL (YouTube)

### 3.2 Asset Recommendations
- Use consistent branding with web app
- Show key features: Dashboard, Automation History, File Management
- Include user interface screenshots
- Highlight time savings and automation benefits

---

## Phase 4: Backend Integration Updates

### 4.1 Push Notification Setup
- [ ] Update backend to include FCM server key
- [ ] Add endpoint for registering FCM tokens: `PUT /api/user/preferences`
- [ ] Implement push notification sending service
- [ ] Add push notification types:
  - Task completion
  - Task failure
  - Workflow status updates
  - Authentication alerts

### 4.2 API Updates (if needed)
- [ ] Verify all API endpoints work with production URLs
- [ ] Add CORS for mobile app origins
- [ ] Update rate limiting for mobile clients

---

## Phase 5: Build & Testing

### 5.1 Internal Testing
- [ ] Create internal build with TestFlight distribution
- [ ] Test on iOS devices (various models)
- [ ] Test on Android devices (various OS versions)
- [ ] Test push notifications
- [ ] Test file upload/download
- [ ] Test offline functionality
- [ ] Gather feedback from internal testers

### 5.2 Closed Testing
- [ ] Upload to TestFlight for beta testers
- [ ] Upload to Internal Testing track on Google Play
- [ ] Collect bug reports
- [ ] Fix critical issues
- [ ] Iterate until stable

---

## Phase 6: Production Submission

### 6.1 iOS App Store Submission
1. Complete App Store Connect metadata
2. Upload build via EAS Build or Transporter
3. Submit for review
4. Respond to review feedback (if any)
5. App goes live (typically 24-48 hours after approval)

### 6.2 Google Play Store Submission
1. Complete Play Console store listing
2. Upload APK/AAB via EAS Build or Play Console
3. Set release notes
4. Select target audience
5. Submit for review
6. App typically goes live within hours (sometimes immediate)

---

## Phase 7: Post-Launch

### 7.1 Monitoring
- [ ] Set up crash reporting (Sentry, Crashlytics)
- [ ] Monitor app store reviews
- [ ] Track key metrics:
  - Downloads
  - Active users
  - Session duration
  - Push notification open rates
  - Crash-free users

### 7.2 Updates
- [ ] Plan regular updates
- [ ] Set up CI/CD for automated builds
- [ ] Implement over-the-air (OTA) updates via Expo Updates

---

## Estimated Timeline

| Phase | Duration | Total |
|-------|----------|-------|
| Phase 1: Prerequisites | 1-2 weeks | 1-2 weeks |
| Phase 2: Configuration | 1 week | 2-3 weeks |
| Phase 3: Assets | 1 week | 3-4 weeks |
| Phase 4: Backend | 1 week | 4-5 weeks |
| Phase 5: Testing | 2 weeks | 6-7 weeks |
| Phase 6: Submission | 1-2 weeks | 7-9 weeks |

---

## Immediate Action Items

### To Start Tomorrow
1. Purchase Apple Developer Program membership
2. Create Google Play Console account
3. Set up Firebase project
4. Update `app.json` with complete store configuration
5. Create `eas.json` for build configuration

### This Week
6. Design app store screenshots
7. Write app descriptions
8. Set up EAS Build access
9. Create production environment variables
10. Test first internal build

---

## Cost Summary

| Item | Cost |
|------|------|
| Apple Developer Program (annual) | $99 |
| Google Play Console (one-time) | $25 |
| Optional: Design services | Variable |
| Optional: App store optimization | Variable |

---

## Risk Factors & Mitigations

| Risk | Mitigation |
|------|------------|
| App rejection by Apple/Google | Follow store guidelines closely; use recommended plugins |
| Push notifications not working | Test early; follow FCM/APNs setup carefully |
| Backend not ready for mobile | Verify API compatibility before submission |
| User feedback negative | Have beta testing phase before launch |

---

## Success Metrics

- **Downloads**: 100 downloads in first month
- **Ratings**: 4+ star average within 30 days
- **Retention**: 30% DAU/MAU ratio
- **Push notifications**: 50% open rate
- **Crash-free users**: 99%+

---

## Next Steps

1. **Approve this plan** to proceed with Phase 1
2. **Set up accounts** (Apple, Google, Firebase)
3. **Switch to Code mode** to implement configuration updates
4. **Create design assets** for app store listings
