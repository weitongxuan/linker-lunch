/**
 * 原創徽章:羅盤環 + 刀叉指針,取「出門找飯吃」的意思。
 * 純手繪路徑,沒有引用任何第三方素材。currentColor 讓它跟著文字顏色走。
 */
export function Emblem({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="emblem"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* 外環 + 內環,像證件上的鋼印 */}
      <circle cx="16" cy="16" r="14" opacity=".45" />
      <circle cx="16" cy="16" r="10.5" />
      {/* 四個方位刻度 */}
      <path d="M16 1.6v3.2M16 27.2v3.2M1.6 16h3.2M27.2 16h3.2" opacity=".65" />
      {/* 中央的叉子(左)與刀(右) */}
      <path d="M12.4 10.2v3.1a1.5 1.5 0 0 0 3 0v-3.1M13.9 14.8v6.9" />
      <path d="M19.2 10.2c1.5 1.1 1.9 3 1.1 4.6h-2.2c-.8-1.6-.4-3.5 1.1-4.6zM19.2 14.8v6.9" />
    </svg>
  );
}
