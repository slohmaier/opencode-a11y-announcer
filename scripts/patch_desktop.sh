#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
USERSCRIPT="$REPO_ROOT/opencode-a11y-announcer.user.js"
INJECT_NAME="oc-a11y.js"
ASAR=""
APP=""
UNPATCH=0
SIGN=1
FORCE=0

usage() {
  cat <<'EOF'
Patch the opencode desktop app so it loads the opencode-a11y-announcer script.

Usage: patch_desktop.sh [options]

Options:
  --asar PATH   Path to app.asar (overrides auto-detection)
  --app PATH    Path to a macOS .app bundle (derives app.asar)
  --unpatch     Restore the original app.asar from app.asar.bak
  --no-sign     Do not re-sign on macOS
  --force       Proceed even if app.asar.unpacked is non-empty
  -h, --help    Show this help

Auto-detection covers the common install locations for OpenCode, OpenCode Beta
and OpenCode Dev on macOS and Linux. Quit the app before running.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --asar) ASAR="${2:-}"; shift 2 ;;
    --app) APP="${2:-}"; shift 2 ;;
    --unpatch) UNPATCH=1; shift ;;
    --no-sign) SIGN=0; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

detect_asar() {
  if [ -n "$APP" ]; then
    echo "$APP/Contents/Resources/app.asar"
    return
  fi
  if [ -n "$ASAR" ]; then
    echo "$ASAR"
    return
  fi
  local candidates=(
    "/Applications/OpenCode.app/Contents/Resources/app.asar"
    "/Applications/OpenCode Beta.app/Contents/Resources/app.asar"
    "/Applications/OpenCode Dev.app/Contents/Resources/app.asar"
    "$HOME/Applications/OpenCode.app/Contents/Resources/app.asar"
    "/opt/OpenCode/resources/app.asar"
    "/opt/OpenCode Beta/resources/app.asar"
    "/opt/opencode/resources/app.asar"
    "/opt/opencode-desktop/resources/app.asar"
    "/usr/lib/opencode/resources/app.asar"
    "/usr/lib/OpenCode/resources/app.asar"
    "/usr/lib/opencode-desktop/resources/app.asar"
  )
  local c
  for c in "${candidates[@]}"; do
    if [ -f "$c" ]; then
      echo "$c"
      return
    fi
  done
  echo ""
}

ASAR="$(detect_asar)"

