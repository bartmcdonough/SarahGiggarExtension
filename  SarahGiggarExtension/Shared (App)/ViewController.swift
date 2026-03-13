//
//  ViewController.swift
//  Shared (App)
//
//  Created by Bart McDonough on 12/8/25.
//

import WebKit

#if os(iOS)
import UIKit
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
import SafariServices
typealias PlatformViewController = NSViewController
#endif

// Ensure this matches your EXTENSION target's ID
let extensionBundleIdentifier = "com.CertSolutions.SarahGiggarExtension.Extension"

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

#if os(iOS)
        self.webView.scrollView.isScrollEnabled = false
#endif

        self.webView.configuration.userContentController.add(self, name: "controller")

        // --- NAME INJECTION FIX ---
        // 1. Get the nice display name (e.g. "Sarah's Wardrobe")
        let displayName = (Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String)
            ?? (Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String)
            ?? "Sarah's Wardrobe"
        
        // 2. Escape it safely for JavaScript
        let escaped = displayName
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        
        // 3. Inject it BEFORE the page loads
        let scriptSource = "window.APP_DISPLAY_NAME = \"\(escaped)\";"
        let userScript = WKUserScript(source: scriptSource, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        self.webView.configuration.userContentController.addUserScript(userScript)
        // --------------------------

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
#if os(iOS)
        webView.evaluateJavaScript("show('ios')")
#elseif os(macOS)
        webView.evaluateJavaScript("show('mac')")

        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else {
                return
            }

            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), false)")
                }
            }
        }
#endif
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
#if os(macOS)
        if (message.body as! String != "open-preferences") {
            return
        }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            if let error = error {
                print("Error launching preferences: \(error)")
            } else {
                DispatchQueue.main.async {
                    NSApp.terminate(self)
                }
            }
        }
#endif
    } // Corrected closing brace location
}
