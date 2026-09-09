import { useMemo, useState } from 'react';
import { currentMood, nowMin, openNowState, randomPick } from '@lunch-map/shared';
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
import { MapPane } from './components/MapPane.js';
import { AddShopModal } from './components/AddShopModal.js';
import { Toast } from './components/Toast.js';
import { toast } from './lib/toast.js';

export function App() {
  const data = useLunchData();
  const { state, dispatch } = useFilters();
  const [addShopOpen, setAddShopOpen] = useState(false);
  const editingShop = state.editShopId ? (data.shops.find((s) => s.id === state.editShopId) ?? null) : null;
  const editingDrink = state.editDrinkId ? (data.drinks.find((d) => d.id === state.editDrinkId) ?? null) : null;

  const nowMinute = nowMin();

  const allRows = useComputedRows({
    config: data.config,
    shops: data.shops,
    parkings: data.parkings,
    ratings: data.shopRatings,
    votes: data.votes,
    nowMinute,
  });
  const visibleRows = useVisibleRows(allRows);

  const afterRows = useMemo(() => {
    const desserts = data.desserts.map((d) => ({ d, lat: d.lat, lng: d.lng, openCode: openNowState(d, state.day, nowMinute).code, kind: 'dessert' as const }));
    const drinks = data.drinks.map((d) => ({ d, lat: d.lat, lng: d.lng, openCode: openNowState(d, state.day, nowMinute).code, kind: 'drink' as const }));
    return [...desserts, ...drinks];
  }, [data.desserts, data.drinks, state.day, nowMinute]);

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

  const handleSelectOnMap = (shopId: string) => {
    dispatch({ type: 'SET_SEL', id: shopId });
    dispatch({ type: 'SET_VIEW', view: 'map' });
  };

  const handleCopyList = () => {
    const feasible = visibleRows.filter((r) => r.feasible);
    const lines = feasible.map((r, i) => {
      const travel = r.by === 'walk' ? `走路 ${r.t.walk} 分` : r.by === 'drive' ? `開車 ${r.t.drive} 分` : '';
      const scoreTxt = r.sc.n ? `★${r.sc.avg.toFixed(1)} (${r.sc.n}人)` : '尚無評分';
      return `${i + 1}. ${r.sh.name} — ${travel} / ${r.sh.category.join('、')} / ${scoreTxt}`;
    });
    const header = data.config ? `${state.day}\n` : '';
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
        market={data.market}
        onRandomPick={handleRandomPick}
        onOpenAddShop={() => setAddShopOpen(true)}
      />
      <FilterDrawer config={data.config} shops={data.shops} ratings={data.shopRatings} onCopyList={handleCopyList} />
      <Banners shops={data.shops} />
      <PickCard rows={allRows} onPickAgain={handleRandomPick} onViewOnMap={handleSelectOnMap} />
      <main className={state.view === 'list' ? 'list-only' : state.view === 'map' ? 'map-only' : ''}>
        <div id="listwrap">
          <ShopList
            allRows={allRows}
            visibleRows={visibleRows}
            config={data.config}
            menus={data.menus}
            drinks={data.drinks}
            day={state.day}
            nowMinute={nowMinute}
            onSelectOnMap={handleSelectOnMap}
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
        <MapPane
          config={data.config}
          parkings={data.parkings}
          rows={visibleRows}
          afterRows={afterRows}
          selectedShopId={state.sel}
          onSelectShop={(id) => dispatch({ type: 'SET_SEL', id })}
        />
      </main>
      {addShopOpen && <AddShopModal config={data.config} shops={data.shops} drinks={data.drinks} onClose={() => setAddShopOpen(false)} />}
      {editingShop && (
        <AddShopModal
          key={editingShop.id}
          config={data.config}
          shops={data.shops}
          drinks={data.drinks}
          shop={editingShop}
          onClose={() => dispatch({ type: 'SET_EDIT_SHOP', id: null })}
        />
      )}
      {editingDrink && (
        <AddShopModal
          key={editingDrink.id}
          config={data.config}
          shops={data.shops}
          drinks={data.drinks}
          drink={editingDrink}
          onClose={() => dispatch({ type: 'SET_EDIT_DRINK', id: null })}
        />
      )}
      <Toast />
    </>
  );
}
