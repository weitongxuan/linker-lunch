import { useMemo, useState } from 'react';
import { currentMood, nowMin, randomPick, toMin, todayKey } from '@lunch-map/shared';
import { useLunchData } from './hooks/useLunchData.js';
import { useComputedRows, useVisibleRows } from './hooks/useComputedRows.js';
import { useFilters } from './state/FiltersContext.js';
import { Header } from './components/Header.js';
import { Toolbar } from './components/Toolbar.js';
import { FilterDrawer } from './components/FilterDrawer.js';
import { Banners } from './components/Banners.js';
import { PickCard } from './components/PickCard.js';
import { ShopList } from './components/ShopList.js';
import { AfterSection } from './components/AfterSection.js';
import { AddShopModal } from './components/AddShopModal.js';
import { Toast } from './components/Toast.js';
import { toast } from './lib/toast.js';

export function App() {
  const data = useLunchData();
  const { state, dispatch } = useFilters();
  const [addShopOpen, setAddShopOpen] = useState(false);

  const allRows = useComputedRows({
    config: data.config,
    shops: data.shops,
    parkings: data.parkings,
    ratings: data.shopRatings,
    votes: data.votes,
  });
  const visibleRows = useVisibleRows(allRows);

  const windowStart = useMemo(() => {
    if (!data.config) return 0;
    const isToday = state.day === todayKey();
    if (state.useNow && isToday) return nowMin();
    return toMin(data.config.depart.start);
  }, [data.config, state.day, state.useNow]);

  const nowMinute = nowMin();

  const handleRandomPick = () => {
    const pool = visibleRows.filter((r) => r.feasible);
    const mood = currentMood(state.mood, data.market);
    const result = randomPick(pool, mood);
    if (result.empty) {
      dispatch({ type: 'SET_PICK_EMPTY' });
    } else {
      dispatch({
        type: 'SET_PICK',
        shopId: result.row.sh.id,
        weights: result.weights.map((w) => ({ shopId: w.r.sh.id, w: w.w })),
        total: result.total,
      });
    }
  };

  const handleCopyList = () => {
    const feasible = visibleRows.filter((r) => r.feasible);
    const lines = feasible.map((r, i) => {
      const travel = r.by === 'walk' ? `走路 ${r.t.walk} 分` : r.by === 'drive' ? `開車 ${r.t.drive} 分` : '';
      const scoreTxt = r.sc.n ? `★${r.sc.avg.toFixed(1)} (${r.sc.n}人)` : '尚無評分';
      return `${i + 1}. ${r.sh.name} — ${travel} / ${r.sh.category} / ${scoreTxt}`;
    });
    const header = data.config ? `${state.day} · ${data.config.depart.start} 出門\n` : '';
    const text = header + lines.join('\n') + '\n\n投票請回覆編號';
    navigator.clipboard?.writeText(text).then(
      () => toast('已複製候選清單'),
      () => toast('複製失敗'),
    );
  };

  if (data.isLoading || !data.config) {
    return <div style={{ padding: 24 }}>載入中…</div>;
  }

  return (
    <>
      <Header config={data.config} />
      <Toolbar
        config={data.config}
        market={data.market}
        onRandomPick={handleRandomPick}
        onOpenAddShop={() => setAddShopOpen(true)}
      />
      <FilterDrawer config={data.config} shops={data.shops} ratings={data.shopRatings} onCopyList={handleCopyList} />
      <Banners shops={data.shops} />
      <PickCard rows={allRows} onPickAgain={handleRandomPick} />
      <main>
        <div id="listwrap">
          <ShopList
            allRows={allRows}
            visibleRows={visibleRows}
            config={data.config}
            windowStart={windowStart}
            menus={data.menus}
          />
          <AfterSection
            sectionKey="desserts"
            title="吃飽再吃(甜點)"
            items={data.desserts}
            config={data.config}
            parkings={data.parkings}
            day={state.day}
            nowMinute={nowMinute}
            ratings={data.dessertRatings}
          />
          <AfterSection
            sectionKey="drinks"
            title="吃飽再買(飲料)"
            items={data.drinks}
            config={data.config}
            parkings={data.parkings}
            day={state.day}
            nowMinute={nowMinute}
            ratings={data.drinkRatings}
          />
        </div>
      </main>
      {addShopOpen && <AddShopModal config={data.config} shops={data.shops} onClose={() => setAddShopOpen(false)} />}
      <Toast />
    </>
  );
}
