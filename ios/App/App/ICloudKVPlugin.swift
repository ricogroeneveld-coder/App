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
