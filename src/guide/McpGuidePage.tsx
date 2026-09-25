import { ArrowLeft, FolderOpen, Link2, PenLine, ShieldCheck, Workflow } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Credit } from '../components/Credit';
import { CopyBlock, CopyField, mcpUrl } from '../components/Copy';
import { Toasts } from '../components/Dialogs';
import { Logo } from '../components/TopBar';
import { LEGAL_PATHS } from '../legal/LegalPage';

/** Public setup guide. Served at the MCP address itself when opened in a browser (see server/mcp.ts). */
export const GUIDE_PATH = '/mcp';

export function isGuidePath(pathname: string) {
  return pathname.replace(/\/+$/, '') === GUIDE_PATH;
}

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <Workflow size={18} />, title: 'Akış çizer', text: 'Anlattığın süreci kulvarlı, karar dallı bir akışa çevirir.' },
  { icon: <PenLine size={18} />, title: 'Düzenler', text: 'Mevcut akışına adım, dal ya da not ekler; yeniden düzenler.' },
  { icon: <FolderOpen size={18} />, title: 'Okur', text: 'Kayıtlı akışlarını bulur, özetler, üzerine konuşur.' },
  { icon: <Link2 size={18} />, title: 'Link verir', text: 'Her işin sonunda akışı flowdraft’ta açan bir bağlantı verir.' },
];

const PROMPTS = [
  'flowdraft ile müşteri iade sürecini çiz: müşteri, destek ekibi ve depo için ayrı kulvarlar olsun.',
  'flowdraft’taki “Sipariş akışı”nı aç ve ödeme reddedilirse ne olacağını gösteren bir dal ekle.',
  'Bu README’deki kurulum adımlarını flowdraft’ta yukarıdan aşağı bir akış olarak çiz.',
  'flowdraft’taki akışlarımı listele ve en son düzenlediğimi özetle.',
];

function Steps({ children }: { children: ReactNode }) {
  return <ol className="fd-guide-steps">{children}</ol>;
}

