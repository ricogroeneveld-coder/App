import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    // Orientation rule (iPhone Duo support):
    // - iPad: exactly what Info.plist's ~ipad key already says (unchanged).
    // - Every regular iPhone: portrait only, exactly as before. Info.plist
    //   lists landscape for iPhone only so the Duo can use it; this method
    //   narrows it back to portrait on every other iPhone.
    // - iPhone Duo: portrait and landscape, on both screens. It can't be
    //   decided per screen: once iOS shows a portrait-only app scaled in a
    //   phone-sized window on the inner screen (e.g. opened on the outer
    //   screen, then unfolded), it also reports a phone-sized screen to the
    //   app, so the app can never "see" the inner display to fix it. The
    //   app therefore has to already allow landscape BEFORE the unfold.
    static func allowedOrientations(for window: UIWindow?) -> UIInterfaceOrientationMask {
        guard UIDevice.current.userInterfaceIdiom == .phone else {
            return [.portrait, .portraitUpsideDown]
        }
        if isDuoDevice { return [.portrait, .landscapeLeft, .landscapeRight] }
        // Not recognised yet: a large screen right now (app launched on the
        // unfolded inner display) also identifies the Duo.
        let scene = window?.windowScene
            ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        if let screen = scene?.screen {
            let traits = screen.traitCollection
            let regularBothWays = traits.horizontalSizeClass == .regular && traits.verticalSizeClass == .regular
            let shortSide = min(screen.bounds.width, screen.bounds.height)
            if regularBothWays || shortSide >= 600 {
                rememberDuoDevice()
                return [.portrait, .landscapeLeft, .landscapeRight]
            }
        }
        return .portrait
    }

    // "This phone is an iPhone Duo", remembered across launches. Set the
    // first time the app sees either Duo-only signal:
    // - a large (regular x regular / >= 600pt) screen, see above, or
    // - a right-hand safe area while upright: the Duo's outer screen keeps
    //   its status bar in a strip on the right (MainViewController). No
    //   regular iPhone has a side safe area in portrait.
    private static let duoDeviceKey = "wmp_isDuoDevice"
    static var isDuoDevice: Bool { UserDefaults.standard.bool(forKey: duoDeviceKey) }
    static func rememberDuoDevice() {
        guard !isDuoDevice else { return }
        UserDefaults.standard.set(true, forKey: duoDeviceKey)
    }

    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        return AppDelegate.allowedOrientations(for: window)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
