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

    // Folding/unfolding the iPhone Duo moves the app between screens. iOS
    // can ask for the allowed orientations while the screen still reports
    // its old size; if the answer was "portrait" on the inner screen, iOS
    // shows the app in a phone-sized window, and from then on nothing about
    // the app's own window changes, so no trait/size callback fires again.
    // To recover from that, a light watchdog re-computes the answer for the
    // CURRENT screen twice a second and asks iOS to re-read it only when it
    // actually changed. Regular iPhones always answer "portrait", so it never
    // fires there; on iPad the watchdog isn't started at all.
    private var orientationWatchdog: Timer?
    private var lastOrientationMask: UIInterfaceOrientationMask?

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard UIDevice.current.userInterfaceIdiom == .phone, orientationWatchdog == nil else { return }
        let timer = Timer(timeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.refreshOrientationSupportIfNeeded()
        }
        RunLoop.main.add(timer, forMode: .common)
        orientationWatchdog = timer
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        orientationWatchdog?.invalidate()
        orientationWatchdog = nil
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        refreshOrientationSupportIfNeeded(force: true)
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: nil) { [weak self] _ in
            self?.refreshOrientationSupportIfNeeded(force: true)
        }
    }

    private func refreshOrientationSupportIfNeeded(force: Bool = false) {
        let mask = AppDelegate.allowedOrientations(for: view.window)
        guard force || mask != lastOrientationMask else { return }
        lastOrientationMask = mask
        if #available(iOS 16.0, *) {
            setNeedsUpdateOfSupportedInterfaceOrientations()
        }
    }
}
