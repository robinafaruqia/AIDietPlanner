import Foundation

struct SyncSample: Codable {
    let type: String
    let date: String
    let value: SyncSampleValue
    var unit: String?
}

enum SyncSampleValue: Codable {
    case number(Double)
    case heartRate([String: Double])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let d = try? container.decode(Double.self) {
            self = .number(d)
            return
        }
        if let dict = try? container.decode([String: Double].self) {
            self = .heartRate(dict)
            return
        }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid sample value")
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .number(let d):
            try container.encode(d)
        case .heartRate(let dict):
            try container.encode(dict)
        }
    }
}

struct SyncPayload: Codable {
    let samples: [SyncSample]
    let deviceInfo: [String: String]
    let clientSyncAt: String
}

struct GoalsConfig: Codable {
    struct Goals: Codable {
        let calories: Int
        let protein: Int
        let carbs: Int
        let fat: Int
        let fiber: Int
        let targetWeight: Double?
        let steps: Int
    }
    let goals: Goals
    let goalsVersion: String
    let syncPreferences: SyncPreferences?
}

struct SyncPreferences: Codable {
    let writeGoalsToHealth: Bool?
    let readNutritionFromHealth: Bool?
}

final class SyncAPIClient {
    var baseURL: URL
    var token: String

    init(baseURL: URL, token: String) {
        self.baseURL = baseURL
        self.token = token
    }

    private func request(path: String, method: String = "GET", body: Data? = nil) async throws -> Data {
        var url = baseURL
        url.append(path: path.hasPrefix("/") ? String(path.dropFirst()) : path)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        guard (200...299).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw NSError(domain: "SyncAPI", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: message])
        }
        return data
    }

    func fetchConfig() async throws -> GoalsConfig {
        let data = try await request(path: "/api/apple-health/config")
        let decoder = JSONDecoder()
        struct Envelope: Codable {
            let success: Bool
            let goals: GoalsConfig.Goals
            let goalsVersion: String
            let syncPreferences: SyncPreferences?
        }
        let env = try decoder.decode(Envelope.self, from: data)
        return GoalsConfig(goals: env.goals, goalsVersion: env.goalsVersion, syncPreferences: env.syncPreferences)
    }

    func upload(samples: [SyncSample]) async throws {
        let payload = SyncPayload(
            samples: samples,
            deviceInfo: [
                "platform": "iOS",
                "model": UIDevice.current.model,
                "systemVersion": UIDevice.current.systemVersion
            ],
            clientSyncAt: ISO8601DateFormatter().string(from: Date())
        )
        let body = try JSONEncoder().encode(payload)
        _ = try await request(path: "/api/apple-health/sync", method: "POST", body: body)
    }

    func ackGoals(version: String, written: Bool) async throws {
        struct Ack: Codable { let goalsVersion: String; let writtenToHealth: Bool }
        let body = try JSONEncoder().encode(Ack(goalsVersion: version, writtenToHealth: written))
        _ = try await request(path: "/api/apple-health/goals/ack", method: "POST", body: body)
    }
}

import UIKit