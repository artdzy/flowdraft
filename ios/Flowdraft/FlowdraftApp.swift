import SwiftUI

@main
struct FlowdraftApp: App {
    var body: some Scene {
        WindowGroup {
            EditorView()
                .ignoresSafeArea()
                .statusBarHidden()
        }
    }
}

/// The whole editor is the bundled web app; see WebViewController.
private struct EditorView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> WebViewController { WebViewController() }
    func updateUIViewController(_ controller: WebViewController, context: Context) {}
}
