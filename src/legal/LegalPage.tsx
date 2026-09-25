import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { Credit } from '../components/Credit';

export const LEGAL_VERSION = '2026-09-25';
const UPDATED = '25 Eylül 2026';
const CONTACT_URL = 'https://websiteniyapalim.com/?utm_source=flowdraft&utm_medium=legal';

export type LegalKind = 'terms' | 'privacy';

export const LEGAL_PATHS: Record<LegalKind, string> = {
  terms: '/kullanim-sartlari',
  privacy: '/gizlilik',
};

function Terms() {
  return (
    <>
      <h1>Kullanım Şartları</h1>
      <p className="fd-legal-meta">Son güncelleme: {UPDATED}</p>

      <div className="fd-legal-callout" role="note">
        <strong>Özetle:</strong> flowdraft ücretsiz bir uygulamadır ve <strong>hiçbir garanti verilmez</strong>. Veritabanı
        herhangi bir gün, önceden haber verilmeden silinebilir. Hesabın ve projelerin kaybolabilir. Önemli çalışmalarını
        mutlaka <strong>JSON veya PNG olarak dışa aktarıp kendi cihazında yedekle</strong>.
      </div>

      <h2>1. Hizmet</h2>
      <p>
        flowdraft (flowdraft.tech), tarayıcıda çalışan ücretsiz bir akış diyagramı editörüdür. Hizmet “olduğu gibi” ve
        “mevcut haliyle” sunulur. Deneysel bir üründür; özellikleri her an değişebilir.
      </p>

      <h2>2. Garanti yoktur</h2>
      <p>
        Hizmetin kesintisiz, hatasız, güvenli ya da belirli bir amaca uygun olacağına dair açık veya örtülü hiçbir garanti
        verilmez. Kayıtlı verilerin bütünlüğü, erişilebilirliği ve saklanması garanti edilmez.
      </p>

      <h2>3. Veri kaybı ve silinme</h2>
      <ul>
        <li>Veritabanı; bakım, taşıma, maliyet ya da başka herhangi bir sebeple, önceden bildirim yapılmadan kısmen veya tamamen silinebilir ya da sıfırlanabilir.</li>
        <li>Bu durumda hesabın, projelerin ve tüm içeriğin geri getirilemeyecek şekilde kaybolabilir.</li>
        <li>Yedekleme sorumluluğu sana aittir. Dışa aktarma (PNG, SVG, JSON) bu amaçla sunulur.</li>
      </ul>

      <h2>4. Hizmetin değiştirilmesi veya sonlandırılması</h2>
      <p>
        flowdraft herhangi bir zamanda, herhangi bir sebeple ve bildirim yapılmadan değiştirilebilir, sınırlandırılabilir,
        askıya alınabilir veya tamamen kapatılabilir.
      </p>

      <h2>5. Senin sorumlulukların</h2>
      <ul>
        <li>Hukuka aykırı, zararlı, başkalarının haklarını ihlal eden ya da yanıltıcı içerik oluşturmamayı kabul edersin.</li>
        <li>Diyagramlarına şifre, kimlik numarası, kart bilgisi, sağlık bilgisi gibi hassas kişisel veriler yazmamalısın.</li>
        <li>Hesabının güvenliğinden ve şifrenin gizliliğinden sen sorumlusun.</li>
        <li>Uygulamaya görsel veya dosya yüklenemez; sistemi kötüye kullanmaya yönelik girişimler hesabın kapatılmasına yol açabilir.</li>
      </ul>

      <h2>6. Sorumluluğun sınırlandırılması</h2>
      <p>
        Yürürlükteki mevzuatın izin verdiği azami ölçüde; hizmetin kullanımından veya kullanılamamasından, veri kaybından,
        kesintilerden ya da hatalardan doğan doğrudan veya dolaylı hiçbir zarardan sorumluluk kabul edilmez.
      </p>

      <h2>7. İçeriğin sahipliği</h2>
      <p>
        Oluşturduğun diyagramların sahibi sensin. Onları sadece sana hizmet sunmak (kaydetmek, göstermek) için saklarız.
      </p>

      <h2>8. Hesabın silinmesi</h2>
      <p>
        Projelerini uygulama içinden istediğin zaman silebilirsin. Hesabının tamamen silinmesini istersen iletişim adresinden
        talep edebilirsin. Kullanım şartlarına aykırı hesaplar bildirim yapılmadan kapatılabilir.
      </p>

      <h2>9. Değişiklikler</h2>
      <p>
        Bu şartlar güncellenebilir. Güncel metin her zaman bu sayfada yayımlanır. Değişiklikten sonra uygulamayı kullanmaya
        devam etmen, güncel şartları kabul ettiğin anlamına gelir.
      </p>

      <h2>10. Uygulanacak hukuk ve iletişim</h2>
      <p>
        Bu şartlara Türkiye Cumhuriyeti hukuku uygulanır. Soruların için:{' '}
        <a href={CONTACT_URL} target="_blank" rel="noopener">
          websiteniyapalım.com
        </a>
        .
      </p>
    </>
  );
}

