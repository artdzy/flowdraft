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

## Yapı

- `src/flow/` — düğüm/bağlantı tipleri, bileşenler, palet, şablonlar
- `src/store/` — editör (geri al/ileri al), oturum, ayarlar, arayüz durumu
- `src/lib/` — Supabase, proje CRUD, kaydetme, dışa aktarma, belge doğrulama
- `server.js` — Express: statik dosyalar, SPA fallback, `/config.js`, güvenlik başlıkları