function Client({ id, name, note, children }: { id: string; name: string; note?: string; children: ReactNode }) {
  return (
    <section className="fd-guide-client" id={id} aria-labelledby={`${id}-title`}>
      <div className="fd-guide-client-head">
        <h3 id={`${id}-title`}>{name}</h3>
        {note && <span className="fd-guide-note">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="fd-guide-faq">
      <summary>{q}</summary>
      <div>{children}</div>
    </details>
  );
}

export function McpGuidePage() {
  const url = mcpUrl();

  useEffect(() => {
    document.title = 'Yapay zekâ ile kullan (MCP) · flowdraft';
  }, []);

  return (
    <div className="fd-legal-page">
      <header className="fd-legal-head">
        <a href="/" className="fd-oauth-home" aria-label="flowdraft ana sayfa">
          <Logo />
        </a>
        <a href="/" className="fd-btn is-ghost">
          <ArrowLeft size={16} /> Uygulamayı aç
        </a>
      </header>

      <main className="fd-guide">
        <section className="fd-guide-hero" aria-labelledby="fd-guide-title">
          <p className="fd-guide-kicker">MCP · YAPAY ZEKÂ BAĞLANTISI</p>
          <h1 id="fd-guide-title">flowdraft’ı yapay zekâ asistanına bağla</h1>
          <p className="fd-guide-lead">
            ChatGPT, Claude ya da MCP destekleyen başka bir araçta “bana şu süreci akış olarak çiz” de. Akış flowdraft
            hesabına kaydedilir; verdiği linke tıklayıp açar, istediğin gibi düzenlersin.
          </p>
          <div className="fd-guide-url">
            <span className="fd-field-label" id="fd-guide-url-label">
              Sunucu adresi — kurulumda bunu yapıştıracaksın
            </span>
            <CopyField value={url} labelId="fd-guide-url-label" />
          </div>
          <p className="fd-muted fd-small">
            Ücretsiz bir flowdraft hesabı gerekir. Yoksa <a href="/">uygulamayı aç</a> → Giriş yap → Kayıt ol.
          </p>
        </section>

        <ul className="fd-guide-features" aria-label="Neler yapabilir">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="fd-guide-feature-icon" aria-hidden>
                {f.icon}
              </span>
              <strong>{f.title}</strong>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>

        <section aria-labelledby="fd-guide-setup">
          <h2 id="fd-guide-setup">Kurulum</h2>
          <p>
            Hepsinde mantık aynı: adresi aracın bağlayıcı (connector) ayarına ekle, açılan flowdraft sayfasında hesabınla
            giriş yapıp <strong>İzin ver</strong>’e bas. Menü adları uygulama sürümüne göre biraz farklı olabilir.
          </p>
          <nav className="fd-guide-jump" aria-label="Araç seç">
            <a href="#claude">Claude</a>
            <a href="#chatgpt">ChatGPT</a>
            <a href="#claude-code">Claude Code</a>
            <a href="#cursor">Cursor</a>
            <a href="#vscode">VS Code</a>
            <a href="#diger">Diğer</a>
          </nav>

          <Client id="claude" name="Claude" note="Web, masaüstü ve mobil · ücretsiz planda 1 özel bağlayıcı">
            <Steps>
              <li>
                <a href="https://claude.ai" target="_blank" rel="noopener">
                  claude.ai
                </a>
                ’de <strong>Customize → Connectors</strong> sayfasını aç (Ayarlar → Bağlayıcılar).
              </li>
              <li>
                <strong>+</strong> → <strong>Add custom connector</strong>’a bas.
              </li>
              <li>
                Ad olarak <code>flowdraft</code> yaz, adrese <code>{url}</code> yapıştır, <strong>Add</strong>’e bas.
                “Advanced settings”e dokunma.
              </li>
              <li>
                <strong>Connect</strong>’e bas. Açılan flowdraft sayfasında giriş yap ve <strong>İzin ver</strong>’e bas.
              </li>
              <li>
                Sohbette sol alttaki <strong>+</strong> → <strong>Connectors</strong>’dan flowdraft’ı aç ve ne çizmek
                istediğini yaz.
              </li>
            </Steps>
          </Client>

          <Client id="chatgpt" name="ChatGPT" note="Web · Plus, Pro, Business, Enterprise, Edu">
            <Steps>
              <li>
                <strong>Ayarlar → Güvenlik ve giriş</strong>’te <strong>Geliştirici modu</strong>’nu (Developer mode) aç. Bazı
                hesaplarda bu anahtar <strong>Uygulamalar / Bağlayıcılar → Gelişmiş</strong> altındadır.
              </li>
              <li>
                <strong>Uygulamalar / Bağlayıcılar</strong> sayfasında <strong>Oluştur</strong>’a (Create) bas.
              </li>
              <li>
                Ad: <code>flowdraft</code>, MCP sunucu adresi: <code>{url}</code>, kimlik doğrulama:{' '}
                <strong>OAuth</strong>. Uygulamaya güvendiğini onaylayan kutuyu işaretleyip oluştur.
              </li>
              <li>Açılan flowdraft sayfasında giriş yap ve <strong>İzin ver</strong>’e bas.</li>
              <li>
                Yeni sohbette <strong>+</strong> → <strong>Geliştirici modu</strong> → flowdraft’ı seç. İsteğinde
                “flowdraft ile …” demen işini kolaylaştırır. Yazma işlemlerini ChatGPT senden onaylamanı ister.
              </li>
            </Steps>
          </Client>

          <Client id="claude-code" name="Claude Code" note="Terminal">
            <Steps>
              <li>Terminalde çalıştır:</li>
            </Steps>
            <CopyBlock label="Komutu" text={`claude mcp add --transport http flowdraft ${url}`} />
            <Steps>
              <li>
                Claude Code içinde <code>/mcp</code> yaz, <strong>flowdraft</strong>’ı seçip{' '}
                <strong>Authenticate</strong> de; tarayıcıda giriş yapıp izin ver.
              </li>
            </Steps>
          </Client>

          <Client id="cursor" name="Cursor">
            <Steps>
              <li>
                <code>~/.cursor/mcp.json</code> dosyasına ekle (dosya yoksa oluştur):
              </li>
            </Steps>
            <CopyBlock label="Cursor ayarını" text={JSON.stringify({ mcpServers: { flowdraft: { url } } }, null, 2)} />
            <Steps>
              <li>
                Cursor ayarlarındaki <strong>MCP</strong> bölümünde flowdraft’ın yanındaki giriş düğmesine bas; tarayıcıda
                giriş yapıp izin ver.
              </li>
            </Steps>
          </Client>

          <Client id="vscode" name="VS Code (Copilot)">
            <Steps>
              <li>
                Proje klasöründe <code>.vscode/mcp.json</code> dosyasına ekle (ya da komut paletinden{' '}
                <strong>MCP: Add Server</strong> → HTTP → adresi yapıştır):
              </li>
            </Steps>
            <CopyBlock
              label="VS Code ayarını"
              text={JSON.stringify({ servers: { flowdraft: { type: 'http', url } } }, null, 2)}
            />
            <Steps>
              <li>Sunucuyu başlatınca VS Code giriş ister; tarayıcıda giriş yapıp izin ver.</li>
            </Steps>
          </Client>

          <Client id="diger" name="Diğer araçlar">
            <p>
              Uzak MCP sunucusu (Streamable HTTP) ve OAuth destekleyen her araçla çalışır. Adres olarak{' '}
              <code>{url}</code> ver; istemci kimlik bilgisi (client ID/secret) gerekmez, araç kendini otomatik kaydeder.
            </p>
          </Client>
        </section>

        <section aria-labelledby="fd-guide-prompts">
          <h2 id="fd-guide-prompts">Örnek istekler</h2>
          <p>Bağlandıktan sonra sohbete şunlardan birini yazarak başlayabilirsin:</p>
          <div className="fd-guide-prompts">
            {PROMPTS.map((p) => (
              <CopyBlock key={p} label="İsteği" text={p} />
            ))}
          </div>
        </section>

        <section aria-labelledby="fd-guide-security">
          <h2 id="fd-guide-security">
            <ShieldCheck size={20} aria-hidden /> Güvenlik ve izinler
          </h2>
          <ul>
            <li>
              Bağladığın araç sadece <strong>senin</strong> akışlarını listeleyip okuyabilir, oluşturabilir, değiştirebilir
              ve silebilir. Başka kimsenin verisine erişemez.
            </li>
            <li>Şifreni görmez; giriş flowdraft’ın kendi sayfasında yapılır ve araç sadece bir erişim izni alır.</li>
            <li>
              Aracın gördüğü akış içerikleri, o aracın (OpenAI, Anthropic vb.) kendi gizlilik kurallarına tabidir. Ayrıntı:{' '}
              <a href={LEGAL_PATHS.privacy}>Gizlilik Politikası</a>.
            </li>
            <li>
              İzni istediğin an kaldırabilirsin: flowdraft → <strong>Dosya → AI araçlarına bağla</strong> →{' '}
              <strong>Erişimi kaldır</strong>.
            </li>
          </ul>
        </section>

        <section aria-labelledby="fd-guide-faq">
          <h2 id="fd-guide-faq">Sık sorulanlar</h2>
          <Faq q="Bağlanırken hata alıyorum.">
            Adresin tam olarak <code>{url}</code> olduğundan emin ol (sonunda boşluk ya da eğik çizgi olmasın). ChatGPT’de
            Geliştirici modu açık olmalı. Hata sürerse bağlayıcıyı silip yeniden ekle.
          </Faq>
          <Faq q="Yapay zekâ akışı oluşturdu ama göremiyorum.">
            Verdiği linke tıkla ya da flowdraft’ta <strong>Dosya → Projelerim</strong>’e bak. Bağlanırken hangi hesapla
            izin verdiysen flowdraft’ta da o hesapla giriş yapmış olmalısın.
          </Faq>
          <Faq q="flowdraft açıkken yapay zekâ akışı değiştirdi.">
            flowdraft sekmesine dönünce son hali kendiliğinden yüklenir. Sende kaydedilmemiş değişiklik varsa önce kaydet;
            aynı akışı iki taraf birden değiştirirse en son kaydedilen kalır.
          </Faq>
          <Faq q="Yanlış hesapla bağlandım.">
            flowdraft’ta o hesabın erişimini kaldır, yapay zekâ aracında bağlayıcıyı silip yeniden ekle; izin sayfasında{' '}
            <strong>Başka bir hesapla devam et</strong>’i seç.
          </Faq>
          <Faq q="Ücretli mi?">
            flowdraft ücretsiz. Özel bağlayıcı desteği yapay zekâ aracının planına bağlı: Claude’un ücretsiz planında bir
            özel bağlayıcı eklenebilir; ChatGPT’de Geliştirici modu ücretli planlarda (web) var.
          </Faq>
          <Faq q="Önemli akışlarım için ne önerirsin?">
            flowdraft ücretsizdir ve garanti verilmez. Önemli akışlarını <strong>Dışa aktar → JSON</strong> ile yedekle;
            yapay zekâya büyük değişiklik yaptırmadan önce de yedek almak iyi fikir.
          </Faq>
        </section>
      </main>
      <Credit />
      <Toasts />
    </div>
  );
}
