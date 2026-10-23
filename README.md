# Anomah Chat (Version: Mahi A01)
> **Owner & Developer:** Mahi Muhtasim  
> **Platform:** Web & Android (APK)

A real-time messaging application like WhatsApp and Messenger with worldwide connectivity, persistent Firebase Firestore cloud database, voice notes, media sharing, and call interface.

---

## 📱 How to Build Android APK (GitHub Actions)

This repository is pre-configured with **Capacitor** and a **GitHub Actions Workflow** (`.github/workflows/build-apk.yml`) to automatically compile and generate an Android APK directly on GitHub without requiring you to install Android Studio or the Android SDK on your personal computer!

### Steps to generate your APK:

1. **Push this project to your GitHub Repository:**
   ```bash
   git init
   git add .
   git commit -m "Anomah Chat Mahi A01 release"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

2. **Wait for GitHub Actions to build the APK:**
   * Open your repository on [GitHub.com](https://github.com).
   * Click on the **Actions** tab at the top.
   * You will see the workflow **"Build Android APK - Anomah Chat"** running automatically!
   * It takes about 2 to 3 minutes to build.

3. **Download your APK:**
   * Once the workflow run shows a green checkmark (Succeeded), click on it.
   * Scroll down to the **Artifacts** section at the bottom.
   * Click on **`Anomah-Chat-vMahi-A01-APK`** to download your Android APK file (`Anomah-Chat-vMahi-A01.apk`).

4. **Install on your Android Phone:**
   * Transfer the `.apk` file to your Android phone (or download it directly from your phone's browser).
   * Tap on the file to install and start chatting with anyone around the world!

---

## 💻 Local Development
```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Build web distribution
npm run build

# Sync with Capacitor Android (optional if building locally)
npm run build:apk
```

---
*Built with ❤️ by Mahi Muhtasim • Version: Mahi A01*
