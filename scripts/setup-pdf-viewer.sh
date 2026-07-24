#!/usr/bin/env bash
# Downloads the prebuilt Mozilla pdf.js viewer into public/pdf-viewer/.
# Called automatically via postinstall — no manual step needed.

set -euo pipefail

VERSION=$(node -p "require('pdfjs-dist/package.json').version" 2>/dev/null || echo "")
if [ -z "$VERSION" ]; then
  echo "pdfjs-dist not installed yet — skipping pdf-viewer setup"
  exit 0
fi

TARGET="public/pdf-viewer"
STAMP="$TARGET/.version"

# Skip if already downloaded at this version
if [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$VERSION" ]; then
  exit 0
fi

echo "Downloading Mozilla pdf.js viewer v${VERSION}..."
rm -rf "$TARGET"
mkdir -p "$TARGET"

TMPFILE=$(mktemp /tmp/pdfjs-XXXXXX.zip)
trap 'rm -f "$TMPFILE"' EXIT

curl -sL "https://github.com/mozilla/pdf.js/releases/download/v${VERSION}/pdfjs-${VERSION}-dist.zip" -o "$TMPFILE"
unzip -q "$TMPFILE" -d "$TARGET"

# Disable origin validation — PDFs are served from Supabase Storage, not the viewer's origin.
# Replace the entire validateFileURL function body with a no-op.
node -e "
const fs = require('fs');
const f = '$TARGET/web/viewer.mjs';
let src = fs.readFileSync(f, 'utf8');
src = src.replace(
  /var validateFileURL = function \(file\) \{[\s\S]*?\n  \};/,
  'var validateFileURL = function (file) { if (!file) return; };'
);
fs.writeFileSync(f, src);
"

echo "$VERSION" > "$STAMP"

echo "pdf.js viewer v${VERSION} ready at $TARGET/"
