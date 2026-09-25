import { ArrowLeft, FolderOpen, Link2, PenLine, ShieldCheck, Workflow } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Credit } from '../components/Credit';
import { CopyBlock, CopyField, mcpUrl } from '../components/Copy';
import { Toasts } from '../components/Dialogs';
import { Logo } from '../components/TopBar';
import { lang, t } from '../i18n';
import { LEGAL_PATHS } from '../legal/LegalPage';

/** Public setup guide. Served at the MCP address itself when opened in a browser (see server/mcp.ts). */
export const GUIDE_PATH = '/mcp';

export function isGuidePath(pathname: string) {
  return pathname.replace(/\/+$/, '') === GUIDE_PATH;
}

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <Workflow size={18} />,
    title: t('Akış çizer', 'Draws flows'),
    text: t(
      'Anlattığın süreci kulvarlı, karar dallı bir akışa çevirir.',
      'Turns the process you describe into a flow with lanes and decision branches.',
    ),
  },
  {
    icon: <PenLine size={18} />,
    title: t('Düzenler', 'Edits'),
    text: t(
      'Mevcut akışına adım, dal ya da not ekler; yeniden düzenler.',
      'Adds steps, branches or notes to your existing flows and rearranges them.',
    ),
  },
  {
    icon: <FolderOpen size={18} />,
    title: t('Okur', 'Reads'),
    text: t(
      'Kayıtlı akışlarını bulur, özetler, üzerine konuşur.',
      'Finds your saved flows, summarizes them and talks them through with you.',
    ),
  },
  {
    icon: <Link2 size={18} />,
    title: t('Link verir', 'Links back'),
    text: t(
      'Her işin sonunda akışı flowdraft’ta açan bir bağlantı verir.',
      'Ends every task with a link that opens the flow in flowdraft.',
    ),
  },
];

