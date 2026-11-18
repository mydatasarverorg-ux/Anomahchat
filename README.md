# Anomah Chat (`v1.0.11` · `Mahi A11`)

> **Developer & Owner:** Mahi Muhtasim  
> **Package ID:** `com.mahimuhtasim.anomahchat`  
> **Platforms:** Web (PWA) & Android Native APK (Capacitor 8)  
> **Release Channel:** Stable (`versionCode: 111`)

Anomah Chat is a real-time cross-platform cloud messenger built with React, TypeScript, Tailwind CSS, Firebase Authentication, Cloud Firestore, WebRTC, and Capacitor Android. Users can connect worldwide via 1-on-1 direct messaging, group chats, voice notes, compressed image sharing, and peer-to-peer audio/video calls, backed by strict Zero-Trust Firestore Security Rules.

---

## Key Features

### Real-Time Messaging & Media
- **Direct & Group Conversations:** Instant message delivery with read receipts (`seenByDetails`), message replies, emoji reactions, message editing, and full history deletion.
- **Voice Notes:** Built-in browser/WebView audio recording with duration tracking and playback controls.
- **Image Sharing:** Client-side image compression (`imageCompressor`) optimized for Cloud Firestore document limits.
- **Live Presence:** Real-time online indicator, last-seen timestamps, and offline status banner.
- **Bilingual Interface:** Instant language switching between **English** and **বাংলা (Bengali)** plus 3 UI themes (`Deep Slate`, `Minimal Light`, `Telegram Blue`).

### Real-Time 1-on-1 WebRTC Audio & Video Calls
- Peer-to-peer audio and video calling powered by **WebRTC (`RTCPeerConnection`)** with **Firestore SDP/ICE signaling** (`chats/{chatId}/calls`).
- Supports live camera preview, microphone mute/unmute, camera toggle, incoming call ringing/accept/decline controls, and automatic 45-second unanswered call timeout.

### Security & Privacy Architecture
- **Zero-Trust Firestore Security Rules (`firestore.rules`):**
  - Default-deny catch-all rule (`match /{document=**}`).
  - Strict separation between private user PII (`users/{uid}`) and public non-PII discovery profiles (`directory/{uid}`).
  - Group permissions enforce creator/admin privileges for group management, message moderation, and room deletion.
  - Suspension enforcement blocks banned accounts from sending messages or creating/updating chats, with server-time (`request.time`) verified temporary ban expiry.
- **Quick App-Lock PIN:** Optional 4–6 digit lock screen protected with client-side salted **SHA-256** digests stored in owner-private `users/{uid}/private/security` documents and brute-force lockout protection.
- **15-Day Account Deletion Grace Period:** Scheduled account deactivation with self-service recovery within 15 days.

### Super Admin Control Panel
- Restricted exclusively to the verified Super Admin account (`email_verified == true`) at both UI and Firestore Rules layers.
- Includes live overview metrics, user dossier & 7-day activity insights, temporary/permanent ban & official warning tools, read-only Ghost DM audit mode, abuse report resolution, recovery ticket desk, global announcements, immutable audit logs, and **APK Release publishing**.

### Native Android APK & In-App Auto-Updater
- **Native Updater Bridge (`MainActivity.java`):** Downloads release APKs strictly from the allowlisted GitHub Releases repository prefix, verifies optional **SHA-256 checksums**, and launches the Android package installer directly.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons |
| **Authentication & Database** | Firebase Auth (Google + Email/Password), Cloud Firestore |
| **Calling** | WebRTC (`RTCPeerConnection` + Google STUN + Firestore Signaling) |
| **Mobile Wrapper** | Capacitor 8 (Android), Java 21, Gradle |
| **Rules Validation** | `@firebase/eslint-plugin-security-rules` |

---

## Changelog (`v1.0.11 · Mahi A11`)
- **Friend Request & Accepted Connection System (`RequestsModal`, `ConnectPreviewModal`, `firestore.rules`):**
  - Enforced accepted friend status (`friendships`) prior to opening new 1-on-1 DMs or starting calls, with full incoming/sent/friends/blocked management.
  - Added QR auto-request flow (`?chat=` / `?group=`) with instant cancel support.
- **Private & Public Group Controls (`NewChatModal`, `GroupInfoModal`, `ShareLinkModal`):**
  - Restricted group creation and admin member additions strictly to accepted friends.
  - Added Private (`invite_only`) and Public (`direct` or `approval` queue) group policies alongside shareable Group Invite QR links.
- **Cross-Platform Offline QR Scanner & Deep-Linking (`QrScannerModal`, `MainActivity.java`, `vite.config.ts`):**
  - Added built-in `jsQR` camera & gallery scanner with runtime permission recovery and smart Web / PWA / Android APK routing.

