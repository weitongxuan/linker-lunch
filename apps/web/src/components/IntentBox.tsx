import { useState } from 'react';
import { EXAMPLE_QUESTIONS, parseIntent } from '@lunch-map/shared';
import { useFilters } from '../state/FiltersContext.js';

interface Props {
  categories: string[];
}

/** 像 inline AI 的輸入框:輸入一句話,對到問題目錄就套篩選並抽一家;對不到就給例句點 */
export function IntentBox({ categories }: Props) {
  const { dispatch } = useFilters();
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<string[] | null>(null);

  const run = (raw: string) => {
    const r = parseIntent(raw, categories);
    if (r.kind === 'matched') {
      dispatch({ type: 'APPLY_INTENT', actions: r.actions, label: r.label });
      setSuggestions(null);
      setText('');
    } else {
      setSuggestions(r.suggestions);
    }
  };

  return (
    <span className="intent">
      <input
        className="intentInput"
        type="text"
        value={text}
        placeholder="💬 我今天不想吃便當…"
        onChange={(e) => setText(e.target.value)}
        onFocus={() => text === '' && setSuggestions(EXAMPLE_QUESTIONS)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') run(text);
          if (e.key === 'Escape') setSuggestions(null);
        }}
      />
      {suggestions && (
        <span className="intentChips" onMouseDown={(e) => e.preventDefault()}>
          {suggestions.map((q) => (
            <button key={q} className="chip" onClick={() => run(q)}>
              {q}
            </button>
          ))}
          <button className="btn ghost" onClick={() => setSuggestions(null)}>
            ×
          </button>
        </span>
      )}
    </span>
  );
}
