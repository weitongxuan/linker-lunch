import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LABEL, ORDER, toMin } from '@lunch-map/shared';
import type { Row } from '../hooks/useComputedRows.js';
import { Timebar } from './Timebar.js';
import { useFilters } from '../state/FiltersContext.js';
import { useMe } from '../hooks/useMe.js';
import * as places from '../api/places.js';
import {
  useAddMessageMutation,
  useAddReportMutation,
  useMarkEatenMutation,
  useRateMutation,
  useSetMenuMutation,
  useToggleTempClosedMutation,
  useUploadPhotoMutation,
  useVoteMutation,
} from '../hooks/useMutations.js';
import type { Config } from '@lunch-map/shared';
import type { Message, Photo, Report } from '../api/types.js';

const STCLS: Record<string, string> = {
  ok: 'ok', tight: 'tight', unknown: 'unk', not_enough: 'tight',
  not_lunch: 'no', closed: 'closed', temp: 'closed', no_time: 'no', out_of_range: 'no',
};

const BAR_VAR: Record<string, string> = {
  ok: '--okbar', tight: '--tightbar', unknown: '--nobar', not_enough: '--tightbar',
  not_lunch: '--nobar', closed: '--closedbar', temp: '--closedbar', no_time: '--nobar', out_of_range: '--nobar',
};

const SERVICE_LABEL: Record<string, string> = { dine_in: '內用', takeout: '外帶', delivery: '外送' };

function travelText(row: Row): string {
  if (!row.by) return '超出範圍';
  if (row.by === 'walk') return `走路 ${row.t.walk} 分`;
  const parkTxt = row.t.park ? `停${row.t.park.name}` : '路邊找位';
  return `開車 ${row.t.drive} 分(${parkTxt})`;
}

interface Props {
  row: Row;
  config: Config;
  windowStart: number;
  menuText: string;
  reports: Report[];
  onSelectOnMap: (shopId: string) => void;
}

