# flowdraft

Tarayıcıda ve telefonda çalışan, ücretsiz akış diyagramı editörü — **flowdraft.tech**

- Açılır açılmaz kullanılır; çizim bu cihazda taslak olarak saklanır.
- Kaydet / dışa aktar / otomatik kaydet → giriş ister (Supabase Auth).
- Projeler sadece düğüm + bağlantı JSON'u olarak saklanır; görsel yüklenemez.
- Hazır parçalar: adım, vurgulu adım, insan onayı, karar, başla/bitir, kişi, bot, sistem,
  veritabanı, konuşma balonu, not/bilgi/uyarı/hata/başarılı, kulvar, otomatik bölge, başlık, çip.
- Bağlantılar: düz / kesikli / noktalı, 6 renk, köşeli / eğri / düz yol, ok yönü, animasyon, etiket.
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

`supabase/migrations/0001_projects.sql` dosyasını Supabase SQL Editor'de çalıştır.
Auth → URL Configuration → Site URL: `https://flowdraft.tech`.

## AI araçları (MCP)

Kullanıcılar flowdraft'ı ChatGPT, Claude, Claude Code, Cursor gibi araçlara **`https://flowdraft.tech/mcp`** adresiyle
ekler; AI kendi hesaplarındaki akışları listeler, okur, oluşturur, günceller ve siler. Aynı adres tarayıcıda açılınca
herkese açık kurulum rehberini gösterir (Claude, ChatGPT, Claude Code, Cursor, VS Code). Uygulamada: Dosya → AI
araçlarına bağla (adres, rehber linki, bağlı uygulamaları kaldırma).

- Kimlik doğrulama **Supabase Auth'un OAuth 2.1 sunucusu** ile yapılır. AI aracı kendini kaydeder (dynamic client
  registration), kullanıcı `/oauth/consent` sayfasında giriş yapıp izin verir.
- `/mcp` sadece korumalı kaynaktır: token'ı doğrular, sorguları kullanıcının kendi token'ıyla çalıştırır (RLS geçerli).
- AI'ın verdiği `https://flowdraft.tech/?p=<id>` bağlantısı akışı açar; sekmeye dönünce AI'ın yaptığı değişiklik yüklenir.

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
- `src/lib/` — Supabase, proje CRUD, kaydetme, dışa aktarma, belge doğrulama
- `src/oauth/` — AI araçları için OAuth onay sayfası (`/oauth/consent`)
- `src/guide/` — kurulum rehberi (`/mcp`, tarayıcıdan açılınca)
- `server/mcp.ts` — MCP sunucusu (`/mcp`); `npm run build` ile `dist-server/`'a derlenir
- `server.js` — Express: statik dosyalar, SPA fallback, `/config.js`, `/mcp`, güvenlik başlıkları
