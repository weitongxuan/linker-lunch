import { useEffect, useRef, useState } from 'react';
import { EXAMPLE_QUESTIONS, parseIntent } from '@lunch-map/shared';
import type { IntentCandidate } from '@lunch-map/shared';
import { useFilters } from '../state/filtersStore.js';

interface Props {
  categories: string[];
}

type Step =
  | { kind: 'input' }
  | { kind: 'clarify'; asked: string; candidates: IntentCandidate[] }
  | { kind: 'pickCat'; asked: string };

/**
 * 「隨機推薦」旁的小視窗。平常只有一個輸入框;聽不懂時反問並給幾個選項,
 * 「不想吃某一類…」再列類別,「其他」回到輸入框重新偵測。
 */
export function IntentBox({ categories }: Props) {
  const { dispatch } = useFilters();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'input' });
  const wrapRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const bottom = wrapRef.current?.getBoundingClientRect().bottom ?? 0;
    panelRef.current?.style.setProperty('--intent-top', `${Math.round(bottom + 8)}px`);
    if (step.kind === 'input') inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, step.kind]);

  const apply = (label: string, reply: string, actions: IntentCandidate['actions']) => {
    dispatch({ type: 'APPLY_INTENT', actions, label, reply });
    setText('');
    setStep({ kind: 'input' });
    setOpen(false);
  };

  const run = () => {
    const raw = text.trim();
    if (!raw) return;
    const r = parseIntent(raw, categories);
    if (r.kind === 'matched') apply(r.label, r.reply, r.actions);
    else setStep({ kind: 'clarify', asked: raw, candidates: r.candidates });
  };

  const backToInput = () => {
    setText('');
    setStep({ kind: 'input' });
  };

  return (
    <span className="intentWrap" ref={wrapRef}>
      <button className={`btn${open ? ' pri' : ''}`} title="用一句話說今天想怎麼吃" onClick={() => setOpen((v) => !v)}>
        💬 問問看
      </button>
      {open && (
        <div ref={panelRef} className="intentPanel" role="dialog" aria-label="今天想怎麼吃">
          {step.kind === 'input' && (
            <input
              ref={inputRef}
              className="intentInput"
              type="text"
              value={text}
              placeholder={`例如:${EXAMPLE_QUESTIONS[0]}`}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') run();
              }}
            />
          )}

          {step.kind === 'clarify' && (
            <>
              <div className="intentAsk">「{step.asked}」我不太懂,你是想…?</div>
              <div className="intentOpts">
                {step.candidates.map((c) => (
                  <button key={c.id} className="chip" onClick={() => apply(c.label, c.reply, c.actions)}>
                    {c.question}
                  </button>
                ))}
                <button className="chip" onClick={() => setStep({ kind: 'pickCat', asked: step.asked })}>
                  不想吃某一類…
                </button>
                <button className="chip ghost" onClick={backToInput}>
                  其他,我再說一次
                </button>
              </div>
            </>
          )}

          {step.kind === 'pickCat' && (
            <>
              <div className="intentAsk">不想吃哪一類?</div>
              <div className="intentOpts">
                {categories.map((c) => (
                  <button
                    key={c}
                    className="chip"
                    onClick={() => apply(`不吃${c}`, `好,今天避開${c}。這家如何:{shop}?`, { excludeCat: [c] })}
                  >
                    {c}
                  </button>
                ))}
                <button className="chip ghost" onClick={backToInput}>
                  其他,我再說一次
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </span>
  );
}
