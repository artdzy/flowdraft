#!/bin/zsh
set -u
# App Store screenshots for the Mac version (2880×1800): Debug Mac Catalyst build in ios/build/dd-mac, one app launch per scene.
RESET='if(!sessionStorage.fdShot){sessionStorage.fdShot=1;localStorage.clear();localStorage.setItem("flowdraft:whatsnew","0.2.0");localStorage.setItem("flowdraft:promo:hidden","1");location.reload();return "reload";}'
THEME='localStorage.setItem("flowdraft:theme",THEME);document.documentElement.dataset.theme=THEME;'
TPL='const find=()=>[...document.querySelectorAll(".fd-template")].find(b=>b.querySelector(".fd-template-title").textContent.trim()===TITLE);let btn;for(let i=0;i<40&&!(btn=find());i++)await new Promise(r=>setTimeout(r,100));if(!btn)return "no template button";btn.click();await new Promise(r=>setTimeout(r,1500));'
EXPORT='const eb=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()===EXPORT_LABEL);if(!eb)return "no export button";eb.click();await new Promise(r=>setTimeout(r,700));'
for lang in en tr; do
  if [ $lang = en ]; then A=Automation; S=Software; C=Conversation; X=Export; else A=Otomasyon; S=Yazılım; C=Konuşma; X="Dışa aktar"; fi
  "$(dirname "$0")/mac-snapshot.sh" $lang 1-automation "${RESET}const THEME='light';${THEME}const TITLE='$A';${TPL}return 'ok';"
  "$(dirname "$0")/mac-snapshot.sh" $lang 2-software-dark "${RESET}const THEME='dark';${THEME}const TITLE='$S';${TPL}return 'ok';"
  "$(dirname "$0")/mac-snapshot.sh" $lang 3-conversation "${RESET}const THEME='light';${THEME}const TITLE='$C';${TPL}return 'ok';"
  "$(dirname "$0")/mac-snapshot.sh" $lang 4-export "${RESET}const THEME='light';${THEME}const TITLE='$A';${TPL}const EXPORT_LABEL='$X';${EXPORT}return 'ok';"
done
ls -la /Users/artunduzay/Desktop/Projects/flowdraft/ios/build/shots/
