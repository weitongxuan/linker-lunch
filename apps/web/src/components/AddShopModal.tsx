import { useMemo, useState } from 'react';
import type { AfterPlace, Config, HourRange, Service, Shop, WeeklyHours } from '@lunch-map/shared';
import { useAddDrinkMutation, useAddShopMutation } from '../hooks/useMutations.js';

interface Props {
  config: Config;
  shops: Shop[];
  drinks: AfterPlace[];
  onClose: () => void;
}

type NewPlaceType = 'shop' | 'drink';

const PLACE_TYPE_LABEL: Record<NewPlaceType, string> = { shop: '餐廳', drink: '飲料店' };

const SERVICE_LABEL: Record<Service, string> = { dine_in: '內用', takeout: '外帶', delivery: '外送' };

function buildHours(open: string, close: string, weekendClosed: boolean): WeeklyHours {
  const weekday: HourRange[] = [[open, close]];
  const weekend: HourRange[] = weekendClosed ? [] : weekday;
  return { mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: weekend, sun: weekend };
}

export function AddShopModal({ config, shops, drinks, onClose }: Props) {
  const addShopMut = useAddShopMutation();
  const addDrinkMut = useAddDrinkMutation();

  const [placeType, setPlaceType] = useState<NewPlaceType>('shop');

  const categories = useMemo(() => {
    const set = new Set(shops.flatMap((s) => s.category).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [shops]);

  const kinds = useMemo(() => {
    const set = new Set(drinks.map((d) => d.kind).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [drinks]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Set<string>>(new Set());
  const [newCategory, setNewCategory] = useState('');
  const [kind, setKind] = useState('');
  const [newKind, setNewKind] = useState('');
  const [addr, setAddr] = useState('');
  const [lat, setLat] = useState(String(config.office.lat));
  const [lng, setLng] = useState(String(config.office.lng));
  const [price, setPrice] = useState<1 | 2 | 3 | 4 | null>(null);
  const [service, setService] = useState<Set<Service>>(new Set(['dine_in', 'takeout']));
  const [openTime, setOpenTime] = useState('11:00');
  const [closeTime, setCloseTime] = useState('14:00');
  const [weekendClosed, setWeekendClosed] = useState(true);
  const [hoursUnknown, setHoursUnknown] = useState(false);
  const [note, setNote] = useState('');

  const toggleService = (s: Service) => {
    setService((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleCategory = (c: string) => {
    setCategory((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const addNewCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    setCategory((prev) => new Set(prev).add(trimmed));
    setNewCategory('');
  };

  const addNewKind = () => {
    const trimmed = newKind.trim();
    if (!trimmed) return;
    setKind(trimmed);
    setNewKind('');
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!trimmedName) {
      return;
    }
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return;
    }
    const hours = hoursUnknown ? { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } : buildHours(openTime, closeTime, weekendClosed);

    if (placeType === 'shop') {
      addShopMut.mutate({
        name: trimmedName,
        lat: latNum,
        lng: lngNum,
        category: category.size ? [...category] : ['其他'],
        price,
        service: [...service],
        hours,
        hoursUnknown,
        addr: addr.trim() || undefined,
        note: note.trim(),
      });
    } else {
      addDrinkMut.mutate({
        name: trimmedName,
        lat: latNum,
        lng: lngNum,
        kind: kind.trim() || '其他',
        price,
        hours,
        hoursUnknown,
        addr: addr.trim() || undefined,
        note: note.trim(),
      });
    }
    onClose();
  };

  const canSubmit = name.trim().length > 0 && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  const isPending = addShopMut.isPending || addDrinkMut.isPending;

  return (
    <div className="mask on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>新增店家</h2>

        <div className="crow">
          <span className="lbl">種類</span>
          {(['shop', 'drink'] as NewPlaceType[]).map((t) => (
            <button key={t} className={`chip${placeType === t ? ' on' : ''}`} onClick={() => setPlaceType(t)}>
              {PLACE_TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="crow">
          <span className="lbl">店名</span>
          <input className="msginput" value={name} onChange={(e) => setName(e.target.value)} placeholder="必填" />
        </div>

        {placeType === 'shop' ? (
          <div className="crow">
            <span className="lbl">類別</span>
            {categories.map((c) => (
              <button key={c} className={`chip${category.has(c) ? ' on' : ''}`} onClick={() => toggleCategory(c)}>
                {c}
              </button>
            ))}
            <input
              className="msginput"
              style={{ flex: '0 1 140px' }}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addNewCategory();
                }
              }}
              placeholder="新增類別…"
            />
            <button className="btn" onClick={addNewCategory}>
              加入
            </button>
            <span className="hint">可複選,沒選就預設「其他」</span>
          </div>
        ) : (
          <div className="crow">
            <span className="lbl">種類</span>
            {kinds.map((k) => (
              <button key={k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>
                {k}
              </button>
            ))}
            <input
              className="msginput"
              style={{ flex: '0 1 140px' }}
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addNewKind();
                }
              }}
              placeholder="新增種類…"
            />
            <button className="btn" onClick={addNewKind}>
              加入
            </button>
            <span className="hint">單選,沒選就預設「其他」</span>
          </div>
        )}

        <div className="crow">
          <span className="lbl">地址</span>
          <input className="msginput" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="選填" />
        </div>

        <div className="crow">
          <span className="lbl">座標</span>
          <input className="msginput" style={{ flex: '0 1 140px' }} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="緯度" />
          <input className="msginput" style={{ flex: '0 1 140px' }} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="經度" />
          <span className="hint">預設為公司位置,可自行調整(從 Google 地圖網址列複製經緯度)</span>
        </div>

        <div className="crow">
          <span className="lbl">價位</span>
          <button className={`chip${price == null ? ' on' : ''}`} onClick={() => setPrice(null)}>
            不填
          </button>
          {config.priceBands.map((band) => (
            <button key={band.v} className={`chip${price === band.v ? ' on' : ''}`} onClick={() => setPrice(band.v)}>
              {band.label}
            </button>
          ))}
        </div>

        {placeType === 'shop' && (
          <div className="crow">
            <span className="lbl">服務</span>
            {(['dine_in', 'takeout', 'delivery'] as Service[]).map((s) => (
              <button key={s} className={`chip${service.has(s) ? ' on' : ''}`} onClick={() => toggleService(s)}>
                {SERVICE_LABEL[s]}
              </button>
            ))}
          </div>
        )}

        <div className="crow">
          <span className="lbl">時間</span>
          <input
            className="msginput"
            style={{ flex: '0 1 100px' }}
            type="time"
            value={openTime}
            onChange={(e) => setOpenTime(e.target.value)}
            disabled={hoursUnknown}
          />
          <span>—</span>
          <input
            className="msginput"
            style={{ flex: '0 1 100px' }}
            type="time"
            value={closeTime}
            onChange={(e) => setCloseTime(e.target.value)}
            disabled={hoursUnknown}
          />
          <button className={`chip${weekendClosed ? ' on' : ''}`} disabled={hoursUnknown} onClick={() => setWeekendClosed((v) => !v)}>
            六日公休
          </button>
          <button className={`chip${hoursUnknown ? ' on' : ''}`} onClick={() => setHoursUnknown((v) => !v)}>
            時間不確定
          </button>
        </div>

        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="備註(選填)" />

        <div className="crow" style={{ marginTop: 9 }}>
          <button className="btn pri" disabled={!canSubmit || isPending} onClick={handleSubmit}>
            {isPending ? '儲存中…' : '儲存'}
          </button>
          <button className="btn" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
