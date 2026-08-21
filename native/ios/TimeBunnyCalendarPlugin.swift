import Capacitor
import Foundation

/// Capacitor plugin — register in AppDelegate / bridge and add to Xcode target.
/// JS access: Capacitor.Plugins.TimeBunnyCalendar or window.TimeBunnyEventKit
@objc(TimeBunnyCalendarPlugin)
public class TimeBunnyCalendarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TimeBunnyCalendarPlugin"
    public let jsName = "TimeBunnyCalendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getAuthorizationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetchEvents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeEvent", returnType: CAPPluginReturnPromise),
    ]

    @objc func getAuthorizationStatus(_ call: CAPPluginCall) {
        let status = EventKitCalendarReader.authorizationStatus()
        call.resolve([
            "status": EventKitCalendarReader.mapAuthorizationStatus(status),
            "rawStatus": status.rawValue,
        ])
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        EventKitCalendarReader.requestAccess { granted, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            let status = EventKitCalendarReader.authorizationStatus()
            call.resolve([
                "status": granted ? "granted" : EventKitCalendarReader.mapAuthorizationStatus(status),
                "rawStatus": status.rawValue,
            ])
        }
    }

    @objc func fetchEvents(_ call: CAPPluginCall) {
        guard let startIso = call.getString("startDateIso"),
              let endIso = call.getString("endDateIso") else {
            call.reject("startDateIso and endDateIso are required")
            return
        }

        let formatter = ISO8601DateFormatter()
        guard let start = formatter.date(from: startIso),
              let end = formatter.date(from: endIso) else {
            call.reject("Invalid ISO date range")
            return
        }

        do {
            let events = try EventKitCalendarReader.fetchEvents(start: start, end: end)
            call.resolve(["events": events])
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func removeEvent(_ call: CAPPluginCall) {
        guard let eventIdentifier = call.getString("eventIdentifier") else {
            call.reject("eventIdentifier is required")
            return
        }

        do {
            try EventKitCalendarReader.removeEvent(eventIdentifier: eventIdentifier)
            call.resolve(["success": true])
        } catch {
            call.reject(error.localizedDescription)
        }
    }
}
