const KEY = 'lunchmap.dismissed';

/** 使用者關掉的橫幅 id,存在 localStorage,重新整理不會再跳出來。 */
export function getDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function persistDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage 不可用(無痕等)—— 這次 session 內仍會關掉,只是重整會回來
  }
}
