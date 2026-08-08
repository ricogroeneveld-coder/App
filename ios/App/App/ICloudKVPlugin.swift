import Foundation
import Capacitor

// Tiny bridge to iCloud's key-value store (NSUbiquitousKeyValueStore).
// Used to back up the guest identity + auth session so progression
// survives app reinstalls and follows the player's iCloud account.
// Requires the iCloud key-value entitlement (App.entitlements).
@objc(ICloudKVPlugin)
public class ICloudKVPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ICloudKVPlugin"
    public let jsName = "ICloudKV"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
    ]

    // After a reinstall the local KV store starts EMPTY and iCloud pushes the
    // real data asynchronously — often fast, but not always faster than app
    // startup. Forward that arrival to JS so a missed restore can retry.
    public override func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(kvChangedExternally(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: NSUbiquitousKeyValueStore.default
        )
        NSUbiquitousKeyValueStore.default.synchronize()
    }

    @objc private func kvChangedExternally(_ note: Notification) {
        notifyListeners("changed", data: [:])
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { call.reject("key required"); return }
        let store = NSUbiquitousKeyValueStore.default
        store.synchronize()
        if let value = store.string(forKey: key) {
            call.resolve(["value": value])
        } else {
            call.resolve([:])
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { call.reject("key required"); return }
        let store = NSUbiquitousKeyValueStore.default
        let value = call.getString("value") ?? ""
        if value.isEmpty {
            store.removeObject(forKey: key)
        } else {
            store.set(value, forKey: key)
        }
        store.synchronize()
        call.resolve()
    }
}
