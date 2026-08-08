import UIKit
import Capacitor

// App-local Capacitor plugins must be registered on the bridge by hand —
// Main.storyboard points here instead of at the stock CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ICloudKVPlugin())
    }
}
