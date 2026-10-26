# App Store kaydı — flowdraft (iPhone + iPad + Mac)

- macOS sürümü aynı kayıt ve aynı bundle ID (Mac Catalyst, `project.yml`: `SUPPORTS_MACCATALYST`, cihaz ailesi 1,2,6 = Mac arayüzü; macOS 15+; `Flowdraft/Mac.entitlements` sandbox + ağ + kullanıcı seçimli dosya). Mac'te dışa aktarma kaydetme penceresi, bağlantılar varsayılan tarayıcı. ASC macOS sürümü 1.0 (2026-10-24), metinler aşağıdaki iPhone/iPad metinlerinin Mac uyarlaması (ASC'de), inceleme notları `review-notes-mac.txt`, ekran görüntüleri `screenshots/*-mac-*` (2880×1800, pencerenin tamamı, trafik ışıkları dahil: Debug build + `FLOWDRAFT_DEBUG_WINDOW=1440x900` + `FLOWDRAFT_DEBUG_SNAPSHOT`, `scripts/app-store/mac-screenshots.sh`). Mac metinleri ASC'de ayrı girilir; aşağıdaki metinlerin MCP bölümü ve tanıtım metni oraya da taşınmalı.
- 4.3 (Spam) reddi, 2026-10-26: 9 sorunun cevabı `review-reply-4.3.txt` (App Review mesajı); build 7 cihaz üstü "Anlat, çizelim" (Foundation Models) ve menü çubuğu ile yeniden gönderildi. Mac ekran görüntüleri 5-describe / 6-described setin başında. İnceleme eki her platformda en fazla 1 dosya: iOS'ta iPad tanıtım videosu + yeni özellik görüntüleri tek videoda, Mac'te 11 sn'lik özellik videosu.
- Demo hesap (App Review, iki platform): `appreview@flowdraft.tech`; parola Keychain'de `flowdraft-appstore-demo` öğesinde ve ASC "Sign-In Information" alanlarında.
- Mac arşiv/yükleme: `xcodebuild archive -destination 'generic/platform=macOS,variant=Mac Catalyst'` + aynı `ExportOptions.plist` (3rd Party Mac Developer Installer sertifikası gerekir). Kimlik için `-allowProvisioningUpdates -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_XP2X24JU5D.p8 -authenticationKeyID XP2X24JU5D -authenticationKeyIssuerID <issuer>`.