export function ShopCard({ row, config, windowStart, menuText, reports, onSelectOnMap }: Props) {
  const { sh, f, sc, ate } = row;
  const { state, dispatch } = useFilters();
  const [me] = useMe();
  const isOpenDetail = state.openDetail.has(sh.id);

  const rateMut = useRateMutation('shop');
  const eatenMut = useMarkEatenMutation('shop');
  const tempClosedMut = useToggleTempClosedMutation('shop');
  const voteMut = useVoteMutation('shop');

  const photosQ = useQuery({
    queryKey: ['photos', 'shop', sh.id],
    queryFn: () => places.getPhotos('shop', sh.id),
    enabled: isOpenDetail,
  });
  const messagesQ = useQuery({
    queryKey: ['messages', 'shop', sh.id],
    queryFn: () => places.getMessages('shop', sh.id),
    enabled: isOpenDetail,
  });

  const menuLines = menuText ? menuText.split('\n').map((l) => l.trim()).filter(Boolean) : [];
  const myScore = sc.who?.[me] ?? 0;
  const votesInfo = row.votes;

  const mySVars = { background: `var(${BAR_VAR[f.code] ?? '--nobar'})` };

  return (
    <div className={`shop${state.sel === sh.id ? ' sel' : ''}`}>
      <div className="bar" style={mySVars} />
      <div className="top">
        <div className="nm">
          {sh.name}
          {sh.needsReview && <span className="sp">待確認</span>}
        </div>
        <span className={`st ${STCLS[f.code] ?? 'no'}`}>{f.label}</span>
      </div>

      <div className="spine">
        <span>{travelText(row)}</span>
        <span className="dot">·</span>
        <span>{sh.category}</span>
        {sh.price != null && (
          <>
            <span className="dot">·</span>
            <span title={config.priceBands.find((b) => b.v === sh.price)?.label}>{'$'.repeat(sh.price)}</span>
          </>
        )}
        {menuLines.length > 0 && (
          <>
            <span className="dot">·</span>
            <span className="mn">📋 {menuLines.length} 項</span>
          </>
        )}
        {sc.n > 0 && (
          <>
            <span className="dot">·</span>
            <span className="sc">★ {sc.avg.toFixed(1)} ({sc.n} 人)</span>
          </>
        )}
        {sh.googleRating != null && (
          <>
            <span className="dot">·</span>
            <span className="gr" title={`Google ${sh.googleReviews ?? 0} 則評論`}>
              G {sh.googleRating.toFixed(1)}
            </span>
          </>
        )}
        <span className="tgs">
          {row.by === 'drive' && row.t.park && <span className="tag pk">🅿 {row.t.park.name}</span>}
          {sh.peak && <span className="tag peak">⚠ {sh.peak.note || `尖峰 ${sh.peak.from}-${sh.peak.to}`}</span>}
          {ate != null && ate < 7 && <span className="tag ate">{ate === 0 ? '今天吃過' : `${ate} 天前吃過`}</span>}
          {reports.length > 0 && <span className="tag rep">🚩 {reports.length} 則回報:{reports[0].type}</span>}
          {(sh.service || []).filter((s) => s !== 'dine_in').map((s) => (
            <span key={s} className="tag">{SERVICE_LABEL[s]}</span>
          ))}
        </span>
      </div>

      <Timebar config={config} day={state.day} windowStart={windowStart} row={row} />
      <div className="why">{f.why || f.label}</div>

      <div className="acts">
        <span className="stars" title={`以「${me || '訪客'}」的身分評分`}>
          {[1, 2, 3, 4, 5].map((s) => (
            <b
              key={s}
              className={s <= myScore ? 'f' : ''}
              onClick={() => rateMut.mutate({ placeId: sh.id, person: me || '訪客', score: s === myScore ? 0 : s })}
            >
              ★
            </b>
          ))}
        </span>
        <button className="btn" onClick={() => eatenMut.mutate({ placeId: sh.id, person: me || '訪客' })}>
          吃過了
        </button>
        <button className="btn" onClick={() => dispatch({ type: 'TOGGLE_DETAIL', id: sh.id })}>
          {isOpenDetail ? '收起' : '詳情／留言'}
        </button>
        <ReportButton shopId={sh.id} me={me} />
        <button
          className={`btn${f.code === 'temp' ? ' warn' : ''}`}
          onClick={() => tempClosedMut.mutate({ placeId: sh.id, person: me || '訪客' })}
        >
          {f.code === 'temp' ? '取消臨時公休' : '今天臨時公休'}
        </button>
        <button className="btn" onClick={() => onSelectOnMap(sh.id)}>
          地圖
        </button>
        {state.voteMode && (
          <span className="votebox">
            <button className="btn ghost" onClick={() => voteMut.mutate({ placeId: sh.id, person: me || '訪客', value: Math.max(0, votesInfo - 1) })}>
              −
            </button>
            <b>{votesInfo}</b>
            <button className="btn ghost" onClick={() => voteMut.mutate({ placeId: sh.id, person: me || '訪客', value: votesInfo + 1 })}>
              +1
            </button>
          </span>
        )}
      </div>

      {isOpenDetail && (
        <DetailPanel
          row={row}
          menuText={menuText}
          photos={photosQ.data ?? []}
          messages={messagesQ.data ?? []}
          me={me}
        />
      )}
    </div>
  );
}

function ReportButton({ shopId, me }: { shopId: string; me: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        🚩 回報
      </button>
      {open && <ReportModal shopId={shopId} me={me} onClose={() => setOpen(false)} />}
    </>
  );
}

const REPORT_TYPES = ['時間不對', '今天沒開', '已歇業', '位置不對', '名稱不對', '其他'];