function Privacy() {
  return (
    <>
      <h1>Gizlilik Politikası</h1>
      <p className="fd-legal-meta">Son güncelleme: {UPDATED}</p>

      <div className="fd-legal-callout" role="note">
        <strong>Özetle:</strong> Sadece hesabını açmak ve projelerini kaydetmek için gereken en az bilgiyi tutarız.
        Reklam, izleme çerezi veya üçüncü taraf analiz aracı kullanmayız. Verilerin satılmaz. Ancak flowdraft ücretsizdir ve
        veritabanı her an silinebilir; bkz. <a href={LEGAL_PATHS.terms}>Kullanım Şartları</a>.
      </div>

      <h2>1. Topladığımız bilgiler</h2>
      <ul>
        <li><strong>Hesap bilgileri:</strong> e-posta adresin ve şifren. Şifre düz metin olarak değil, tek yönlü şifrelenmiş (hash) olarak saklanır.</li>
        <li><strong>Projelerin:</strong> diyagram başlığı ve içeriği (kutular, metinler, bağlantılar). Görsel veya dosya yüklenemez.</li>
        <li><strong>Onay kaydı:</strong> kayıt olurken bu metinleri kabul ettiğin tarih ve metin sürümü.</li>
        <li><strong>Teknik kayıtlar:</strong> sunucular, güvenlik ve hata ayıklama için IP adresi, tarih ve tarayıcı bilgisi gibi standart erişim kayıtları tutabilir.</li>
      </ul>

      <h2>2. Giriş yapmadan kullanım</h2>
      <p>
        Giriş yapmadan çizdiklerin sunucuya gönderilmez; sadece kendi tarayıcının yerel depolamasında (localStorage) saklanır.
        Tarayıcı verilerini temizlersen bu taslak silinir.
      </p>

      <h2>3. Çerezler ve yerel depolama</h2>
      <p>
        Reklam veya izleme çerezi kullanmayız. Tarayıcında sadece şunlar saklanır: oturum bilgin (oturumunun açık kalması için),
        taslak çizimin ve otomatik kaydetme tercihin.
      </p>

      <h2>4. Bilgileri ne için kullanırız</h2>
      <ul>
        <li>Hesabını oluşturmak ve seni tanımak (giriş, çıkış).</li>
        <li>Projelerini kaydetmek ve sana tekrar göstermek.</li>
        <li>Hizmetin güvenliğini sağlamak ve kötüye kullanımı önlemek.</li>
      </ul>
      <p>Bilgilerin satılmaz, kiralanmaz ve pazarlama amacıyla paylaşılmaz.</p>

      <h2>5. Nerede saklanır, kimlerle paylaşılır</h2>
      <p>
        Veriler flowdraft'ın kendi sunucusunda, kendi kurduğumuz bir Supabase veritabanında saklanır. Sunucu, barındırma
        hizmeti sağlayıcısının altyapısında çalışır. Yasal bir zorunluluk olmadıkça verilerin üçüncü kişilerle paylaşılmaz.
      </p>

      <h2>6. Saklama süresi</h2>
      <p>
        Hesabın açık kaldığı sürece saklanır. Ancak flowdraft ücretsiz bir hizmettir: veritabanı önceden haber verilmeden
        silinebilir ve bu durumda verilerin kalıcı olarak kaybolabilir.
      </p>

      <h2>7. Güvenlik</h2>
      <p>
        Bağlantılar HTTPS ile şifrelenir, her kullanıcı sadece kendi projelerine erişebilir. Makul önlemler alınsa da hiçbir
        sistem tamamen güvenli değildir; güvenlik garanti edilmez.
      </p>

      <h2>8. Hakların (KVKK)</h2>
      <p>
        6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında; verilerinin işlenip işlenmediğini öğrenme, bilgi talep
        etme, düzeltilmesini veya silinmesini isteme ve diğer yasal haklarını kullanmak için bize ulaşabilirsin:{' '}
        <a href={CONTACT_URL} target="_blank" rel="noopener">
          websiteniyapalım.com
        </a>
        .
      </p>

      <h2>9. Değişiklikler</h2>
      <p>Bu politika güncellenebilir. Güncel metin her zaman bu sayfada yayımlanır.</p>
    </>
  );
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  useEffect(() => {
    document.title = `${kind === 'terms' ? 'Kullanım Şartları' : 'Gizlilik Politikası'} · flowdraft`;
  }, [kind]);

  return (
    <div className="fd-legal-page">
      <header className="fd-legal-head">
        <a href="/" className="fd-btn is-ghost">
          <ArrowLeft size={16} /> Uygulamaya dön
        </a>
        <nav aria-label="Yasal metinler" className="fd-legal-nav">
          <a href={LEGAL_PATHS.terms} aria-current={kind === 'terms' ? 'page' : undefined}>
            Kullanım Şartları
          </a>
          <a href={LEGAL_PATHS.privacy} aria-current={kind === 'privacy' ? 'page' : undefined}>
            Gizlilik
          </a>
        </nav>
      </header>
      <main className="fd-legal">{kind === 'terms' ? <Terms /> : <Privacy />}</main>
      <Credit />
    </div>
  );
}

export function legalKindFromPath(pathname: string): LegalKind | null {
  const path = pathname.replace(/\/+$/, '');
  if (path === LEGAL_PATHS.terms) return 'terms';
  if (path === LEGAL_PATHS.privacy) return 'privacy';
  return null;
}
