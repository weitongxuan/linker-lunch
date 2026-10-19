import { useMemo, useState } from 'react';
import { parseMenu, splitMenuItem } from '@lunch-map/shared';

/**
 * 平常顯示整理好的唯讀菜單;按「編輯」才出現輸入框,按「儲存」才送出。
 * 草稿只在編輯中存在:菜單還沒載入、或別人剛改過時,不會拿舊內容/空字串蓋回去。
 */
export function MenuBlock({ menuText, onSave, saving }: { menuText: string; onSave: (text: string) => void; saving: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const sections = useMemo(() => parseMenu(menuText), [menuText]);

  if (draft !== null) {
    return (
      <div className="menublock">
        <textarea
          className="menuedit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={'一行一項,例如:排骨飯 90\n【分類】開頭的行是標題'}
          autoFocus
        />
        <div className="crow">
          <button
            className="btn pri"
            disabled={saving}
            onClick={() => {
              if (draft.trim() !== menuText.trim()) onSave(draft.trim());
              setDraft(null);
            }}
          >
            儲存菜單
          </button>
          <button className="btn ghost" onClick={() => setDraft(null)}>
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="menublock">
      <div className="menuhead">
        <span className="lbl">菜單</span>
        <button className="btn ghost" onClick={() => setDraft(menuText)}>
          ✏️ {menuText ? '編輯' : '新增菜單'}
        </button>
      </div>
      {sections.length === 0 && <div className="dmeta">還沒有菜單,拍一張或打字新增</div>}
      {sections.map((s, i) => (
        <div key={i} className="menusec">
          {s.title && <div className="menutitle">{s.title}</div>}
          {s.items.map((it, j) => {
            const { name, price } = splitMenuItem(it);
            return (
              <div key={j} className="menuitem">
                <span>{name}</span>
                {price && <span className="menuprice">{price}</span>}
              </div>
            );
          })}
          {s.notes.map((n, j) => (
            <div key={`n${j}`} className="menunote">
              {n}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
