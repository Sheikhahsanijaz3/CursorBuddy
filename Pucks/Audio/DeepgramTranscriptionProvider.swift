import AVFoundation
import Foundation
import os

// MARK: - Deepgram Provider

/// Deepgram streaming speech-to-text with built-in Voice Activity Detection.
/// Requires a Deepgram API key. Configure via DEEPGRAM_API_KEY env var or APIKeysManager.
struct DeepgramTranscriptionProvider: BuddyTranscriptionProvider {

    let providerName = "Deepgram"

    var isConfigured: Bool {
        apiKey != nil && !apiKey!.isEmpty
    }

    var requiresSpeechRecognitionPermission: Bool { false }

    private var apiKey: String? {
        if let key = ProcessInfo.processInfo.environment["DEEPGRAM_API_KEY"], !key.isEmpty {
            return key
        }
        return APIKeysManager.shared.deepgramKey
    }

    func createSession() throws -> BuddyStreamingTranscriptionSession {
        guard let key = apiKey else {
            throw DeepgramError.notConfigured
        }
        return DeepgramTranscriptionSession(apiKey: key)
    }
}

// MARK: - Deepgram Session

private final class DeepgramTranscriptionSession: BuddyStreamingTranscriptionSession, @unchecked Sendable {

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.pucks",
        category: "DeepgramSession"
    )

    private let apiKey: String
    private var webSocketTask: URLSessionWebSocketTask?
    private let pcmConverter = BuddyPCM16AudioConverter()
    private var isConnected = false

    private(set) var isReady: Bool = false
    private(set) var transcriptText: String = ""
    var onTranscriptUpdate: ((String) -> Void)?
    var onError: ((Error) -> Void)?

    init(apiKey: String) {
        self.apiKey = apiKey
    }

    func start() throws {
        pcmConverter.reset()
        transcriptText = ""

        var request = URLRequest(url: URL(string: "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&encoding=linear16&sample_rate=16000&channels=1&vad_events=true&vad_turnoff=500")!)
        request.setValue(apiKey, forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 30

        let session = URLSession(configuration: .default)
        webSocketTask = session.webSocketTask(with: request)
        webSocketTask?.resume()

        isConnected = true
        isReady = true
        logger.info("Deepgram session started")

        receiveMessages()
    }

    func stop() {
        isReady = false
        isConnected = false

        let finalizeMessage = "{\"type\": \"Finalize\"}"
        webSocketTask?.send(.string(finalizeMessage)) { [weak self] error in
            if let error {
                self?.logger.warning("Error sending finalize: \(error.localizedDescription)")
            }
        }

        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        logger.info("Deepgram session stopped")
    }

    func feedAudio(buffer: AVAudioPCMBuffer) {
        guard isReady else { return }

        pcmConverter.reset()
        pcmConverter.appendAudioPCMBuffer(buffer: buffer)
        let pcmData = pcmConverter.pcm16Data
        let base64Audio = pcmData.base64EncodedString()

        let jsonMessage = "{\"audio\": \"\(base64Audio)\"}"
        webSocketTask?.send(.string(jsonMessage)) { [weak self] error in
            if let error {
                self?.logger.warning("Deepgram send error: \(error.localizedDescription)")
            }
        }
    }

    private func receiveMessages() {
        webSocketTask?.receive { [weak self] result in
            guard let self, self.isConnected else { return }

            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                self.receiveMessages()

            case .failure(let error):
                self.logger.error("Deepgram receive error: \(error.localizedDescription)")
                if self.isReady {
                    DispatchQueue.main.async {
                        self.onError?(error)
                    }
                }
            }
        }
    }

    private func handleMessage(_ jsonString: String) {
        guard let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }

        // Handle speech_started (VAD event — user started speaking)
        if let channel = json["channel"] as? [String: Any],
           let alternatives = channel["alternatives"] as? [[String: Any]],
           let transcript = alternatives.first?["transcript"] as? String,
           !transcript.isEmpty {

            let isFinal = json["speech_final"] as? Bool ?? false

            if isFinal {
                if !transcriptText.isEmpty {
                    transcriptText += " "
                }
                transcriptText += transcript

                DispatchQueue.main.async { [weak self] in
                    guard let self else { return }
                    self.onTranscriptUpdate?(self.transcriptText)
                }
            } else {
                // Partial transcript — but we still use it as incremental
                let displayText = !transcriptText.isEmpty ? "\(transcriptText) \(transcript)" : transcript
                DispatchQueue.main.async { [weak self] in
                    guard let self else { return }
                    self.onTranscriptUpdate?(displayText)
                }
            }
        }

        // Handle VAD events
        if let type = json["type"] as? String {
            switch type {
            case "SpeechStarted":
                logger.debug("Deepgram VAD: speech started")
            case "SpeechStopped":
                logger.debug("Deepgram VAD: speech stopped")
            default:
                break
            }
        }
    }
}

// MARK: - Errors

enum DeepgramError: LocalizedError {
    case notConfigured

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Deepgram API key not configured. Set DEEPGRAM_API_KEY or add it in Settings."
        }
    }
}
