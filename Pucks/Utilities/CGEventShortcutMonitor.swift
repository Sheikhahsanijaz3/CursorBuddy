import AppKit
import Carbon
import Foundation

/// Modern global keyboard shortcut monitor using CGEvent.
///
/// Listens for a specific keyboard shortcut globally using macOS's CGEvent tap API.
/// Falls back to the Carbon-based GlobalPushToTalkShortcutMonitor if needed.
///
/// Usage:
///   let monitor = ModernGlobalShortcutMonitor()
///   monitor.keyCode = UInt32(kVK_Space)
///   monitor.modifiers = UInt32(controlKey | optionKey)
///   monitor.onShortcutPressed = { ... }
///   monitor.onShortcutReleased = { ... }
///   monitor.start()
final class ModernGlobalShortcutMonitor {

    // MARK: - Configuration

    var keyCode: UInt32 = UInt32(kVK_Space)
    var modifiers: UInt32 = UInt32(controlKey | optionKey)

    // Required modifier flags for CGEvent tap
    private var requiredFlags: CGEventFlags {
        var flags: CGEventFlags = []
        if modifiers & UInt32(controlKey) != 0 { flags.insert(.maskControl) }
        if modifiers & UInt32(optionKey) != 0 { flags.insert(.maskAlternate) }
        if modifiers & UInt32(shiftKey) != 0 { flags.insert(.maskShift) }
        if modifiers & UInt32(cmdKey) != 0 { flags.insert(.maskCommand) }
        return flags
    }

    // Forbidden keys — these must NOT be pressed alone (but may be modifiers)
    private var forbiddenKeys: Set<UInt16> = [
        UInt16(kVK_Command),
        UInt16(kVK_Shift),
        UInt16(kVK_Option),
        UInt16(kVK_Control)
    ]

    // MARK: - Callbacks

    var onShortcutPressed: (() -> Void)?
    var onShortcutReleased: (() -> Void)?

    // MARK: - Internal State

    private(set) var isRunning: Bool = false
    private var eventTap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private(set) var isPressed: Bool = false

    deinit { stop() }

    // MARK: - Public

    @discardableResult
    func start() -> Bool {
        guard !isRunning else { return true }

        // Create an event tap at the HID level to capture key events
        // We want keyDown and keyUp events before they reach other apps
        let eventMask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.keyUp.rawValue) | (1 << CGEventType.flagsChanged.rawValue)

        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .defaultTap,
            eventsOfInterest: CGEventMask(eventMask),
            callback: { (proxy, type, event, refcon) -> Unmanaged<CGEvent>? in
                guard let refcon = refcon else { return Unmanaged.passRetained(event) }
                let monitor = Unmanaged<ModernGlobalShortcutMonitor>.fromOpaque(refcon).takeUnretainedValue()
                return monitor.handleEvent(proxy: proxy, type: type, event: event)
            },
            userInfo: Unmanaged.passUnretained(self).toOpaque()
        ) else {
            print("[ModernShortcut] Failed to create event tap. Check Accessibility permissions.")
            return false
        }

        eventTap = tap

        runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
        CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)

        isRunning = true
        print("[ModernShortcut] Event tap started (keyCode: \(keyCode), modifiers: \(modifiers))")
        return true
    }

    func stop() {
        guard isRunning else { return }

        if let tap = eventTap {
            CGEvent.tapEnable(tap: tap, enable: false)
        }

        if let source = runLoopSource {
            CFRunLoopRemoveSource(CFRunLoopGetCurrent(), source, .commonModes)
            runLoopSource = nil
        }

        eventTap = nil
        isRunning = false
        isPressed = false
        print("[ModernShortcut] Event tap stopped")
    }

    // MARK: - Event Handler

    private func handleEvent(proxy: CGEventTapProxy, type: CGEventType, event: CGEvent) -> Unmanaged<CGEvent>? {
        // Handle tap being disabled by the system
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if let tap = eventTap {
                CGEvent.tapEnable(tap: tap, enable: true)
            }
            return Unmanaged.passRetained(event)
        }

        let keyCode = UInt32(event.getIntegerValueField(.keyboardEventKeycode))
        let flags = event.flags

        // Only process our target key code
        guard keyCode == self.keyCode else {
            return Unmanaged.passRetained(event)
        }

        // Check flags match our required modifiers
        let ourFlags = requiredFlags
        let hasRequiredFlags = flags.contains(ourFlags)

        switch type {
        case .keyDown:
            // Only trigger if:
            // 1. Our required modifiers are present (except we allow the key itself to provide modifiers)
            // 2. No "forbidden" extra modifiers are present (e.g., if we want Ctrl+Space, Command+Space should not trigger)
            let extraForbidden: CGEventFlags = [.maskCommand, .maskControl, .maskAlternate, .maskShift]
            let flagsWithoutOurs = flags.intersection(extraForbidden).subtracting(ourFlags)

            if hasRequiredFlags && flagsWithoutOurs.isEmpty {
                if !isPressed {
                    isPressed = true
                    DispatchQueue.main.async { [weak self] in
                        self?.onShortcutPressed?()
                    }
                }
            }

        case .keyUp:
            if isPressed {
                isPressed = false
                DispatchQueue.main.async { [weak self] in
                    self?.onShortcutReleased?()
                }
            }

        default:
            break
        }

        // Don't consume the event — let it reach other apps
        return Unmanaged.passRetained(event)
    }
}

// MARK: - Carbon Legacy Monitor (kept for compatibility)

/// Wrapper that uses the Carbon-based monitor but exposes the same interface.
final class GlobalShortcutMonitorLegacy {

    var keyCode: UInt32 = UInt32(kVK_Space)
    var modifiers: UInt32 = UInt32(controlKey | optionKey)

    var onShortcutPressed: (() -> Void)?
    var onShortcutReleased: (() -> Void)?

    private var carbonMonitor: GlobalPushToTalkShortcutMonitor?

    @discardableResult
    func start() -> Bool {
        carbonMonitor = GlobalPushToTalkShortcutMonitor()
        carbonMonitor?.keyCode = keyCode
        carbonMonitor?.modifiers = modifiers
        carbonMonitor?.onShortcutPressed = onShortcutPressed
        carbonMonitor?.onShortcutReleased = onShortcutReleased
        return carbonMonitor?.start() ?? false
    }

    func stop() {
        carbonMonitor?.stop()
        carbonMonitor = nil
    }
}
