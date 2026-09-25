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

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(schemeHandler, forURLScheme: BundleSchemeHandler.scheme)
        config.userContentController.add(WeakMessageHandler(self), name: "flowdraft")
        config.userContentController.addUserScript(
            WKUserScript(source: Self.viewportScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        )

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

    /// Links leave the app: flowdraft pages (legal texts, AI guide) open from flowdraft.tech in a Safari sheet.
    private func openExternally(_ url: URL) {
        var target = url
        if url.scheme == BundleSchemeHandler.scheme,
           var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            parts.scheme = Self.site.scheme
            parts.host = Self.site.host
            target = parts.url ?? Self.site
        }
        guard ["http", "https"].contains(target.scheme?.lowercased() ?? "") else {
            UIApplication.shared.open(target)
            return
        }
        guard presentedViewController == nil else { return }
        present(SFSafariViewController(url: target), animated: true)
    }

    private func share(_ data: Data, filename: String) {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("exports", isDirectory: true)
        let file = folder.appendingPathComponent(filename.replacingOccurrences(of: "/", with: "-"))
        do {
            try? FileManager.default.removeItem(at: folder)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try data.write(to: file, options: .atomic)
        } catch {
            showMessage("Dosya hazırlanamadı. Tekrar dene.")
            return
        }
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        if let popover = sheet.popoverPresentationController {
            // Both the export menu and the compact menu button sit at the top right.
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.maxX - 110, y: view.safeAreaInsets.top + 44, width: 1, height: 1)
            popover.permittedArrowDirections = .up
        }
        guard presentedViewController == nil else { return }
        present(sheet, animated: true)
    }

    private func showMessage(_ message: String) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Tamam", style: .default))
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
                showMessage("Dışa aktarılamadı.")
                return
            }
            share(data, filename: filename)
        case "copy":
            UIPasteboard.general.string = body["text"] as? String
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
        alert.addAction(UIAlertAction(title: "Tamam", style: .default) { _ in completionHandler() })
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
        alert.addAction(UIAlertAction(title: "Vazgeç", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "Tamam", style: .default) { _ in completionHandler(true) })
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
        alert.addAction(UIAlertAction(title: "Vazgeç", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "Tamam", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
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
        if env["FLOWDRAFT_DEBUG_LANDSCAPE"] != nil {
            view.window?.windowScene?.requestGeometryUpdate(.iOS(interfaceOrientations: .landscapeLeft))
        }
        guard let script = env["FLOWDRAFT_DEBUG_JS"] else { return }
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
            print("FLOWDRAFT_DEBUG_JS", result)
            fflush(stdout)
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