derive_unpack_glob() {
  node - "$1" <<'NODE'
const fs = require("fs")
const p = process.argv[2]
const fd = fs.openSync(p, "r")
const head = Buffer.alloc(16)
fs.readSync(fd, head, 0, 16, 0)
const size = head.readUInt32LE(12)
const hb = Buffer.alloc(size)
fs.readSync(fd, hb, 0, size, 16)
const root = JSON.parse(hb.toString("utf8"))
const dirs = []
function walkDirs(node, prefix) {
  for (const k of Object.keys(node.files || {})) {
    const child = node.files[k]
    const q = prefix + "/" + k
    if (child.files) {
      if (child.unpacked) dirs.push(q.replace(/^\//, ""))
      walkDirs(child, q)
    }
  }
}
walkDirs(root, "")
const top = dirs.filter(d => !dirs.some(o => o !== d && d.startsWith(o + "/")))
if (top.length) {
  console.log(top.join(","))
  process.exit(0)
}
const parents = new Set()
function walkFiles(node, prefix) {
  for (const k of Object.keys(node.files || {})) {
    const child = node.files[k]
    const q = prefix + "/" + k
    if (child.files) walkFiles(child, q)
    else if (child.unpacked) {
      const dir = q.replace(/^\//, "").split("/").slice(0, -1).join("/")
      if (dir) parents.add(dir)
    }
  }
}
walkFiles(root, "")
console.log(parents.size ? [...parents].join(",") : "")
NODE
}

if [ -z "$ASAR" ]; then
  echo "Could not find app.asar. Pass --asar PATH or --app PATH." >&2
  exit 1
fi

if [ ! -f "$ASAR" ]; then
  echo "app.asar not found: $ASAR" >&2
  exit 1
fi

BACKUP="$ASAR.bak"
UNPACKED="${ASAR%.asar}.unpacked"

if [ "$UNPATCH" -eq 1 ]; then
  if [ ! -f "$BACKUP" ]; then
    echo "No backup found at $BACKUP; nothing to restore." >&2
    exit 1
  fi
  cp "$BACKUP" "$ASAR"
  echo "Restored $ASAR from backup."
  echo "If the app was signed, re-sign it or reinstall the app."
  exit 0
fi

if [ ! -f "$USERSCRIPT" ]; then
  echo "Userscript not found: $USERSCRIPT" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "npx not found; Node.js is required (for @electron/asar)." >&2
  exit 1
fi

UNPACKED_NONEMPTY=0
if [ -d "$UNPACKED" ] && [ -n "$(ls -A "$UNPACKED" 2>/dev/null || true)" ]; then
  UNPACKED_NONEMPTY=1
fi

if [ ! -f "$BACKUP" ]; then
  cp "$ASAR" "$BACKUP"
  echo "Backup created: $BACKUP"
fi

UNPACK_GLOB="$(derive_unpack_glob "$BACKUP")"
if [ "$UNPACKED_NONEMPTY" -eq 1 ] && [ -z "$UNPACK_GLOB" ]; then
  if [ "$FORCE" -eq 0 ]; then
    echo "app.asar.unpacked is non-empty but no unpack patterns could be derived; refusing to repack." >&2
    echo "Re-run with --force to pack everything into the asar." >&2
    exit 1
  fi
  echo "app.asar.unpacked is non-empty and no unpack patterns were derived; native modules will be packed into the asar (--force)." >&2
elif [ -n "$UNPACK_GLOB" ]; then
  echo "Preserving unpacked native modules: $UNPACK_GLOB"
fi

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "Extracting $ASAR"
npx --yes @electron/asar extract "$ASAR" "$TMP/app"

RENDERER="$TMP/app/out/renderer"
INDEX="$RENDERER/index.html"
if [ ! -f "$INDEX" ]; then
  echo "Renderer index.html not found at $INDEX; unexpected package layout." >&2
  exit 1
fi

cp "$USERSCRIPT" "$RENDERER/$INJECT_NAME"

node - "$INDEX" "$INJECT_NAME" <<'NODE'
const fs = require("fs")
const file = process.argv[2]
const name = process.argv[3]
let html = fs.readFileSync(file, "utf8")
if (html.includes(name)) {
  console.log("Script tag already present; leaving index.html unchanged.")
  process.exit(0)
}
const tag = '<script src="./' + name + '"></script>'
if (/<\/body>/i.test(html)) {
  html = html.replace(/<\/body>/i, tag + "\n</body>")
} else if (/<\/html>/i.test(html)) {
  html = html.replace(/<\/html>/i, tag + "\n</html>")
} else {
  html += "\n" + tag + "\n"
}
fs.writeFileSync(file, html)
console.log("Injected script tag into out/renderer/index.html")
NODE

echo "Repacking $ASAR"
if [ -n "$UNPACK_GLOB" ]; then
  npx --yes @electron/asar pack "$TMP/app" "$ASAR" --unpack-dir "$UNPACK_GLOB"
else
  npx --yes @electron/asar pack "$TMP/app" "$ASAR"
fi

BEFORE="$(npx --yes @electron/asar list --is-pack "$BACKUP" | grep -c '^unpack' || true)"
AFTER="$(npx --yes @electron/asar list --is-pack "$ASAR" | grep -c '^unpack' || true)"
if [ "$BEFORE" != "$AFTER" ]; then
  echo "Unpacked entry count changed ($BEFORE -> $AFTER); restoring backup." >&2
  cp "$BACKUP" "$ASAR"
  exit 1
fi
echo "Unpacked entries preserved: $AFTER"

if [ "$(uname -s)" = "Darwin" ]; then
  BUNDLE="${ASAR%/Contents/Resources/app.asar}"
  if [ -d "$BUNDLE" ]; then
    PLIST="$BUNDLE/Contents/Info.plist"
    if [ -f "$PLIST" ] && /usr/libexec/PlistBuddy -c "Print :ElectronAsarIntegrity" "$PLIST" >/dev/null 2>&1; then
      echo "Removing ElectronAsarIntegrity from Info.plist"
      /usr/libexec/PlistBuddy -c "Delete :ElectronAsarIntegrity" "$PLIST" >/dev/null 2>&1 || true
    fi
    if [ "$SIGN" -eq 1 ]; then
      if command -v codesign >/dev/null 2>&1; then
        echo "Ad-hoc signing $BUNDLE"
        codesign --force --deep --sign - "$BUNDLE" >/dev/null 2>&1 || echo "codesign failed; run with --no-sign or sign manually." >&2
      else
        echo "codesign not found; skipping signing." >&2
      fi
    fi
  fi
fi

echo "Done. Start the opencode desktop app."
echo "Re-run this script after each opencode update (the installer overwrites app.asar)."
