# alpha-fit → Google Play Store (Android)

Dieses Verzeichnis enthält das **Trusted Web Activity (TWA)** Wrapper-Projekt, das aus deiner PWA (https://alpha-fit.fitness) ein natives Android-App-Bundle für den Play Store macht.

## 📦 Was ist enthalten

| Datei | Zweck |
|---|---|
| `twa-manifest.json` | Bubblewrap-Konfiguration (App-Name, Package-ID, Farben, Icons) |
| `app/build.gradle` | Android-Build-Konfiguration |
| `android.keystore` | Signing-Keystore (Passwort: `alphafit123` – **VOR PROD-UPLOAD ÄNDERN!**) |
| `build.sh` | Ein-Klick-Build-Skript für lokale Builds |
| `../.github/workflows/build-android.yml` | GitHub-Actions-Workflow für Cloud-Builds |

**SHA-256 Fingerprint** (bereits in assetlinks.json eingetragen):
```
99:C7:2E:B2:12:84:87:76:5F:B6:D5:0C:19:4B:4F:05:5C:2F:51:39:4B:76:87:A3:1D:B8:22:2A:AE:A0:2B:AC
```

---

## 🚀 Build-Optionen

### Option A – GitHub Actions (empfohlen, keine lokale Toolchain nötig)

1. Committe & pushe `android/` und `.github/workflows/build-android.yml` in dein GitHub-Repo
2. GitHub → **Settings → Secrets and variables → Actions → New repository secret**:
   - `ANDROID_KEYSTORE_BASE64` = Ausgabe von `base64 -w 0 android/android.keystore`
   - `ANDROID_KEYSTORE_PASSWORD` = `alphafit123`
   - `ANDROID_KEY_PASSWORD` = `alphafit123`
3. GitHub → **Actions → Build Android APK + AAB → Run workflow**
4. Nach ~5 Min: **Artifacts** herunterladen (`alpha-fit-apk` & `alpha-fit-aab`)

### Option B – Lokal (Linux x86_64 oder macOS)

Vorraussetzungen:
- **JDK 17** (Temurin empfohlen)
- **Android command-line tools** (https://developer.android.com/studio#command-tools)

```bash
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=/path/to/android-sdk
cd android
./build.sh
```

Das Skript installiert fehlende SDK-Komponenten automatisch und produziert:
- `app/build/outputs/apk/release/app-release-signed.apk` – zum Sideloaden aufs Gerät
- `app/build/outputs/bundle/release/app-release.aab` – für den Play-Store-Upload

⚠️ **Nicht auf ARM64-Linux** (die von Google gelieferten `aapt2`/`d8`-Binärdateien sind x86_64-only). Für Apple Silicon geht macOS ARM64 dank Rosetta – kein Problem.

---

## 🎬 Play Store Submission Checklist

- [ ] **Digital Asset Links** hochgeladen: `/.well-known/assetlinks.json` liegt in `frontend/public/.well-known/` und muss nach dem Deploy unter `https://alpha-fit.fitness/.well-known/assetlinks.json` erreichbar sein (sonst zeigt die App die URL-Bar)
- [ ] **Play Console Account** erstellt ($25 einmalig)
- [ ] **App eintragen** unter Name „alpha-fit", Kategorie „Health & Fitness", Sprache Deutsch
- [ ] **AAB hochladen** (Datei aus `app/build/outputs/bundle/release/app-release.aab`)
- [ ] Data Safety Form ausfüllen (siehe Auflistung unten)
- [ ] Content Rating Questionnaire
- [ ] Screenshots (Play-Console erwartet mind. 2, in 1080×1920)
- [ ] Feature Graphic 1024×500
- [ ] App-Icon 512×512 (bereits vorhanden: `/app/frontend/public/alphafit-logo-512.png`)
- [ ] Privacy Policy URL (deine Impressum-Seite)

### Data Safety (Play Console) – so ausfüllen
Da alpha-fit eine PWA im TWA-Wrapper ist:
- **Data collected**: E-Mail, Name, Trainingsdaten, Fotos (Body Scan, Progress Photos), Nutrition Fotos
- **Data shared with third parties**: OpenAI (LLM), Stripe (Payments), Resend (Emails)
- **Data security**: HTTPS in transit, MongoDB Atlas encryption at rest
- **Ist Datenlöschung möglich?** Ja (über Settings → Account löschen)

---

## 🔧 Version bumpen (jedes Release)

Vor jedem Play-Store-Upload:

```bash
# In twa-manifest.json:
"appVersion": <increment integer>,        # z.B. 1 → 2 → 3
"appVersionName": "1.0.1"                 # user-facing string

# Dann regenerate:
npx @bubblewrap/cli update
```

Google akzeptiert keine zwei Uploads mit demselben `versionCode`.

---

## 🐛 Troubleshooting

**„Die App zeigt die URL-Bar oben"**
→ `assetlinks.json` ist nicht erreichbar oder der SHA-256 Fingerprint stimmt nicht. Fingerprint neu auslesen mit:
```bash
keytool -list -v -keystore android.keystore -alias android -storepass alphafit123 | grep SHA-256
```

**„Package name conflict"**
→ Ändere `packageId` in `twa-manifest.json` (aktuell: `fitness.alphafit.twa`) und regenerate.

**„Failed to start AAPT2 process"**
→ Du buildest auf ARM64-Linux ohne Emulation. Nutze macOS/Windows/x86_64-Linux oder GitHub Actions (siehe oben).
