import SafariServices
import UIKit
import UniformTypeIdentifiers
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
    /// The flow being drawn from a description (FlowSketcher); one at a time.
    private var sketchTask: Task<Void, Never>?
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
        // What the app adds to the web app (src/lib/platform.ts): drawing a flow from a description on the device.
        config.userContentController.addUserScript(
            WKUserScript(
                source: "window.flowdraftNative = { sketch: '\(FlowSketcher.status)' };",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
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
        if #available(iOS 26.0, *) {
            // iOS 26 and macOS 26 blur whatever scrolls under the window's top and bottom edges; the editor's own bars sit
            // there, and on the Mac the blur would cover the top bar together with the traffic lights.
            webView.scrollView.topEdgeEffect.isHidden = true
            webView.scrollView.bottomEdgeEffect.isHidden = true
        }
        #if DEBUG
        webView.isInspectable = true
        #endif
        self.webView = webView
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: BundleSchemeHandler.startURL))
        NotificationCenter.default.addObserver(self, selector: #selector(runCommand(_:)), name: .flowdraftCommand, object: nil)
    }

    /// Edit > Select All (AppDelegate.buildMenu): the web app selects the canvas parts or the text being edited.
    @objc func selectAllInEditor(_ sender: Any?) {
        send(["type": "command", "name": "selectAll"])
    }

    /// A menu bar command (EditorCommands): Open shows the file picker here, the rest go to the web app.
    @objc private func runCommand(_ note: Notification) {
        guard let name = note.object as? String else { return }
        guard name == EditorCommand.open.rawValue else {
            send(["type": "command", "name": name])
            return
        }
        guard presentedViewController == nil else { return }
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json], asCopy: true)
        picker.delegate = self
        present(picker, animated: true)
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

    /// The editor's top bar doubles as the title bar: a press on an empty part of it hands the mouse event in flight
    /// to AppKit, which moves the window with it; a double-click zooms the window like a title bar would.
    private static func moveWindow(zoom: Bool) {
        guard let appClass = NSClassFromString("NSApplication"),
              let app = (appClass as AnyObject).value(forKey: "sharedApplication") as? NSObject,
              let window = (app.value(forKey: "keyWindow") as? NSObject) ?? (app.value(forKey: "windows") as? [NSObject])?.first
        else { return }
        if zoom {
            window.perform(NSSelectorFromString("performZoom:"), with: nil)
            return
        }
        // The press or a drag of the left button starts the move (NSEvent.EventType 1 and 6). The message from the
        // page arrives a moment after the press, so the current event may already be something else (the window
        // becoming key, say); then the next drag event is waited for briefly without taking it out of the queue.
        var event = app.value(forKey: "currentEvent") as? NSObject
        if let type = event?.value(forKey: "type") as? UInt, type == 1 || type == 6 {
            // Use it as is.
        } else {
            typealias NextEvent = @convention(c) (AnyObject, Selector, UInt64, AnyObject?, AnyObject, Bool) -> Unmanaged<AnyObject>?
            let selector = NSSelectorFromString("nextEventMatchingMask:untilDate:inMode:dequeue:")
            let next = unsafeBitCast(app.method(for: selector), to: NextEvent.self)
            let dragMask: UInt64 = 1 << 6 // NSEvent.EventTypeMask.leftMouseDragged
            event = next(app, selector, dragMask, NSDate(timeIntervalSinceNow: 0.3), "kCFRunLoopDefaultMode" as NSString, false)?
                .takeUnretainedValue() as? NSObject
        }
        guard let event else { return }
        window.perform(NSSelectorFromString("performWindowDragWithEvent:"), with: event)
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

    /// Hands an event to the web app (window.flowdraftNativeEvent, src/lib/platform.ts).
    private func send(_ event: [String: Any]) {
        webView.callAsyncJavaScript("window.flowdraftNativeEvent?.(event)", arguments: ["event": event], in: nil, in: .page)
    }

    /// Draws a flow from the user's description on the device and reports progress, then the sketch or an error code.
    private func startSketch(id: Int, prompt: String) {
        sketchTask?.cancel()
        sketchTask = Task { [weak self] in
            do {
                let sketch = try await FlowSketcher.sketch(prompt) { steps, latest in
                    self?.send(["type": "sketchProgress", "id": id, "steps": steps, "latest": latest])
                }
                try Task.checkCancellation()
                self?.send(["type": "sketchResult", "id": id, "sketch": sketch])
            } catch {
                self?.send(["type": "sketchError", "id": id, "code": FlowSketcher.code(for: error)])
            }
        }
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
        case "dragWindow", "zoomWindow":
            #if targetEnvironment(macCatalyst)
            Self.moveWindow(zoom: type == "zoomWindow")
            #endif
        case "sketchPrepare":
            // The describe dialog opened: report whether the model is ready now and load it in the background.
            send(["type": "sketchStatus", "status": FlowSketcher.status])
            FlowSketcher.prepare()
        case "sketch":
            guard let id = body["id"] as? Int, let prompt = body["prompt"] as? String,
                  !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
            startSketch(id: id, prompt: String(prompt.prefix(1200)))
        case "sketchCancel":
            sketchTask?.cancel()
            sketchTask = nil
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

extension WebViewController: UIDocumentPickerDelegate {
    /// File > Open: the chosen flowdraft JSON goes to the web app, which checks and opens it like an import.
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { return }
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        guard size <= 2 * 1024 * 1024, let data = try? Data(contentsOf: url), let text = String(data: data, encoding: .utf8) else {
            showMessage(String(localized: "This file can’t be opened."))
            return
        }
        send(["type": "importFile", "name": url.lastPathComponent, "text": text])
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
            Self.moveWindowToRetinaScreen(height: size[1])
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
                #if targetEnvironment(macCatalyst)
                // The Mac picture is the window as the App Store shows it: the page from the web view (rendered out of
                // process, so a plain window capture misses it) with the traffic lights AppKit draws on top. The app
                // comes to the front first so the lights are coloured.
                Self.activateApp()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    // 2x pixels whatever the screen: WebKit renders at the requested width and tags the image 1x.
                    let config = WKSnapshotConfiguration()
                    config.snapshotWidth = NSNumber(value: Double(self.webView.bounds.width) * 2)
                    self.webView.takeSnapshot(with: config) { page, error in
                        Self.logScreens(page: page)
                        let image = page.map { Self.windowPicture(page: $0, size: self.webView.bounds.size) }
                        if let data = image?.pngData() { try? data.write(to: URL(fileURLWithPath: path)) }
                        print("FLOWDRAFT_DEBUG_SNAPSHOT", image.map { "\(Int($0.size.width * $0.scale))x\(Int($0.size.height * $0.scale))" } ?? "none", error.map { "\($0)" } ?? "")
                        fflush(stdout)
                    }
                }
                #else
                self.webView.takeSnapshot(with: nil) { image, error in
                    if let data = image?.pngData() { try? data.write(to: URL(fileURLWithPath: path)) }
                    print("FLOWDRAFT_DEBUG_SNAPSHOT", image.map { "\(Int($0.size.width * $0.scale))x\(Int($0.size.height * $0.scale))" } ?? "none", error.map { "\($0)" } ?? "")
                    fflush(stdout)
                }
                #endif
            }
        }
    }

    #if targetEnvironment(macCatalyst)
    private static func activateApp() {
        guard let appClass = NSClassFromString("NSApplication"),
              let app = (appClass as AnyObject).value(forKey: "sharedApplication") as? NSObject else { return }
        app.perform(NSSelectorFromString("activate"))
    }

    /// App Store pictures want 2x pixels: the window goes to a Retina screen when it was left on another one.
    private static func moveWindowToRetinaScreen(height: Double) {
        guard let window = appKitWindow(), let screenClass = NSClassFromString("NSScreen"),
              let screens = (screenClass as AnyObject).value(forKey: "screens") as? [NSObject],
              let retina = screens.first(where: { ($0.value(forKey: "backingScaleFactor") as? Double ?? 1) >= 2 }),
              let frame = (retina.value(forKey: "frame") as? NSValue)?.cgRectValue else { return }
        typealias SetOrigin = @convention(c) (AnyObject, Selector, CGPoint) -> Void
        let selector = NSSelectorFromString("setFrameOrigin:")
        guard let imp = window.method(for: selector) else { return }
        unsafeBitCast(imp, to: SetOrigin.self)(window, selector, CGPoint(x: frame.minX, y: frame.maxY - height))
    }

    private static func appKitWindow() -> NSObject? {
        guard let appClass = NSClassFromString("NSApplication"),
              let app = (appClass as AnyObject).value(forKey: "sharedApplication") as? NSObject else { return nil }
        return (app.value(forKey: "keyWindow") as? NSObject) ?? (app.value(forKey: "windows") as? [NSObject])?.first
    }

    /// The title bar strip as AppKit draws it (the traffic lights on a transparent background), at the screen's scale.
    private static func titleBarPicture() -> (image: UIImage, size: CGSize)? {
        guard let window = appKitWindow(),
              let frame = (window.value(forKey: "contentView") as? NSObject)?.value(forKey: "superview") as? NSObject,
              let subviews = frame.value(forKey: "subviews") as? [NSObject],
              let bar = subviews.first(where: { NSStringFromClass(type(of: $0)).contains("TitlebarContainerView") }),
              let bounds = (bar.value(forKey: "bounds") as? NSValue)?.cgRectValue else { return nil }
        typealias RepFor = @convention(c) (AnyObject, Selector, CGRect) -> Unmanaged<AnyObject>?
        typealias Cache = @convention(c) (AnyObject, Selector, CGRect, AnyObject) -> Void
        let repSelector = NSSelectorFromString("bitmapImageRepForCachingDisplayInRect:")
        let cacheSelector = NSSelectorFromString("cacheDisplayInRect:toBitmapImageRep:")
        guard let repImp = bar.method(for: repSelector), let cacheImp = bar.method(for: cacheSelector),
              let rep = unsafeBitCast(repImp, to: RepFor.self)(bar, repSelector, bounds)?.takeUnretainedValue() as? NSObject
        else { return nil }
        unsafeBitCast(cacheImp, to: Cache.self)(bar, cacheSelector, bounds, rep)
        // The rep's CGImage can't travel through key-value coding; its PNG bytes can (NSBitmapImageFileTypePNG = 4).
        typealias RepData = @convention(c) (AnyObject, Selector, UInt, AnyObject?) -> Unmanaged<AnyObject>?
        let dataSelector = NSSelectorFromString("representationUsingType:properties:")
        guard let dataImp = rep.method(for: dataSelector),
              let data = unsafeBitCast(dataImp, to: RepData.self)(rep, dataSelector, 4, NSDictionary())?.takeUnretainedValue() as? Data,
              let image = UIImage(data: data) else { return nil }
        return (image, bounds.size)
    }

    private static func logScreens(page: UIImage?) {
        guard let screenClass = NSClassFromString("NSScreen"),
              let screens = (screenClass as AnyObject).value(forKey: "screens") as? [NSObject] else { return }
        let list = screens.map { "\(($0.value(forKey: "frame") as? NSValue)?.cgRectValue ?? .zero)@\($0.value(forKey: "backingScaleFactor") ?? 0)" }
        let window = appKitWindow()
        print("FLOWDRAFT_DEBUG_SCREENS", list, "window", (window?.value(forKey: "frame") as? NSValue)?.cgRectValue ?? .zero,
              "@", window?.value(forKey: "backingScaleFactor") ?? 0, "page", page?.size ?? .zero, "@", page?.scale ?? 0)
        fflush(stdout)
    }

    /// The window's backing scale, 1 on a plain screen and 2 on a Retina one.
    private static func windowScale() -> CGFloat {
        (appKitWindow()?.value(forKey: "backingScaleFactor") as? CGFloat) ?? 1
    }

    /// The page's pixels at 2x with the title bar strip on top. AppKit's own strip is used when the window sits on a
    /// Retina screen; on a plain screen it would come out soft, so the traffic lights are drawn in macOS's colours.
    private static func windowPicture(page: UIImage, size: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 2
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            page.draw(in: CGRect(origin: .zero, size: size))
            if windowScale() >= 2, let bar = titleBarPicture() {
                bar.image.draw(in: CGRect(origin: .zero, size: bar.size))
                return
            }
            let lights: [(fill: UIColor, ring: UIColor)] = [
                (UIColor(red: 1, green: 0.373, blue: 0.341, alpha: 1), UIColor(red: 0.878, green: 0.267, blue: 0.243, alpha: 1)),
                (UIColor(red: 0.996, green: 0.737, blue: 0.18, alpha: 1), UIColor(red: 0.871, green: 0.631, blue: 0.137, alpha: 1)),
                (UIColor(red: 0.157, green: 0.784, blue: 0.251, alpha: 1), UIColor(red: 0.102, green: 0.671, blue: 0.161, alpha: 1)),
            ]
            for (i, light) in lights.enumerated() {
                let rect = CGRect(x: 9 + CGFloat(i) * 23, y: 9, width: 14, height: 14)
                light.fill.setFill()
                ctx.cgContext.fillEllipse(in: rect)
                light.ring.setStroke()
                ctx.cgContext.setLineWidth(0.5)
                ctx.cgContext.strokeEllipse(in: rect.insetBy(dx: 0.25, dy: 0.25))
            }
        }
    }
    #endif
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
