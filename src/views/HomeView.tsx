import React, { useState, useRef, useMemo } from 'react';
import { FileSpreadsheet, Download, Users, FileUp, Grid, List } from 'lucide-react';
import type { AppState, WorkLog, Worker, Site } from '@/types';
import { formatCurrency, calcPayroll, getSiteTheme, hashString, normalizeText, num, parseKoreanDateToISO, median } from '@/lib/helpers';
import MonthYearPicker from '@/components/app/MonthYearPicker';
import SearchableSelect from '@/components/app/SearchableSelect';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface HomeViewProps {
  data: AppState;
  setData: React.Dispatch<React.SetStateAction<AppState>>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  setLogModalOpen: (o: boolean) => void;
  setLogModalDate: (d: string) => void;
  recentSiteIds: string[];
  recentWorkerIds: string[];
}

const HomeView = ({ data, setData, addToast, selectedDate, setSelectedDate, setLogModalOpen, setLogModalDate, recentSiteIds, recentWorkerIds }: HomeViewProps) => {
  const [calMonth, setCalMonth] = useState(() => {
    // Default to most recent month with data, or current month
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1); // previous month as default
  });
  const [calFilterSite, setCalFilterSite] = useState('');
  const [calFilterWorker, setCalFilterWorker] = useState('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [payMonthOverride, setPayMonthOverride] = useState<Date | null>(null);
  const [payShowAll, setPayShowAll] = useState(false);
  const payMonth = payMonthOverride || calMonth;
  const setPayMonth = (d: Date) => { setPayMonthOverride(d); setPayShowAll(false); };
  const [payFilterSite, setPayFilterSite] = useState('');
  const [payFilterWorker, setPayFilterWorker] = useState('');
  const [payFilterCompany, setPayFilterCompany] = useState('');
  const [payDateDesc, setPayDateDesc] = useState(true);


  const payrollCsvInputRef = useRef<HTMLInputElement>(null);

  const workersById = useMemo(() => Object.fromEntries(data.workers.map(w => [w.id, w] as const)), [data.workers]);
  const sitesById = useMemo(() => Object.fromEntries(data.sites.map(s => [s.id, s] as const)), [data.sites]);

  const importPayrollCsv = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const decodeTry = (enc: string) => { try { return new TextDecoder(enc).decode(buf); } catch { return ''; } };
      let text = decodeTry('euc-kr') || decodeTry('utf-8');
      const utf8 = decodeTry('utf-8');
      if (utf8 && (utf8.match(/�/g) || []).length < (text.match(/�/g) || []).length) text = utf8;

      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
      const rows: Record<string, unknown>[] = Array.isArray(parsed.data) ? parsed.data as Record<string, unknown>[] : [];
      if (rows.length === 0) { addToast('CSV 데이터가 비어있습니다.', 'error'); return; }

      const existingWorkersByName = new Map(data.workers.map(w => [w.name, w] as const));
      const existingSitesByName = new Map(data.sites.map(s => [s.name, s] as const));
      const workerDailyCandidates: Record<string, number[]> = {};
      const siteCompanyCandidates: Record<string, Record<string, number>> = {};

      const normalized = rows.map(r => {
        const workerName = normalizeText(r['작업자'] ?? r['worker'] ?? '');
        const dateISO = parseKoreanDateToISO(String(r['일자'] ?? r['date'] ?? ''));
        const company = normalizeText(r['거래처'] ?? r['company'] ?? '');
        const siteName = normalizeText(r['현장'] ?? r['site'] ?? '미지정') || '미지정';
        const md = num(r['공수'] ?? r['md'] ?? 0, 0);
        const gross = num(r['총급여'] ?? r['gross'] ?? 0, 0);
        const note = normalizeText(r['메모'] ?? r['note'] ?? '');
        if (workerName && md > 0 && gross > 0) {
          const daily = Math.round((gross / md) / 100) * 100;
          if (!workerDailyCandidates[workerName]) workerDailyCandidates[workerName] = [];
          workerDailyCandidates[workerName].push(daily);
        }
        if (siteName) {
          if (!siteCompanyCandidates[siteName]) siteCompanyCandidates[siteName] = {};
          if (company) siteCompanyCandidates[siteName][company] = (siteCompanyCandidates[siteName][company] || 0) + 1;
        }
        return { workerName, dateISO, company, siteName, md, note };
      }).filter(r => r.workerName && r.dateISO && r.md > 0 && r.siteName);

      if (normalized.length === 0) { addToast('CSV 컬럼을 확인해주세요. (작업자/일자/현장/공수)', 'error'); return; }

      const workerIdByName: Record<string, string> = {};
      const mergedWorkers: Worker[] = [...data.workers];
      for (const name of new Set([...Object.keys(workerDailyCandidates), ...normalized.map(r => r.workerName)])) {
        const existed = existingWorkersByName.get(name);
        if (existed) {
          const med = median(workerDailyCandidates[name] || []);
          workerIdByName[name] = existed.id;
          const idx = mergedWorkers.findIndex(w => w.id === existed.id);
          if (idx >= 0 && med > 0) mergedWorkers[idx] = { ...mergedWorkers[idx], daily: med };
        } else {
          const med = median(workerDailyCandidates[name] || []);
          const id = crypto.randomUUID();
          workerIdByName[name] = id;
          mergedWorkers.push({ id, name, daily: med > 0 ? med : 150000 });
        }
      }

      const siteIdByName: Record<string, string> = {};
      const mergedSites: Site[] = [...data.sites];
      for (const siteName of new Set([...Object.keys(siteCompanyCandidates), ...normalized.map(r => r.siteName)])) {
        const existed = existingSitesByName.get(siteName);
        const companyCounts = siteCompanyCandidates[siteName] || {};
        const topCompany = Object.entries(companyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || existed?.company_name || '';
        if (existed) {
          siteIdByName[siteName] = existed.id;
          const idx = mergedSites.findIndex(s => s.id === existed.id);
          if (idx >= 0) mergedSites[idx] = { ...mergedSites[idx], company_name: topCompany || mergedSites[idx].company_name };
        } else {
          const id = crypto.randomUUID();
          siteIdByName[siteName] = id;
          mergedSites.push({ id, name: siteName, company_name: topCompany, budget: 0, status: 'active' });
        }
      }

      const seen = new Set<string>();
      const importedLogs: WorkLog[] = [];
      for (let i = 0; i < normalized.length; i++) {
        const r = normalized[i];
        const worker_id = workerIdByName[r.workerName];
        const site_id = siteIdByName[r.siteName];
        const key = `${r.dateISO}|${worker_id}|${site_id}|${r.md}|${r.note}`;
        if (seen.has(key)) continue;
        seen.add(key);
        importedLogs.push({ id: crypto.randomUUID(), date: r.dateISO, site_id, worker_id, md: r.md, note: r.note || '' });
      }

      const latest = importedLogs.map(l => l.date).sort().slice(-1)[0];
      if (latest) {
        const d = new Date(latest);
        setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        setPayMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        setSelectedDate(latest);
      }

      setData(prev => ({ ...prev, workers: mergedWorkers, sites: mergedSites, workLogs: importedLogs }));
      addToast(`CSV 반영 완료 · 작업일지 ${importedLogs.length}건`, 'success');
    } catch (e: unknown) {
      console.error(e);
      addToast(`CSV 반영 실패: ${(e as Error)?.message || '오류'}`, 'error');
    }
  };

  const payrollData = useMemo(() => {
    let logs = data.workLogs;
    if (!payShowAll) {
      const y = payMonth.getFullYear();
      const m = payMonth.getMonth() + 1;
      const monthPrefix = `${y}-${String(m).padStart(2, '0')}`;
      logs = logs.filter(l => l.date.startsWith(monthPrefix));
    }
    if (payFilterWorker) logs = logs.filter(l => l.worker_id === payFilterWorker);
    if (payFilterSite) logs = logs.filter(l => l.site_id === payFilterSite);
    if (payFilterCompany) {
      const companySiteIds = new Set(data.sites.filter(s => s.company_name === payFilterCompany).map(s => s.id));
      logs = logs.filter(l => companySiteIds.has(l.site_id));
    }
    if (payDateDesc) {
      logs.sort((a, b) => b.date.localeCompare(a.date));
    } else {
      logs.sort((a, b) => a.date.localeCompare(b.date));
    }
    let result = logs.map(log => {
      const worker = workersById[log.worker_id];
      const site = sitesById[log.site_id];
      const { gross, tax, net } = calcPayroll(worker?.daily || 0, log.md);
      return { ...log, workerName: worker?.name || '미등록', siteName: site?.name || '삭제된 현장', companyName: site?.company_name || '-', gross, tax, net };
    });
    return result;
  }, [data.workLogs, data.workers, data.sites, payMonth, payShowAll, payFilterWorker, payFilterSite, payFilterCompany, payDateDesc, workersById, sitesById]);

  const totals = payrollData.reduce((acc, curr) => ({ md: acc.md + curr.md, gross: acc.gross + curr.gross, tax: acc.tax + curr.tax, net: acc.net + curr.net }), { md: 0, gross: 0, tax: 0, net: 0 });

  const exportToExcel = () => {
    const excelData = payrollData.map(row => ({
      '작업자': row.workerName, '일자': row.date, '거래처': row.companyName, '현장': row.siteName,
      '공수': row.md, '총급여': row.gross, '세금(3.3%)': -row.tax, '실수령액': row.net, '메모': row.note || '',
    }));
    excelData.push({ '작업자': '합계', '일자': '', '거래처': '', '현장': '', '공수': totals.md, '총급여': totals.gross, '세금(3.3%)': -totals.tax, '실수령액': totals.net, '메모': '' });
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '출력현황');
    XLSX.writeFile(wb, `출력현황_${payMonth.getFullYear()}_${String(payMonth.getMonth() + 1).padStart(2, '0')}.xlsx`);
    addToast('엑셀 다운로드 완료', 'success');
  };

  const generateCalendar = () => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const today = new Date().toISOString().split('T')[0];
    const days: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="min-h-[100px] border-r border-b border-border bg-muted/30"></div>);

    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = today === dateStr;
      const isSelected = selectedDate === dateStr;

      const dayLogs = data.workLogs.filter(l => {
        const dateMatch = l.date === dateStr;
        const workerMatch = calFilterWorker ? l.worker_id === calFilterWorker : true;
        const siteMatch = calFilterSite ? l.site_id === calFilterSite : true;
        return dateMatch && workerMatch && siteMatch;
      });

      const logsBySite = dayLogs.reduce((acc, log) => {
        if (!acc[log.site_id]) acc[log.site_id] = [];
        acc[log.site_id].push(log);
        return acc;
      }, {} as Record<string, WorkLog[]>);

      days.push(
        <div key={d} onClick={() => { setSelectedDate(dateStr); setLogModalDate(dateStr); setLogModalOpen(true); }}
          className={`min-h-[100px] border-r border-b border-border p-1 cursor-pointer transition-colors relative group flex flex-col ${isSelected ? 'bg-accent ring-2 ring-inset ring-primary' : 'hover:bg-muted'} ${isToday ? 'bg-accent/50' : 'bg-card'}`}
        >
          <div className={`text-sm font-bold mb-1 flex justify-between px-1 ${isToday ? 'text-primary' : 'text-foreground'}`}><span>{d}</span></div>
          <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
            {Object.entries(logsBySite).slice(0, 3).map(([siteId, logs]) => {
              const siteLogs = logs as WorkLog[];
              const site = sitesById[siteId];
              const theme = getSiteTheme(siteId);
              // Group workers by md value for compact display
              const mdGroups: Record<number, string[]> = {};
              siteLogs.forEach(log => {
                const wName = workersById[log.worker_id]?.name || '?';
                const surname = `(${wName.slice(0, 1)})`;
                if (!mdGroups[log.md]) mdGroups[log.md] = [];
                mdGroups[log.md].push(surname);
              });
              return (
                <div key={siteId} className={`rounded px-1 py-px ${theme.header} text-micro-sm leading-tight`}>
                  <span className="font-bold">{site?.name?.slice(0, 3) || '미지정'}</span>
                  {' '}
                  {Object.entries(mdGroups).map(([md, names]) => (
                    <span key={md} className="text-micro">
                      {names.join('')}<span className="font-bold">{md === '1' ? '' : ` ${md}`}</span>
                      {' '}
                    </span>
                  ))}
                </div>
              );
            })}
            {Object.keys(logsBySite).length > 3 && <div className="text-micro text-center text-muted-foreground">+{Object.keys(logsBySite).length - 3}</div>}
          </div>
        </div>
      );
    }
    return days;
  };

  const generateListView = () => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const today = new Date().toISOString().split('T')[0];
    const daysList: React.ReactNode[] = [];

    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(year, month, d);
      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
      const isToday = today === dateStr;

      const dayLogs = data.workLogs.filter(l => {
        const dateMatch = l.date === dateStr;
        const workerMatch = calFilterWorker ? l.worker_id === calFilterWorker : true;
        const siteMatch = calFilterSite ? l.site_id === calFilterSite : true;
        return dateMatch && workerMatch && siteMatch;
      });
      const isEmpty = dayLogs.length === 0;

      daysList.push(
        <div key={d} onClick={() => { setSelectedDate(dateStr); setLogModalDate(dateStr); setLogModalOpen(true); }}
          className={`flex items-start gap-4 p-4 border-b last:border-0 border-border cursor-pointer hover:bg-muted transition-colors ${isToday ? 'bg-accent/30' : ''}`}
        >
          <div className="flex flex-col items-center justify-center min-w-[3rem]">
            <span className={`text-lg font-bold ${dateObj.getDay() === 0 ? 'text-red-500' : dateObj.getDay() === 6 ? 'text-blue-500' : 'text-foreground'}`}>{d}</span>
            <span className="text-xs text-muted-foreground">{dayOfWeek}</span>
          </div>
          <div className="flex-1">
            {isEmpty ? (
              <div className="text-xs text-muted-foreground/40 py-1">일정 없음</div>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(dayLogs.reduce((acc, log) => { if (!acc[log.site_id]) acc[log.site_id] = []; acc[log.site_id].push(log); return acc; }, {} as Record<string, WorkLog[]>)).map(([siteId, logs]) => {
                  const site = sitesById[siteId];
                  const theme = getSiteTheme(siteId);
                  const siteLogs = logs as WorkLog[];
                  const mdGroups: Record<number, string[]> = {};
                  siteLogs.forEach(log => {
                    const wName = workersById[log.worker_id]?.name || '?';
                    if (!mdGroups[log.md]) mdGroups[log.md] = [];
                    mdGroups[log.md].push(`(${wName.slice(0, 1)})`);
                  });
                  return (
                    <div key={siteId} className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center text-micro-lg font-bold px-2 py-1 rounded-lg ${theme.header}`}>
                        {site?.name || '미지정'}
                      </span>
                      {Object.entries(mdGroups).map(([md, names]) => (
                        <span key={md} className="text-micro-lg text-muted-foreground">
                          {names.join('')} <span className="font-bold text-foreground">{md}공수</span>
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }
    return daysList;
  };

  return (
    <div className="animate-fade-in pb-24 space-y-8">
      {/* Calendar Section */}
      <div>
        <div className="flex flex-col gap-6 mb-6 bg-card p-4 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <MonthYearPicker date={calMonth} onChange={setCalMonth} />
              <div className="flex bg-muted p-0.5 rounded-lg shrink-0">
                <button onClick={() => setViewMode('calendar')} className={`p-1.5 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}><Grid size={16} /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}><List size={16} /></button>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => payrollCsvInputRef.current?.click()} className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-primary shadow-sm transition-all active:scale-95" title="CSV 불러오기">
                <FileUp size={18} />
              </button>
              <input ref={payrollCsvInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importPayrollCsv(f); (e.target as HTMLInputElement).value = ''; }} />
              <button onClick={() => { setLogModalDate(selectedDate); setLogModalOpen(true); }} className="p-2 rounded-xl bg-foreground text-background dark:bg-primary dark:text-primary-foreground shadow-lg hover:scale-105 transition-transform" title="공수등록">
                <Users size={18} />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchableSelect options={[{ id: '', label: '전체 현장' }, ...data.sites.map(s => ({ id: s.id, label: s.name }))]} value={calFilterSite} onChange={setCalFilterSite} placeholder="현장 필터" recentIds={recentSiteIds} />
            </div>
            <div className="flex-1">
              <SearchableSelect options={[{ id: '', label: '전체 작업자' }, ...data.workers.map(w => ({ id: w.id, label: w.name }))]} value={calFilterWorker} onChange={setCalFilterWorker} placeholder="작업자 필터" recentIds={recentWorkerIds} />
            </div>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-muted/50">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div key={d} className={`text-center py-3 text-xs font-bold ${i === 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">{generateCalendar()}</div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">{generateListView()}</div>
        )}
      </div>

      {/* Payroll Table */}
      <div className="bg-card rounded-3xl p-4 sm:p-6 shadow-soft border border-transparent dark:border-border">
        <div className="flex flex-col gap-4 mb-6">
          <h3 className="font-bold text-lg text-foreground flex items-center gap-2"><FileSpreadsheet size={20} className="text-primary" /> 출력현황</h3>
          <div className="flex items-center gap-2 w-full min-w-0">
            <MonthYearPicker date={payMonth} onChange={setPayMonth} />
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setPayShowAll(!payShowAll)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${payShowAll ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}
              >
                전체
              </button>
              <button onClick={exportToExcel} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-1 whitespace-nowrap transition-transform active:scale-95">
                <Download size={14} /> 엑셀
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchableSelect options={[{ id: '', label: '전체 현장' }, ...data.sites.map(s => ({ id: s.id, label: s.name }))]} value={payFilterSite} onChange={setPayFilterSite} placeholder="현장 필터" recentIds={recentSiteIds} />
            </div>
            <div className="flex-1">
              <SearchableSelect options={[{ id: '', label: '전체 작업자' }, ...data.workers.map(w => ({ id: w.id, label: w.name }))]} value={payFilterWorker} onChange={setPayFilterWorker} placeholder="작업자 필터" recentIds={recentWorkerIds} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
              <tr>
                <th className="py-2 px-2 whitespace-nowrap">작업자</th>
                <th className="py-2 px-2 whitespace-nowrap cursor-pointer select-none" onClick={() => setPayDateDesc(prev => !prev)}>
                  일자 {payDateDesc ? '↓' : '↑'}
                </th>
                <th className="py-2 px-2 whitespace-nowrap">거래처</th>
                <th className="py-2 px-2 whitespace-nowrap">현장</th>
                <th className="py-2 px-2 text-center whitespace-nowrap">공수</th>
                <th className="py-2 px-2 text-right whitespace-nowrap">총급여</th>
                <th className="py-2 px-2 text-right text-red-500 whitespace-nowrap">세금(3.3%)</th>
                <th className="py-2 px-2 text-right whitespace-nowrap">실수령액</th>
                <th className="py-2 px-2 whitespace-nowrap">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payrollData.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">데이터가 없습니다.</td></tr>
              ) : (
                payrollData.map((row, idx) => (
                  <tr key={`${row.id}-${idx}`} className="hover:bg-muted/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-foreground whitespace-nowrap">{row.workerName}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-medium whitespace-nowrap">{row.date}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-medium whitespace-nowrap max-w-[100px] truncate">{row.companyName}</td>
                    <td className="py-2.5 px-3 text-foreground whitespace-nowrap">{row.siteName}</td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded font-bold bg-accent text-primary">{row.md}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-foreground font-medium whitespace-nowrap">{formatCurrency(row.gross)}</td>
                    <td className="py-2.5 px-3 text-right text-red-500 whitespace-nowrap">-{formatCurrency(row.tax)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{formatCurrency(row.net)}</td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap max-w-[150px] truncate">{row.note}</td>
                  </tr>
                ))
              )}
            </tbody>
            {payrollData.length > 0 && (
              <tfoot className="bg-blue-50 dark:bg-blue-900/10 font-black text-blue-900 dark:text-blue-100 border-t-2 border-blue-100 dark:border-blue-900/30">
                <tr>
                  <td colSpan={4} className="py-3 px-3 text-center whitespace-nowrap">합계</td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">{totals.md}</td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">{formatCurrency(totals.gross)}</td>
                  <td className="py-3 px-3 text-right text-red-500 whitespace-nowrap">-{formatCurrency(totals.tax)}</td>
                  <td className="py-3 px-3 text-right text-blue-700 dark:text-blue-300 whitespace-nowrap">{formatCurrency(totals.net)}</td>
                  <td className="py-3 px-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default HomeView;
