import SwiftUI

@main
struct AIDietPlannerHealthSyncApp: App {
    @StateObject private var model = SyncViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
        }
    }
}