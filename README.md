# Master Barang

Aplikasi manajemen inventaris produk, pemindaian barcode, dan sinkronisasi Google Sheets.

## Run Locally

**Prerequisites:** Bun, Node.js, and (for Android) Android Studio with Android SDK and JDK 21 or newer. Capacitor 8 requires Java 21+; JDK 17 alone cannot build this Android project.

```sh
bun install
bun run dev
```

The current frontend does not call Gemini and does not need a Gemini API key to run. See the API key note under **Build Android** before adding any key to a client build.

## Build Android

Install Android Studio and the Android SDK, then point `JAVA_HOME` at JDK 21+ (or Android Studio's bundled JDK). From the project root:

```sh
bun run android:debug
```

For example, if Temurin JDK 21 is installed at its default location, select it in PowerShell (adjust the directory to match your installed JDK 21):

```powershell
$env:JAVA_HOME = "$env:ProgramFiles\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
bun run android:debug
```

This builds the Vite app, syncs it into Capacitor, and builds:
`android/app/build/outputs/apk/debug/app-debug.apk`

Useful commands:

```sh
bun run cap:sync
bun run cap:open
```

### Release signing and AAB

The Android release signing key for this project is stored outside the repository at `%USERPROFILE%\.android\master-barang-release.keystore`; its password and alias are stored in `%USERPROFILE%\.gradle\gradle.properties`. Keep backups of both files in a secure password manager or encrypted storage. Never delete or regenerate this keystore: every future update to the published app must use the same signing key. The keystore and credentials must not be committed to source control.

The Android application ID is `com.masterbarang.app`. Release builds use the release keystore (never the debug key), APK Signature Scheme v2/v3, and code/resource shrinking.

To move builds to another computer, securely copy the same keystore there and configure signing using either environment variables or user-level Gradle properties:

| Gradle property | Environment variable |
| --- | --- |
| `RELEASE_STORE_FILE` | `ANDROID_RELEASE_STORE_FILE` |
| `RELEASE_STORE_PASSWORD` | `ANDROID_RELEASE_STORE_PASSWORD` |
| `RELEASE_KEY_ALIAS` | `ANDROID_RELEASE_KEY_ALIAS` |
| `RELEASE_KEY_PASSWORD` | `ANDROID_RELEASE_KEY_PASSWORD` |

Gradle properties belong in the user-level `%USERPROFILE%\.gradle\gradle.properties`; do not commit passwords or keystore files. `android/app/build.gradle` reads the values from Gradle properties first, then environment variables, and refuses release builds when signing is not configured.

Build a Play Store bundle from the project root:

```sh
bun run android:bundle
```

The AAB is written to `android/app/build/outputs/bundle/release/`; the signed APK is written to `android/app/build/outputs/apk/release/app-release.apk`. Each new release must increment `versionCode` in `android/app/build.gradle` (and update `versionName` as appropriate) before building.

Verify the signed APK using Android SDK Build Tools:

```powershell
& "$env:ANDROID_HOME\build-tools\36.0.0\apksigner.bat" verify --verbose --print-certs android/app/build/outputs/apk/release/app-release.apk
```

Google Play Protect may still warn users about an app installed directly from an APK: a valid signature confirms the publisher and file integrity, but does not itself establish Google Play reputation. Publishing through Google Play with Play App Signing is the recommended distribution path.

### API key safety

`.env.example` contains a placeholder `GEMINI_API_KEY`, but this project currently has no frontend code that uses it. Any API key embedded in a frontend bundle or APK can be extracted; never put a real secret in a `VITE_*` variable or commit a real `.env` file. If Gemini functionality is added, call it through an authenticated backend proxy with appropriate quotas instead.
