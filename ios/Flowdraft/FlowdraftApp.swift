import SwiftUI

@main
struct FlowdraftApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            EditorView()
                .ignoresSafeArea()
                .statusBarHidden()
        }
        .commands { EditorCommands() }
    }
}

/// Trims the system menus the editor has no use for (see EditorCommands for its own).
final class AppDelegate: UIResponder, UIApplicationDelegate {
    override func buildMenu(with builder: UIMenuBuilder) {
        super.buildMenu(with: builder)
        guard builder.system == .main else { return }
        // Duplicate, Move, Rename and Export As belong to document-based apps.
        builder.remove(menu: .document)
        // Select All would select the page's text; the editor's own selects every part on the canvas (or the text of
        // the field being typed in), see WebViewController.selectAllInEditor.
        builder.replaceChildren(ofMenu: .standardEdit) { children in
            children.map { element in
                guard let command = element as? UICommand,
                      command.action == #selector(UIResponderStandardEditActions.selectAll(_:)) else { return element }
                return UIKeyCommand(
                    title: String(localized: "Select All"),
                    action: #selector(WebViewController.selectAllInEditor(_:)),
                    input: "a",
                    modifierFlags: .command
                )
            }
        }
    }
}

/// The whole editor is the bundled web app; see WebViewController.
private struct EditorView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> WebViewController { WebViewController() }
    func updateUIViewController(_ controller: WebViewController, context: Context) {}
}
