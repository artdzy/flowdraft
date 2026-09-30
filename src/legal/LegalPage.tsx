import { ArrowLeft } from 'lucide-react';
import { useEffect, type ReactElement } from 'react';
import { Credit } from '../components/Credit';
import { LangSwitch } from '../components/LangSwitch';
import { lang, t } from '../i18n';

export const LEGAL_VERSION = '2026-09-25';
const UPDATED = '25 Eylül 2026';
const UPDATED_EN = 'September 25, 2026';
const CONTACT_URL = 'https://websiteniyapalim.com/?utm_source=flowdraft&utm_medium=legal';

export type LegalKind = 'terms' | 'privacy' | 'support';

export const LEGAL_PATHS: Record<LegalKind, string> = {
  terms: '/kullanim-sartlari',
  privacy: '/gizlilik',
  support: '/destek',
};

const TITLE: Record<LegalKind, string> = {
  terms: t('Kullanım Şartları', 'Terms of Use'),
  privacy: t('Gizlilik Politikası', 'Privacy Policy'),
  support: t('Destek', 'Support'),
};

function TermsTr() {
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
        Projelerini ve hesabını uygulama içinden istediğin zaman silebilirsin (hesap menüsü → Profil → Hesabı sil); hesabınla
        birlikte kayıtlı tüm projelerin de kalıcı olarak silinir. Kullanım şartlarına aykırı hesaplar bildirim yapılmadan
        kapatılabilir.
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

function PrivacyTr() {
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
        <li><strong>AI araçları için açık akış:</strong> hesabına bir AI aracı bağlıysan ve paylaşımı kapatmadıysan, o an açık olan akış (kaydedilmemiş değişiklikler dahil) hesabına yazılır, böylece bağlı araç onu okuyabilir. Paylaşımı Dosya → AI araçlarına bağla altından kapatabilirsin.</li>
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
      <p>
        Kendi isteğinle bir AI aracını (ör. ChatGPT, Claude) flowdraft hesabına bağlarsan, o araç senin adına projelerini
        okuyabilir, oluşturabilir, değiştirebilir ve silebilir. Bu araçlara giden veriler onların kendi gizlilik
        politikalarına tabidir. Bağlantıyı istediğin zaman uygulamada Dosya → AI araçlarına bağla bölümünden kaldırabilirsin.
      </p>

      <h2>6. Saklama süresi</h2>
      <p>
        Hesabın açık kaldığı sürece saklanır. Hesabını uygulama içinden (hesap menüsü → Profil → Hesabı sil) sildiğinde e-posta
        adresin ve kayıtlı projelerin hemen ve kalıcı olarak silinir. Ayrıca flowdraft ücretsiz bir hizmettir: veritabanı önceden haber verilmeden
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

function SupportTr() {
  return (
    <>
      <h1>Destek</h1>
      <p className="fd-legal-meta">flowdraft web (flowdraft.tech) ve iPad uygulaması</p>

      <h2>Nasıl başlarım?</h2>
      <p>
        Uygulamayı aç; boş tuvalde bir şablon seç ya da soldaki parçaları tuvale sürükle. Kutuları bağlamak için kenarlarındaki
        noktalardan birini başka bir kutuya sürükle. Bir kutuya ya da çizgiye dokununca sağdaki panelden metnini, rengini ve
        stilini değiştirebilirsin. Hesap açman gerekmez; çizimin bu cihazda otomatik saklanır.
      </p>

      <h2>Nasıl kaydederim ve paylaşırım?</h2>
      <ul>
        <li>Dışa aktar → PNG, SVG ya da JSON. iPad'de paylaşım menüsü açılır: Dosyalar'a kaydet, AirDrop ya da başka bir uygulama.</li>
        <li>Dosya → JSON içe aktar ile daha önce dışa aktardığın akışı geri açarsın.</li>
        <li>Ücretsiz bir hesapla “Kaydet”e basınca akış buluta kaydedilir; Dosya → Projelerim'den açarsın.</li>
      </ul>

      <h2>Hesabımı nasıl silerim?</h2>
      <p>
        Giriş yaptıktan sonra sağ üstteki hesap düğmesine dokun → Profil → Hesabı sil → onayla. Hesabın ve kayıtlı tüm projelerin hemen
        ve kalıcı olarak silinir. Cihazdaki taslak çizim silinmez.
      </p>

      <h2>AI araçlarıyla nasıl kullanırım?</h2>
      <p>
        Dosya → AI araçlarına bağla bölümündeki adresi, MCP destekleyen AI aracının bağlayıcı ayarına ekle. Adım adım
        rehber: <a href="/mcp">flowdraft.tech/mcp</a>. Bağlantıyı aynı bölümden istediğin zaman kaldırabilirsin.
      </p>

      <h2>İletişim</h2>
      <p>
        Soru, hata bildirimi ve önerilerin için{' '}
        <a href={CONTACT_URL} target="_blank" rel="noopener">
          websiteniyapalım.com
        </a>{' '}
        üzerindeki iletişim kanallarından bize yazabilirsin. Genellikle birkaç iş günü içinde yanıt veririz.
      </p>
    </>
  );
}

function TermsEn() {
  return (
    <>
      <h1>Terms of Use</h1>
      <p className="fd-legal-meta">Last updated: {UPDATED_EN}</p>

      <div className="fd-legal-callout" role="note">
        <strong>In short:</strong> flowdraft is a free app and comes with <strong>no warranty of any kind</strong>. The
        database may be deleted on any day, without prior notice. Your account and projects may be lost. Be sure to{' '}
        <strong>export your important work as JSON or PNG and back it up on your own device</strong>.
      </div>

      <h2>1. The service</h2>
      <p>
        flowdraft (flowdraft.tech) is a free flowchart editor that runs in your browser. The service is provided “as is”
        and “as available”. It is an experimental product; its features may change at any time.
      </p>

      <h2>2. No warranty</h2>
      <p>
        No warranty of any kind, express or implied, is given that the service will be uninterrupted, error-free, secure or
        fit for a particular purpose. The integrity, availability and retention of stored data are not guaranteed.
      </p>

      <h2>3. Data loss and deletion</h2>
      <ul>
        <li>The database may be partially or completely deleted or reset without prior notice, for maintenance, migration, cost or any other reason.</li>
        <li>If that happens, your account, your projects and all of your content may be lost with no way to recover them.</li>
        <li>You are responsible for backing up your work. Export (PNG, SVG, JSON) is provided for this purpose.</li>
      </ul>

      <h2>4. Changes to the service or its discontinuation</h2>
      <p>
        flowdraft may be changed, restricted, suspended or shut down completely at any time, for any reason and without
        notice.
      </p>

      <h2>5. Your responsibilities</h2>
      <ul>
        <li>You agree not to create content that is unlawful, harmful, infringes the rights of others or is misleading.</li>
        <li>You must not put sensitive personal data such as passwords, ID numbers, card details or health information into your diagrams.</li>
        <li>You are responsible for the security of your account and for keeping your password confidential.</li>
        <li>Images and files cannot be uploaded to the app; attempts to abuse the system may lead to your account being closed.</li>
      </ul>

      <h2>6. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by applicable law, no liability is accepted for any direct or indirect damage
        arising from the use of or inability to use the service, from data loss, or from interruptions or errors.
      </p>

      <h2>7. Ownership of content</h2>
      <p>
        You own the diagrams you create. We store them only to provide the service to you (saving and displaying them).
      </p>

      <h2>8. Deleting your account</h2>
      <p>
        You can delete your projects and your account from within the app at any time (account menu → Profile → Delete account); all
        projects saved to your account are permanently deleted along with it. Accounts that violate these terms of use may
        be closed without notice.
      </p>

      <h2>9. Changes</h2>
      <p>
        These terms may be updated. The current version is always published on this page. If you keep using the app after
        a change, it means you accept the updated terms.
      </p>

      <h2>10. Governing law and contact</h2>
      <p>
        These terms are governed by the laws of the Republic of Türkiye. For questions:{' '}
        <a href={CONTACT_URL} target="_blank" rel="noopener">
          websiteniyapalım.com
        </a>
        .
      </p>
    </>
  );
}

function PrivacyEn() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="fd-legal-meta">Last updated: {UPDATED_EN}</p>

      <div className="fd-legal-callout" role="note">
        <strong>In short:</strong> We keep only the minimum information needed to open your account and save your projects.
        We don't use ads, tracking cookies or third-party analytics tools. Your data is not sold. However, flowdraft is free
        and the database may be deleted at any time; see the <a href={LEGAL_PATHS.terms}>Terms of Use</a>.
      </div>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account information:</strong> your email address and password. Your password is not stored in plain text; it is stored as a one-way hash.</li>
        <li><strong>Your projects:</strong> the diagram title and content (boxes, text, connections). Images and files cannot be uploaded.</li>
        <li><strong>The open flow, for AI tools:</strong> if you have connected an AI tool and kept sharing on, the flow open at that moment (unsaved changes included) is written to your account so that tool can read it. You can turn sharing off under File → Connect AI tools.</li>
        <li><strong>Consent record:</strong> the date on which you accepted these documents when signing up, and the version of the documents.</li>
        <li><strong>Technical logs:</strong> for security and debugging, servers may keep standard access logs such as IP address, date and browser information.</li>
      </ul>

      <h2>2. Using the app without signing in</h2>
      <p>
        What you draw without signing in is not sent to the server; it is stored only in your own browser's local storage
        (localStorage). If you clear your browser data, this draft is deleted.
      </p>

      <h2>3. Cookies and local storage</h2>
      <p>
        We don't use advertising or tracking cookies. Only the following is stored in your browser: your session (so you
        stay signed in), your draft drawing and your autosave preference.
      </p>

      <h2>4. What we use your information for</h2>
      <ul>
        <li>To create your account and recognize you (signing in and out).</li>
        <li>To save your projects and show them to you again.</li>
        <li>To keep the service secure and prevent abuse.</li>
      </ul>
      <p>Your information is not sold, rented or shared for marketing purposes.</p>

      <h2>5. Where it is stored and who it is shared with</h2>
      <p>
        Your data is stored on flowdraft's own server, in a Supabase database that we set up and run ourselves. The server
        runs on the infrastructure of a hosting provider. Your data is not shared with third parties unless there is a legal
        obligation to do so.
      </p>
      <p>
        If you choose to connect an AI tool (e.g. ChatGPT, Claude) to your flowdraft account, that tool can read, create,
        change and delete your projects on your behalf. Data sent to these tools is subject to their own privacy policies.
        You can remove the connection at any time in the app under File → Connect AI tools.
      </p>

      <h2>6. How long we keep it</h2>
      <p>
        Your data is kept for as long as your account stays open. When you delete your account from within the app (account
        menu → Profile → Delete account), your email address and your saved projects are deleted immediately and permanently. Also,
        flowdraft is a free service: the database may be deleted without prior notice, in which case your data may be
        permanently lost.
      </p>

      <h2>7. Security</h2>
      <p>
        Connections are encrypted with HTTPS, and each user can access only their own projects. Although reasonable
        measures are taken, no system is completely secure; security is not guaranteed.
      </p>

      <h2>8. Your rights (KVKK)</h2>
      <p>
        Under Türkiye's Law No. 6698 on the Protection of Personal Data (KVKK), you can contact us to find out whether
        your data is being processed, request information, ask for your data to be corrected or deleted, and exercise your
        other legal rights:{' '}
        <a href={CONTACT_URL} target="_blank" rel="noopener">
          websiteniyapalım.com
        </a>
        .
      </p>

      <h2>9. Changes</h2>
      <p>This policy may be updated. The current version is always published on this page.</p>
    </>
  );
}

