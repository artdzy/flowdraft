import SwiftUI

extension Notification.Name {
    /// A menu bar command for the editor; the object is the command's name (see EditorCommand).
    static let flowdraftCommand = Notification.Name("flowdraftCommand")
}

/// Menu bar commands (Mac menu bar, iPadOS menu bar and the ⌘ shortcut overlay on iPad). WebViewController hands
/// them to the web app (src/lib/commands.ts), except Open, which shows the system file picker first.
enum EditorCommand: String {
    case newFlow, describe, open, projects, save, exportPng, exportSvg, exportJson, zoomIn, zoomOut, zoomFit, aiTools, guide

    func send() {
        NotificationCenter.default.post(name: .flowdraftCommand, object: rawValue)
    }
}

struct EditorCommands: Commands {
    /// Drawing from a description needs Apple Intelligence (FlowSketcher); without it the item is left out.
    private let canDescribe = !["unsupported", "notEligible"].contains(FlowSketcher.status)

    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("New Flow…") { EditorCommand.newFlow.send() }
                .keyboardShortcut("n")
            if canDescribe {
                Button("Draw from a Description…") { EditorCommand.describe.send() }
                    .keyboardShortcut("n", modifiers: [.command, .shift])
            }
            Divider()
            Button("Open…") { EditorCommand.open.send() }
                .keyboardShortcut("o")
            Button("My Projects…") { EditorCommand.projects.send() }
                .keyboardShortcut("o", modifiers: [.command, .shift])
        }
        // Before the system's group, which holds Close (⌘W).
        CommandGroup(before: .saveItem) {
            Divider()
            Button("Save") { EditorCommand.save.send() }
                .keyboardShortcut("s")
            Menu("Export") {
                Button("PNG Image…") { EditorCommand.exportPng.send() }
                    .keyboardShortcut("e")
                Button("SVG Vector…") { EditorCommand.exportSvg.send() }
                Button("JSON (Editable)…") { EditorCommand.exportJson.send() }
            }
            Divider()
        }
        // The system's document items (Duplicate, Move, Rename, Export As) have no meaning here.
        CommandGroup(replacing: .importExport) {}
        // Show / Customize Toolbar: the window has no toolbar.
        CommandGroup(replacing: .toolbar) {
            Button("Zoom In") { EditorCommand.zoomIn.send() }
                .keyboardShortcut("+")
            Button("Zoom Out") { EditorCommand.zoomOut.send() }
                .keyboardShortcut("-")
            Button("Fit Flow") { EditorCommand.zoomFit.send() }
                .keyboardShortcut("0")
        }
        CommandGroup(replacing: .help) {
            Button("Flowchart Guide") { EditorCommand.guide.send() }
            Button("Connect AI Tools…") { EditorCommand.aiTools.send() }
        }
    }
}
