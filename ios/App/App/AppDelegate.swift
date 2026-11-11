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
    // - Every regular iPhone, and the iPhone Duo's outer screen: portrait
    //   only, exactly as before. Info.plist now lists landscape for iPhone
    //   only so the Duo's inner screen can use it; this method narrows it
    //   back to portrait everywhere else.
    // - The iPhone Duo's inner screen (Apple: regular width AND regular
    //   height size class), or any phone screen at least 600pt on its short
    //   side (no regular iPhone comes close, max is ~440pt): portrait and
    //   landscape, so the app gets the full inner display instead of a
    //   phone-sized window.
    static func allowedOrientations(for window: UIWindow?) -> UIInterfaceOrientationMask {
        guard UIDevice.current.userInterfaceIdiom == .phone else {
            return [.portrait, .portraitUpsideDown]
        }
        guard let screen = window?.windowScene?.screen else { return .portrait }
        let traits = screen.traitCollection
        let regularBothWays = traits.horizontalSizeClass == .regular && traits.verticalSizeClass == .regular
        let shortSide = min(screen.bounds.width, screen.bounds.height)
        return (regularBothWays || shortSide >= 600) ? [.portrait, .landscapeLeft, .landscapeRight] : .portrait
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
