import type { Shop } from '@lunch-map/shared';
import { useFilters } from '../state/FiltersContext.js';

function Banner({ id, className, children }: { id: string; className: string; children: React.ReactNode }) {
  const { dispatch } = useFilters();
  return (
    <div className={`banner ${className}`}>
      <span className="bx">{children}</span>
      <button className="bclose" onClick={() => dispatch({ type: 'DISMISS_BANNER', id })}>
        ×
      </button>
    </div>
  );
}

export function Banners({ shops }: { shops: Shop[] }) {
  const { state } = useFilters();
  const unknownCount = shops.filter((s) => s.hoursUnknown).length;

  return (
    <div id="banners">
      {shops.length === 0 && (
        <div className="banner err">
          <span className="bx">還沒有店家資料 —— 先執行 `npm run seed` 從舊資料匯入,或用「匯入 OSM」抓取附近店家。</span>
        </div>
      )}
      {unknownCount > 0 && !state.dismissed.has('unknown') && (
        <Banner id="unknown" className="sample">
          {unknownCount} 家店的營業時間還不確定 —— 這些店不會被當成「吃得到」,也不會被隨機抽中,除非在篩選裡打開「時間未知的也列出」。
        </Banner>
      )}
    </div>
  );
}
