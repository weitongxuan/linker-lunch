import type { Shop } from '@lunch-map/shared';

export function Banners({ shops }: { shops: Shop[] }) {
  if (shops.length > 0) return null;
  return (
    <div id="banners">
      <div className="banner err">
        <span className="bx">還沒有店家資料 —— 先執行 `npm run seed:dev -w apps/api` 從舊資料匯入,或用「匯入 OSM」抓取附近店家。</span>
      </div>
    </div>
  );
}
