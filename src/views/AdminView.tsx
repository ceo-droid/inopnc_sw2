import React, { useState, useRef, useMemo } from 'react';
import { Building2, Users, Plus, Edit2, Trash2, X, FileUp, Search } from 'lucide-react';
import type { AppState, Site, Worker, SiteStatus } from '@/types';
import { formatCurrency, hashString } from '@/lib/helpers';
import AppCard from '@/components/app/AppCard';
import AppBadge from '@/components/app/AppBadge';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface AdminViewProps {
  data: AppState;
  setData: React.Dispatch<React.SetStateAction<AppState>>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const AdminView = ({ data, setData, addToast }: AdminViewProps) => {
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const siteExcelInputRef = useRef<HTMLInputElement>(null);
  const [siteSearch, setSiteSearch] = useState('');
  const [siteStatusFilter, setSiteStatusFilter] = useState<SiteStatus | 'all'>('all');
  const [workerSearch, setWorkerSearch] = useState('');

  const filteredSites = useMemo(() => {
    return data.sites.filter(s => {
      const matchesSearch = !siteSearch || s.name.toLowerCase().includes(siteSearch.toLowerCase()) || (s.company_name || '').toLowerCase().includes(siteSearch.toLowerCase());
      const matchesStatus = siteStatusFilter === 'all' || s.status === siteStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data.sites, siteSearch, siteStatusFilter]);

  const filteredWorkers = useMemo(() => {
    if (!workerSearch) return data.workers;
    return data.workers.filter(w => w.name.toLowerCase().includes(workerSearch.toLowerCase()));
  }, [data.workers, workerSearch]);

  const initialSite: Site = { id: '', name: '', budget: 0, company_name: '', status: 'scheduled' };
  const initialWorker: Worker = { id: '', name: '', daily: 150000 };

  const openCreateSiteModal = () => {setEditingSite({ ...initialSite });setIsSiteModalOpen(true);};
  const openEditSiteModal = (site: Site) => {setEditingSite({ ...site });setIsSiteModalOpen(true);};
  const openCreateWorkerModal = () => {setEditingWorker({ ...initialWorker });setIsWorkerModalOpen(true);};
  const openEditWorkerModal = (worker: Worker) => {setEditingWorker({ ...worker });setIsWorkerModalOpen(true);};

  const findColumn = (headers: string[], candidates: string[]): string | null => {
    const normalize = (s: string) => s.replace(/\uFEFF/g, '').toLowerCase().normalize('NFC').replace(/[_\s\u200B\u00A0]+/g, '').trim();
    const normCandidates = candidates.map(normalize);
    // Exact match
    for (const h of headers) {
      const nh = normalize(h);
      if (normCandidates.includes(nh)) return h;
    }
    // Contains match
    for (const h of headers) {
      const nh = normalize(h);
      if (normCandidates.some(c => nh.includes(c) || c.includes(nh))) return h;
    }
    return null;
  };

  const cleanHeaders = (rows: Record<string, unknown>[]): Record<string, unknown>[] => {
    if (!rows.length) return rows;
    const originalKeys = Object.keys(rows[0]);
    const cleanMap = new Map<string, string>();
    for (const key of originalKeys) {
      cleanMap.set(key, key.replace(/\uFEFF/g, '').trim());
    }
    return rows.map(row => {
      const cleaned: Record<string, unknown> = {};
      for (const [orig, clean] of cleanMap) {
        cleaned[clean] = row[orig];
      }
      return cleaned;
    });
  };

  const processSiteRows = (rawData: Record<string, unknown>[]) => {
    const jsonData = cleanHeaders(rawData);
    if (!jsonData?.length) { addToast('데이터가 없습니다.', 'error'); return; }
    const headers = Object.keys(jsonData[0]);
    console.log('[CSV/Excel] Headers found:', headers);
    const nameCol = findColumn(headers, ['현장명', '현장', 'name', 'site']);
    const budgetCol = findColumn(headers, ['예산', 'budget', 'amount']);
    const companyCol = findColumn(headers, ['거래처', '건설사', 'company', 'customer']);
    console.log('[CSV/Excel] Mapped columns:', { nameCol, budgetCol, companyCol });

    if (!nameCol) { addToast(`현장명 컬럼을 찾을 수 없습니다. (감지된 헤더: ${headers.join(', ')})`, 'error'); return; }

    const norm = (v: unknown) => String(v ?? '').trim();
    const newSites: Site[] = [];
    const updatedSites: Site[] = [];
    const existingMap = new Map(data.sites.map((s) => [s.name, s]));
    for (const row of jsonData) {
      const name = norm(row[nameCol!]);
      if (!name) continue;
      const rawBudget = budgetCol ? row[budgetCol] : 0;
      const budget = typeof rawBudget === 'number' ? rawBudget : parseInt(String(rawBudget ?? '0').replace(/,/g, '')) || 0;
      const company = companyCol ? norm(row[companyCol]) : '';
      const existingSite = existingMap.get(name);
      if (existingSite) {
        if (existingSite.budget !== budget || (company && existingSite.company_name !== company)) {
          updatedSites.push({ ...existingSite, budget: budget as number, ...(company ? { company_name: company } : {}) });
        }
      } else {
        const id = crypto.randomUUID();
        newSites.push({ id, name, budget: budget as number, company_name: company, status: 'active' });
        existingMap.set(name, newSites[newSites.length - 1]);
      }
    }
    if (newSites.length === 0 && updatedSites.length === 0) { addToast('변경할 현장이 없습니다.', 'info'); return; }
    const updatedIds = new Set(updatedSites.map(s => s.id));
    setData((prev) => ({
      ...prev,
      sites: [...prev.sites.map(s => updatedIds.has(s.id) ? updatedSites.find(u => u.id === s.id)! : s), ...newSites],
    }));
    const msgs: string[] = [];
    if (newSites.length > 0) msgs.push(`${newSites.length}개 추가`);
    if (updatedSites.length > 0) msgs.push(`${updatedSites.length}개 업데이트`);
    addToast(`현장 ${msgs.join(', ')}되었습니다.`, 'success');
  };

  const handleSiteFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processSiteRows(results.data as Record<string, unknown>[]);
          if (siteExcelInputRef.current) siteExcelInputRef.current.value = '';
        },
        error: () => { addToast('CSV 업로드 오류', 'error'); if (siteExcelInputRef.current) siteExcelInputRef.current.value = ''; }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const dataArr = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(dataArr, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
          processSiteRows(jsonData);
        } catch (err) { console.error(err); addToast('엑셀 업로드 오류', 'error'); } finally
        { if (siteExcelInputRef.current) siteExcelInputRef.current.value = ''; }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSaveSite = () => {
    if (!editingSite || !editingSite.name) return;
    let newSite = { ...editingSite };
    if (!newSite.id) newSite.id = crypto.randomUUID();
    if (data.sites.find((s) => s.id === newSite.id)) {
      setData((prev) => ({ ...prev, sites: prev.sites.map((s) => s.id === newSite.id ? newSite : s) }));
      addToast('현장 정보가 수정되었습니다.', 'success');
    } else {
      setData((prev) => ({ ...prev, sites: [...prev.sites, newSite] }));
      addToast('새 현장이 추가되었습니다.', 'success');
    }
    setIsSiteModalOpen(false);setEditingSite(null);
  };

  const handleDeleteSite = (id: string) => {
    if (confirm('현장을 삭제하시겠습니까?')) {
      setData((prev) => ({ ...prev, sites: prev.sites.filter((s) => s.id !== id) }));
      addToast('현장이 삭제되었습니다.', 'info');
      setIsSiteModalOpen(false);
    }
  };

  const handleSaveWorker = () => {
    if (!editingWorker || !editingWorker.name) return;
    let newWorker = { ...editingWorker };
    if (!newWorker.id) newWorker.id = crypto.randomUUID();
    if (data.workers.find((w) => w.id === newWorker.id)) {
      setData((prev) => ({ ...prev, workers: prev.workers.map((w) => w.id === newWorker.id ? newWorker : w) }));
      addToast('작업자 정보가 수정되었습니다.', 'success');
    } else {
      setData((prev) => ({ ...prev, workers: [...prev.workers, newWorker] }));
      addToast('새 작업자가 추가되었습니다.', 'success');
    }
    setIsWorkerModalOpen(false);setEditingWorker(null);
  };

  const handleDeleteWorker = (id: string) => {
    if (confirm('작업자를 삭제하시겠습니까?')) {
      setData((prev) => ({ ...prev, workers: prev.workers.filter((w) => w.id !== id) }));
      addToast('작업자가 삭제되었습니다.', 'info');
      setIsWorkerModalOpen(false);
    }
  };

  const getSiteStatusLabel = (status: SiteStatus) => status === 'active' ? '진행중' : status === 'completed' ? '완료' : '예정';
  const getSiteStatusColor = (status: SiteStatus) => status === 'active' ? 'primary' : status === 'completed' ? 'dark' : 'warning';

  return (
    <div className="pb-24 animate-fade-in">
      

      <AppCard className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2"><Building2 size={20} className="text-primary" /> 현장 관리</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => siteExcelInputRef.current?.click()} title="현장 파일 업로드 (엑셀/CSV)" className="bg-muted text-foreground p-2 rounded-xl border border-border hover:scale-105 transition-transform"><FileUp size={18} /></button>
            <input ref={siteExcelInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleSiteFileUpload} className="hidden" />
            <button onClick={openCreateSiteModal} className="bg-primary text-primary-foreground p-2 rounded-xl shadow-lg shadow-neon hover:scale-105 transition-transform"><Plus size={18} /></button>
          </div>
        </div>
        {/* Status filter chips */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {([['all', '전체'], ['active', '진행중'], ['completed', '완료'], ['scheduled', '예정']] as [SiteStatus | 'all', string][]).map(([status, label]) => (
            <button key={status} onClick={() => setSiteStatusFilter(status)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${siteStatusFilter === status ? 'bg-primary text-primary-foreground shadow' : 'bg-muted text-muted-foreground border border-border'}`}>
              {label}
            </button>
          ))}
        </div>
        {/* Site search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="현장명 또는 거래처 검색..." value={siteSearch} onChange={(e) => setSiteSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted border border-border text-xs font-bold text-foreground outline-none focus:border-primary transition-colors" />
        </div>
        <div className="space-y-3">
          {filteredSites.map((s) =>
          <div key={s.id} onClick={() => openEditSiteModal(s)} className="relative flex items-center justify-between p-4 bg-muted rounded-2xl cursor-pointer hover:bg-secondary transition-colors group">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AppBadge type={getSiteStatusColor(s.status) as any}>{getSiteStatusLabel(s.status)}</AppBadge>
                  <span className="text-[10px] text-muted-foreground font-bold">{s.company_name || '거래처 미입력'}</span>
                </div>
                <div className="font-bold text-foreground">{s.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">예산: {formatCurrency(s.budget)}</div>
              </div>
              <div className="p-2 text-muted-foreground/50 group-hover:text-primary transition-colors"><Edit2 size={16} /></div>
            </div>
          )}
          {filteredSites.length === 0 && <div className="text-center py-6 text-muted-foreground text-sm">{siteSearch || siteStatusFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 현장이 없습니다.'}</div>}
        </div>
      </AppCard>

      <AppCard>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-lg flex items-center gap-2"><Users size={20} className="text-primary" /> 작업자 관리</h3>
          <button onClick={openCreateWorkerModal} className="bg-foreground text-background p-2 rounded-xl shadow-lg hover:scale-105 transition-transform"><Plus size={18} /></button>
        </div>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="작업자명 검색..." value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted border border-border text-xs font-bold text-foreground outline-none focus:border-primary transition-colors" />
        </div>
        <div className="space-y-3">
          {filteredWorkers.map((w) =>
          <div key={w.id} onClick={() => openEditWorkerModal(w)} className="flex items-center justify-between p-4 bg-muted rounded-2xl cursor-pointer hover:bg-secondary transition-colors group">
              <div>
                <div className="font-bold text-foreground">{w.name}</div>
                <div className="text-xs text-muted-foreground">일당: {formatCurrency(w.daily)}</div>
              </div>
              <div className="p-2 text-muted-foreground/50 group-hover:text-primary transition-colors"><Edit2 size={16} /></div>
            </div>
          )}
          {filteredWorkers.length === 0 && <div className="text-center py-6 text-muted-foreground text-sm">{workerSearch ? '검색 결과가 없습니다.' : '등록된 작업자가 없습니다.'}</div>}
        </div>
      </AppCard>

      {/* Site Modal */}
      {isSiteModalOpen && editingSite &&
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-foreground">{editingSite.id ? '현장 정보 수정' : '새 현장 추가'}</h3>
              <button onClick={() => setIsSiteModalOpen(false)} className="p-2 bg-muted rounded-full text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">현장명</label>
                <input type="text" placeholder="현장 이름 입력" value={editingSite.name} onChange={(e) => setEditingSite({ ...editingSite, name: e.target.value })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm font-bold text-foreground outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">거래처명 (건설사)</label>
                <input type="text" placeholder="거래처 이름 입력" value={editingSite.company_name || ''} onChange={(e) => setEditingSite({ ...editingSite, company_name: e.target.value })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm font-bold text-foreground outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">예산 (원)</label>
                <input type="number" placeholder="0" value={editingSite.budget} onChange={(e) => setEditingSite({ ...editingSite, budget: parseInt(e.target.value) || 0 })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm font-black text-right text-foreground outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">진행 상태</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['scheduled', 'active', 'completed'] as SiteStatus[]).map((status) =>
                <button key={status} onClick={() => setEditingSite({ ...editingSite, status })} className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${editingSite.status === status ? status === 'completed' ? 'bg-foreground text-background' : status === 'active' ? 'bg-accent border-primary text-primary' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 text-yellow-600' : 'border-border text-muted-foreground'}`}>
                      {getSiteStatusLabel(status)}
                    </button>
                )}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                {editingSite.id && <button onClick={() => handleDeleteSite(editingSite.id)} className="p-4 rounded-xl bg-red-50 text-red-500 font-bold"><Trash2 size={20} /></button>}
                <button onClick={handleSaveSite} className="flex-1 py-4 bg-foreground text-background rounded-xl font-bold text-sm shadow-xl">{editingSite.id ? '수정사항 저장' : '새 항목 등록'}</button>
              </div>
            </div>
          </div>
        </div>
      }

      {/* Worker Modal */}
      {isWorkerModalOpen && editingWorker &&
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-foreground">{editingWorker.id ? '작업자 정보 수정' : '새 작업자 추가'}</h3>
              <button onClick={() => setIsWorkerModalOpen(false)} className="p-2 bg-muted rounded-full text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">이름</label>
                <input type="text" placeholder="이름 입력" value={editingWorker.name} onChange={(e) => setEditingWorker({ ...editingWorker, name: e.target.value })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm font-bold text-foreground outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">일당 (원)</label>
                <input type="number" placeholder="0" value={editingWorker.daily} onChange={(e) => setEditingWorker({ ...editingWorker, daily: parseInt(e.target.value) || 0 })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm font-black text-right text-foreground outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                {editingWorker.id && <button onClick={() => handleDeleteWorker(editingWorker.id)} className="p-4 rounded-xl bg-red-50 text-red-500 font-bold"><Trash2 size={20} /></button>}
                <button onClick={handleSaveWorker} className="flex-1 py-4 bg-foreground text-background rounded-xl font-bold text-sm shadow-xl">{editingWorker.id ? '수정사항 저장' : '새 작업자 등록'}</button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>);

};

export default AdminView;