### Previous (`v1.0.10 · Mahi A10`)
- **Fixed Direct Message & Inbox Read Receipts (`Sidebar`, `ChatArea`, `chatService`, `MessageBubble`, `MessageInfoModal`, `MessageContextMenu`):**
  - Replaced misleading always-blue double-ticks in `Sidebar` with real `lastMessageReadBy` tracking (slate ticks until partner reads, sky-blue after read, plus live unread indicator dot for incoming unread messages).
  - Prevented background/minimized auto-seen by gating `markChatMessagesAsRead` on `isAppInBackground()` and syncing read status on `visibilitychange` / `focus`.
  - Eliminated `onSnapshot` resubscription churn on message updates and replaced sequential `readBy` writes with atomic batched `arrayUnion` + dot-notation `seenByDetails.<uid>` writes guarded by in-flight deduplication.
  - Unified `readBy` and `seenByDetails` across `MessageBubble` and `MessageInfoModal`, resolved live/deleted partner profiles, excluded call logs from seen avatars, and anchored the DM seen avatar cleanly to the latest seen outgoing message.

### Previous (`v1.0.9 · Mahi A09`)
- Added **Super Admin Google Drive Chat Backup & Safe 1 GiB Firestore Cleanup** (`AdminBackupTab` & `driveBackupService`) using an isolated in-memory Drive OAuth session (`drive.file` least-privilege scope targeting `anomahchatsarverorg@gmail.com`) without touching the Super Admin (`chinisdramaorg@gmail.com`) login session.
- Added **Firestore 1 GiB Storage Scanner**, **Local JSON Export**, **Explicit Confirmation Cleanup** (with recursive WebRTC `calls`/`offerCandidates`/`answerCandidates` purging), **In-Panel Google Drive Archive Reader**, and **1-Click Restore to Firebase**.
- Added **Automatic In-Chat Audio & Video Call Logs** (`calllog_<callId>`) recording answered call duration, missed, declined, and cancelled calls with 1-tap callback controls.

### Previous (`v1.0.8 · Mahi A08`)
- Added **Android Runtime Camera, Microphone & Notification (`POST_NOTIFICATIONS`) Permission Handling** in `MainActivity.java`, including on-demand permission prompts during WebRTC calls if initially denied.
- Added **Native Android Notification Channels** (`anomah_messages` & `anomah_calls`) with high-importance alerts, ringtones, vibration patterns, and **Tap-to-Open Chat Deep-Linking** (both minimized and cold start).
- Added **Real-Time Background & Inactive-Chat Notifications** (`notificationService`) across both Native Android APK and Web/PWA browsers for incoming messages and incoming WebRTC calls, with automatic dismissal on chat open or call answer/decline.
- Added 1-click **Notification Opt-In Banner** and **Profile → Appearance** notification permission status card.

### Previous (`v1.0.7 · Mahi A07`)
- Replaced simulated call timer with real **1-on-1 WebRTC peer-to-peer audio & video calling** via Firestore signaling.
- Hardened Firestore Security Rules for group message deletion, group room deletion, and direct chat self-leave validation.
- Fixed custom display name & avatar overwrite bug on reload (`syncUserProfile` & `updateProfile`).
- Fixed direct chat deletion so old messages are purged cleanly instead of reappearing in new deterministic `dm_*` rooms.
- Added error recovery and inline feedback for failed message/photo sends in `ChatArea`.
- Added single-field query fallback for username availability & directory lookups when composite indexes are absent.
- Fixed `AdminModal` user listener resubscription loop, `BannedScreen` clock-skew retry lockup, semver `isUpdateAvailable` ordering, and unified group fallback avatars.

---

## Local Development

### Prerequisites
- Node.js 22+
- Firebase project configured in `firebase-applet-config.json`

### Commands
```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server (port 3000)
npm run dev

# 3. Type-check TypeScript
npm run lint

# 4. Validate Firestore security rules
npx eslint firestore.rules

# 5. Build production web bundle
npm run build

# 6. Sync web bundle into Android Capacitor project
npx cap sync android
```

---

## Automated Android APK Build (GitHub Actions)

The workflow in `.github/workflows/build-apk.yml` automatically builds an Android APK on every push to `main` or `master` (or manual dispatch):

1. Builds the Vite bundle (`npm run build`) and syncs Capacitor (`npx cap sync android`).
2. Compiles a **Signed Release APK** using Gradle when these repository secrets are configured:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
   *(Falls back to a Debug APK if keystore secrets are not set.)*
3. Computes the APK **SHA-256** digest, uploads `AnomahChat-v1.0.11-APK` as a workflow artifact, and publishes `v1.0.11` (`AnomahChat-v1.0.11.apk` & `AnomahChat.apk`) to **GitHub Releases**.

---

*Built & maintained by **Mahi Muhtasim** · Anomah Chat `v1.0.11` (`Mahi A11`)*
