#!/usr/bin/env bash
# Local build script — run on any Linux x86_64 or macOS with JDK 17 + Android SDK.
# Produces:
#   android/app/build/outputs/apk/release/*.apk        (installable on devices)
#   android/app/build/outputs/bundle/release/*.aab     (upload to Google Play)

set -euo pipefail
cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════════════════════"
echo "  alpha-fit → Android Build (APK + AAB)"
echo "═══════════════════════════════════════════════════════════════"

# ─── Verify JDK 17 ─────────────────────────────────────────────────
if [ -z "${JAVA_HOME:-}" ]; then
  echo "❌ JAVA_HOME not set. Install JDK 17 (Temurin recommended):"
  echo "   • macOS:  brew install --cask temurin@17"
  echo "   • Ubuntu: sudo apt install openjdk-17-jdk"
  exit 1
fi
JAVA_V=$("$JAVA_HOME/bin/java" -version 2>&1 | head -1)
echo "☕ Java: $JAVA_V"

# ─── Verify Android SDK ────────────────────────────────────────────
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "❌ ANDROID_HOME not set. Download Android command-line tools:"
  echo "   https://developer.android.com/studio#command-tools"
  echo "   Then: export ANDROID_HOME=/path/to/android-sdk"
  exit 1
fi
if [ ! -d "$ANDROID_HOME/platforms/android-36" ]; then
  echo "📦 Installing SDK components (platforms;android-36, build-tools;36.0.0)…"
  yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
    "platforms;android-36" "build-tools;36.0.0" "platform-tools" > /dev/null
fi
echo "🤖 Android SDK: $ANDROID_HOME"

# ─── Verify keystore ───────────────────────────────────────────────
KEYSTORE="./android.keystore"
if [ ! -f "$KEYSTORE" ]; then
  echo "❌ Keystore not found: $KEYSTORE"
  echo "   Generate one with:"
  echo "     keytool -genkeypair -v -keystore ./android.keystore \\"
  echo "       -alias android -keyalg RSA -keysize 2048 -validity 10000"
  exit 1
fi
echo "🔐 Keystore: $KEYSTORE"

# ─── Passwords ─────────────────────────────────────────────────────
if [ -z "${BUBBLEWRAP_KEYSTORE_PASSWORD:-}" ]; then
  read -rsp "Enter keystore password: " BUBBLEWRAP_KEYSTORE_PASSWORD; echo
fi
if [ -z "${BUBBLEWRAP_KEY_PASSWORD:-}" ]; then
  BUBBLEWRAP_KEY_PASSWORD="$BUBBLEWRAP_KEYSTORE_PASSWORD"
fi
export BUBBLEWRAP_KEYSTORE_PASSWORD BUBBLEWRAP_KEY_PASSWORD

# ─── Build ──────────────────────────────────────────────────────────
chmod +x ./gradlew

echo ""
echo "🔨 Building APK (release)…"
./gradlew :app:assembleRelease --no-daemon

echo ""
echo "🔨 Building AAB (release, Play-Store-ready)…"
./gradlew :app:bundleRelease --no-daemon

# ─── Sign APK (align + apksigner) ──────────────────────────────────
APK_UNSIGNED=$(find app/build/outputs/apk/release -name "*-unsigned.apk" 2>/dev/null | head -1 || true)
if [ -n "$APK_UNSIGNED" ]; then
  APK_SIGNED="${APK_UNSIGNED%-unsigned.apk}-signed.apk"
  APKSIGNER="$ANDROID_HOME/build-tools/36.0.0/apksigner"
  "$APKSIGNER" sign \
    --ks "$KEYSTORE" \
    --ks-key-alias android \
    --ks-pass "pass:$BUBBLEWRAP_KEYSTORE_PASSWORD" \
    --key-pass "pass:$BUBBLEWRAP_KEY_PASSWORD" \
    --out "$APK_SIGNED" \
    "$APK_UNSIGNED"
  echo "✅ APK signed: $APK_SIGNED"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ BUILD COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
echo ""
find app/build/outputs -name "*.apk" -o -name "*.aab" | while read -r f; do
  size=$(du -h "$f" | cut -f1)
  echo "  📱 $f  ($size)"
done
echo ""
echo "Next steps:"
echo "  • Install APK on device:   adb install app/build/outputs/apk/release/*-signed.apk"
echo "  • Upload AAB to Play Console: app/build/outputs/bundle/release/app-release.aab"
