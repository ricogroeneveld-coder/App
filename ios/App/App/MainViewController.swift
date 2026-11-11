import UIKit
import Capacitor

// App-local Capacitor plugins must be registered on the bridge by hand —
// Main.storyboard points here instead of at the stock CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ICloudKVPlugin())
    }

    // Same rule as AppDelegate.allowedOrientations: portrait on every
    // regular iPhone (unchanged), portrait + landscape only on the iPhone
    // Duo's inner screen.
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return AppDelegate.allowedOrientations(for: view.window)
    }

    // Folding/unfolding the iPhone Duo moves the app between screens; ask
    // iOS to re-read the allowed orientations so it snaps back to portrait
    // on the outer screen. No-op on devices whose screen never changes.
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if #available(iOS 16.0, *) {
            setNeedsUpdateOfSupportedInterfaceOrientations()
        }
    }
}
