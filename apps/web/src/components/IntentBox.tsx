import { useEffect, useRef, useState } from 'react';
import { EXAMPLE_QUESTIONS, parseIntent } from '@lunch-map/shared';
import { useFilters } from '../state/FiltersContext.js';

interface Props {
  categories: string[];
}

/**
 * 「隨機推薦」旁的小視窗:就一個輸入框。
 * 一句話對到問題目錄就套篩選並抽一家(結果在推薦卡),對不到就把例句寫回 placeholder。
 */
export function IntentBox({ categories }: Props) {
  const { dispatch } = useFilters();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [placeholder, setPlaceholder] = useState(`例如:${EXAMPLE_QUESTIONS[0]}`);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // 手機版面板是 fixed,頂端要貼著按鈕底緣,否則會蓋到工具列別的按鈕
    const bottom = wrapRef.current?.getBoundingClientRect().bottom ?? 0;
    panelRef.current?.style.setProperty('--intent-top', `${Math.round(bottom + 8)}px`);
    inputRef.current?.focus();
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
  }, [open]);

  const run = () => {
    const r = parseIntent(text, categories);
    if (r.kind === 'matched') {
      dispatch({ type: 'APPLY_INTENT', actions: r.actions, label: r.label, reply: r.reply });
      setText('');
      setPlaceholder(`例如:${EXAMPLE_QUESTIONS[0]}`);
      setOpen(false);
      return;
    }
    // 聽不懂:換一句例句放回 placeholder,不另開提示元素
    const next = r.suggestions[Math.floor(Math.random() * r.suggestions.length)];
    setText('');
    setPlaceholder(`${r.reply}${next}`);
  };

  return (
    <span className="intentWrap" ref={wrapRef}>
      <button className={`btn${open ? ' pri' : ''}`} title="用一句話說今天想怎麼吃" onClick={() => setOpen((v) => !v)}>
        💬 問問看
      </button>
      {open && (
        <div ref={panelRef} className="intentPanel" role="dialog" aria-label="今天想怎麼吃">
          <input
            ref={inputRef}
            className="intentInput"
            type="text"
            value={text}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run();
            }}
          />
        </div>
      )}
    </span>
  );
}
