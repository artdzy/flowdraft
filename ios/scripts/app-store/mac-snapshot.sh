#!/bin/zsh
# Takes one Mac App Store screenshot: launches the Debug Mac Catalyst build with FLOWDRAFT_DEBUG_WINDOW/_JS/_SNAPSHOT, copies the PNG out of the sandbox container.
# snap.sh <lang> <name> <js> → <lang>-mac-<name>.png written by the app itself (web view pixels)
set -u
APP=/Users/artunduzay/Desktop/Projects/flowdraft/ios/build/dd-mac/Build/Products/Debug-maccatalyst/Flowdraft.app
lang=$1; name=$2; js=$3; out="$HOME/Library/Containers/tech.flowdraft.app/Data/tmp/$lang-mac-$name.png"
pkill -x Flowdraft 2>/dev/null; sleep 0.5; rm -f "$out"
FLOWDRAFT_DEBUG_WINDOW=${WIN:-1440x900} FLOWDRAFT_DEBUG_SNAPSHOT="$out" FLOWDRAFT_DEBUG_JS="$js" "$APP/Contents/MacOS/Flowdraft" -AppleLanguages "($lang)" > "run-$lang-$name.log" 2>&1 &
pid=$!
for i in {1..40}; do [ -f "$out" ] && break; sleep 0.5; done; sleep 0.3
kill $pid 2>/dev/null; cp -f "$out" "/Users/artunduzay/Desktop/Projects/flowdraft/ios/build/shots/" 2>/dev/null
grep "FLOWDRAFT_DEBUG" "run-$lang-$name.log" | tr '\n' ' '; echo
[ -f "$out" ] && sips -g pixelWidth -g pixelHeight "$out" | tail -2 | tr '\n' ' '; echo
