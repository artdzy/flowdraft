import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { nativeApp, postNative, siteOrigin } from '../lib/platform';
import { toast } from '../store/ui';

/** Address users paste into their AI tool; opening it in a browser shows the setup guide instead. */
export const mcpUrl = () => `${siteOrigin}/mcp`;

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      if (nativeApp) postNative({ type: 'copy', text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast('Kopyalanamadı; seçip elle kopyala.', 'error');
    }
  };
  return { copied, copy };
}

export function CopyField({ value, labelId }: { value: string; labelId: string }) {
  const { copied, copy } = useCopy(value);
  return (
    <div className="fd-copy">
      <input readOnly value={value} aria-labelledby={labelId} onFocus={(e) => e.target.select()} />
      <button type="button" className="fd-btn" onClick={() => void copy()}>
        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Kopyalandı' : 'Kopyala'}
      </button>
    </div>
  );
}

/** Preformatted snippet (command, config, prompt) with its own copy button. */
export function CopyBlock({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopy(text);
  return (
    <div className="fd-copyblock">
      <pre>
        <code>{text}</code>
      </pre>
      <button type="button" className="fd-icon-btn" onClick={() => void copy()} aria-label={`${label} kopyala`} title="Kopyala">
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}
