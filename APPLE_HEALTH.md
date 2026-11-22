# Apple Health integration

Apple Health does not expose a web OAuth API (unlike Google Fit). This project uses a **sync token** plus a small **iOS companion app** to bridge HealthKit and your account.

## Connect from the web app

1. Sign in and open **Profile → Connected Devices**.
2. Tap **Connect** under Apple Health.
3. Copy the sync token into the iOS app (`mobile/ios/AIDietPlannerHealthSync`).
4. On your iPhone, open the companion app and tap **Sync Now**.

## Goal tracking (both ways)

| Where you set it | What happens |
|------------------|--------------|
| **Tracking** nutrition goals | Saved to your log; `goalsVersion` updates; iOS app writes targets to Health on next sync |
| **Weight** goal | Same — included in `/api/apple-health/config` for the iOS client |
| **Apple Health** workouts / steps | Uploaded to `biometricData` on your user; visible on **Tracking** and **Profile** |

Weight samples from Apple Health are appended to your weight history with note `Synced from Apple Health`.

## API reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/apple-health/connect` | Session | Issue sync token |
| POST | `/api/apple-health/disconnect` | Session | Revoke token |
| PUT | `/api/apple-health/preferences` | Session | Steps goal, read/write toggles |
| GET | `/api/apple-health/config` | Bearer token | Goals for HealthKit |
| POST | `/api/apple-health/sync` | Bearer token | Upload HealthKit samples |
| POST | `/api/apple-health/goals/ack` | Bearer token | Confirm goals written |

## Security

Sync tokens are stored as SHA-256 hashes server-side. Regenerate a token from Profile if you lose it or suspect leakage.