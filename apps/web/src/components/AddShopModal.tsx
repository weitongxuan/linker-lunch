import { useMemo, useState } from 'react';
import type { Config, HourRange, Service, Shop, WeeklyHours } from '@lunch-map/shared';
import { useAddShopMutation } from '../hooks/useMutations.js';

interface Props {
  config: Config;
  shops: Shop[];
  onClose: () => void;
}

const SERVICE_LABEL: Record<Service, string> = { dine_in: '內用', takeout: '外帶', delivery: '外送' };

function buildHours(open: string, close: string, weekendClosed: boolean): WeeklyHours {
  const weekday: HourRange[] = [[open, close]];
  const weekend: HourRange[] = weekendClosed ? [] : weekday;
  return { mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: weekend, sun: weekend };
}

export function AddShopModal({ config, shops, onClose }: Props) {
  const addShopMut = useAddShopMutation();

  const categories = useMemo(() => {
    const set = new Set(shops.map((s) => s.category).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [shops]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
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
    addShopMut.mutate({
      name: trimmedName,
      lat: latNum,
      lng: lngNum,
      category: category.trim() || '其他',
      price,
      service: [...service],
      hours: hoursUnknown ? { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } : buildHours(openTime, closeTime, weekendClosed),
      hoursUnknown,
      addr: addr.trim() || undefined,
      note: note.trim(),
    });
    onClose();
  };

  const canSubmit = name.trim().length > 0 && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  return (
    <div className="mask on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>新增店家</h2>

        <div className="crow">
          <span className="lbl">店名</span>
          <input className="msginput" value={name} onChange={(e) => setName(e.target.value)} placeholder="必填" />
        </div>

        <div className="crow">
          <span className="lbl">類別</span>
          <input
            className="msginput"
            list="shop-category-options"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="例如:小吃、便當、麵食…"
          />
          <datalist id="shop-category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

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

        <div className="crow">
          <span className="lbl">服務</span>
          {(['dine_in', 'takeout', 'delivery'] as Service[]).map((s) => (
            <button key={s} className={`chip${service.has(s) ? ' on' : ''}`} onClick={() => toggleService(s)}>
              {SERVICE_LABEL[s]}
            </button>
          ))}
        </div>

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
          <button className="btn pri" disabled={!canSubmit || addShopMut.isPending} onClick={handleSubmit}>
            {addShopMut.isPending ? '儲存中…' : '儲存'}
          </button>
          <button className="btn" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
