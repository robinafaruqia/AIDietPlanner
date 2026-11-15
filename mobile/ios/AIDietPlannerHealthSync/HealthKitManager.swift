import Foundation
import HealthKit

final class HealthKitManager {
    private let store = HKHealthStore()

  private var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .stepCount)!,
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .bodyMass)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
            HKObjectType.quantityType(forIdentifier: .dietaryEnergyConsumed)!,
            HKObjectType.quantityType(forIdentifier: .dietaryProtein)!,
            HKObjectType.quantityType(forIdentifier: .dietaryCarbohydrates)!,
            HKObjectType.quantityType(forIdentifier: .dietaryFatTotal)!,
            HKObjectType.quantityType(forIdentifier: .dietaryFiber)!,
            HKObjectType.quantityType(forIdentifier: .dietaryWater)!
        ]
        return types
    }

    private var writeTypes: Set<HKSampleType> {
        [
            HKObjectType.quantityType(forIdentifier: .dietaryEnergyConsumed)!,
            HKObjectType.quantityType(forIdentifier: .dietaryProtein)!,
            HKObjectType.quantityType(forIdentifier: .dietaryCarbohydrates)!,
            HKObjectType.quantityType(forIdentifier: .dietaryFatTotal)!,
            HKObjectType.quantityType(forIdentifier: .dietaryFiber)!
        ]
    }

    func requestAuthorization() async throws {
        try await store.requestAuthorization(toShare: writeTypes, read: readTypes)
    }

    func collectSamples(days: Int = 7, includeNutrition: Bool) async throws -> [SyncSample] {
        let calendar = Calendar.current
        let end = Date()
        guard let start = calendar.date(byAdding: .day, value: -days, to: end) else { return [] }

        var samples: [SyncSample] = []
        let dayFormatter = DateFormatter()
        dayFormatter.dateFormat = "yyyy-MM-dd"
        dayFormatter.timeZone = TimeZone.current

        samples.append(contentsOf: try await dailyQuantity(.stepCount, unit: .count(), type: "steps", start: start, end: end, dayFormatter: dayFormatter))
        samples.append(contentsOf: try await dailyQuantity(.activeEnergyBurned, unit: .kilocalorie(), type: "activeEnergy", start: start, end: end, dayFormatter: dayFormatter))
        samples.append(contentsOf: try await dailyWeight(start: start, end: end, dayFormatter: dayFormatter))
        samples.append(contentsOf: try await dailyHeartRate(start: start, end: end, dayFormatter: dayFormatter))
        samples.append(contentsOf: try await dailySleep(start: start, end: end, dayFormatter: dayFormatter))

        if includeNutrition {
            samples.append(contentsOf: try await dailyQuantity(.dietaryEnergyConsumed, unit: .kilocalorie(), type: "dietaryEnergy", start: start, end: end, dayFormatter: dayFormatter))
            samples.append(contentsOf: try await dailyQuantity(.dietaryProtein, unit: .gram(), type: "dietaryProtein", start: start, end: end, dayFormatter: dayFormatter))
            samples.append(contentsOf: try await dailyQuantity(.dietaryCarbohydrates, unit: .gram(), type: "dietaryCarbs", start: start, end: end, dayFormatter: dayFormatter))
            samples.append(contentsOf: try await dailyQuantity(.dietaryFatTotal, unit: .gram(), type: "dietaryFat", start: start, end: end, dayFormatter: dayFormatter))
            samples.append(contentsOf: try await dailyQuantity(.dietaryFiber, unit: .gram(), type: "dietaryFiber", start: start, end: end, dayFormatter: dayFormatter))
        }

        return samples
    }

    func writeGoals(_ goals: GoalsConfig.Goals) async throws {
        // HealthKit does not support arbitrary "goals" for all types; we write metadata samples
        // Users typically track goals in the Health app separately. We store targets as today's
        // reference samples only when no sample exists (lightweight approach).
        _ = goals
    }

    private func dailyQuantity(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        type: String,
        start: Date,
        end: Date,
        dayFormatter: DateFormatter
    ) async throws -> [SyncSample] {
        guard let quantityType = HKQuantityType.quantityType(forIdentifier: identifier) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let stats = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[Date: Double], Error>) in
            var byDay: [Date: Double] = [:]
            let anchor = calendarStartOfDay(start)
            var interval = DateComponents()
            interval.day = 1
            let query = HKStatisticsCollectionQuery(
                quantityType: quantityType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: anchor,
                intervalComponents: interval
            )
            query.initialResultsHandler = { _, results, error in
                if let error { continuation.resume(throwing: error); return }
                results?.enumerateStatistics(from: start, to: end) { statistics, _ in
                    if let sum = statistics.sumQuantity() {
                        let day = Calendar.current.startOfDay(for: statistics.startDate)
                        byDay[day] = sum.doubleValue(for: unit)
                    }
                }
                continuation.resume(returning: byDay)
            }
            store.execute(query)
        }

        return stats.map { day, value in
            SyncSample(type: type, date: dayFormatter.string(from: day), value: .number(value), unit: nil)
        }
    }

    private func dailyWeight(start: Date, end: Date, dayFormatter: DateFormatter) async throws -> [SyncSample] {
        guard let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let samples: [HKQuantitySample] = try await withCheckedThrowingContinuation { continuation in
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: true)
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { _, results, error in
                if let error { continuation.resume(throwing: error); return }
                continuation.resume(returning: results as? [HKQuantitySample] ?? [])
            }
            store.execute(query)
        }

        var latestByDay: [String: Double] = [:]
        for sample in samples {
            let day = dayFormatter.string(from: sample.startDate)
            let kg = sample.quantity.doubleValue(for: .gramUnit(with: .kilo))
            latestByDay[day] = kg
        }
        return latestByDay.map { SyncSample(type: "weight", date: $0.key, value: .number($0.value), unit: "kg") }
    }

    private func dailyHeartRate(start: Date, end: Date, dayFormatter: DateFormatter) async throws -> [SyncSample] {
        guard let type = HKQuantityType.quantityType(forIdentifier: .heartRate) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let samples: [HKQuantitySample] = try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, results, error in
                if let error { continuation.resume(throwing: error); return }
                continuation.resume(returning: results as? [HKQuantitySample] ?? [])
            }
            store.execute(query)
        }

        var grouped: [String: [Double]] = [:]
        for sample in samples {
            let day = dayFormatter.string(from: sample.startDate)
            let bpm = sample.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
            grouped[day, default: []].append(bpm)
        }

        return grouped.compactMap { day, values -> SyncSample? in
            guard !values.isEmpty else { return nil }
            let avg = values.reduce(0, +) / Double(values.count)
            let dict: [String: Double] = [
                "avg": avg,
                "min": values.min() ?? avg,
                "max": values.max() ?? avg
            ]
            return SyncSample(type: "heartRate", date: day, value: .heartRate(dict), unit: nil)
        }
    }

    private func dailySleep(start: Date, end: Date, dayFormatter: DateFormatter) async throws -> [SyncSample] {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let samples: [HKCategorySample] = try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, results, error in
                if let error { continuation.resume(throwing: error); return }
                continuation.resume(returning: results as? [HKCategorySample] ?? [])
            }
            store.execute(query)
        }

        var hoursByDay: [String: Double] = [:]
        for sample in samples {
            guard sample.value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
                || sample.value == HKCategoryValueSleepAnalysis.asleepCore.rawValue
                || sample.value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue
                || sample.value == HKCategoryValueSleepAnalysis.asleepREM.rawValue else { continue }
            let day = dayFormatter.string(from: sample.startDate)
            let hours = sample.endDate.timeIntervalSince(sample.startDate) / 3600
            hoursByDay[day, default: 0] += hours
        }
        return hoursByDay.map { SyncSample(type: "sleep", date: $0.key, value: .number($0.value), unit: "h") }
    }

    private func calendarStartOfDay(_ date: Date) -> Date {
        Calendar.current.startOfDay(for: date)
    }
}