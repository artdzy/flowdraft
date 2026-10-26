import { LoaderCircle, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { t, UNTITLED } from '../i18n';
import { sketchToDoc } from '../flow/sketch';
import { confirmDiscard } from '../lib/actions';
import {
  initialSketchStatus,
  openDescribe,
  prepareSketch,
  SketchCancelled,
  sketchFromDescription,
  statusMessage,
} from '../lib/describe';
import type { SketchStatus } from '../lib/platform';
import { useEditor } from '../store/editor';
import { toast, useUi } from '../store/ui';
import { Modal } from './Modal';

/** Drawing from a description is offered only in the app, on systems with Apple Intelligence (src/lib/describe.ts). */
export const describeAvailable = initialSketchStatus() !== null;

const EXAMPLES = [
  {
    label: t('İade talebi', 'Refund request'),
    text: t(
      'Müşteri iade talebi gönderir. Destek ekibi talebi inceler; tutar 500 TL’yi aşıyorsa müdür onaylar. Sonra muhasebe ödemeyi yapar.',
      'A customer asks for a refund. Support reviews the request; if the amount is over $500 a manager approves it. Then finance pays it out.',
    ),
  },
  {
    label: t('Kod yayını', 'Code release'),
    text: t(
      'Geliştirici kodu gönderir ve testler çalışır. Testler geçerse ekip lideri kodu inceleyip onaylar ve kod canlıya alınır; geçmezse geliştirici düzeltir.',
      'A developer pushes code and the tests run. If they pass, the team lead reviews and approves it and it goes live; if not, the developer fixes it.',
    ),
  },
  {
    label: t('Üyelik', 'Sign-up'),
    text: t(
      'Kullanıcı kayıt olur ve doğrulama e-postası gider. Bağlantıya 24 saat içinde tıklarsa hesap açılır, tıklamazsa hesap silinir.',
      'A user signs up and gets a verification email. If they click the link within 24 hours the account is activated, otherwise it is deleted.',
    ),
  },
];

function DescribeForm({ onDone }: { onDone: () => void }) {
  const [status, setStatus] = useState<SketchStatus>(() => initialSketchStatus() ?? 'unavailable');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ steps: number; latest: string } | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  // The model may have finished downloading since the page loaded; loading it now saves time on Draw.
  useEffect(() => prepareSketch(setStatus), []);
  // Closing the dialog stops a drawing in progress.
  useEffect(() => () => abort.current?.abort(), []);

  const ready = status === 'available';

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const prompt = text.trim();
    if (!prompt || busy || !ready) return;
    if (!(await confirmDiscard())) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError('');
    setProgress(null);
    try {
      const sketch = await sketchFromDescription(prompt, (steps, latest) => setProgress({ steps, latest }), controller.signal);
      const doc = sketchToDoc(sketch);
      if (!doc.nodes.some((n) => n.type !== 'text')) {
        throw new Error(t('Bu açıklamadan akış çıkmadı. Adımları biraz daha anlat.', 'No flow came out of this. Describe the steps a bit more.'));
      }
      useEditor.getState().loadDoc(doc, { title: sketch.title?.trim() || UNTITLED, projectId: null, dirty: true });
      toast(t('Akış çizildi. İstediğin gibi düzenleyebilirsin.', 'Your flow is drawn. Edit anything you like.'));
      onDone();
    } catch (err) {
      if (!(err instanceof SketchCancelled)) setError(err instanceof Error ? err.message : String(err));
    } finally {
      abort.current = null;
      setBusy(false);
    }
  };

  return (
    <form className="fd-describe" onSubmit={submit}>
      <p className="fd-describe-lead">
        {t(
          'Süreçte ne olduğunu, kimin yaptığını ve nerede dallandığını yaz. Akışı Apple Intelligence bu cihazda çizer; yazdıkların hiçbir yere gönderilmez.',
          'Write what happens, who does it and where it branches. Apple Intelligence draws the flow on this device; your text isn’t sent anywhere.',
        )}
      </p>
      <div className="fd-describe-examples" role="group" aria-label={t('Örnekler', 'Examples')}>
        {EXAMPLES.map((example) => (
          <button key={example.label} type="button" className="fd-describe-example" disabled={busy} onClick={() => setText(example.text)}>
            {example.label}
          </button>
        ))}
      </div>
      <label className="fd-field">
        <span className="fd-field-label">{t('Süreç', 'Process')}</span>
        <textarea
          rows={5}
          maxLength={1000}
          value={text}
          disabled={busy}
          placeholder={t('Kim ne yapıyor, nerede karar veriliyor? Birkaç cümle yeter.', 'Who does what, and where is a decision made? A few sentences will do.')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
          }}
        />
      </label>
      {!ready && (
        <p className="fd-form-info" role="status">
          {statusMessage(status)}
        </p>
      )}
      {busy && (
        <p className="fd-describe-progress" role="status" aria-live="polite">
          <LoaderCircle size={15} className="fd-spin" aria-hidden />
          {progress?.steps
            ? t(`Çiziliyor… ${progress.steps}. adım: ${progress.latest}`, `Drawing… step ${progress.steps}: ${progress.latest}`)
            : t('Apple Intelligence süreci okuyor…', 'Apple Intelligence is reading the process…')}
        </p>
      )}
      {error && (
        <p className="fd-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="fd-describe-actions">
        {busy ? (
          <button type="button" className="fd-btn" onClick={() => abort.current?.abort()}>
            {t('Durdur', 'Stop')}
          </button>
        ) : (
          <button type="submit" className="fd-btn is-primary" disabled={!ready || !text.trim()}>
            <Sparkles size={16} aria-hidden /> {t('Akışı çiz', 'Draw the flow')}
          </button>
        )}
      </div>
    </form>
  );
}

export function DescribeDialog() {
  const open = useUi((s) => s.describeOpen);
  if (!describeAvailable) return null;
  const close = () => useUi.setState({ describeOpen: false });
  return (
    <Modal open={open} onClose={close} title={t('Anlat, çizelim', 'Describe it, we’ll draw it')} titleId="fd-describe-title">
      <DescribeForm onDone={close} />
    </Modal>
  );
}

/** The way in on the empty canvas and in the New flow dialog. */
export function DescribeButton() {
  if (!describeAvailable) return null;
  return (
    <button type="button" className="fd-describe-cta" onClick={openDescribe}>
      <span className="fd-template-icon">
        <Sparkles size={18} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="fd-describe-cta-text">
        <span className="fd-template-title">{t('Anlat, Apple Intelligence çizsin', 'Describe it, Apple Intelligence draws it')}</span>
        <span className="fd-template-desc">
          {t('Süreci kendi cümlelerinle yaz; akış bu cihazda saniyeler içinde çizilir.', 'Write the process in your own words; the flow is drawn on this device in seconds.')}
        </span>
      </span>
    </button>
  );
}
