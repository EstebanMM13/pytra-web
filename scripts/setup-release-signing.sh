#!/usr/bin/env bash
# One-time setup of the Android release signing key.
#
# 1. Generates ~/.android/pytra-release.jks (only if it does not exist yet).
# 2. Writes ~/.android/pytra-release.properties for local release builds.
# 3. Uploads the keystore and its credentials as GitHub Actions secrets.
#
# Safe to re-run: an existing keystore and properties file are reused, never overwritten,
# and the secrets are simply set again. Secrets are never printed.
#
# Requirements: Git Bash, openssl, gh (authenticated: gh auth login), a JDK keytool.
set -euo pipefail

REPO="EstebanMM13/pytra-web"
ALIAS="pytra"
ANDROID_DIR="${HOME}/.android"
KEYSTORE="${ANDROID_DIR}/pytra-release.jks"
PROPS="${ANDROID_DIR}/pytra-release.properties"

info() { printf '==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

find_keytool() {
  local candidates=(
    "C:/Program Files/Android/Android Studio/jbr/bin/keytool.exe"
    "/c/Program Files/Android/Android Studio/jbr/bin/keytool.exe"
  )
  if [[ -n "${JAVA_HOME:-}" ]]; then
    candidates+=("${JAVA_HOME}/bin/keytool.exe" "${JAVA_HOME}/bin/keytool")
  fi
  local dir
  for dir in "${HOME}/.gradle/jdks"/* "${HOME}/.jdks"/*; do
    [[ -d "$dir" ]] && candidates+=("${dir}/bin/keytool.exe" "${dir}/bin/keytool")
  done
  local c
  for c in "${candidates[@]}"; do
    if [[ -x "$c" || -f "$c" ]]; then
      printf '%s' "$c"
      return 0
    fi
  done
  command -v keytool 2>/dev/null && return 0
  return 1
}

# Reads one key from a .properties file (value after the first '=').
read_prop() {
  sed -n "s/^$1=//p" "$PROPS" | head -n 1 | tr -d '\r'
}

command -v openssl >/dev/null || fail "No se encontró openssl (viene con Git Bash)."
command -v gh >/dev/null || fail "No se encontró gh. Instala GitHub CLI: https://cli.github.com"
gh auth status >/dev/null 2>&1 || fail "gh no tiene sesión iniciada. Ejecuta: gh auth login"

mkdir -p "$ANDROID_DIR"

if [[ -f "$KEYSTORE" ]]; then
  info "El keystore ya existe, se reutiliza: $KEYSTORE"
  [[ -f "$PROPS" ]] || fail "Existe $KEYSTORE pero falta $PROPS (con su contraseña). Restáuralo desde tu copia de seguridad."
  PASSWORD="$(read_prop storePassword)"
  KEY_PASSWORD="$(read_prop keyPassword)"
  ALIAS="$(read_prop keyAlias)"
  [[ -n "$PASSWORD" && -n "$KEY_PASSWORD" && -n "$ALIAS" ]] || fail "Faltan valores en $PROPS (storePassword, keyPassword, keyAlias)."
else
  KEYTOOL="$(find_keytool)" || fail "No se encontró keytool. Instala Android Studio o define JAVA_HOME apuntando a un JDK."
  info "Usando keytool: $KEYTOOL"
  PASSWORD="$(openssl rand -hex 24)"
  KEY_PASSWORD="$PASSWORD"
  info "Generando el keystore de release: $KEYSTORE"
  # PKCS12 keystores use the store password for the key too. Passwords go through env vars, not argv.
  PYTRA_STOREPASS="$PASSWORD" "$KEYTOOL" -genkeypair -noprompt \
    -keystore "$KEYSTORE" -storetype PKCS12 \
    -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
    -storepass:env PYTRA_STOREPASS -keypass:env PYTRA_STOREPASS \
    -dname "CN=Pytra, O=EstebanMM13, C=ES" >/dev/null
  info "Keystore creado."
fi

if [[ -f "$PROPS" ]]; then
  info "El fichero de propiedades ya existe, no se modifica: $PROPS"
else
  info "Escribiendo $PROPS"
  umask 077
  # Forward slashes: valid on Windows and no escaping needed in .properties.
  KEYSTORE_PATH="$(cygpath -m "$KEYSTORE" 2>/dev/null || printf '%s' "$KEYSTORE")"
  {
    printf 'storeFile=%s\n' "$KEYSTORE_PATH"
    printf 'storePassword=%s\n' "$PASSWORD"
    printf 'keyAlias=%s\n' "$ALIAS"
    printf 'keyPassword=%s\n' "$KEY_PASSWORD"
  } > "$PROPS"
fi

info "Subiendo los secretos a GitHub ($REPO)..."
base64 -w0 "$KEYSTORE" | gh secret set ANDROID_KEYSTORE_BASE64 --repo "$REPO"
printf '%s' "$PASSWORD" | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO"
printf '%s' "$ALIAS" | gh secret set ANDROID_KEY_ALIAS --repo "$REPO"
printf '%s' "$KEY_PASSWORD" | gh secret set ANDROID_KEY_PASSWORD --repo "$REPO"

echo
info "Listo. La firma de release está configurada."
echo "    Keystore:    $KEYSTORE"
echo "    Propiedades: $PROPS"
echo
echo "IMPORTANTE: haz una copia de seguridad de estos dos ficheros (gestor de contraseñas, disco externo)."
echo "Si pierdes el keystore no podrás publicar actualizaciones: habría que desinstalar la app en cada móvil."
