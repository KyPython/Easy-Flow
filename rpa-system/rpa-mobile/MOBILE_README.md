# EasyFlow Mobile

React Native (Expo) app for EasyFlow RPA system.

## Features

- **Week 1**: Auth, navigation, dashboard, files list, settings
- **Week 2**: Analytics, file upload/download, automation controls, push notifications
- **Week 3**: Offline banner, camera integration for file capture, onboarding
- **Week 4**: Store prep (app.json), onboarding docs

## Setup

1. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` (e.g. `http://localhost:3030` or your backend URL).
2. For physical device: use your machine IP (e.g. `http://192.168.1.x:3030`).
3. Run `npx expo start` and press `i` (iOS) or `a` (Android).

## Backend APIs Used

- `POST /api/auth/login` - Login
- `GET /api/auth/session` - Session check
- `POST /api/auth/logout` - Logout
- `GET /api/dashboard` - Dashboard stats
- `GET /api/workflows` - List workflows
- `POST /api/workflows/:id/executions` - Run workflow
- `GET /api/files` - List files
- `POST /api/files/upload` - Upload file
- `GET /api/files/:id/download` - Get download URL
- `DELETE /api/files/:id` - Delete file
- `PUT /api/user/preferences` - Update preferences (FCM token for push)

## App Store Deployment

### CI/CD Pipeline

The mobile app is integrated with GitHub Actions for automated builds:

- **File**: `.github/workflows/mobile-ci.yml`
- **Triggers**: On push to `rpa-system/rpa-mobile/` or main branch
- **Builds**: Automatic builds to TestFlight (iOS) and Play Store Internal (Android)

### Build Commands

```bash
# Install dependencies
npm install

# Run locally
npm run ios      # iOS Simulator
npm run android  # Android Emulator

# Build for store
npx eas build --profile preview --platform all  # Preview build
npx eas build --profile production --platform all  # Production build

# Submit to stores
npx eas submit --profile preview --platform all  # Internal testing
```

### Required Secrets

Set these in GitHub repository secrets:

| Secret | Description |
|--------|-------------|
| `EAS_TOKEN` | Expo Access Token for EAS CLI |
| `EXPO_PROJECT_ID` | Expo Project ID |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications (optional) |

### Store Submission Flow

1. **Push to main** → Triggers CI validation
2. **Validation passes** → Builds iOS and Android
3. **Build succeeds** → Auto-submits to TestFlight & Play Store Internal
4. **Manual trigger** → Use workflow_dispatch for production builds

See [`STORE_DEPLOYMENT_README.md`](STORE_DEPLOYMENT_README.md) for full deployment guide.