const PROMPTS = [
  t(
    'flowdraft ile müşteri iade sürecini çiz: müşteri, destek ekibi ve depo için ayrı kulvarlar olsun.',
    'Use flowdraft to draw our customer return process, with separate lanes for the customer, the support team and the warehouse.',
  ),
  t(
    'flowdraft’taki “Sipariş akışı”nı aç ve ödeme reddedilirse ne olacağını gösteren bir dal ekle.',
    'Open “Order flow” in flowdraft and add a branch showing what happens if the payment is declined.',
  ),
  t(
    'Bu README’deki kurulum adımlarını flowdraft’ta yukarıdan aşağı bir akış olarak çiz.',
    'Draw the setup steps in this README as a top-to-bottom flow in flowdraft.',
  ),
  t(
    'flowdraft’taki akışlarımı listele ve en son düzenlediğimi özetle.',
    'List my flows in flowdraft and summarize the one I edited most recently.',
  ),
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
    document.title = t('Yapay zekâ ile kullan (MCP) · flowdraft', 'Use with AI (MCP) · flowdraft');
  }, []);

  return (
    <div className="fd-legal-page">
      <header className="fd-legal-head">
        <a href="/" className="fd-oauth-home" aria-label={t('flowdraft ana sayfa', 'flowdraft home')}>
          <Logo />
        </a>
        <a href="/" className="fd-btn is-ghost">
          <ArrowLeft size={16} /> {t('Uygulamayı aç', 'Open the app')}
        </a>
      </header>

      <main className="fd-guide">
        <section className="fd-guide-hero" aria-labelledby="fd-guide-title">
          <p className="fd-guide-kicker">{t('MCP · YAPAY ZEKÂ BAĞLANTISI', 'MCP · AI CONNECTION')}</p>
          <h1 id="fd-guide-title">
            {t('flowdraft’ı yapay zekâ asistanına bağla', 'Connect flowdraft to your AI assistant')}
          </h1>
          <p className="fd-guide-lead">
            {t(
              'ChatGPT, Claude ya da MCP destekleyen başka bir araçta “bana şu süreci akış olarak çiz” de. Akış flowdraft hesabına kaydedilir; verdiği linke tıklayıp açar, istediğin gibi düzenlersin.',
              'In ChatGPT, Claude or any other tool that supports MCP, just say “draw this process as a flow.” The flow is saved to your flowdraft account; click the link it gives you to open it and edit it however you like.',
            )}
          </p>
          <div className="fd-guide-url">
            <span className="fd-field-label" id="fd-guide-url-label">
              {t('Sunucu adresi — kurulumda bunu yapıştıracaksın', 'Server URL — you’ll paste this during setup')}
            </span>
            <CopyField value={url} labelId="fd-guide-url-label" />
          </div>
          <p className="fd-muted fd-small">
            {lang === 'tr' ? (
              <>
                Ücretsiz bir flowdraft hesabı gerekir. Yoksa <a href="/">uygulamayı aç</a> → Giriş yap → Kayıt ol.
              </>
            ) : (
              <>
                You need a free flowdraft account. Don’t have one? <a href="/">Open the app</a> → Sign in → Sign up.
              </>
            )}
          </p>
        </section>

        <ul className="fd-guide-features" aria-label={t('Neler yapabilir', 'What it can do')}>
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
          <h2 id="fd-guide-setup">{t('Kurulum', 'Setup')}</h2>
          <p>
            {lang === 'tr' ? (
              <>
                Hepsinde mantık aynı: adresi aracın bağlayıcı (connector) ayarına ekle, açılan flowdraft sayfasında
                hesabınla giriş yapıp <strong>İzin ver</strong>’e bas. Menü adları uygulama sürümüne göre biraz farklı
                olabilir.
              </>
            ) : (
              <>
                It works the same way everywhere: add the URL to the tool’s connector settings, then sign in with your
                account on the flowdraft page that opens and click <strong>Allow</strong>. Menu names may differ
                slightly depending on the app version.
              </>
            )}
          </p>
          <nav className="fd-guide-jump" aria-label={t('Araç seç', 'Choose a tool')}>
            <a href="#claude">Claude</a>
            <a href="#chatgpt">ChatGPT</a>
            <a href="#claude-code">Claude Code</a>
            <a href="#cursor">Cursor</a>
            <a href="#vscode">VS Code</a>
            <a href="#diger">{t('Diğer', 'Other')}</a>
          </nav>

          <Client
            id="claude"
            name="Claude"
            note={t(
              'Web, masaüstü ve mobil · ücretsiz planda 1 özel bağlayıcı',
              'Web, desktop and mobile · 1 custom connector on the free plan',
            )}
          >
            {lang === 'tr' ? (
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
                  <strong>Connect</strong>’e bas. Açılan flowdraft sayfasında giriş yap ve <strong>İzin ver</strong>’e
                  bas.
                </li>
                <li>
                  Sohbette sol alttaki <strong>+</strong> → <strong>Connectors</strong>’dan flowdraft’ı aç ve ne çizmek
                  istediğini yaz.
                </li>
              </Steps>
            ) : (
              <Steps>
                <li>
                  On{' '}
                  <a href="https://claude.ai" target="_blank" rel="noopener">
                    claude.ai
                  </a>
                  , open <strong>Customize → Connectors</strong> (or Settings → Connectors).
                </li>
                <li>
                  Click <strong>+</strong> → <strong>Add custom connector</strong>.
                </li>
                <li>
                  Enter <code>flowdraft</code> as the name, paste <code>{url}</code> as the URL and click{' '}
                  <strong>Add</strong>. Leave “Advanced settings” as is.
                </li>
                <li>
                  Click <strong>Connect</strong>. On the flowdraft page that opens, sign in and click{' '}
                  <strong>Allow</strong>.
                </li>
                <li>
                  In a chat, turn on flowdraft from <strong>+</strong> → <strong>Connectors</strong> at the bottom left,
                  then describe what you want to draw.
                </li>
              </Steps>
            )}
          </Client>

          <Client id="chatgpt" name="ChatGPT" note="Web · Plus, Pro, Business, Enterprise, Edu">
            {lang === 'tr' ? (
              <Steps>
                <li>
                  <strong>Ayarlar → Güvenlik ve giriş</strong>’te <strong>Geliştirici modu</strong>’nu (Developer mode)
                  aç. Bazı hesaplarda bu anahtar <strong>Uygulamalar / Bağlayıcılar → Gelişmiş</strong> altındadır.
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
            ) : (
              <Steps>
                <li>
                  In <strong>Settings → Security and login</strong>, turn on <strong>Developer mode</strong>. On some
                  accounts this toggle is under <strong>Apps &amp; Connectors → Advanced settings</strong>.
                </li>
                <li>
                  On the <strong>Apps &amp; Connectors</strong> page, click <strong>Create</strong>.
                </li>
                <li>
                  Name: <code>flowdraft</code>, MCP server URL: <code>{url}</code>, authentication:{' '}
                  <strong>OAuth</strong>. Check the box confirming you trust the app, then create it.
                </li>
                <li>
                  On the flowdraft page that opens, sign in and click <strong>Allow</strong>.
                </li>
                <li>
                  In a new chat, choose <strong>+</strong> → <strong>Developer mode</strong> → flowdraft. Starting your
                  request with “use flowdraft to …” makes things easier. ChatGPT will ask you to confirm any write
                  actions.
                </li>
              </Steps>
            )}
          </Client>

          <Client id="claude-code" name="Claude Code" note="Terminal">
            <Steps>
              <li>{t('Terminalde çalıştır:', 'Run this in your terminal:')}</li>
            </Steps>
            <CopyBlock label={t('Komutu', 'command')} text={`claude mcp add --transport http flowdraft ${url}`} />
            <Steps>
              {lang === 'tr' ? (
                <li>
                  Claude Code içinde <code>/mcp</code> yaz, <strong>flowdraft</strong>’ı seçip{' '}
                  <strong>Authenticate</strong> de; tarayıcıda giriş yapıp izin ver.
                </li>
              ) : (
                <li>
                  In Claude Code, type <code>/mcp</code>, select <strong>flowdraft</strong> and choose{' '}
                  <strong>Authenticate</strong>; sign in in your browser and allow access.
                </li>
              )}
            </Steps>
          </Client>

          <Client id="cursor" name="Cursor">
            <Steps>
              {lang === 'tr' ? (
                <li>
                  <code>~/.cursor/mcp.json</code> dosyasına ekle (dosya yoksa oluştur):
                </li>
              ) : (
                <li>
                  Add this to <code>~/.cursor/mcp.json</code> (create the file if it doesn’t exist):
                </li>
              )}
            </Steps>
            <CopyBlock
              label={t('Cursor ayarını', 'Cursor config')}
              text={JSON.stringify({ mcpServers: { flowdraft: { url } } }, null, 2)}
            />
            <Steps>
              {lang === 'tr' ? (
                <li>
                  Cursor ayarlarındaki <strong>MCP</strong> bölümünde flowdraft’ın yanındaki giriş düğmesine bas;
                  tarayıcıda giriş yapıp izin ver.
                </li>
              ) : (
                <li>
                  In the <strong>MCP</strong> section of Cursor’s settings, click the sign-in button next to flowdraft;
                  sign in in your browser and allow access.
                </li>
              )}
            </Steps>
          </Client>

          <Client id="vscode" name="VS Code (Copilot)">
            <Steps>
              {lang === 'tr' ? (
                <li>
                  Proje klasöründe <code>.vscode/mcp.json</code> dosyasına ekle (ya da komut paletinden{' '}
                  <strong>MCP: Add Server</strong> → HTTP → adresi yapıştır):
                </li>
              ) : (
                <li>
                  Add this to <code>.vscode/mcp.json</code> in your project folder (or run{' '}
                  <strong>MCP: Add Server</strong> → HTTP from the Command Palette and paste the URL):
                </li>
              )}
            </Steps>
            <CopyBlock
              label={t('VS Code ayarını', 'VS Code config')}
              text={JSON.stringify({ servers: { flowdraft: { type: 'http', url } } }, null, 2)}
            />
            <Steps>
              <li>
                {t(
                  'Sunucuyu başlatınca VS Code giriş ister; tarayıcıda giriş yapıp izin ver.',
                  'When you start the server, VS Code asks you to sign in; sign in in your browser and allow access.',
                )}
              </li>
            </Steps>
          </Client>

          <Client id="diger" name={t('Diğer araçlar', 'Other tools')}>
            {lang === 'tr' ? (
              <p>
                Uzak MCP sunucusu (Streamable HTTP) ve OAuth destekleyen her araçla çalışır. Adres olarak{' '}
                <code>{url}</code> ver; istemci kimlik bilgisi (client ID/secret) gerekmez, araç kendini otomatik
                kaydeder.
              </p>
            ) : (
              <p>
                Works with any tool that supports remote MCP servers (Streamable HTTP) and OAuth. Use{' '}
                <code>{url}</code> as the URL; no client credentials (client ID/secret) are needed, because the tool
                registers itself automatically.
              </p>
            )}
          </Client>
        </section>

        <section aria-labelledby="fd-guide-prompts">
          <h2 id="fd-guide-prompts">{t('Örnek istekler', 'Example prompts')}</h2>
          <p>
            {t(
              'Bağlandıktan sonra sohbete şunlardan birini yazarak başlayabilirsin:',
              'Once you’re connected, try starting a chat with one of these:',
            )}
          </p>
          <div className="fd-guide-prompts">
            {PROMPTS.map((p) => (
              <CopyBlock key={p} label={t('İsteği', 'prompt')} text={p} />
            ))}
          </div>
        </section>

        <section aria-labelledby="fd-guide-security">
          <h2 id="fd-guide-security">
            <ShieldCheck size={20} aria-hidden /> {t('Güvenlik ve izinler', 'Security and permissions')}
          </h2>
          {lang === 'tr' ? (
            <ul>
              <li>
                Bağladığın araç sadece <strong>senin</strong> akışlarını listeleyip okuyabilir, oluşturabilir,
                değiştirebilir ve silebilir. Başka kimsenin verisine erişemez.
              </li>
              <li>Şifreni görmez; giriş flowdraft’ın kendi sayfasında yapılır ve araç sadece bir erişim izni alır.</li>
              <li>
                Aracın gördüğü akış içerikleri, o aracın (OpenAI, Anthropic vb.) kendi gizlilik kurallarına tabidir.
                Ayrıntı: <a href={LEGAL_PATHS.privacy}>Gizlilik Politikası</a>.
              </li>
              <li>
                İzni istediğin an kaldırabilirsin: flowdraft → <strong>Dosya → AI araçlarına bağla</strong> →{' '}
                <strong>Erişimi kaldır</strong>.
              </li>
            </ul>
          ) : (
            <ul>
              <li>
                The tool you connect can only list, read, create, change and delete <strong>your</strong> flows. It
                can’t access anyone else’s data.
              </li>
              <li>
                It never sees your password: you sign in on flowdraft’s own page, and the tool only receives an access
                grant.
              </li>
              <li>
                Flow content the tool sees is subject to that tool’s own privacy terms (OpenAI, Anthropic, etc.).
                Details: <a href={LEGAL_PATHS.privacy}>Privacy Policy</a>.
              </li>
              <li>
                You can revoke access at any time: flowdraft → <strong>File → Connect AI tools</strong> →{' '}
                <strong>Remove access</strong>.
              </li>
            </ul>
          )}
        </section>

        <section aria-labelledby="fd-guide-faq">
          <h2 id="fd-guide-faq">{t('Sık sorulanlar', 'FAQ')}</h2>
          <Faq q={t('Bağlanırken hata alıyorum.', 'I get an error when connecting.')}>
            {lang === 'tr' ? (
              <>
                Adresin tam olarak <code>{url}</code> olduğundan emin ol (sonunda boşluk ya da eğik çizgi olmasın).
                ChatGPT’de Geliştirici modu açık olmalı. Hata sürerse bağlayıcıyı silip yeniden ekle.
              </>
            ) : (
              <>
                Make sure the URL is exactly <code>{url}</code> (no trailing space or slash). In ChatGPT, Developer mode
                must be on. If the error persists, delete the connector and add it again.
              </>
            )}
          </Faq>
          <Faq q={t('Yapay zekâ akışı oluşturdu ama göremiyorum.', 'The AI created a flow but I can’t see it.')}>
            {lang === 'tr' ? (
              <>
                Verdiği linke tıkla ya da flowdraft’ta <strong>Dosya → Projelerim</strong>’e bak. Bağlanırken hangi
                hesapla izin verdiysen flowdraft’ta da o hesapla giriş yapmış olmalısın.
              </>
            ) : (
              <>
                Click the link it gave you, or check <strong>File → My projects</strong> in flowdraft. Make sure you’re
                signed in to flowdraft with the same account you allowed access from when connecting.
              </>
            )}
          </Faq>
          <Faq
            q={t(
              'flowdraft açıkken yapay zekâ akışı değiştirdi.',
              'The AI changed a flow while I had flowdraft open.',
            )}
          >
            {t(
              'flowdraft sekmesine dönünce son hali kendiliğinden yüklenir. Sende kaydedilmemiş değişiklik varsa önce kaydet; aynı akışı iki taraf birden değiştirirse en son kaydedilen kalır.',
              'When you switch back to the flowdraft tab, the latest version loads automatically. If you have unsaved changes, save them first; if both sides change the same flow, the last save wins.',
            )}
          </Faq>
          <Faq q={t('Yanlış hesapla bağlandım.', 'I connected with the wrong account.')}>
            {lang === 'tr' ? (
              <>
                flowdraft’ta o hesabın erişimini kaldır, yapay zekâ aracında bağlayıcıyı silip yeniden ekle; izin
                sayfasında <strong>Başka bir hesapla devam et</strong>’i seç.
              </>
            ) : (
              <>
                Remove that account’s access in flowdraft, then delete and re-add the connector in your AI tool. On the
                permission page, choose <strong>Continue with a different account</strong>.
              </>
            )}
          </Faq>
          <Faq q={t('Ücretli mi?', 'Does it cost anything?')}>
            {t(
              'flowdraft ücretsiz. Özel bağlayıcı desteği yapay zekâ aracının planına bağlı: Claude’un ücretsiz planında bir özel bağlayıcı eklenebilir; ChatGPT’de Geliştirici modu ücretli planlarda (web) var.',
              'flowdraft is free. Custom connector support depends on your AI tool’s plan: Claude’s free plan allows one custom connector, and ChatGPT’s Developer mode is available on paid plans (web).',
            )}
          </Faq>
          <Faq q={t('Önemli akışlarım için ne önerirsin?', 'Any tips for important flows?')}>
            {lang === 'tr' ? (
              <>
                flowdraft ücretsizdir ve garanti verilmez. Önemli akışlarını <strong>Dışa aktar → JSON</strong> ile
                yedekle; yapay zekâya büyük değişiklik yaptırmadan önce de yedek almak iyi fikir.
              </>
            ) : (
              <>
                flowdraft is free and comes with no guarantees. Back up important flows with{' '}
                <strong>Export → JSON</strong>, and it’s a good idea to make a backup before asking the AI for big
                changes, too.
              </>
            )}
          </Faq>
        </section>
      </main>
      <Credit />
      <Toasts />
    </div>
  );
}
