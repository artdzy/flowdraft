import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Draws a flow from a plain-language description with Apple's on-device model (Apple Intelligence, iOS and macOS 26).
/// The model only lists the steps, who does them and where they lead; the web app repairs and lays them out
/// (src/flow/sketch.ts). Nothing leaves the device.
enum FlowSketcher {
    /// Told to the web app: "available", or why drawing from a description isn't (src/lib/describe.ts has the texts).
    static var status: String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macCatalyst 26.0, *) { return OnDeviceSketcher.status }
        #endif
        return "unsupported"
    }

    /// Opens a session ahead of the request so the model is loaded by the time the user presses Draw.
    @MainActor static func prepare() {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macCatalyst 26.0, *) { OnDeviceSketcher.prepare() }
        #endif
    }

    /// A FlowSketch for the web app (title, lanes, steps, links). `progress` gets the step count and the latest title.
    @MainActor static func sketch(_ prompt: String, progress: @escaping @MainActor (Int, String) -> Void) async throws -> [String: Any] {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macCatalyst 26.0, *) { return try await OnDeviceSketcher.sketch(prompt, progress: progress) }
        #endif
        throw SketchError(code: "unavailable")
    }

    /// Error codes the web app turns into messages.
    static func code(for error: Error) -> String {
        if let error = error as? SketchError { return error.code }
        if error is CancellationError { return "cancelled" }
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macCatalyst 26.0, *), let error = error as? LanguageModelSession.GenerationError {
            switch error {
            case .exceededContextWindowSize: return "tooLong"
            case .guardrailViolation, .refusal: return "refused"
            case .unsupportedLanguageOrLocale: return "language"
            case .assetsUnavailable: return "notReady"
            case .rateLimited, .concurrentRequests: return "busy"
            default: return "failed"
            }
        }
        #endif
        return "failed"
    }
}

struct SketchError: Error {
    let code: String
}

#if canImport(FoundationModels)
@available(iOS 26.0, macCatalyst 26.0, *)
private enum OnDeviceSketcher {
    // Kept short: the schema and its guides count against the model's 4096-token context.
    private static let instructions = """
    You draw flowcharts. Turn the user's description of a process into steps.
    Begin with one start step; every path finishes at an end step. A decision is a short question; its next steps carry the answers as labels and lead to different steps. Use approval where a person approves or signs off. Other labels stay empty.
    Write all text in the language of the user's description.

    Example. Description: "The customer orders. If the item is in stock the warehouse ships it, otherwise sales tells the customer."
    title: Order handling; lanes: Customer, Warehouse, Sales
    s1 start "Order placed" (Customer) -> s2
    s2 decision "In stock?" (Warehouse) -> s3 "Yes", s4 "No"
    s3 step "Ship the item" (Warehouse) -> s5
    s4 step "Tell the customer" (Sales) -> s5
    s5 end "Done" (Customer)
    """

    @Generable
    enum Kind: String {
        case start, step, approval, decision, end
    }

    @Generable
    struct Next {
        var to: String
        @Guide(description: "Answer of a decision, else empty")
        var label: String
    }

    @Generable
    struct Step {
        @Guide(description: "s1, s2, s3…")
        var id: String
        var kind: Kind
        @Guide(description: "2-5 words")
        var title: String
        @Guide(description: "One of the lanes, or empty")
        var lane: String
        @Guide(.maximumCount(3))
        var next: [Next]
    }

    @Generable
    struct Sketch {
        var title: String
        @Guide(description: "Actors, only if two or more", .maximumCount(5))
        var lanes: [String]
        @Guide(.count(3...14))
        var steps: [Step]
    }

    /// One prewarmed session, used by the next request (a session keeps its transcript, so each flow gets a new one).
    @MainActor private static var ready: LanguageModelSession?

    static var status: String {
        switch SystemLanguageModel.default.availability {
        case .available: "available"
        case .unavailable(.deviceNotEligible): "notEligible"
        case .unavailable(.appleIntelligenceNotEnabled): "notEnabled"
        case .unavailable(.modelNotReady): "notReady"
        default: "unavailable"
        }
    }

    @MainActor static func prepare() {
        guard status == "available", ready == nil else { return }
        let session = LanguageModelSession(instructions: instructions)
        session.prewarm()
        ready = session
    }

    @MainActor static func sketch(_ prompt: String, progress: @escaping @MainActor (Int, String) -> Void) async throws -> [String: Any] {
        guard status == "available" else { throw SketchError(code: status) }
        let session = ready ?? LanguageModelSession(instructions: instructions)
        ready = nil
        let stream = session.streamResponse(
            to: prompt,
            generating: Sketch.self,
            options: GenerationOptions(maximumResponseTokens: 1400)
        )
        var count = 0
        for try await snapshot in stream {
            let steps = snapshot.content.steps ?? []
            // A step counts once the next one has started, so its title is complete.
            if steps.count - 1 > count, let title = steps[steps.count - 2].title {
                count = steps.count - 1
                progress(count, title)
            }
        }
        let sketch = try await stream.collect().content
        progress(sketch.steps.count, sketch.steps.last?.title ?? "")
        var links: [[String: String]] = []
        for step in sketch.steps {
            for next in step.next {
                links.append(["from": step.id, "to": next.to, "label": next.label])
            }
        }
        return [
            "title": sketch.title,
            "lanes": sketch.lanes,
            "steps": sketch.steps.map { ["id": $0.id, "kind": $0.kind.rawValue, "title": $0.title, "lane": $0.lane] },
            "links": links,
        ]
    }
}
#endif
