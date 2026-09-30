import { useReactFlow, useViewport, ViewportPortal } from '@xyflow/react';
import { ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { FlowNode } from '../flow/types';
import { locale, t } from '../i18n';
import { dismissReview, useLive } from '../lib/live';
import type { ReviewItem, Severity } from '../lib/review';
import { useEditor } from '../store/editor';

const SEVERITY_LABEL: Record<Severity, string> = {
  problem: t('Sorun', 'Problem'),
  warning: t('Dikkat', 'Warning'),
  suggestion: t('Öneri', 'Suggestion'),
  praise: t('İyi', 'Good'),
};

const RANK: Record<Severity, number> = { problem: 0, warning: 1, suggestion: 2, praise: 3 };

const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });

function size(n: FlowNode) {
  return { w: n.measured?.width ?? n.width ?? 120, h: n.measured?.height ?? n.height ?? 40 };
}

/** Flow coordinates of the pin for a finding: a node's top-right corner, or the middle of an edge. */
function anchorOf(item: ReviewItem, nodes: Map<string, FlowNode>, edges: Map<string, { source: string; target: string }>) {
  if (item.node_id) {
    const n = nodes.get(item.node_id);
    if (!n) return null;
    return { key: `n:${n.id}`, x: n.position.x + size(n).w, y: n.position.y };
  }
  if (item.edge_id) {
    const e = edges.get(item.edge_id);
    const a = e && nodes.get(e.source);
    const b = e && nodes.get(e.target);
    if (!a || !b) return null;
    const sa = size(a);
    const sb = size(b);
    return {
      key: `e:${item.edge_id}`,
      x: (a.position.x + sa.w / 2 + b.position.x + sb.w / 2) / 2,
      y: (a.position.y + sa.h / 2 + b.position.y + sb.h / 2) / 2,
    };
  }
  return null;
}

function useFocusItem() {
  const rf = useReactFlow();
  return (index: number) => {
    const item = useLive.getState().review?.items[index];
    useLive.setState({ focus: index, collapsed: false });
    if (!item) return;
    const { edges, selectOnly } = useEditor.getState();
    let ids: string[] = [];
    if (item.node_id) {
      ids = [item.node_id];
      selectOnly(item.node_id);
    } else if (item.edge_id) {
      const e = edges.find((edge) => edge.id === item.edge_id);
      if (e) ids = [e.source, e.target];
    }
    if (ids.length) void rf.fitView({ nodes: ids.map((id) => ({ id })), duration: 400, maxZoom: 1.2, padding: 0.8 });
  };
}

/** Numbered markers next to the nodes and edges a review talks about. Rendered inside <ReactFlow>. */
export function ReviewPins() {
  const review = useLive((s) => s.review);
  const focus = useLive((s) => s.focus);
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const { zoom } = useViewport();
  const focusItem = useFocusItem();
  if (!review) return null;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edgeMap = new Map(edges.map((e) => [e.id, e]));
  const groups = new Map<string, { x: number; y: number; indexes: number[] }>();
  review.items.forEach((item, i) => {
    const anchor = anchorOf(item, nodeMap, edgeMap);
    if (!anchor) return;
    const group = groups.get(anchor.key) ?? { x: anchor.x, y: anchor.y, indexes: [] };
    group.indexes.push(i);
    groups.set(anchor.key, group);
  });
  // Pins keep a readable size when zoomed out and do not balloon when zoomed in.
  const scale = Math.min(2.5, Math.max(0.8, 1 / zoom));

  return (
    <ViewportPortal>
      {[...groups.entries()].map(([key, g]) => {
        const worst = g.indexes.map((i) => review.items[i].severity).sort((a, b) => RANK[a] - RANK[b])[0];
        const label = g.indexes.map((i) => i + 1).join(', ');
        return (
          <button
            key={key}
            type="button"
            className={`fd-review-pin nodrag nopan sev-${worst}${focus !== null && g.indexes.includes(focus) ? ' is-focus' : ''}`}
            style={{ transform: `translate(${g.x}px, ${g.y}px) translate(-50%, -50%) scale(${scale})` }}
            title={g.indexes.map((i) => review.items[i].title).join('\n')}
            aria-label={t(`AI kritiği, madde ${label}`, `AI review, item ${label}`)}
            onClick={() => focusItem(g.indexes[0])}
          >
            {label}
          </button>
        );
      })}
    </ViewportPortal>
  );
}

/** The latest AI review of the open flow, left by a connected AI tool with add_review. */
export function ReviewPanel() {
  const review = useLive((s) => s.review);
  const collapsed = useLive((s) => s.collapsed);
  const focus = useLive((s) => s.focus);
  const nodes = useEditor((s) => s.nodes);
  const focusItem = useFocusItem();
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (focus === null) return;
    list.current?.children[focus]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focus]);

  if (!review) return null;
  const present = new Set(nodes.map((n) => n.id));
  const counts = review.items.reduce<Partial<Record<Severity, number>>>((acc, item) => {
    acc[item.severity] = (acc[item.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className={`fd-review${collapsed ? ' is-collapsed' : ''}`} aria-labelledby="fd-review-title">
      <header className="fd-review-head">
        <Sparkles size={15} className="fd-review-icon" aria-hidden />
        <h2 id="fd-review-title">{t('AI kritiği', 'AI review')}</h2>
        <span className="fd-review-time">{timeFmt.format(new Date(review.created_at))}</span>
        <span className="fd-review-counts" aria-hidden>
          {(Object.keys(RANK) as Severity[])
            .filter((sev) => counts[sev])
            .map((sev) => (
              <span key={sev} className={`fd-review-count sev-${sev}`} title={SEVERITY_LABEL[sev]}>
                {counts[sev]}
              </span>
            ))}
        </span>
        <button
          type="button"
          className="fd-icon-btn"
          onClick={() => useLive.setState({ collapsed: !collapsed })}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('Kritiği aç', 'Expand review') : t('Kritiği küçült', 'Collapse review')}
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
        <button type="button" className="fd-icon-btn" onClick={() => void dismissReview()} aria-label={t('Kritiği kapat', 'Close review')}>
          <X size={16} />
        </button>
      </header>
      {!collapsed && (
        <div className="fd-review-body">
          {review.summary && <p className="fd-review-summary">{review.summary}</p>}
          {review.items.length > 0 && (
            <ol className="fd-review-items" ref={list}>
              {review.items.map((item, i) => {
                const gone = !!item.node_id && !present.has(item.node_id);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className={`fd-review-item sev-${item.severity}${focus === i ? ' is-focus' : ''}`}
                      onClick={() => focusItem(i)}
                    >
                      <span className="fd-review-num">{i + 1}</span>
                      <span className="fd-review-main">
                        <span className="fd-review-item-title">
                          <span className="fd-review-sev">{SEVERITY_LABEL[item.severity]}</span> {item.title}
                        </span>
                        {item.text && <span className="fd-review-text">{item.text}</span>}
                        {gone && <span className="fd-review-gone">{t('Bu parça artık akışta yok.', 'This part is no longer in the flow.')}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