function SupportEn() {
  return (
    <>
      <h1>Support</h1>
      <p className="fd-legal-meta">flowdraft on the web (flowdraft.tech) and the iPad app</p>

      <h2>How do I get started?</h2>
      <p>
        Open the app; pick a template on the empty canvas, or drag parts from the left panel onto the canvas. To connect boxes,
        drag one of the dots on a box's edges onto another box. Tap a box or a line to change its text, color and style in
        the panel on the right. You don't need an account; your drawing is saved automatically on this device.
      </p>

      <h2>How do I save and share?</h2>
      <ul>
        <li>Export → PNG, SVG or JSON. On iPad, the share sheet opens: Save to Files, AirDrop or another app.</li>
        <li>File → Import JSON reopens a flow you exported earlier.</li>
        <li>With a free account, tap “Save” to save the flow to the cloud; open it from File → My projects.</li>
      </ul>

      <h2>How do I delete my account?</h2>
      <p>
        After signing in, tap the account button in the top right → Profile → Delete account → confirm. Your account and all your
        saved projects are deleted immediately and permanently. The draft drawing on your device is not deleted.
      </p>

      <h2>How do I use it with AI tools?</h2>
      <p>
        Add the address shown under File → Connect AI tools to the connector settings of an AI tool that supports MCP.
        Step-by-step guide: <a href="/mcp">flowdraft.tech/mcp</a>. You can remove the connection from the same place at any
        time.
      </p>

      <h2>Contact</h2>
      <p>
        For questions, bug reports and suggestions, write to us through the contact options on{' '}
        <a href={CONTACT_URL} target="_blank" rel="noopener">
          websiteniyapalım.com
        </a>
        . We usually reply within a few business days.
      </p>
    </>
  );
}

