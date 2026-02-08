# EasyFlow Mobile App Store Deployment Guide

## Overview

This document guides you through deploying the EasyFlow mobile app to the Apple App Store and Google Play Store.

## Prerequisites

Before starting, ensure you have:

### Required Accounts
- [ ] Apple Developer Program account ($99/year) - https://developer.apple.com
- [ ] Google Play Console account ($25 one-time) - https://play.google.com/console
- [ ] Firebase project for push notifications - https://console.firebase.google.com

### Required Tools
- [ ] Node.js 18+
- [ ] Expo CLI (`npm install -g expo-cli`)
- [ ] EAS CLI (`npm install -g eas-cli`)
- [ ] Xcode (for iOS builds on Mac)
- [ ] Android Studio (for Android builds)

## Step 1: Configure Firebase

### Create Firebase Project
1. Go to Firebase Console: https://console.firebase.google.com
2. Create new project "EasyFlow"
3. Add iOS app with bundle ID: `com.tryeasyflow.app`
4. Add Android app with package name: `com.tryeasyflow.app`
5. Download:
   - iOS: `GoogleService-Info.plist` → place in `rpa-system/rpa-mobile/`
   - Android: `google-services.json` → place in `rpa-system/rpa-mobile/`

### Enable FCM
1. In Firebase Console, go to Project Settings → Cloud Messaging
2. Note the Server Key for backend integration

## Step 2: Configure Expo

### Create Expo Account
1. Sign up at https://expo.dev
2. Run `eas login` to authenticate

### Link Project
1. Run `eas project:link` or add project ID to `app.json`:
```json
{
  "extra": {
    "eas": {
      "projectId": "YOUR_EXPO_PROJECT_ID"
    }
  }
}
```

### Create Project on Expo
1. Go to https://expo.dev/projects
2. Create new project "EasyFlow Mobile"
3. Note the Project ID for configuration

## Step 3: Configure App Store Credentials

### iOS (App Store Connect)
1. Go to https://appstoreconnect.apple.com
2. Create new app "EasyFlow"
3. Note the Apple ID and App ID
4. Generate and download:
   - iOS Distribution Certificate
   - Provisioning Profile

### Android (Google Play Console)
1. Go to https://play.google.com/console
2. Create new application "EasyFlow"
3. Set up app listing with metadata
4. Create service account for automated uploads:
   - IAM & Admin → Service Accounts
   - Create service account with "Release Manager" role
   - Download JSON key file as `google-play-service-account.json`

## Step 4: Configure Environment

### Update .env File
```bash
cp .env.example .env
# Edit .env with your production values:
EXPO_PUBLIC_API_URL=https://api.tryeasyflow.com
EXPO_PUBLIC_ENV=production
```

### Update eas.json
Update the placeholder values in `eas.json`:
- `appleId`: Your Apple ID email
- `ascAppId`: Your App Store Connect App ID
- `appleTeamId`: Your Apple Team ID
- `serviceAccountKeyPath`: Path to Google service account JSON

## Step 5: Build for Testing

### Development Build (Simulator)
```bash
cd rpa-system/rpa-mobile
npm run ios  # Runs in iOS Simulator
npm run android  # Runs in Android Emulator
```

### Preview Build (Internal Testing)
```bash
cd rpa-system/rpa-mobile
eas build --profile preview --platform all
```

### Production Build (App Store)
```bash
cd rpa-system/rpa-mobile
eas build --profile production --platform all
```

## Step 6: Submit to TestFlight (iOS)

### Manual Upload
1. Download build from EAS or use Transporter app
2. Go to App Store Connect → TestFlight
3. Upload build and fill out compliance info
4. Add to testing groups

### Automated Submission
```bash
eas submit --profile production --platform ios
```

## Step 7: Submit to Play Store (Android)

### Manual Upload
1. Download AAB from EAS build
2. Go to Google Play Console → Testing → Internal Testing
3. Upload AAB and fill release notes
4. Submit for review

### Automated Submission
```bash
eas submit --profile production --platform android
```

## Step 8: Production Review

### Apple App Store Review
- Review typically takes 24-48 hours
- Respond to any issues via App Store Connect
- App goes live after approval

### Google Play Review
- Review typically takes hours to days
- Respond to any issues via Play Console
- App can go live immediately after approval

## Troubleshooting

### Build Errors
```bash
# Clear cache and retry
npx expo clean
npm install
eas build --profile production --platform all
```

### Certificate Issues (iOS)
- Ensure valid distribution certificate
- Check provisioning profile includes all devices
- Verify bundle ID matches exactly

### Upload Errors
- Check file sizes (iOS max 150MB, Android max 150MB AAB)
- Ensure all required metadata is filled
- Verify credentials are valid and not expired

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Run locally
npm run ios
npm run android

# Build for store
eas build --profile preview --platform all  # Preview
eas build --profile production --platform all  # Production

# Submit to stores
eas submit --profile preview --platform all  # Internal testing
eas submit --profile production --platform all  # Production
```

## Support

- Expo Documentation: https://docs.expo.dev
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines
- Play Store Content Policy: https://play.google.com/console/about/policy/
