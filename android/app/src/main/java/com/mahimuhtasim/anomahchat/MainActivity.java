package com.mahimuhtasim.anomahchat;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;

public class MainActivity extends BridgeActivity {
    private static final int MIC_PERMISSION_REQUEST_CODE = 1001;
    private BroadcastReceiver downloadCompleteReceiver = null;
    private long activeDownloadId = -1;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            // Clean up any temporary update APK files from previous installation
            cleanOldUpdateFiles();

            // Ensure window content fits system windows (status bar and notch do not overlap WebView)
            Window window = getWindow();
            WindowCompat.setDecorFitsSystemWindows(window, true);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.setStatusBarColor(Color.parseColor("#0b1120"));
                window.setNavigationBarColor(Color.parseColor("#0b1120"));
            }

            WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
            if (insetsController != null) {
                insetsController.setAppearanceLightStatusBars(false);
                insetsController.setAppearanceLightNavigationBars(false);
            }

            // Request Android OS runtime microphone permission if not already granted
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(
                            this,
                            new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.MODIFY_AUDIO_SETTINGS},
                            MIC_PERMISSION_REQUEST_CODE
                    );
                }
            }

            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setFitsSystemWindows(true);
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setSupportMultipleWindows(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setMediaPlaybackRequiresUserGesture(false);

                // Remove "; wv" from User-Agent string so Google OAuth doesn't block Android WebView
                String originalUserAgent = settings.getUserAgentString();
                if (originalUserAgent != null && originalUserAgent.contains("; wv")) {
                    settings.setUserAgentString(originalUserAgent.replace("; wv", ""));
                }

                // Grant WebRTC audio & media permissions requested by the web app
                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                request.grant(request.getResources());
                            }
                        });
                    }
                });

                // Handle WebView APK downloads via system browser/DownloadManager
                webView.setDownloadListener(new android.webkit.DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                });

                // Native Javascript Interface for reliable in-app update downloading & auto-install
                webView.addJavascriptInterface(new AndroidUpdaterInterface(), "AndroidUpdater");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void cleanOldUpdateFiles() {
        try {
            File targetDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (targetDir != null) {
                File apkFile = new File(targetDir, "AnomahUpdate.apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }
            }
            File cacheApk = new File(getExternalCacheDir(), "AnomahUpdate.apk");
            if (cacheApk.exists()) {
                cacheApk.delete();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void promptInstallApk(File apkFile) {
        try {
            if (apkFile != null && apkFile.exists()) {
                Uri apkUri = FileProvider.getUriForFile(
                        MainActivity.this,
                        getPackageName() + ".fileprovider",
                        apkFile
                );
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } else {
                Toast.makeText(MainActivity.this, "আপডেট ফাইল পাওয়া যায়নি, অনুগ্রহ করে পুনরায় ডাউনলোড করুন।", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(MainActivity.this, "স্বয়ংক্রিয় ইনস্টলার চালুর সমস্যা: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void notifyWebViewDownloadFinished() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.evaluateJavascript("if (window.onNativeApkDownloadComplete) { window.onNativeApkDownloadComplete(); }", null);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (downloadCompleteReceiver != null) {
            try {
                unregisterReceiver(downloadCompleteReceiver);
            } catch (Exception e) {
                // ignore
            }
            downloadCompleteReceiver = null;
        }
    }

    public class AndroidUpdaterInterface {
        @android.webkit.JavascriptInterface
        public void openSystemDownload(String url) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @android.webkit.JavascriptInterface
        public void installDownloadedApk() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    File targetDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (targetDir != null) {
                        File apkFile = new File(targetDir, "AnomahUpdate.apk");
                        promptInstallApk(apkFile);
                    }
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void downloadAndInstall(final String url, final String versionName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        cleanOldUpdateFiles();

                        File targetDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                        if (targetDir == null) {
                            targetDir = getFilesDir();
                        }
                        final File targetFile = new File(targetDir, "AnomahUpdate.apk");

                        Uri uri = Uri.parse(url);
                        android.app.DownloadManager.Request request = new android.app.DownloadManager.Request(uri);
                        request.setTitle("Anomah Chat Update v" + (versionName != null ? versionName : ""));
                        request.setDescription("Downloading latest in-app update...");
                        request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE);
                        request.setDestinationUri(Uri.fromFile(targetFile));
                        request.setMimeType("application/vnd.android.package-archive");

                        final android.app.DownloadManager manager = (android.app.DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                        if (manager != null) {
                            // Unregister any previous receiver
                            if (downloadCompleteReceiver != null) {
                                try {
                                    unregisterReceiver(downloadCompleteReceiver);
                                } catch (Exception e) {
                                    // ignore
                                }
                            }

                            activeDownloadId = manager.enqueue(request);

                            downloadCompleteReceiver = new BroadcastReceiver() {
                                @Override
                                public void onReceive(Context context, Intent intent) {
                                    long id = intent.getLongExtra(android.app.DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                                    if (id == activeDownloadId) {
                                        notifyWebViewDownloadFinished();
                                        promptInstallApk(targetFile);
                                    }
                                }
                            };

                            ContextCompat.registerReceiver(
                                    MainActivity.this,
                                    downloadCompleteReceiver,
                                    new IntentFilter(android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                                    ContextCompat.RECEIVER_EXPORTED
                            );

                            Toast.makeText(MainActivity.this, "ইন-অ্যাপ আপডেট ডাউনলোড শুরু হয়েছে...", Toast.LENGTH_SHORT).show();
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                        // Fallback to standard system browser
                        openSystemDownload(url);
                    }
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void downloadWithManager(final String url) {
            downloadAndInstall(url, "latest");
        }
    }
}
