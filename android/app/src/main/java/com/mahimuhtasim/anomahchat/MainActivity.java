package com.mahimuhtasim.anomahchat;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int RUNTIME_PERMISSIONS_REQUEST_CODE = 1001;
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1002;
    private static final int MEDIA_PERMISSIONS_REQUEST_CODE = 1003;
    private static final String PREFS_NAME = "anomah_native_prefs";
    private static final String KEY_ASKED_NOTIF_PERM = "asked_notif_perm";
    private static final String CHANNEL_MESSAGES_ID = "anomah_messages";
    private static final String CHANNEL_CALLS_ID = "anomah_calls";
    private static final String ALLOWED_RELEASE_PREFIX = "https://github.com/mydatasarverorg-ux/Anomahchat/releases/";
    private BroadcastReceiver downloadCompleteReceiver = null;
    private long activeDownloadId = -1;
    private PermissionRequest pendingWebPermissionRequest = null;

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

            createNotificationChannels();
            requestMissingRuntimePermissions();

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

                // Subclass BridgeWebChromeClient to preserve file chooser (onShowFileChooser) & JS dialogs while keeping trusted-origin media permissions
                webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                if (request == null) return;
                                if (!isTrustedWebOrigin(request.getOrigin())) {
                                    request.deny();
                                    return;
                                }

                                List<String> missingAndroidPerms = new ArrayList<>();
                                String[] resources = request.getResources();
                                if (resources != null) {
                                    for (String res : resources) {
                                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                                                    != PackageManager.PERMISSION_GRANTED) {
                                                missingAndroidPerms.add(Manifest.permission.CAMERA);
                                            }
                                        } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                                                    != PackageManager.PERMISSION_GRANTED) {
                                                missingAndroidPerms.add(Manifest.permission.RECORD_AUDIO);
                                            }
                                        }
                                    }
                                }

                                if (missingAndroidPerms.isEmpty()) {
                                    request.grant(request.getResources());
                                } else {
                                    if (pendingWebPermissionRequest != null) {
                                        try {
                                            pendingWebPermissionRequest.deny();
                                        } catch (Exception ignored) {
                                        }
                                    }
                                    pendingWebPermissionRequest = request;
                                    ActivityCompat.requestPermissions(
                                            MainActivity.this,
                                            missingAndroidPerms.toArray(new String[0]),
                                            MEDIA_PERMISSIONS_REQUEST_CODE
                                    );
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
                webView.addJavascriptInterface(new AndroidNotificationInterface(), "AndroidNotifications");
            }
            handleNotificationIntent(getIntent());
            handleDeepLinkIntent(getIntent());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
        handleDeepLinkIntent(intent);
    }

    private void handleDeepLinkIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null) return;
        if (!Intent.ACTION_VIEW.equals(intent.getAction())) return;

        String scheme = data.getScheme() != null ? data.getScheme().toLowerCase() : "";
        String host = data.getHost() != null ? data.getHost().toLowerCase() : "";
        boolean isAllowed = ("anomahchat".equals(scheme) && "open".equals(host))
                || ("https".equals(scheme) && "mydatasarverorg-ux.github.io".equals(host));
        if (!isAllowed) return;

        final String chatParam = data.getQueryParameter("chat");
        final String groupParam = data.getQueryParameter("group");
        final String qrParam = data.getQueryParameter("qr");
        if ((chatParam == null || chatParam.trim().isEmpty()) && (groupParam == null || groupParam.trim().isEmpty())) {
            return;
        }

        intent.setData(null);

        try {
            org.json.JSONObject payload = new org.json.JSONObject();
            if (groupParam != null && !groupParam.trim().isEmpty()) {
                payload.put("type", "group");
                payload.put("value", groupParam.trim());
            } else {
                payload.put("type", "chat");
                payload.put("value", chatParam.trim());
            }
            payload.put("isQr", "1".equals(qrParam) || "true".equalsIgnoreCase(qrParam));
            final String jsonPayload = payload.toString();

            runOnUiThread(() -> {
                try {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.postDelayed(() -> {
                            String script = "window.__pendingDeepLink=" + jsonPayload + ";"
                                    + "window.dispatchEvent(new CustomEvent('anomah_deep_link',{detail:" + jsonPayload + "}));";
                            webView.evaluateJavascript(script, null);
                        }, 450);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        final String chatId = intent.getStringExtra("openChatId");
        if (chatId == null || chatId.trim().isEmpty()) return;
        intent.removeExtra("openChatId");
        final String safeChatId = chatId.replaceAll("[^a-zA-Z0-9_-]", "");
        if (safeChatId.isEmpty()) return;
        runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    webView.postDelayed(() -> {
                        String script = "window.__pendingNotificationChatId='" + safeChatId + "';"
                                + "window.dispatchEvent(new CustomEvent('anomah_open_chat_from_notification',{detail:{chatId:'" + safeChatId + "'}}));";
                        webView.evaluateJavascript(script, null);
                    }, 400);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private void notifyNotificationPermissionChanged() {
        runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    webView.evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('anomah_notification_permission_changed'));",
                            null
                    );
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == MEDIA_PERMISSIONS_REQUEST_CODE && pendingWebPermissionRequest != null) {
            final PermissionRequest req = pendingWebPermissionRequest;
            pendingWebPermissionRequest = null;
            runOnUiThread(() -> {
                try {
                    List<String> grantable = new ArrayList<>();
                    String[] requestedResources = req.getResources();
                    if (requestedResources != null) {
                        for (String res : requestedResources) {
                            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                                        == PackageManager.PERMISSION_GRANTED) {
                                    grantable.add(res);
                                }
                            } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                                        == PackageManager.PERMISSION_GRANTED) {
                                    grantable.add(res);
                                }
                            } else {
                                grantable.add(res);
                            }
                        }
                    }
                    if (!grantable.isEmpty()) {
                        req.grant(grantable.toArray(new String[0]));
                    } else {
                        req.deny();
                    }
                } catch (Exception ignored) {
                }
            });
        }

        if (requestCode == RUNTIME_PERMISSIONS_REQUEST_CODE || requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            notifyNotificationPermissionChanged();
        }
    }

    private void requestMissingRuntimePermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        List<String> needed = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.RECORD_AUDIO);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.MODIFY_AUDIO_SETTINGS) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS);
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(KEY_ASKED_NOTIF_PERM, true).apply();
            }
        }
        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), RUNTIME_PERMISSIONS_REQUEST_CODE);
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        NotificationChannel msgChannel = new NotificationChannel(
                CHANNEL_MESSAGES_ID,
                "Chat Messages",
                NotificationManager.IMPORTANCE_HIGH
        );
        msgChannel.setDescription("Real-time incoming chat messages");
        msgChannel.enableVibration(true);
        msgChannel.setVibrationPattern(new long[]{0, 220, 120, 220});
        nm.createNotificationChannel(msgChannel);

        NotificationChannel callChannel = new NotificationChannel(
                CHANNEL_CALLS_ID,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
        );
        callChannel.setDescription("Incoming 1-on-1 voice and video calls");
        callChannel.enableVibration(true);
        callChannel.setVibrationPattern(new long[]{0, 500, 300, 500, 300, 500});
        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (ringtoneUri != null) {
            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            callChannel.setSound(ringtoneUri, audioAttrs);
        }
        nm.createNotificationChannel(callChannel);
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

    public class AndroidNotificationInterface {
        @android.webkit.JavascriptInterface
        public boolean hasPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    return false;
                }
            }
            return NotificationManagerCompat.from(MainActivity.this).areNotificationsEnabled();
        }

        @android.webkit.JavascriptInterface
        public void requestPermission() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    boolean granted = ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                            == PackageManager.PERMISSION_GRANTED;
                    if (!granted) {
                        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                        boolean askedBefore = prefs.getBoolean(KEY_ASKED_NOTIF_PERM, false);
                        boolean shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(
                                MainActivity.this,
                                Manifest.permission.POST_NOTIFICATIONS
                        );
                        if (!askedBefore || shouldShowRationale) {
                            prefs.edit().putBoolean(KEY_ASKED_NOTIF_PERM, true).apply();
                            ActivityCompat.requestPermissions(
                                    MainActivity.this,
                                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                                    NOTIFICATION_PERMISSION_REQUEST_CODE
                            );
                            return;
                        }
                    }
                }

                if (!NotificationManagerCompat.from(MainActivity.this).areNotificationsEnabled()) {
                    try {
                        Intent settingsIntent = new Intent();
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            settingsIntent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                            settingsIntent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                        } else {
                            settingsIntent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                            settingsIntent.setData(Uri.fromParts("package", getPackageName(), null));
                        }
                        settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(settingsIntent);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void showNotification(
                final String notifId,
                final String title,
                final String body,
                final String type,
                final String chatId
        ) {
            runOnUiThread(() -> {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                                != PackageManager.PERMISSION_GRANTED) {
                            return;
                        }
                    }

                    boolean isCall = "call".equalsIgnoreCase(type);
                    String channelId = isCall ? CHANNEL_CALLS_ID : CHANNEL_MESSAGES_ID;
                    String key = (notifId != null && !notifId.isEmpty()) ? notifId : (chatId != null ? chatId : "anomah");
                    int intId = (key.hashCode() & 0x7fffffff);

                    Intent launchIntent = new Intent(MainActivity.this, MainActivity.class);
                    launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    if (chatId != null && !chatId.isEmpty()) {
                        launchIntent.putExtra("openChatId", chatId);
                    }

                    int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
                    }
                    PendingIntent pendingIntent = PendingIntent.getActivity(
                            MainActivity.this,
                            intId,
                            launchIntent,
                            pendingFlags
                    );

                    NotificationCompat.Builder builder = new NotificationCompat.Builder(MainActivity.this, channelId)
                            .setSmallIcon(R.mipmap.ic_launcher)
                            .setContentTitle(title != null && !title.isEmpty() ? title : "Anomah Chat")
                            .setContentText(body != null ? body : "")
                            .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
                            .setPriority(NotificationCompat.PRIORITY_HIGH)
                            .setAutoCancel(true)
                            .setContentIntent(pendingIntent);

                    if (isCall) {
                        builder.setCategory(NotificationCompat.CATEGORY_CALL);
                        Uri ringUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                        if (ringUri != null) {
                            builder.setSound(ringUri);
                        }
                        builder.setVibrate(new long[]{0, 500, 300, 500});
                    } else {
                        builder.setCategory(NotificationCompat.CATEGORY_MESSAGE);
                        Uri msgSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                        if (msgSound != null) {
                            builder.setSound(msgSound);
                        }
                    }

                    NotificationManagerCompat.from(MainActivity.this).notify(intId, builder.build());
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void cancelNotification(final String notifId) {
            if (notifId == null || notifId.isEmpty()) return;
            runOnUiThread(() -> {
                try {
                    int intId = (notifId.hashCode() & 0x7fffffff);
                    NotificationManagerCompat.from(MainActivity.this).cancel(intId);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }
    }
}
