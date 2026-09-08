import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOpenReports, resolveReport } from '../api/places.js';
import { toast } from '../lib/toast.js';

interface Props {
  placeNameById: Record<string, string>;
  onClose: () => void;
}

export function ReportListModal({ placeNameById, onClose }: Props) {
  const { data: reports = [] } = useQuery({ queryKey: ['reports', 'open-all'], queryFn: getOpenReports });
  const qc = useQueryClient();
  const resolveMut = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => resolveReport(id, done),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  const copyAll = () => {
    const text = reports
      .map((r) => `${r.placeId}  ${placeNameById[r.placeId] ?? r.placeId}  [${r.type}]  ${r.text}  —— ${r.who} ${r.date}`)
      .join('\n');
    navigator.clipboard?.writeText(text).then(
      () => toast('已複製'),
      () => toast('複製失敗'),
    );
  };

  return (
    <div className="mask on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>回報清單</h2>
        {reports.length === 0 && <p>目前沒有未處理的回報。</p>}
        {reports.map((r) => (
          <div key={r.id} className="drow">
            <span className="dn">
              {placeNameById[r.placeId] ?? r.placeId} <span className="tag">{r.type}</span>
            </span>
            <button className="btn ghost" onClick={() => resolveMut.mutate({ id: r.id, done: true })}>
              標為已處理
            </button>
            <span className="dmeta">
              {r.who} · {r.date} · {r.text}
            </span>
          </div>
        ))}
        <div className="crow" style={{ marginTop: 9 }}>
          {reports.length > 0 && (
            <button className="btn pri" onClick={copyAll}>
              複製全部
            </button>
          )}
          <button className="btn" onClick={onClose}>
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