const BODY: Record<LegalKind, () => ReactElement> =
  lang === 'tr'
    ? { terms: TermsTr, privacy: PrivacyTr, support: SupportTr }
    : { terms: TermsEn, privacy: PrivacyEn, support: SupportEn };

export function LegalPage({ kind }: { kind: LegalKind }) {
  useEffect(() => {
    document.title = `${TITLE[kind]} · flowdraft`;
  }, [kind]);
  const Body = BODY[kind];

  return (
    <div className="fd-legal-page">
      <header className="fd-legal-head">
        <a href="/" className="fd-btn is-ghost">
          <ArrowLeft size={16} /> {t('Uygulamaya dön', 'Back to the app')}
        </a>
        <div className="fd-legal-end">
          <nav aria-label={t('Yasal metinler', 'Legal documents')} className="fd-legal-nav">
            <a href={LEGAL_PATHS.terms} aria-current={kind === 'terms' ? 'page' : undefined}>
              {t('Kullanım Şartları', 'Terms of Use')}
            </a>
            <a href={LEGAL_PATHS.privacy} aria-current={kind === 'privacy' ? 'page' : undefined}>
              {t('Gizlilik', 'Privacy')}
            </a>
            <a href={LEGAL_PATHS.support} aria-current={kind === 'support' ? 'page' : undefined}>
              {t('Destek', 'Support')}
            </a>
          </nav>
          <LangSwitch />
        </div>
      </header>
      <main className="fd-legal">
        <Body />
      </main>
      <Credit />
    </div>
  );
}

export function legalKindFromPath(pathname: string): LegalKind | null {
  const path = pathname.replace(/\/+$/, '');
  if (path === LEGAL_PATHS.terms) return 'terms';
  if (path === LEGAL_PATHS.privacy) return 'privacy';
  if (path === LEGAL_PATHS.support) return 'support';
  return null;
}
