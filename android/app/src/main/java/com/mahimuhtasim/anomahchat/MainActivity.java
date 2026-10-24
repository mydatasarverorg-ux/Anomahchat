package com.mahimuhtasim.anomahchat;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setSupportMultipleWindows(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                // Remove "; wv" from User-Agent string so Google OAuth doesn't block Android WebView
                String originalUserAgent = settings.getUserAgentString();
                if (originalUserAgent != null && originalUserAgent.contains("; wv")) {
                    settings.setUserAgentString(originalUserAgent.replace("; wv", ""));
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
