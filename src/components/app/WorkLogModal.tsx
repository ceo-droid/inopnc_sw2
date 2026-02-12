import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Edit2, Save, Trash2 } from 'lucide-react';
import type { AppState, WorkLog } from '@/types';
import { formatCurrency, calcPayroll, formatMd, formatDateFriendly } from '@/lib/helpers';
import SearchableSelect from './SearchableSelect';

interface WorkLogModalProps {
  data: AppState;
  setData: React.Dispatch<React.SetStateAction<AppState>>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  isLogModalOpen: boolean;
  setLogModalOpen: (open: boolean) => void;
  logModalDate: string;
  recentSiteIds: string[];
  recentWorkerIds: string[];
}

const WorkLogModal = ({ data, setData, addToast, isLogModalOpen, setLogModalOpen, logModalDate, recentSiteIds, recentWorkerIds }: WorkLogModalProps) => {
  const [targetSiteId, setTargetSiteId] = useState('');
  const [targetWorkerId, setTargetWorkerId] = useState('');
  const [targetMd, setTargetMd] = useState(1.0);
  const [targetMemo, setTargetMemo] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const todaysLogs = useMemo(() => data.workLogs.filter(l => l.date === logModalDate), [data.workLogs, logModalDate]);
  const selectedWorker = useMemo(() => data.workers.find(w => w.id === targetWorkerId), [data.workers, targetWorkerId]);
  const previewPayroll = useMemo(() => calcPayroll(selectedWorker?.daily || 0, targetMd), [selectedWorker?.daily, targetMd]);

  useEffect(() => { if (isLogModalOpen) resetInputs(); }, [isLogModalOpen]);

  if (!isLogModalOpen) return null;

  const resetInputs = () => { setTargetSiteId(''); setTargetWorkerId(''); setTargetMd(1.0); setTargetMemo(''); setEditingLogId(null); };

  const handleAdd = () => {
    if (!targetSiteId) return alert('현장을 선택해주세요.');
    if (!targetWorkerId) return alert('작업자를 선택해주세요.');
    const newLog: WorkLog = { id: crypto.randomUUID(), date: logModalDate, site_id: targetSiteId, worker_id: targetWorkerId, md: targetMd, note: targetMemo };
    setData(prev => ({ ...prev, workLogs: [...prev.workLogs, newLog] }));
    addToast('공수가 등록되었습니다.', 'success');
    setTargetWorkerId(''); setTargetMemo(''); setTargetMd(1.0);
  };

  const handleEdit = (log: WorkLog) => { setTargetSiteId(log.site_id); setTargetWorkerId(log.worker_id); setTargetMd(log.md); setTargetMemo(log.note || ''); setEditingLogId(log.id); };

  const handleUpdate = () => {
    if (!editingLogId || !targetSiteId || !targetWorkerId) return;
    setData(prev => ({ ...prev, workLogs: prev.workLogs.map(l => l.id === editingLogId ? { ...l, site_id: targetSiteId, worker_id: targetWorkerId, md: targetMd, note: targetMemo } : l) }));
    addToast('공수 내역이 수정되었습니다.', 'success');
    resetInputs();
  };

  const handleDelete = (id: string) => {
    if (confirm('이 공수 내역을 삭제하시겠습니까?')) {
      setData(prev => ({ ...prev, workLogs: prev.workLogs.filter(l => l.id !== id) }));
      addToast('삭제되었습니다.', 'info');
      if (editingLogId === id) resetInputs();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-border shrink-0">
          <div>
            <h3 className="text-xl font-bold text-foreground">공수 등록</h3>
            <p className="text-sm text-muted-foreground font-medium">{formatDateFriendly(logModalDate)} ({logModalDate})</p>
          </div>
          <button onClick={() => setLogModalOpen(false)} className="p-2 hover:bg-secondary rounded-full text-muted-foreground"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground mb-1">현장 선택</label>
              <SearchableSelect options={data.sites.map(s => ({ id: s.id, label: s.name, sub: s.company_name }))} value={targetSiteId} onChange={setTargetSiteId} placeholder="현장 검색..." recentIds={recentSiteIds} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground mb-1">작업자 선택</label>
              <SearchableSelect options={data.workers.map(w => ({ id: w.id, label: w.name }))} value={targetWorkerId} onChange={setTargetWorkerId} placeholder="작업자 검색..." recentIds={recentWorkerIds} />
            </div>

            {/* 실시간 예상 비용 */}
            <div className="bg-card rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-muted-foreground">기본 일당</div>
                <div className="text-xs font-black text-foreground">{selectedWorker ? `${formatCurrency(selectedWorker.daily)}원` : '-'}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-muted rounded-lg p-2 border border-border">
                  <div className="text-[9px] font-bold text-muted-foreground mb-0.5">총급여</div>
                  <div className="text-[11px] font-black text-foreground">{selectedWorker ? formatCurrency(previewPayroll.gross) : '-'}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-2 border border-red-100 dark:border-red-900/20">
                  <div className="text-[9px] font-bold text-red-500 mb-0.5">세금(3.3%)</div>
                  <div className="text-[11px] font-black text-red-600 dark:text-red-300">{selectedWorker ? `-${formatCurrency(previewPayroll.tax)}` : '-'}</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-2 border border-blue-100 dark:border-blue-900/20">
                  <div className="text-[9px] font-bold text-info mb-0.5">실지급액</div>
                  <div className="text-[11px] font-black text-blue-700 dark:text-blue-200">{selectedWorker ? formatCurrency(previewPayroll.net) : '-'}</div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">공수 {formatMd(targetMd)} 기준 · 세금은 원 단위 절사</div>
            </div>

            <div className="flex gap-4">
              <div className="w-1/3">
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">공수</label>
                <div className="flex items-center bg-card rounded-xl border border-border overflow-hidden h-[42px]">
                  <button onClick={() => setTargetMd(Math.max(0, targetMd - 0.5))} className="w-10 h-full flex items-center justify-center bg-muted hover:bg-secondary text-muted-foreground font-bold border-r border-border">-</button>
                  <div className="flex-1 text-center font-black text-foreground text-sm">{targetMd}</div>
                  <button onClick={() => setTargetMd(Math.min(3.5, targetMd + 0.5))} className="w-10 h-full flex items-center justify-center bg-muted hover:bg-secondary text-muted-foreground font-bold border-l border-border">+</button>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">메모 (선택)</label>
                <input type="text" value={targetMemo} onChange={(e) => setTargetMemo(e.target.value)} placeholder="작업 내용 등" className="w-full h-[42px] px-3 rounded-xl bg-card border border-border text-sm font-bold text-foreground outline-none focus:border-primary transition-colors" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {editingLogId && (
                <button onClick={resetInputs} className="px-4 py-3 bg-secondary text-muted-foreground rounded-xl font-bold text-xs">취소</button>
              )}
              <button
                onClick={editingLogId ? handleUpdate : handleAdd}
                className={`flex-1 py-3 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${editingLogId ? 'bg-foreground text-background' : 'bg-primary text-primary-foreground shadow-neon'}`}
              >
                {editingLogId ? <><Save size={14} /> 수정 저장</> : <><Plus size={14} /> 추가하기</>}
              </button>
            </div>
          </div>

          {/* Log List */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-3 px-1">등록된 공수 ({todaysLogs.length})</h4>
            <div className="space-y-2">
              {todaysLogs.length === 0 && <div className="text-center py-8 text-muted-foreground text-xs border border-dashed border-border rounded-xl">아직 등록된 공수가 없습니다.</div>}
              {todaysLogs.map(log => {
                const site = data.sites.find(s => s.id === log.site_id);
                const worker = data.workers.find(w => w.id === log.worker_id);
                const isEditing = editingLogId === log.id;
                return (
                  <div key={log.id} className={`p-4 rounded-xl border transition-all ${isEditing ? 'border-primary bg-accent ring-1 ring-primary' : 'bg-card border-border hover:border-muted-foreground/20'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground font-bold mb-0.5">{site?.name || '삭제된 현장'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-foreground">{worker?.name || '미등록'}</span>
                          <span className="text-[10px] font-black bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-1.5 py-0.5 rounded">{log.md}공수</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(log)} className="p-2 text-muted-foreground/50 hover:text-info transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(log.id)} className="p-2 text-muted-foreground/50 hover:text-destructive transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    {log.note && <div className="text-xs text-muted-foreground bg-muted p-2 rounded-lg break-words">{log.note}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkLogModal;
