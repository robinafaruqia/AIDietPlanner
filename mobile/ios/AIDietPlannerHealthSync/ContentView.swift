import SwiftUI

@MainActor
final class SyncViewModel: ObservableObject {
    @Published var serverURLString: String = UserDefaults.standard.string(forKey: "serverURL") ?? ""
    @Published var syncToken: String = UserDefaults.standard.string(forKey: "syncToken") ?? ""
    @Published var statusMessage: String = "Not synced yet"
    @Published var isSyncing = false
    @Published var lastGoalsVersion: String = UserDefaults.standard.string(forKey: "lastGoalsVersion") ?? ""

    private let health = HealthKitManager()

    func saveSettings() {
        UserDefaults.standard.set(serverURLString.trimmingCharacters(in: .whitespacesAndNewlines), forKey: "serverURL")
        UserDefaults.standard.set(syncToken.trimmingCharacters(in: .whitespacesAndNewlines), forKey: "syncToken")
    }

    func sync() async {
        saveSettings()
        guard let base = URL(string: serverURLString.trimmingCharacters(in: .whitespacesAndNewlines)),
              !syncToken.isEmpty else {
            statusMessage = "Enter server URL and sync token from the web app Profile page."
            return
        }

        isSyncing = true
        defer { isSyncing = false }

        do {
            try await health.requestAuthorization()
            let client = SyncAPIClient(baseURL: base, token: syncToken)
            let config = try await client.fetchConfig()
            let includeNutrition = config.syncPreferences?.readNutritionFromHealth ?? false
            let samples = try await health.collectSamples(days: 14, includeNutrition: includeNutrition)
            try await client.upload(samples: samples)

            if config.syncPreferences?.writeGoalsToHealth != false,
               config.goalsVersion != lastGoalsVersion {
                try await health.writeGoals(config.goals)
                try await client.ackGoals(version: config.goalsVersion, written: true)
                lastGoalsVersion = config.goalsVersion
                UserDefaults.standard.set(lastGoalsVersion, forKey: "lastGoalsVersion")
            }

            statusMessage = "Synced \(samples.count) samples · goals v\(config.goalsVersion)"
        } catch {
            statusMessage = "Error: \(error.localizedDescription)"
        }
    }
}

struct ContentView: View {
    @EnvironmentObject private var model: SyncViewModel

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("Server URL", text: $model.serverURLString)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    SecureField("Sync token", text: $model.syncToken)
                }

                Section {
                    Button {
                        Task { await model.sync() }
                    } label: {
                        HStack {
                            Text(model.isSyncing ? "Syncing…" : "Sync Now")
                            Spacer()
                            if model.isSyncing { ProgressView() }
                        }
                    }
                    .disabled(model.isSyncing)
                } footer: {
                    Text("Connect Apple Health in the web app first, then paste the token here. Goals updated in the app are pulled on each sync.")
                }

                Section("Status") {
                    Text(model.statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Diet Planner Sync")
            .onAppear {
                Task { await model.sync() }
            }
        }
    }
}