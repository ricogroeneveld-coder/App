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
    // on the outer screen. The screen's size/traits may not be updated yet
    // when the first signal arrives, so this re-checks on the trait change,
    // on the next run-loop pass, and again once the resize has finished.
    // On regular iPhones the answer is always "portrait", so it's a no-op.
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        refreshOrientationSupport()
        DispatchQueue.main.async { [weak self] in self?.refreshOrientationSupport() }
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: nil) { [weak self] _ in
            self?.refreshOrientationSupport()
        }
    }

    private func refreshOrientationSupport() {
        if #available(iOS 16.0, *) {
            setNeedsUpdateOfSupportedInterfaceOrientations()
        }
    }
}
