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
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.MessageDigest;

public class MainActivity extends BridgeActivity {
    private static final int MIC_PERMISSION_REQUEST_CODE = 1001;
    private static final String ALLOWED_RELEASE_PREFIX = "https://github.com/mydatasarverorg-ux/Anomahchat/releases/";
    private BroadcastReceiver downloadCompleteReceiver = null;
    private long activeDownloadId = -1;

    private boolean isAllowedReleaseUrl(String url) {
        if (url == null) return false;
        String trimmed = url.trim();
        return trimmed.startsWith(ALLOWED_RELEASE_PREFIX);
    }

    private boolean isTrustedWebOrigin(Uri origin) {
        if (origin == null) return false;
        String scheme = origin.getScheme() != null ? origin.getScheme().toLowerCase() : "";
        String host = origin.getHost() != null ? origin.getHost().toLowerCase() : "";
        if ("capacitor".equals(scheme) || "ionic".equals(scheme)) {
            return true;
        }
        if ("https".equals(scheme) || "http".equals(scheme)) {
            return "mydatasarverorg-ux.github.io".equals(host)
                    || "localhost".equals(host)
                    || "127.0.0.1".equals(host)
                    || host.endsWith(".run.app");
        }
        return false;
    }

    private String computeStreamSha256(InputStream is) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = is.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
            byte[] hash = digest.digest();
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private boolean verifyDownloadedApkSha256(Uri downloadedUri, File fallbackFile, String expectedSha256) {
        if (expectedSha256 == null) return true;
        String cleanExpected = expectedSha256.trim().toLowerCase();
        if (!cleanExpected.matches("^[a-f0-9]{64}$")) {
            return true;
        }

        InputStream is = null;
        try {
            if (downloadedUri != null) {
                is = getContentResolver().openInputStream(downloadedUri);
            }
            if (is == null && fallbackFile != null && fallbackFile.exists()) {
                is = new FileInputStream(fallbackFile);
            }
            if (is == null) return false;

            String computed = computeStreamSha256(is);
            return computed != null && computed.equalsIgnoreCase(cleanExpected);
        } catch (Exception e) {
            return false;
        } finally {
            if (is != null) {
                try {
                    is.close();
                } catch (Exception ignored) {
                }
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            cleanOldUpdateFiles();

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

                String standardChromeUA = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
                settings.setUserAgentString(standardChromeUA);

                // Strictly grant WebRTC audio/camera permissions ONLY to trusted app origins
                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (request == null) return;
                                if (isTrustedWebOrigin(request.getOrigin())) {
                                    request.grant(request.getResources());
                                } else {
                                    request.deny();
                                }
                            }
                        });
                    }

                    @Override
                    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                        final android.app.Dialog authDialog = new android.app.Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen);
                        WebView authWebView = new WebView(MainActivity.this);
                        WebSettings authSettings = authWebView.getSettings();
                        authSettings.setJavaScriptEnabled(true);
                        authSettings.setDomStorageEnabled(true);
                        authSettings.setSupportMultipleWindows(true);
                        authSettings.setJavaScriptCanOpenWindowsAutomatically(true);
                        authSettings.setUserAgentString(standardChromeUA);

                        authWebView.setWebChromeClient(new WebChromeClient() {
                            @Override
                            public void onCloseWindow(WebView window) {
                                if (authDialog != null && authDialog.isShowing()) {
                                    authDialog.dismiss();
                                }
                            }
                        });

                        authWebView.setWebViewClient(new android.webkit.WebViewClient() {
                            @Override
                            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                                return false;
                            }
                        });

                        authDialog.setContentView(authWebView);
                        authDialog.show();

                        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                        transport.setWebView(authWebView);
                        resultMsg.sendToTarget();
                        return true;
                    }
                });

                // Only allow APK/release downloads from allowlisted official GitHub Releases URL
                webView.setDownloadListener(new android.webkit.DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                        try {
                            if (!isAllowedReleaseUrl(url)) {
                                Toast.makeText(MainActivity.this, "Blocked untrusted download link.", Toast.LENGTH_LONG).show();
                                return;
                            }
                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                });

                webView.addJavascriptInterface(new AndroidUpdaterInterface(), "AndroidUpdater");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void cleanOldUpdateFiles() {
        try {
            File pubFile = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "AnomahChat-Update.apk");
            if (pubFile.exists()) {
                pubFile.delete();
            }
            File targetDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (targetDir != null) {
                File apkFile = new File(targetDir, "AnomahUpdate.apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void promptInstallFromUri(Uri uri) {
        try {
            if (uri != null) {
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            }
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(MainActivity.this, "স্বয়ংক্রিয় ইনস্টলার চালুর সমস্যা: " + e.getMessage(), Toast.LENGTH_LONG).show();
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
                promptInstallFromUri(apkUri);
            } else {
                Toast.makeText(MainActivity.this, "আপডেট ফাইল পাওয়া যায়নি, অনুগ্রহ করে পুনরায় ডাউনলোড করুন।", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(MainActivity.this, "ইনস্টলার ওপেন করতে সমস্যা: " + e.getMessage(), Toast.LENGTH_LONG).show();
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
                if (!isAllowedReleaseUrl(url)) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Untrusted update URL blocked.", Toast.LENGTH_LONG).show());
                    return;
                }
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
                    try {
                        android.app.DownloadManager manager = (android.app.DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                        if (manager != null && activeDownloadId != -1) {
                            Uri downloadedUri = manager.getUriForDownloadedFile(activeDownloadId);
                            if (downloadedUri != null) {
                                promptInstallFromUri(downloadedUri);
                                return;
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                    File pubFile = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "AnomahChat-Update.apk");
                    promptInstallApk(pubFile);
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void downloadAndInstall(final String url, final String versionName) {
            downloadAndInstall(url, versionName, "");
        }

        @android.webkit.JavascriptInterface
        public void downloadAndInstall(final String url, final String versionName, final String expectedSha256) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (!isAllowedReleaseUrl(url)) {
                        Toast.makeText(MainActivity.this, "অনুমোদিত সোর্স না হওয়ায় আপডেট বাতিল করা হয়েছে।", Toast.LENGTH_LONG).show();
                        notifyWebViewDownloadFinished();
                        return;
                    }

                    try {
                        cleanOldUpdateFiles();

                        Uri uri = Uri.parse(url);
                        android.app.DownloadManager.Request request = new android.app.DownloadManager.Request(uri);
                        request.setTitle("Anomah Chat Update v" + (versionName != null ? versionName : ""));
                        request.setDescription("Downloading latest in-app update...");
                        request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "AnomahChat-Update.apk");
                        request.setMimeType("application/vnd.android.package-archive");

                        final android.app.DownloadManager manager = (android.app.DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                        if (manager != null) {
                            if (downloadCompleteReceiver != null) {
                                try {
                                    unregisterReceiver(downloadCompleteReceiver);
                                } catch (Exception ignored) {
                                }
                            }

                            activeDownloadId = manager.enqueue(request);

                            downloadCompleteReceiver = new BroadcastReceiver() {
                                @Override
                                public void onReceive(Context context, Intent intent) {
                                    long id = intent.getLongExtra(android.app.DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                                    if (id == activeDownloadId) {
                                        notifyWebViewDownloadFinished();
                                        Uri downloadedUri = manager.getUriForDownloadedFile(activeDownloadId);
                                        File pubFile = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "AnomahChat-Update.apk");

                                        if (!verifyDownloadedApkSha256(downloadedUri, pubFile, expectedSha256)) {
                                            try {
                                                manager.remove(activeDownloadId);
                                            } catch (Exception ignored) {
                                            }
                                            cleanOldUpdateFiles();
                                            Toast.makeText(MainActivity.this, "নিরাপত্তা সতর্কতা: APK SHA-256 যাচাই ব্যর্থ হয়েছে। ইনস্টল বাতিল করা হলো।", Toast.LENGTH_LONG).show();
                                            return;
                                        }

                                        if (downloadedUri != null) {
                                            promptInstallFromUri(downloadedUri);
                                        } else {
                                            promptInstallApk(pubFile);
                                        }
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
                        openSystemDownload(url);
                    }
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void downloadWithManager(final String url) {
            downloadAndInstall(url, "latest", "");
        }
    }
}
