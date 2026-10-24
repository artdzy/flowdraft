#!/bin/zsh
# Records the App Review walkthrough (review-walkthrough.js) on the booted 13-inch iPad simulator → ios/build/rec/review-ipad.mp4
# Needs the Debug simulator build installed (ios/build/dd-sim) and the demo account password in the Keychain.
set -u
export DEVELOPER_DIR=/Applications/Xcode-27.1-RC.app/Contents/Developer
UD=43636576-D46C-415C-A8E5-B0CD20F7EFAA
OUT=/Users/artunduzay/Desktop/Projects/flowdraft/ios/build/rec/review-ipad.mp4
EMAIL=appreview@flowdraft.tech
PW=$(security find-generic-password -s flowdraft-appstore-demo -a "$EMAIL" -w)
JS="const EMAIL='$EMAIL';const PASSWORD='$PW';$(cat "$(dirname "$0")/review-walkthrough.js")"
xcrun simctl terminate $UD tech.flowdraft.app 2>/dev/null
rm -f "$OUT"
xcrun simctl io $UD recordVideo --codec h264 --force "$OUT" > rec.log 2>&1 &
REC=$!
sleep 1.5
SIMCTL_CHILD_FLOWDRAFT_DEBUG_JS="$JS" xcrun simctl launch --console-pty $UD tech.flowdraft.app -AppleLanguages "(en)" > app.log 2>&1 &
APP=$!
# wait until the profile stage reports, max 120 s
for i in {1..240}; do grep -q "profile done\|no delete button\|no template\|no auth form" app.log && break; sleep 0.5; done
sleep 2
kill -INT $REC; wait $REC 2>/dev/null
kill $APP 2>/dev/null
grep FLOWDRAFT_DEBUG app.log | sed -E "s/$PW/<pw>/g"
ls -la "$OUT"
