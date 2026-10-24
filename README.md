# flowdraft

Tarayıcıda ve telefonda çalışan, ücretsiz akış diyagramı editörü — **flowdraft.tech**

- Açılır açılmaz kullanılır; çizim bu cihazda taslak olarak saklanır.
- Kaydet / dışa aktar / otomatik kaydet → giriş ister (Supabase Auth).
- Projeler sadece düğüm + bağlantı JSON'u olarak saklanır; görsel yüklenemez.
- Hazır parçalar: adım, vurgulu adım, insan onayı, karar, başla/bitir, kişi, bot, sistem,
  veritabanı, konuşma balonu, not/bilgi/uyarı/hata/başarılı, kulvar, otomatik bölge, başlık, çip.
- Bağlantılar: düz / kesikli / noktalı, 6 renk, köşeli / eğri / düz yol, ok yönü, animasyon, etiket.
- Editör: kopyala / yapıştır / kes (başka akışa da), bağlantı noktasından boşluğa sürükleyince bağlı yeni parça, sağ tık
  menüsü, çizgiye çift tıkla etiket, seçili çizginin ucunu başka kutuya taşıma, kulvar içindekilerle birlikte taşınır,
  sürüklerken hizalama kılavuzları, zoom kısayolları (⇧1 sığdır, ⇧0 %100, ⇧2 seçim, ⌘+ / ⌘−).
- Dışa aktarma: PNG, SVG, JSON. PWA olarak ana ekrana eklenebilir.

## Geliştirme

```bash
cp .env.example .env   # SUPABASE_URL ve SUPABASE_ANON_KEY doldur
npm install
npm run dev
```

## Üretim

```bash
npm run build
SUPABASE_URL=... SUPABASE_ANON_KEY=... npm start   # :3000
```

Coolify: build pack **Dockerfile**, port **3000**, ortam değişkenleri `SUPABASE_URL`, `SUPABASE_ANON_KEY`
(çalışma anında `/config.js` ile tarayıcıya verilir, yeniden build gerekmez).

## Veritabanı

`supabase/migrations/` altındaki dosyaları sırayla (0001 → 0005) Supabase SQL Editor'de çalıştır.
Auth → URL Configuration → Site URL: `https://flowdraft.tech`.

## AI araçları (MCP)

Kullanıcılar flowdraft'ı ChatGPT, Claude, Claude Code, Codex, Cursor gibi araçlara **`https://flowdraft.tech/mcp`** adresiyle
ekler; AI kendi hesaplarındaki akışları listeler, okur, oluşturur, günceller ve siler. Aynı adres tarayıcıda açılınca
herkese açık kurulum rehberini gösterir (Claude, ChatGPT, Claude Code, Cursor, VS Code). Uygulamada: Dosya → AI
araçlarına bağla (adres, rehber linki, bağlı uygulamaları kaldırma).

- Kimlik doğrulama **Supabase Auth'un OAuth 2.1 sunucusu** ile yapılır. AI aracı kendini kaydeder (dynamic client
  registration), kullanıcı `/oauth/consent` sayfasında giriş yapıp izin verir.
- `/mcp` sadece korumalı kaynaktır: token'ı doğrular, sorguları kullanıcının kendi token'ıyla çalıştırır (RLS geçerli).
- AI'ın verdiği `https://flowdraft.tech/?p=<id>` bağlantısı akışı açar; AI açık akışı güncellerse ekran Realtime ile hemen
  yenilenir (kaydedilmemiş değişiklik varsa uyarır), aksi halde sekmeye dönünce yüklenir.

### Sohbetten çiz, sohbette gör

Kullanıcı flowdraft'ı hiç açmadan Claude/ChatGPT sohbetinden akış çizdirip düzelttirebilir: AI `create_diagram` /
`update_diagram` çağırır, sonuç PNG olarak sohbete gelir, kullanıcı düzeltmesini sohbete yazar, AI aynı akışı günceller.

- PNG sunucuda çizilir (`server/render.ts`): akış JSON'u → SVG (editörün açık tema stilleri) → PNG. Ücretsiz, açık kaynak
  parçalar: `@resvg/resvg-js`, `opentype.js` (yazı ölçümü) ve Geist fontları (OFL, `server/fonts/`). Arka plan opaktır.
