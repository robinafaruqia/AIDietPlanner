# AIDietPlanner — Apple Health Sync (iOS)

This companion app reads and writes HealthKit data so your **AI Diet Planner** web app and **Apple Health** stay in sync.

## What syncs

| Direction | Data |
|-----------|------|
| **Health → App** | Steps, heart rate, weight, active energy, sleep, optional dietary intake & water |
| **App → Health** | Calorie/macro goals, weight goal, step goal (when enabled in Profile) |

## Setup

1. In the web app, go to **Profile → Connected Devices → Apple Health → Connect**.
2. Copy the **sync token** (shown once).
3. Open this folder in **Xcode 15+**:
   - File → New → Project → iOS App
   - Product name: `AIDietPlannerHealthSync`
   - Or add the Swift files below to an existing SwiftUI app target.
4. Enable **HealthKit** capability on the app target.
5. Replace `Info.plist` usage descriptions with the provided `Info.plist` entries (or merge them).
6. Build to a physical iPhone (HealthKit does not work fully on the simulator).
7. In the app: paste **Server URL** (your app origin, e.g. `https://your-host.com`) and **Sync Token**.

## API endpoints used

- `GET /api/apple-health/config` — goals & preferences (Bearer token)
- `POST /api/apple-health/sync` — upload HealthKit samples
- `POST /api/apple-health/goals/ack` — confirm goals written to Health

## Auto sync

The app syncs on launch and when you tap **Sync Now**. For background sync, enable **Background Modes → Background fetch** and schedule `BGAppRefreshTask` (optional enhancement).

## Files

- `AIDietPlannerHealthSyncApp.swift` — app entry
- `ContentView.swift` — pairing UI
- `HealthKitManager.swift` — read/write HealthKit
- `SyncAPIClient.swift` — HTTP client
- `Info.plist` — privacy strings