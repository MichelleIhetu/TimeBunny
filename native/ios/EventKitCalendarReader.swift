import EventKit
import Foundation

/// Reads Apple Calendar events via EventKit for the TimeBunny Capacitor plugin.
/// Drop into your iOS target when you add Capacitor.
enum EventKitCalendarReader {
    private static let store = EKEventStore()

    static func authorizationStatus() -> EKAuthorizationStatus {
        EKEventStore.authorizationStatus(for: .event)
    }

    static func requestAccess(completion: @escaping (Bool, Error?) -> Void) {
        if #available(iOS 17.0, *) {
            store.requestFullAccessToEvents { granted, error in
                completion(granted, error)
            }
        } else {
            store.requestAccess(to: .event) { granted, error in
                completion(granted, error)
            }
        }
    }

    static func fetchEvents(start: Date, end: Date) throws -> [[String: Any]] {
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = store.events(matching: predicate)

        return events.map { event in
            var payload: [String: Any] = [
                "eventIdentifier": event.eventIdentifier ?? UUID().uuidString,
                "title": event.title ?? "Untitled Event",
                "startDateIso": isoString(event.startDate),
                "endDateIso": isoString(event.endDate),
                "isAllDay": event.isAllDay,
            ]
            if let notes = event.notes { payload["notes"] = notes }
            if let calendar = event.calendar {
                payload["calendarIdentifier"] = calendar.calendarIdentifier
                payload["calendarTitle"] = calendar.title
            }
            if let modified = event.lastModifiedDate {
                payload["lastModifiedDateIso"] = isoString(modified)
            }
            if let url = event.url?.absoluteString { payload["url"] = url }
            return payload
        }
    }

    static func removeEvent(eventIdentifier: String) throws {
        guard let event = store.event(withIdentifier: eventIdentifier) else {
            throw NSError(
                domain: "TimeBunnyEventKit",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Calendar event not found"]
            )
        }
        try store.remove(event, span: .thisEvent, commit: true)
    }

    private static func isoString(_ date: Date) -> String {
        ISO8601DateFormatter().string(from: date)
    }

    static func mapAuthorizationStatus(_ status: EKAuthorizationStatus) -> String {
        switch status {
        case .authorized, .fullAccess:
            return "granted"
        case .denied, .restricted:
            return "denied"
        case .notDetermined:
            return "not_determined"
        case .writeOnly:
            return "denied"
        @unknown default:
            return "unavailable"
        }
    }
}