- `create_diagram`, `update_diagram`, `get_diagram`, `get_open_diagram` sonuçlarında PNG vardır; model her zaman görür.
  MCP Apps destekleyen istemciler (Claude, ChatGPT) görseli sohbette de gösterir (`server/view.ts`, `ui://flowdraft/diagram.html`).
- `get_open_diagram`: kullanıcının flowdraft'ta şu an açık tuvali (kaydedilmemiş değişiklikler dahil). Uygulama bunu
  `live_canvas` tablosuna yazar: sadece giriş yapılmış, hesaba bir AI aracı bağlı (OAuth grant) ve “Açık akışı bağlı AI
  araçlarıyla paylaş” anahtarı açıkken (Dosya → AI araçlarına bağla).
- AI açık akışı güncellerse ekran Realtime ile hemen yenilenir (`src/lib/live.ts`).
- Gerekenler: `0003_live_canvas.sql` migration'ı (tablo, RLS, `supabase_realtime` yayını) ve Supabase Realtime servisi
  (self-hosted'da Kong'daki `/realtime/v1` yolu).

### Kurulum (self-hosted Supabase, `api.flowdraft.tech`)

1. **Auth (GoTrue) ortam değişkenleri** — güncel bir `supabase/gotrue` imajıyla (ör. v2.196.0):

   ```env
   GOTRUE_OAUTH_SERVER_ENABLED=true
   GOTRUE_OAUTH_SERVER_ALLOW_DYNAMIC_REGISTRATION=true
   GOTRUE_OAUTH_SERVER_AUTHORIZATION_PATH=/oauth/consent
   # OAuth uç noktaları issuer'dan türetilir (issuer + /oauth/authorize), bu yüzden /auth/v1 ile bitmeli:
   GOTRUE_JWT_ISSUER=https://api.flowdraft.tech/auth/v1
   GOTRUE_SITE_URL=https://flowdraft.tech
   ```

2. **Kong** (`volumes/api/kong.yml`, `services:` altına) — AI istemcileri `apikey` göndermez, bu iki yol açık olmalı:

   ```yaml
   - name: auth-v1-open-oauth
     url: http://auth:9999/oauth/
     routes:
       - name: auth-v1-open-oauth
         strip_path: true
         paths:
           - /auth/v1/oauth/
     plugins:
       - name: cors
   - name: well-known-oauth-auth-v1
     url: http://auth:9999/.well-known/oauth-authorization-server
     routes:
       - name: well-known-oauth-auth-v1
         strip_path: true
         paths:
           - /.well-known/oauth-authorization-server/auth/v1
     plugins:
       - name: cors
   ```

3. **flowdraft uygulaması**: `SUPABASE_URL` ve `SUPABASE_ANON_KEY` dolu olmalı (MCP sunucusu da bunları kullanır).

4. **Kontrol**:

   ```bash
   curl https://api.flowdraft.tech/.well-known/oauth-authorization-server/auth/v1   # registration_endpoint içermeli
   curl https://flowdraft.tech/.well-known/oauth-protected-resource/mcp
   ```

Supabase Cloud kullanılırsa 1–2 yerine: Dashboard → Authentication → OAuth Server → etkinleştir, Authorization Path
`/oauth/consent`, dynamic client registration açık.

## Yapı

- `src/flow/` — düğüm/bağlantı tipleri, bileşenler, palet, şablonlar
- `src/store/` — editör (geri al/ileri al), oturum, ayarlar, arayüz durumu
- `src/lib/` — Supabase, proje CRUD, kaydetme, dışa aktarma, belge doğrulama, AI kritiği için canlı bağlantı (`live.ts`)
- `src/admin/` — yönetim paneli (`/yonetim`): üyeler, akışları ve salt okunur akış önizlemesi. Yöneticiler
  `public.admins` tablosunda durur (`0004_admin.sql`, `0005_admin_flow.sql`)
- `src/profile/` — profil sayfası (`/profil`): hesap bilgisi, çıkış, hesabı silme
- `src/oauth/` — AI araçları için OAuth onay sayfası (`/oauth/consent`)
- `src/guide/` — kurulum rehberi (`/mcp`, tarayıcıdan açılınca)
- `server/mcp.ts` — MCP sunucusu (`/mcp`); `npm run build` ile `dist-server/`'a derlenir
- `server/render.ts` — akışı PNG olarak çizer; `server/view.ts` — görseli sohbette gösteren MCP Apps görünümü
- `server.js` — Express: statik dosyalar, SPA fallback, `/config.js`, `/mcp`, güvenlik başlıkları
