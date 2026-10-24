import SafariServices
import UIKit
import WebKit

/// Hosts the bundled flowdraft editor. The web app talks to it through `window.webkit.messageHandlers.flowdraft`
/// (see src/lib/platform.ts): exports go to the share sheet, copied text to the pasteboard.
final class WebViewController: UIViewController {
    private static let site = URL(string: "https://flowdraft.tech")!

    /// Page zoom stays off: the canvas has its own pinch zoom, and 14px inputs would otherwise zoom in on focus.
    private static let viewportScript = """
    document.querySelector('meta[name="viewport"]')?.setAttribute('content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    """

    private let schemeHandler = BundleSchemeHandler()
    private var webView: WKWebView!
    #if DEBUG
    /// The share sheet last presented, for the recording hook (on iPad it lives in its own window).
    private weak var debugPresented: UIViewController?
    #endif

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(schemeHandler, forURLScheme: BundleSchemeHandler.scheme)
        config.userContentController.add(WeakMessageHandler(self), name: "flowdraft")
        config.userContentController.addUserScript(
            WKUserScript(source: Self.viewportScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        )
        #if targetEnvironment(macCatalyst)
        // The web app leaves room for the window's traffic lights in its own top bar (styles.css, html[data-platform='mac']).
        config.userContentController.addUserScript(
            WKUserScript(source: "document.documentElement.dataset.platform = 'mac';", injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        #endif

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(named: "LaunchBackground")
        webView.scrollView.backgroundColor = UIColor(named: "LaunchBackground")
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        #if DEBUG
        webView.isInspectable = true
        #endif
        self.webView = webView
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: BundleSchemeHandler.startURL))
    }

    #if targetEnvironment(macCatalyst)
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard let scene = view.window?.windowScene else { return }
        // The editor needs room for its side panels; the desktop layout starts at 960 px.
        scene.sizeRestrictions?.minimumSize = CGSize(width: 980, height: 640)
        // No separate title bar: the editor's own top bar runs edge to edge and the traffic lights sit inside it.
        scene.titlebar?.titleVisibility = .hidden
        scene.titlebar?.toolbar = nil
        Self.clearTitleBarMaterial()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // AppKit lays the title bar out again on resize and full screen; keep its material away.
        Self.clearTitleBarMaterial()
    }

    /// UIKit hides the title but, on macOS 26, leaves the title bar's glass material drawn over the top of the editor.
    /// The window underneath is an AppKit NSWindow: its own switch hides the title bar background, and the two views
    /// that paint the glass (a backdrop blur and a decoration layer) are hidden by hand. The traffic lights stay.
    private static func clearTitleBarMaterial() {
        guard let appClass = NSClassFromString("NSApplication"),
              let app = (appClass as AnyObject).value(forKey: "sharedApplication") as? NSObject,
              let windows = app.value(forKey: "windows") as? [NSObject] else { return }
        for window in windows {
            window.setValue(true, forKey: "titlebarAppearsTransparent")
            if let mask = window.value(forKey: "styleMask") as? UInt, mask & (1 << 15) == 0 {
                window.setValue(mask | (1 << 15), forKey: "styleMask") // NSWindow.StyleMask.fullSizeContentView
            }
            guard let frame = (window.value(forKey: "contentView") as? NSObject)?.value(forKey: "superview") as? NSObject else { continue }
            hideTitleBarGlass(in: frame)
            #if DEBUG
            // `FLOWDRAFT_DEBUG_WINDOWTREE=1` prints AppKit's view tree of the window frame (title bar layers included).
            if ProcessInfo.processInfo.environment["FLOWDRAFT_DEBUG_WINDOWTREE"] != nil,
               let tree = frame.perform(NSSelectorFromString("_subtreeDescription"))?.takeUnretainedValue() {
                print("FLOWDRAFT_DEBUG_WINDOWTREE\n\(tree)")
                fflush(stdout)
            }
            #endif
        }
    }

    private static func hideTitleBarGlass(in view: NSObject) {
        guard let subviews = view.value(forKey: "subviews") as? [NSObject] else { return }
        for sub in subviews {
            let name = NSStringFromClass(type(of: sub))
            let layer = (sub.value(forKey: "layer") as? NSObject).map { NSStringFromClass(type(of: $0)) } ?? ""
            if name.contains("TitlebarDecorationView") || layer.contains("CABackdropLayer") {
                if sub.value(forKey: "hidden") as? Bool != true { sub.setValue(true, forKey: "hidden") }
            } else if name.contains("Titlebar") {
                hideTitleBarGlass(in: sub)
            }
        }
    }
    #endif
        }
    }
    #endif

    /// Links leave the app: flowdraft pages (legal texts, AI guide) open from flowdraft.tech in a Safari sheet.
    private func openExternally(_ url: URL) {
        var target = url
        if url.scheme == BundleSchemeHandler.scheme,
           var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            parts.scheme = Self.site.scheme
            parts.host = Self.site.host
            target = parts.url ?? Self.site
        }
        #if targetEnvironment(macCatalyst)
        // On the Mac every link opens in the default browser.
        UIApplication.shared.open(target)
        #else
        guard ["http", "https"].contains(target.scheme?.lowercased() ?? "") else {
            UIApplication.shared.open(target)
            return
        }
        guard presentedViewController == nil else { return }
        present(SFSafariViewController(url: target), animated: true)
        #endif
    }

    private func share(_ data: Data, filename: String) {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("exports", isDirectory: true)
        let file = folder.appendingPathComponent(filename.replacingOccurrences(of: "/", with: "-"))
        do {
            try? FileManager.default.removeItem(at: folder)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try data.write(to: file, options: .atomic)
        } catch {
            showMessage(String(localized: "The file could not be prepared. Try again."))
            return
        }
        guard presentedViewController == nil else { return }
        #if targetEnvironment(macCatalyst)
        // The Mac shows a save panel (the sandbox then grants access to the chosen location).
        let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
        picker.shouldShowFileExtensions = true
        present(picker, animated: true)
        #else
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        #if DEBUG
        debugPresented = sheet
        #endif
        if let popover = sheet.popoverPresentationController {
            // Both the export menu and the compact menu button sit at the top right.
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.maxX - 110, y: view.safeAreaInsets.top + 44, width: 1, height: 1)
            popover.permittedArrowDirections = .up
        }
        present(sheet, animated: true)
        #endif
    }

    private func showMessage(_ message: String) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: String(localized: "OK"), style: .default))
        present(alert, animated: true)
    }

    /// Reads a data: URL as produced by the web exporter (base64 PNG, percent-encoded SVG and JSON).
    private static func decode(dataURL: String) -> Data? {
        guard dataURL.hasPrefix("data:"), let comma = dataURL.firstIndex(of: ",") else { return nil }
        let header = dataURL[..<comma]
        let payload = String(dataURL[dataURL.index(after: comma)...])
        if header.hasSuffix(";base64") { return Data(base64Encoded: payload) }
        return payload.removingPercentEncoding.map { Data($0.utf8) }
    }
}

