#!/bin/sh
# Builds the web app and copies it into the iPad app bundle (Flowdraft/Web), then regenerates the Xcode project.
# Run before building or archiving: ios/scripts/build-web.sh
set -eu
cd "$(dirname "$0")/../.."

npx vite build --outDir ios/build/web --emptyOutDir

web=ios/Flowdraft/Web
rm -rf "$web"
mkdir -p "$web"
cp -R ios/build/web/. "$web/"
# Browser-only files: the app has no service worker or install prompt, and /config.js is served by the app.
rm -f "$web/sw.js" "$web/manifest.webmanifest" "$web/icon-maskable-512.png"
# The promo page videos (/tanitim) are web-only and would add megabytes to the app.
rm -rf "$web/promo"

cd ios
xcodegen generate --quiet
echo "web bundle: $(du -sh Flowdraft/Web | cut -f1)"
