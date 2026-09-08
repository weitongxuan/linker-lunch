type Listener = (msg: string | null) => void;
let listener: Listener | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

/** 最新一則蓋掉前一則,2.2 秒後自動消失 —— 跟原本 toast() 的行為一樣。 */
export function toast(msg: string) {
  if (hideTimer) clearTimeout(hideTimer);
  listener?.(msg);
  hideTimer = setTimeout(() => listener?.(null), 2200);
}

export function subscribeToast(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
