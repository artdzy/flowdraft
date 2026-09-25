import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves the web app bundled in Web/ at flowdraft://app/, so the editor opens instantly and works offline.
/// /config.js (Supabase address and public key) comes from flowdraft.tech, cached for offline launches.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "flowdraft"
    static let startURL = URL(string: "flowdraft://app/")!

    private static let configURL = URL(string: "https://flowdraft.tech/config.js")!
    private static let configCacheKey = "flowdraft.config.js"
    private static let emptyConfig = "window.__FLOWDRAFT__={};"

    private let root = Bundle.main.url(forResource: "Web", withExtension: nil)!
    /// Tasks WebKit has not cancelled yet; a stopped task must not receive a response.
    private var active = Set<ObjectIdentifier>()

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        let path = task.request.url?.path ?? "/"
        if path == "/config.js" {
            serveConfig(task)
            return
        }
        // Page routes (/, /gizlilik, /mcp …) all get the single-page app shell.
        let file = (path as NSString).pathExtension.isEmpty
            ? root.appendingPathComponent("index.html")
            : root.appendingPathComponent(String(path.dropFirst()))
        guard file.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path),
              let data = try? Data(contentsOf: file)
        else {
            respond(task, status: 404, type: "text/plain", data: Data("Not found".utf8))
            return
        }
        respond(task, status: 200, type: Self.mimeType(for: file), data: data)
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {
        active.remove(ObjectIdentifier(task))
    }

    private func serveConfig(_ task: any WKURLSchemeTask) {
        let cached = UserDefaults.standard.string(forKey: Self.configCacheKey)
        if let cached {
            // Answer from the cache right away; the refreshed copy is used from the next launch.
            respond(task, status: 200, type: "text/javascript", data: Data(cached.utf8))
        } else {
            active.insert(ObjectIdentifier(task))
        }
        var request = URLRequest(url: Self.configURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 6)
        request.setValue("flowdraft-ipad", forHTTPHeaderField: "User-Agent")
        URLSession.shared.dataTask(with: request) { data, response, _ in
            let text = data.flatMap { String(data: $0, encoding: .utf8) }
            let ok = (response as? HTTPURLResponse)?.statusCode == 200 && text.map(Self.hasAnonKey) == true
            DispatchQueue.main.async {
                if ok, let text { UserDefaults.standard.set(text, forKey: Self.configCacheKey) }
                guard cached == nil, self.active.remove(ObjectIdentifier(task)) != nil else { return }
                let body = text?.hasPrefix("window.__FLOWDRAFT__=") == true ? text! : Self.emptyConfig
                self.respond(task, status: 200, type: "text/javascript", data: Data(body.utf8))
            }
        }.resume()
    }

    private static func hasAnonKey(_ config: String) -> Bool {
        config.range(of: #""supabaseAnonKey":"[^"]+""#, options: .regularExpression) != nil
    }

    private func respond(_ task: any WKURLSchemeTask, status: Int, type: String, data: Data) {
        let headers = ["Content-Type": type, "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        let response = HTTPURLResponse(url: task.request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    private static func mimeType(for file: URL) -> String {
        switch file.pathExtension.lowercased() {
        case "html": "text/html; charset=utf-8"
        case "js", "mjs": "text/javascript"
        case "css": "text/css"
        case "json": "application/json"
        case "svg": "image/svg+xml"
        case "woff2": "font/woff2"
        case "woff": "font/woff"
        default: UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
