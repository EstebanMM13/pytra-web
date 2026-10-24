#!/usr/bin/env bash
# Local signed release build. Needs ~/.android/pytra-release.properties
# (created once by scripts/setup-release-signing.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROPS="${HOME}/.android/pytra-release.properties"

[[ -f "$PROPS" ]] || { echo "ERROR: falta $PROPS. Ejecuta antes scripts/setup-release-signing.sh" >&2; exit 1; }

if [[ -z "${JAVA_HOME:-}" && -d "C:/Program Files/Android/Android Studio/jbr" ]]; then
  export JAVA_HOME="C:/Program Files/Android/Android Studio/jbr"
fi

cd "$ROOT"
echo "==> Compilando la web (npm run build)"
npm run build
echo "==> Sincronizando Capacitor (npx cap sync android)"
npx cap sync android
echo "==> Generando el APK de release firmado"
(cd android && ./gradlew assembleRelease "-PpytraReleaseProperties=${PROPS}")

APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
[[ -f "$APK" ]] || { echo "ERROR: no se generó $APK" >&2; exit 1; }
echo
echo "APK firmado: $APK"