- Bundle ID: `tech.flowdraft.app` · SKU: `flowdraft-ipad` · Birincil dil: English (U.S.), ek dil: Türkçe · iPhone ve iPad (iOS/iPadOS 18+; iPhone'da yalnız dikey)
- Uygulama dili cihaza göre: Türkçe cihazda Türkçe, diğer her dilde İngilizce (`src/i18n.ts`)
- Kategori: Verimlilik (Productivity), ikincil: Grafik ve Tasarım · Fiyat: Ücretsiz · Yaş: 4+
- Destek: https://flowdraft.tech/destek · Pazarlama: https://flowdraft.tech · Gizlilik: https://flowdraft.tech/gizlilik
- Ekran görüntüleri: `screenshots/` (iPad 13" 2064×2752 `*-iPadPro13-*` ve iPhone 6.9" 1320×2868 `*-iPhone69-*`, gerçek simülatör çekimi; `tr-*` Türkçe, `en-*` İngilizce) · İnceleme notları: `review-notes.txt`

# Türkçe

## Ad (30)
flowdraft

## Alt başlık (30)
Akış diyagramı çiz ve paylaş

## Tanıtım metni (170)
Süreci anlat, Apple Intelligence akışı cihazında çizsin. Sürükle, bağla; PNG, SVG ya da JSON olarak dışa aktar ya da Claude ve ChatGPT’ye MCP ile çizdir.

## Anahtar kelimeler (100)
akış,diyagram,şema,flowchart,süreç,iş akışı,otomasyon,mimari,çizim,plan,mcp,yapay zeka,ai

## Açıklama
flowdraft, iPhone, iPad ve Mac için hızlı ve sade bir akış diyagramı editörü. Süreçlerini, otomasyonlarını, yazılım mimarini ve müşteri konuşmalarını birkaç dokunuşla çiz. Claude, ChatGPT gibi AI araçlarına MCP ile bağlanır: akışını sohbetten çizdir, burada düzenle.

ANLAT, APPLE INTELLIGENCE ÇİZSİN
• Süreci kendi cümlelerinle yaz. Apple’ın cihaz üstü modeli adımları, kimin yaptığını ve nerede dallandığını bulur; flowdraft akışı düzenlemeye hazır biçimde çizer.
• Gizli ve çevrimdışı: yazdıkların cihazdan çıkmaz. Apple Intelligence destekleyen bir cihaz gerekir.

HEMEN BAŞLA
• Hesap açmadan kullan; çizimin bu cihazda otomatik saklanır.
• Hazır şablonlar: Otomasyon, Yazılım, Konuşma.
• İnternet olmadan da çalışır.

PARÇALAR
• Adım, vurgulu adım, insan onayı, karar, başla/bitir
• Kişi, ajan/bot, sistem, veritabanı
• Konuşma balonları, not, bilgi, uyarı, hata, başarılı
• Kulvar, otomatik bölge, başlık, etiket yazı, çip

BAĞLANTILAR
• Düz, kesikli ya da noktalı çizgi, 6 renk
• Köşeli, eğri ya da düz yol; ok yönü, akış animasyonu ve etiket

DIŞA AKTAR VE PAYLAŞ
• PNG görsel, SVG vektör ve düzenlenebilir JSON
• Dosyalar'a kaydet, AirDrop ile gönder ya da istediğin uygulamada paylaş
• Dışa aktardığın JSON dosyasını geri içe aktar

İSTERSEN BULUTA KAYDET
• Ücretsiz hesapla projelerini kaydet, otomatik kaydetmeyi aç; aynı projeleri flowdraft.tech üzerinden tarayıcıda da aç.
• Hesabını ve projelerini istediğin an uygulama içinden silebilirsin.

AI ARAÇLARINA MCP İLE BAĞLANIR
• flowdraft, MCP (Model Context Protocol) destekleyen her AI aracına bağlanır: Claude, ChatGPT, Claude Code, Codex, Cursor ve VS Code. Hesabına bir kez bağla, gerisi sohbette olur.
• Sohbette “bana bir sipariş akışı çiz” de: AI akışı hesabına çizer, görselini sohbette gösterir, düzeltmelerini aynı akışa uygular. flowdraft’ı açman bile gerekmez.
• Uygulamada açık olan akışı AI de görebilir; AI değiştirdiğinde ekran anında yenilenir. İstersen bu paylaşımı kapat.
• Kurulum rehberi: flowdraft.tech/mcp

Geri al / ileri al, kopyala / yapıştır, çoğalt, çoklu seçim, sağ tık menüsü, hizalama kılavuzları menü çubuğu komutları ve klavye kısayolları (⌘Z, ⌘C / ⌘V, ⌘D, ⌘S) var. Açık ve koyu tema cihazına uyar.

flowdraft ücretsizdir; reklam ve uygulama içi satın alma yoktur.

# English (U.S.)

## Name (30)
flowdraft

## Subtitle (30)
Draw and share flowcharts

## Promotional text (170)
Describe a process and Apple Intelligence draws the flowchart on your device. Drag, connect, export as PNG, SVG or JSON, or let Claude and ChatGPT draw over MCP.

## Keywords (100)
flowchart,diagram,workflow,process,flow,chart,automation,architecture,whiteboard,planning,mcp,ai

## Description
flowdraft is a fast, simple flowchart and diagram editor for iPhone, iPad and Mac. Sketch processes, automations, software architecture and customer conversations in a few taps. It connects to AI tools such as Claude and ChatGPT over MCP: have a flow drawn from the chat, then edit it here.

DESCRIBE IT, APPLE INTELLIGENCE DRAWS IT
• Write a process in your own words. Apple’s on-device model finds its steps, who does them and where it branches, and flowdraft lays out the flowchart, ready to edit.
• Private and offline: your text never leaves the device. Requires a device with Apple Intelligence.

START RIGHT AWAY
• No account needed; your drawing is kept on this device automatically.
• Ready-made templates: Automation, Software, Conversation.
• Works offline.

PARTS
• Step, highlighted step, human approval, decision, start/end
• Person, agent/bot, system, database
• Chat bubbles, note, info, warning, error, success
• Lane, automation zone, heading, label, chip

CONNECTIONS
• Solid, dashed or dotted lines in 6 colors
• Stepped, curved or straight paths; arrow direction, flow animation and labels

EXPORT AND SHARE
• PNG image, SVG vector and editable JSON
• Save to Files, send with AirDrop or share to any app
• Import an exported JSON file back

SAVE TO THE CLOUD IF YOU LIKE
• With a free account, save your projects, turn on auto-save and open the same projects in your browser at flowdraft.tech.
• Delete your account and projects from inside the app at any time.

CONNECTS TO AI TOOLS OVER MCP
• flowdraft connects to any AI tool that supports MCP (Model Context Protocol): Claude, ChatGPT, Claude Code, Codex, Cursor and VS Code. Connect your account once; the rest happens in the chat.
• Say "draw me an order flow" in the chat: the AI draws it into your account, shows a picture of it in the chat and applies your corrections to the same flow. You don't even need to open flowdraft.
• The AI can also see the flow you have open here, and the screen updates the moment the AI changes it. Turn that sharing off whenever you like.
• Setup guide: flowdraft.tech/mcp

Undo/redo, copy/paste, duplicate, multi-select, a right-click menu, alignment guides menu bar commands and keyboard shortcuts (⌘Z, ⌘C / ⌘V, ⌘D, ⌘S). Light and dark themes follow your device.

flowdraft is free, with no ads and no in-app purchases.

## Uygulama gizliliği (App Privacy)
Toplanan veriler (hepsi hesaba bağlı, izleme yok, amaç: Uygulama işlevselliği):
- İletişim bilgileri → E-posta adresi
- Kullanıcı içeriği → Diğer kullanıcı içeriği (hesaba kaydedilen diyagramlar)
- Tanımlayıcılar → Kullanıcı kimliği (hesap kimliği)

## Ekran kaydı senaryosu (fiziksel iPad, TestFlight build'i, ~1–1,5 dk)
1. Ana ekrandan flowdraft'ı aç.
2. Boş tuvalde “Otomasyon” şablonuna dokun.
3. Bir kutuya dokun, sağ panelde başlığını değiştir.
4. Soldan “Karar”ı tuvale sürükle, bir kutunun kenar noktasından ona bağla.
5. Dışa aktar → PNG görsel → paylaşım menüsü açılsın → kapat (ya da Dosyalar'a kaydet).
6. Giriş yap → demo hesabı → Kaydet → Dosya → Projelerim (kayıtlı akış görünsün) → kapat.
7. Sağ üstteki hesap düğmesi → “Profil” → “Hesabı sil” → onay penceresi görünsün → Vazgeç.
