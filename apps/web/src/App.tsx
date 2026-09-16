import { useEffect, useMemo, useState } from 'react';
import { currentMood, nowMin, randomPick } from '@lunch-map/shared';
import { useLunchData } from './hooks/useLunchData.js';
import { useMyLocation } from './hooks/useMyLocation.js';
import { useComputedRows, useVisibleRows } from './hooks/useComputedRows.js';
import { useFilters } from './state/filtersStore.js';
import { Header } from './components/Header.js';
import { Toolbar } from './components/Toolbar.js';
import { FilterDrawer } from './components/FilterDrawer.js';
import { ActiveConditions } from './components/ActiveConditions.js';
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
  const myLocation = useMyLocation();

  /** 定位成功就用我的位置當距離原點,否則沿用辦公室座標 */
  const config = useMemo(() => {
    if (!data.config || !myLocation.coords) return data.config;
    return { ...data.config, office: { ...myLocation.coords, name: '我的位置' } };
  }, [data.config, myLocation.coords]);

  const allRows = useComputedRows({
    config,
    shops: data.shops,
    parkings: data.parkings,
    ratings: data.shopRatings,
    votes: data.votes,
    nowMinute,
  });
  const visibleRows = useVisibleRows(allRows);
  // 甜點/咖啡店不是午餐選項,不列、不進隨機推薦與候選清單
  const lunchRows = useMemo(() => visibleRows.filter((r) => !r.sh.category.includes('甜點')), [visibleRows]);
  const categories = useMemo(() => [...new Set(data.shops.flatMap((s) => (s.category.length ? s.category : ['其他'])))], [data.shops]);
  const cuisines = useMemo(() => [...new Set(data.shops.map((s) => s.cuisine).filter((c): c is string => !!c))].sort(), [data.shops]);

  const afterRows = useMemo(() => {
    return data.drinks.map((d) => ({ d, lat: d.lat, lng: d.lng }));
  }, [data.drinks]);

  const handleRandomPick = () => {
    const pool = lunchRows.filter((r) => r.feasible);
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

  // 意圖套用後 filters 已變,但 visibleRows/lunchRows 要下一輪才重算;等它們更新再抽
  useEffect(() => {
    if (!state.pendingPick) return;
    handleRandomPick();
    dispatch({ type: 'CLEAR_PENDING_PICK' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在旗標立起且 rows 重算後跑一次
  }, [state.pendingPick, lunchRows]);

  const handleSelectOnMap = (shopId: string) => {
    dispatch({ type: 'SET_SEL', id: shopId });
    dispatch({ type: 'SET_VIEW', view: 'map' });
  };

  const handleCopyList = () => {
    const feasible = lunchRows.filter((r) => r.feasible);
    const lines = feasible.map((r) => {
      const travel = r.by === 'walk' ? `走路 ${r.t.walk} 分` : r.by === 'drive' ? `開車 ${r.t.drive} 分` : '';
      const scoreTxt = r.sc.n ? `★${r.sc.avg.toFixed(1)} (${r.sc.n}人)` : '尚無評分';
      return `• ${r.sh.name} — ${travel} / ${r.sh.category.join('、')} / ${scoreTxt}`;
    });
    const header = config ? `${state.day}\n` : '';
    const text = header + lines.join('\n') + '\n\n投票請回覆店名';
    navigator.clipboard?.writeText(text).then(
      () => toast('已複製候選清單'),
      () => toast('複製失敗'),
    );
  };

  if (data.isLoading || !config) {
    return <div style={{ padding: 24 }}>載入中…</div>;
  }

  return (
    <>
      <Header config={config} />
      <Toolbar
        market={data.market}
        onRandomPick={handleRandomPick}
        onOpenAddShop={() => setAddShopOpen(true)}
        categories={categories}
        cuisines={cuisines}
        myLocation={myLocation}
      />
      <FilterDrawer config={config} shops={data.shops} ratings={data.shopRatings} onCopyList={handleCopyList} />
      <ActiveConditions />
      <Banners shops={data.shops} />
      <PickCard rows={allRows} onPickAgain={handleRandomPick} onViewOnMap={handleSelectOnMap} />
      <main className={state.view === 'list' ? 'list-only' : state.view === 'map' ? 'map-only' : ''}>
        <div id="listwrap">
          <span className="seg listTabs">
            {(['shops', 'drinks'] as const).map((tab) => (
              <button
                key={tab}
                className={state.listTab === tab ? 'on' : ''}
                onClick={() => dispatch({ type: 'SET_LIST_TAB', tab })}
              >
                {tab === 'shops' ? '餐廳' : '飲料'}
              </button>
            ))}
          </span>
          {state.listTab !== 'drinks' ? (
            <ShopList
              visibleRows={lunchRows}
              config={config}
              menus={data.menus}
              drinks={data.drinks}
              day={state.day}
              nowMinute={nowMinute}
              onSelectOnMap={handleSelectOnMap}
            />
          ) : (
            <AfterSection
              title="吃飽再買(飲料)"
              items={data.drinks}
              config={config}
              parkings={data.parkings}
              day={state.day}
              nowMinute={nowMinute}
              ratings={data.drinkRatings}
            />
          )}
        </div>
        <MapPane
          config={config}
          parkings={data.parkings}
          rows={visibleRows}
          afterRows={afterRows}
          selectedShopId={state.sel}
          onSelectShop={(id) => dispatch({ type: 'SET_SEL', id })}
        />
      </main>
      {addShopOpen && <AddShopModal config={config} shops={data.shops} drinks={data.drinks} onClose={() => setAddShopOpen(false)} />}
      {editingShop && (
        <AddShopModal
          key={editingShop.id}
          config={config}
          shops={data.shops}
          drinks={data.drinks}
          shop={editingShop}
          onClose={() => dispatch({ type: 'SET_EDIT_SHOP', id: null })}
        />
      )}
      {editingDrink && (
        <AddShopModal
          key={editingDrink.id}
          config={config}
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
