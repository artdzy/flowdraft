# App Store kaydı — flowdraft (iPhone + iPad + Mac)

- macOS sürümü aynı kayıt ve aynı bundle ID (Mac Catalyst, `project.yml`: `SUPPORTS_MACCATALYST`, cihaz ailesi 1,2,6 = Mac arayüzü; macOS 15+; `Flowdraft/Mac.entitlements` sandbox + ağ + kullanıcı seçimli dosya). Mac'te dışa aktarma kaydetme penceresi, bağlantılar varsayılan tarayıcı. ASC macOS sürümü 1.0 (2026-10-24), metinler aşağıdaki iPhone/iPad metinlerinin Mac uyarlaması (ASC'de), inceleme notları `review-notes-mac.txt`, ekran görüntüleri `screenshots/*-mac-*` (2880×1800, Debug build + `FLOWDRAFT_DEBUG_WINDOW=1440x900` + `FLOWDRAFT_DEBUG_SNAPSHOT`).
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
Sürükle, bağla, dışa aktar. Otomasyon, yazılım ve konuşma akışlarını dakikalar içinde çiz; PNG, SVG ya da JSON olarak paylaş. Hesap açmadan hemen başla.

## Anahtar kelimeler (100)
akış,diyagram,şema,flowchart,süreç,iş akışı,otomasyon,mimari,çizim,tahta,plan,organizasyon

## Açıklama
flowdraft, iPhone ve iPad için hızlı ve sade bir akış diyagramı editörü. Süreçlerini, otomasyonlarını, yazılım mimarini ve müşteri konuşmalarını birkaç dokunuşla çiz.

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

AI ARAÇLARIYLA KULLAN
• İstersen flowdraft hesabını MCP destekleyen bir AI asistanına bağla; “bana bir akış çiz” de, akış hesabına kaydedilsin, sonra burada açıp düzenle.

Geri al / ileri al, çoğalt, çoklu seçim ve klavye kısayolları (⌘Z, ⇧⌘Z, ⌘D, ⌘S) var. Açık ve koyu tema cihazına uyar.

flowdraft ücretsizdir; reklam ve uygulama içi satın alma yoktur.

# English (U.S.)

## Name (30)
flowdraft

## Subtitle (30)
Draw and share flowcharts

## Promotional text (170)
Drag, connect, export. Sketch automations, software architecture and conversations in minutes, then share them as PNG, SVG or JSON. Start right away, no account needed.

## Keywords (100)
flowchart,diagram,workflow,process,flow,chart,automation,architecture,mind map,whiteboard,planning

## Description
flowdraft is a fast, simple flowchart and diagram editor for iPhone and iPad. Sketch processes, automations, software architecture and customer conversations in a few taps.

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

USE WITH AI
• Optionally connect your flowdraft account to an AI assistant that supports MCP; ask it to "draw me a flow", it is saved to your account, then open and edit it here.

Undo/redo, duplicate, multi-select and keyboard shortcuts (⌘Z, ⇧⌘Z, ⌘D, ⌘S). Light and dark themes follow your device.

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