function ReportModal({ shopId, me, onClose }: { shopId: string; me: string; onClose: () => void }) {
  const [type, setType] = useState(REPORT_TYPES[0]);
  const [text, setText] = useState('');
  const addReport = useAddReportMutation('shop');

  return (
    <div className="mask on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>回報問題</h2>
        <div className="crow">
          {REPORT_TYPES.map((t) => (
            <button key={t} className={`chip${type === t ? ' on' : ''}`} onClick={() => setType(t)}>
              {t}
            </button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="想補充什麼?(選填)" />
        <div className="crow" style={{ marginTop: 9 }}>
          <button
            className="btn pri"
            onClick={() => {
              addReport.mutate({ placeId: shopId, who: me || '訪客', type, text });
              onClose();
            }}
          >
            送出
          </button>
          <button className="btn" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  row,
  menuText,
  photos,
  messages,
  me,
}: {
  row: Row;
  menuText: string;
  photos: Photo[];
  messages: Message[];
  me: string;
}) {
  const { sh, sc, t } = row;
  const { state } = useFilters();
  const setMenuMut = useSetMenuMutation('shop');
  const uploadPhotoMut = useUploadPhotoMutation('shop', sh.id);
  const addMessageMut = useAddMessageMutation('shop');
  const [draftMenu, setDraftMenu] = useState(menuText);
  const [draftMsg, setDraftMsg] = useState('');

  const sendMessage = () => {
    const text = draftMsg.trim();
    if (!text) return;
    addMessageMut.mutate({ placeId: sh.id, person: me || '訪客', text });
    setDraftMsg('');
  };

  return (
    <div className="detail">
      <div className="hrs">
        {ORDER.map((d) => (
          <Fragment key={d}>
            <span className={`d${d === state.day ? ' today' : ''}`}>{LABEL[d]}</span>
            <span className={d === state.day ? 'today' : ''}>
              {(sh.hours[d] || []).length ? sh.hours[d].map(([o, c]) => `${o}-${c}`).join('、') : '公休'}
            </span>
          </Fragment>
        ))}
      </div>

      {sh.hoursRaw && <div className="why">原始時段字串:{sh.hoursRaw}</div>}

      <div className="why">
        {t.park
          ? `開車:到 ${t.park.name}(約 ${t.parkWalk} 分走到店),含找車位約 ${t.searchMin ?? 3} 分。`
          : t.street
            ? `開車:路邊找位,抓 ${t.searchMin} 分。`
            : ''}
      </div>

      {sc.n > 0 && (
        <div className="who-rated">
          {Object.entries(sc.who || {}).map(([name, score]) => (
            <s key={name}>
              {name} ★{score}
            </s>
          ))}
        </div>
      )}

      <textarea
        value={draftMenu}
        onChange={(e) => setDraftMenu(e.target.value)}
        onBlur={() => {
          if (draftMenu !== menuText) setMenuMut.mutate({ placeId: sh.id, text: draftMenu });
        }}
        placeholder="這家店的菜單(一行一項,例如:排骨飯 90)"
      />

      <div className="crow" style={{ marginTop: 9 }}>
        <label className="btn">
          📷 拍菜單
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadPhotoMut.mutate({ file, who: me || '訪客', shared: true });
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {photos.length > 0 && (
        <div className="crow" style={{ marginTop: 9 }}>
          {photos.map((p) => (
            <span key={p.id} className={`mthumbw${p.shared ? ' sh' : ''}`}>
              <img className="mthumb" src={p.url} alt="" />
            </span>
          ))}
        </div>
      )}

      <div className="msgboard">
        {messages.length === 0 && <div className="dmeta">還沒有留言,說點什麼吧</div>}
        {messages.length > 0 && (
          <div className="msglist">
            {messages.map((m) => (
              <div key={m.id} className="msg">
                <div className="txt">{m.text}</div>
                <div className="meta">{m.who} · {m.date}</div>
              </div>
            ))}
          </div>
        )}
        <div className="crow" style={{ marginTop: 9 }}>
          <input
            className="msginput"
            value={draftMsg}
            onChange={(e) => setDraftMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="留言給大家看…"
          />
          <button className="btn pri" onClick={sendMessage}>
            送出
          </button>
        </div>
      </div>
    </div>
  );
}
