#!/usr/bin/env swift

import Cocoa
import ApplicationServices

// Check accessibility permissions
func checkAccessibility() -> Bool {
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue(): true] as CFDictionary
    return AXIsProcessTrustedWithOptions(options)
}

func escapeJSON(_ text: String) -> String {
    return text
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "\"", with: "\\\"")
        .replacingOccurrences(of: "\n", with: "\\n")
        .replacingOccurrences(of: "\r", with: "\\r")
        .replacingOccurrences(of: "\t", with: "\\t")
}

struct SelectionInfo {
    var text: String
    var bounds: CGRect? // screen coordinates of selection
    var appName: String?
}

func getSelectionInfo() -> SelectionInfo? {
    guard let app = NSWorkspace.shared.frontmostApplication else { return nil }
    let pid = app.processIdentifier
    let axApp = AXUIElementCreateApplication(pid)
    
    var focusedElement: AnyObject?
    guard AXUIElementCopyAttributeValue(axApp, kAXFocusedUIElementAttribute as CFString, &focusedElement) == .success else {
        return nil
    }
    
    let element = focusedElement as! AXUIElement
    
    // Get selected text
    var selectedText: AnyObject?
    guard AXUIElementCopyAttributeValue(element, kAXSelectedTextAttribute as CFString, &selectedText) == .success,
          let text = selectedText as? String, !text.isEmpty else {
        return nil
    }
    
    // Try to get selection bounds via selectedTextRange → boundsForRange
    var bounds: CGRect? = nil
    var selectedRange: AnyObject?
    if AXUIElementCopyAttributeValue(element, kAXSelectedTextRangeAttribute as CFString, &selectedRange) == .success {
        var boundsValue: AnyObject?
        let paramResult = AXUIElementCopyParameterizedAttributeValue(
            element,
            kAXBoundsForRangeParameterizedAttribute as CFString,
            selectedRange!,
            &boundsValue
        )
        if paramResult == .success, let boundsAX = boundsValue {
            var rect = CGRect.zero
            if AXValueGetValue(boundsAX as! AXValue, .cgRect, &rect) {
                bounds = rect
            }
        }
    }
    
    // Fallback: get the element's own position/size
    if bounds == nil {
        var posValue: AnyObject?
        var sizeValue: AnyObject?
        if AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &posValue) == .success,
           AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &sizeValue) == .success {
            var pos = CGPoint.zero
            var size = CGSize.zero
            if AXValueGetValue(posValue as! AXValue, .cgPoint, &pos),
               AXValueGetValue(sizeValue as! AXValue, .cgSize, &size) {
                bounds = CGRect(origin: pos, size: size)
            }
        }
    }
    
    return SelectionInfo(text: text, bounds: bounds, appName: app.localizedName)
}

// Main loop
guard checkAccessibility() else {
    fputs("{\"error\":\"accessibility_denied\"}\n", stderr)
    exit(1)
}

fputs("{\"status\":\"ready\"}\n", stdout)
fflush(stdout)

var lastText = ""

// Poll every 300ms
while true {
    if let info = getSelectionInfo(), info.text != lastText {
        lastText = info.text
        let escaped = escapeJSON(info.text)
        let appEscaped = escapeJSON(info.appName ?? "")
        
        var json = "{\"text\":\"\(escaped)\""
        json += ",\"app\":\"\(appEscaped)\""
        
        if let b = info.bounds {
            // Screen coordinates (origin top-left for Electron compatibility)
            // AX uses bottom-left origin, convert to top-left
            let screenHeight = NSScreen.main?.frame.height ?? 0
            let topLeftY = screenHeight - b.origin.y - b.height
            json += ",\"bounds\":{\"x\":\(Int(b.origin.x)),\"y\":\(Int(topLeftY)),\"width\":\(Int(b.width)),\"height\":\(Int(b.height))}"
        }
        
        json += "}"
        print(json)
        fflush(stdout)
    } else if lastText != "" {
        // Check if selection was cleared
        if getSelectionInfo() == nil {
            lastText = ""
            print("{\"cleared\":true}")
            fflush(stdout)
        }
    }
    Thread.sleep(forTimeInterval: 0.3)
}