extension WebViewController: WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "export":
            guard let filename = body["filename"] as? String, let dataURL = body["dataUrl"] as? String,
                  let data = Self.decode(dataURL: dataURL)
            else {
                showMessage(String(localized: "Export failed."))
                return
            }
            share(data, filename: filename)
        case "copy":
            UIPasteboard.general.string = body["text"] as? String
        #if DEBUG
        case "debugDismiss":
            // Screen-recording hook: closes the share sheet or alert the script opened.
            (debugPresented ?? presentedViewController)?.dismiss(animated: true)
            debugPresented = nil
        #endif
        default:
            break
        }
    }
}

extension WebViewController: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor action: WKNavigationAction,
        decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        switch url.scheme?.lowercased() {
        case BundleSchemeHandler.scheme, "about", "blob", "data":
            decisionHandler(.allow)
        default:
            decisionHandler(.cancel)
            openExternally(url)
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // The canvas is mirrored to local storage, so a reload picks up where the user was.
        webView.reload()
    }
}

extension WebViewController: WKUIDelegate {
    /// target="_blank" links and window.open.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for action: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = action.request.url { openExternally(url) }
        return nil
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor () -> Void
    ) {
        guard presentedViewController == nil else { return completionHandler() }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: String(localized: "OK"), style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor (Bool) -> Void
    ) {
        guard presentedViewController == nil else { return completionHandler(false) }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: String(localized: "Cancel"), style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: String(localized: "OK"), style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor (String?) -> Void
    ) {
        guard presentedViewController == nil else { return completionHandler(nil) }
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: String(localized: "Cancel"), style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: String(localized: "OK"), style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        present(alert, animated: true)
    }
}

#if DEBUG
extension WebViewController {
    /// Test and screenshot hook: `SIMCTL_CHILD_FLOWDRAFT_DEBUG_JS='<async function body>' xcrun simctl launch --console …`
    /// runs the script once the page has loaded and prints what it returns.
    /// `SIMCTL_CHILD_FLOWDRAFT_DEBUG_LANDSCAPE=1` turns the window to landscape first (simctl cannot rotate).
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let env = ProcessInfo.processInfo.environment
        #if targetEnvironment(macCatalyst)
        // `FLOWDRAFT_DEBUG_WINDOW=1440x900` fixes the Mac window's content size (App Store screenshots).
        if let size = env["FLOWDRAFT_DEBUG_WINDOW"]?.split(separator: "x").compactMap({ Double($0) }), size.count == 2,
           let restrictions = view.window?.windowScene?.sizeRestrictions {
            restrictions.minimumSize = CGSize(width: size[0], height: size[1])
            restrictions.maximumSize = restrictions.minimumSize
        }
        #else
        if env["FLOWDRAFT_DEBUG_LANDSCAPE"] != nil {
            view.window?.windowScene?.requestGeometryUpdate(.iOS(interfaceOrientations: .landscapeLeft))
        }
        #endif
        guard let script = env["FLOWDRAFT_DEBUG_JS"] else { return }
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { [weak self] result in
            print("FLOWDRAFT_DEBUG_JS", result)
            fflush(stdout)
            // `FLOWDRAFT_DEBUG_SNAPSHOT=/path.png` writes the web view's pixels once the script is done (App Store screenshots).
            guard let self, let path = env["FLOWDRAFT_DEBUG_SNAPSHOT"], (try? result.get()) as? String != "reload" else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                self.webView.takeSnapshot(with: nil) { image, error in
                    if let data = image?.pngData() { try? data.write(to: URL(fileURLWithPath: path)) }
                    print("FLOWDRAFT_DEBUG_SNAPSHOT", image.map { "\(Int($0.size.width * $0.scale))x\(Int($0.size.height * $0.scale))" } ?? "none", error.map { "\($0)" } ?? "")
                    fflush(stdout)
                }
            }
        }
    }
}
#endif

/// WKUserContentController keeps its handlers alive; this keeps it from owning the controller.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
