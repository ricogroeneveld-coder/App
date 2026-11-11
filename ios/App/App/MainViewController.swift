import UIKit
import Capacitor

// App-local Capacitor plugins must be registered on the bridge by hand —
// Main.storyboard points here instead of at the stock CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ICloudKVPlugin())
    }

    // Same rule as AppDelegate.allowedOrientations: portrait on every
    // regular iPhone (unchanged), portrait + landscape on the iPhone Duo.
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return AppDelegate.allowedOrientations(for: view.window)
    }

    // Safety net: a light watchdog re-computes the allowed orientations twice
    // a second and asks iOS to re-read them only when the answer changed
    // (e.g. right after the Duo was recognised). Regular iPhones always
    // answer "portrait", so it never fires there; on iPad it isn't started.
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

    // Recognise the iPhone Duo on its outer screen (status bar in a strip on
    // the right while upright) so landscape is already allowed before the
    // first unfold. See AppDelegate.allowedOrientations.
    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        guard UIDevice.current.userInterfaceIdiom == .phone, !AppDelegate.isDuoDevice else { return }
        let upright = view.bounds.height > view.bounds.width
        let insets = view.safeAreaInsets
        if upright && max(insets.left, insets.right) >= 20 {
            AppDelegate.rememberDuoDevice()
            refreshOrientationSupportIfNeeded(force: true)
        }
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
