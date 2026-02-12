import React, { useState, useRef, useMemo } from 'react';
import { Wallet, Search, Plus, FileSpreadsheet, Download, Trash2, ChevronDown, Edit2, X } from 'lucide-react';
import type { AppState, Transaction, ExpenseCategory } from '@/types';
import { formatCurrency, calcPayroll } from '@/lib/helpers';
import AppCard from '@/components/app/AppCard';
import SearchableSelect from '@/components/app/SearchableSelect';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface ExpenseViewProps {
  data: AppState;
  setData: React.Dispatch<React.SetStateAction<AppState>>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  recentSiteIds: string[];
  recentWorkerIds: string[];
}

const ExpenseView = ({ data, setData, addToast, recentSiteIds, recentWorkerIds }: ExpenseViewProps) => {
  const [expSiteId, setExpSiteId] = useState('');
  const [expWorkerId, setExpWorkerId] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory | ''>('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [profitSearch, setProfitSearch] = useState('');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const categories: ExpenseCategory[] = ['아침', '점심', '저녁', '주유', '숙박', '자재', '기타'];
  const excelInputRef = useRef<HTMLInputElement>(null);

  const sortedTransactions = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date));

  const workersById = useMemo(() => Object.fromEntries(data.workers.map(w => [w.id, w] as const)), [data.workers]);

  const siteStats = useMemo(() => {
    return data.sites.map(site => {
      const laborAgg = data.workLogs.filter(l => l.site_id === site.id).reduce((acc, log) => {
        const daily = workersById[log.worker_id]?.daily || 0;
        const { gross, tax, net } = calcPayroll(daily, log.md);
        acc.gross += gross; acc.tax += tax; acc.net += net;
        return acc;
      }, { gross: 0, tax: 0, net: 0 });
      const expenseCost = data.transactions.filter(t => t.site_id === site.id).reduce((acc, t) => acc + t.amount, 0);
      const totalCost = laborAgg.gross + expenseCost;
      const profit = site.budget - totalCost;
      return { ...site, laborCost: laborAgg.gross, laborTax: laborAgg.tax, laborNet: laborAgg.net, expenseCost, totalCost, profit };
    });
  }, [data.sites, data.workLogs, data.transactions, workersById]);

  const filteredStats = useMemo(() => {
    if (!profitSearch) return siteStats;
    return siteStats.filter(s => s.name.toLowerCase().includes(profitSearch.toLowerCase()));
  }, [siteStats, profitSearch]);

  const handleAddTransaction = () => {
    if (!expCategory || !expAmount) return alert('항목(카테고리)과 금액을 입력해주세요.');
    const newItem: Transaction = {
      id: crypto.randomUUID(), date: expDate, site_id: expSiteId, worker_id: expWorkerId,
      type: 'expense', category: expCategory, description: expDesc || expCategory,
      amount: parseInt(expAmount.replace(/,/g, '')),
    };
    setData(prev => ({ ...prev, transactions: [...prev.transactions, newItem] }));
    setExpDesc(''); setExpAmount(''); setExpCategory('');
    addToast('지출 내역이 등록되었습니다.', 'success');
  };

  const processRows = (jsonData: Record<string, unknown>[]) => {
    if (!jsonData || jsonData.length === 0) { addToast('등록할 내역이 없거나 형식이 올바르지 않습니다.', 'error'); return; }

    const norm = (v: unknown) => String(v ?? '').trim();
    const parseAmount = (v: unknown) => {
      if (v === null || v === undefined || v === '') return 0;
      if (typeof v === 'number') return v;
      const n = parseFloat(String(v).replace(/,/g, ''));
      return isNaN(n) ? 0 : n;
    };
    const toISO = (v: unknown) => {
      if (v === null || v === undefined || v === '') return new Date().toISOString().slice(0, 10);
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      if (typeof v === 'number') {
        try {
          const d = XLSX.SSF.parse_date_code(v);
          if (d && d.y && d.m && d.d) return `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        } catch { /* ignore */ }
      }
      const s = String(v).trim();
      const m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
      if (m) return `${m[1]}-${String(parseInt(m[2])).padStart(2, '0')}-${String(parseInt(m[3])).padStart(2, '0')}`;
      return new Date().toISOString().slice(0, 10);
    };

    const sitesByName = new Map(data.sites.map(s => [s.name, s]));
    const workersByName = new Map(data.workers.map(w => [w.name, w]));
    const newTransactions: Transaction[] = [];
    const newSites = [...data.sites];

    for (const row of jsonData) {
      const siteName = norm(row['현장'] ?? row['현장_표준화'] ?? row['site'] ?? '');
      const workerName = norm(row['작업자'] ?? row['작업자(수동입력)'] ?? row['worker'] ?? '');
      const category = norm(row['항목'] ?? row['카테고리'] ?? row['category'] ?? '기타');
      const desc = norm(row['내용'] ?? row['설명'] ?? row['description'] ?? row['이용하신 가맹점명'] ?? category);
      const amount = parseAmount(row['금액'] ?? row['이용금액'] ?? row['amount'] ?? 0);
      const dateStr = toISO(row['날짜'] ?? row['일자'] ?? row['date'] ?? '');
      if (amount <= 0) continue;

      let siteId = '';
      if (siteName) {
        const found = sitesByName.get(siteName);
        if (found) { siteId = found.id; }
        else {
          const newId = crypto.randomUUID();
          const newSite = { id: newId, name: siteName, budget: 0, company_name: '', status: 'active' as const };
          newSites.push(newSite);
          sitesByName.set(siteName, newSite);
          siteId = newId;
        }
      }

      let workerId = '';
      if (workerName) {
        const found = workersByName.get(workerName);
        if (found) workerId = found.id;
      }

      newTransactions.push({
        id: crypto.randomUUID(),
        date: dateStr, site_id: siteId, worker_id: workerId,
        type: 'expense', category, description: desc, amount,
      });
    }

    setData(prev => ({ ...prev, sites: newSites, transactions: [...prev.transactions, ...newTransactions] }));
    addToast(`${newTransactions.length}건의 경비 내역이 등록되었습니다.`, 'success');
  };

  const handleExpenseFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'EUC-KR',
        complete: (results) => {
          try {
            processRows(results.data as Record<string, unknown>[]);
          } catch (err) {
            console.error(err);
            addToast('CSV 파싱 중 오류가 발생했습니다.', 'error');
          } finally {
            if (excelInputRef.current) excelInputRef.current.value = '';
          }
        },
        error: () => {
          addToast('CSV 파일을 읽을 수 없습니다.', 'error');
          if (excelInputRef.current) excelInputRef.current.value = '';
        },
      });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const dataArr = new Uint8Array(evt.target?.result as ArrayBuffer);
          const wb = XLSX.read(dataArr, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
          processRows(jsonData);
        } catch (err) {
          console.error(err);
          addToast('엑셀 업로드 중 오류가 발생했습니다.', 'error');
        } finally {
          if (excelInputRef.current) excelInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const deleteTransaction = (id: string) => {
    if (confirm('삭제하시겠습니까?')) {
      setData(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
      addToast('삭제되었습니다.', 'info');
    }
  };

  const handleSaveEditTx = () => {
    if (!editingTx) return;
    setData(prev => ({ ...prev, transactions: prev.transactions.map(t => t.id === editingTx.id ? editingTx : t) }));
    addToast('수정되었습니다.', 'success');
    setEditingTx(null);
  };

  const downloadExpenseTemplate = () => {
    const sampleData = [
      { '날짜': '2026-01-15', '현장': '광주첨단센트럴', '작업자': '홍길동', '항목': '점심', '내용': '식당 이름', '금액': 35000 },
      { '날짜': '2026-01-15', '현장': '', '작업자': '', '항목': '주유', '내용': '주유소명', '금액': 80000 },
      { '날짜': '2026-01-16', '현장': '서대구힐스테이트', '작업자': '김철수', '항목': '자재', '내용': '자재 품목', '금액': 150000 },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // 날짜
      { wch: 20 }, // 현장
      { wch: 10 }, // 작업자
      { wch: 10 }, // 항목
      { wch: 20 }, // 내용
      { wch: 12 }, // 금액
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '경비지출');
    XLSX.writeFile(wb, '경비지출_업로드양식.xlsx');
    addToast('엑셀 양식이 다운로드되었습니다.', 'success');
  };

  const downloadProfitReport = () => {
    const excelData = siteStats.map(stat => ({
      '거래처': stat.company_name || '-', '현장명': stat.name, '예산': stat.budget,
      '노무비(총급여)': -stat.laborCost, '세금(3.3%)': -stat.laborTax, '실지급액': -stat.laborNet,
      '경비(지출)': -stat.expenseCost, '순수익': stat.profit,
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '수익보고서');
    XLSX.writeFile(wb, `현장별_수익보고서_${new Date().toISOString().slice(0, 10)}.xlsx`);
    addToast('수익보고서 다운로드가 완료되었습니다.', 'success');
  };

  return (
    <div className="pb-24 animate-fade-in max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg flex items-center gap-2"><Wallet size={18} className="text-primary" /> 수익현황</h3>
        <button onClick={downloadProfitReport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-2 whitespace-nowrap transition-transform active:scale-95">
          <Download size={14} /> 수익보고서 엑셀저장
        </button>
      </div>

      {/* Profit Analysis */}
      <div className="mb-8">
        <div className="relative mb-4 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-muted-foreground" /></div>
          <input type="text" className="block w-full pl-10 pr-3 py-3 border border-border rounded-2xl bg-card text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="현장명으로 수익 현황 검색..." value={profitSearch} onChange={(e) => setProfitSearch(e.target.value)} />
        </div>

        <div className="overflow-x-auto pb-2 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex gap-3 snap-x snap-mandatory">
            {filteredStats.length === 0 && <div className="p-8 text-center text-muted-foreground w-full bg-card rounded-3xl border border-border">검색된 현장이 없습니다.</div>}
            {filteredStats.map(stat => (
              <div key={stat.id} className="bg-card rounded-2xl p-4 shadow-soft border border-border min-w-[260px] max-w-[300px] flex-shrink-0 flex flex-col justify-between snap-start transition-transform hover:scale-[1.02] duration-200">
                <div>
                  <div className="mb-2">
                    <h3 className="font-bold text-sm text-foreground leading-snug line-clamp-1">{stat.name}</h3>
                    <span className="text-micro-md text-muted-foreground font-bold">예산 {formatCurrency(stat.budget)}</span>
                  </div>
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-xs items-center p-2 bg-red-50 dark:bg-red-900/10 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-red-500 font-bold leading-tight">노무비</span>
                        <span className="text-micro-md text-muted-foreground mt-0.5">세금 -{formatCurrency(stat.laborTax)} · 실지급 -{formatCurrency(stat.laborNet)}</span>
                      </div>
                      <span className="font-bold text-red-600 whitespace-nowrap ml-2">-{formatCurrency(stat.laborCost)}</span>
                    </div>
                    <div className="flex justify-between text-xs items-center p-2 bg-orange-50 dark:bg-orange-900/10 rounded-xl">
                      <span className="text-orange-500 font-bold">경비</span>
                      <span className="font-bold text-orange-600">-{formatCurrency(stat.expenseCost)}</span>
                    </div>
                    <div className="h-px bg-border"></div>
                    <div className="flex justify-between text-sm px-1">
                      <span className="font-bold text-foreground">순수익</span>
                      <span className={`font-black ${stat.profit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600'}`}>{formatCurrency(stat.profit)}원</span>
                    </div>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${stat.profit >= 0 ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${Math.min((stat.totalCost / (stat.budget || 1)) * 100, 100)}%` }}></div>
                </div>
                <div className="mt-1 text-micro-md text-muted-foreground text-right">{stat.budget > 0 ? `소진율 ${((stat.totalCost / stat.budget) * 100).toFixed(1)}%` : '-'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AppCard className="md:col-span-1 h-fit">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Wallet size={18} className="text-primary" /> 경비 지출 입력</h3>
          <div className="space-y-4">
            <div>
              <label className="text-micro-md text-muted-foreground mb-1 block font-bold">날짜</label>
              <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="w-full p-2.5 rounded-xl bg-muted border border-border text-xs font-bold text-foreground outline-none" />
            </div>
            <div>
              <label className="text-micro-md text-muted-foreground mb-1 block font-bold">현장 (수익 계산에 반영됨)</label>
              <SearchableSelect options={[{ id: '', label: '공통경비 (현장 미지정)' }, ...data.sites.map(s => ({ id: s.id, label: s.name }))]} value={expSiteId} onChange={setExpSiteId} placeholder="현장 선택" recentIds={recentSiteIds} />
            </div>
            <div className="flex gap-2">
              <div className="flex-[1.2]">
                <label className="text-micro-md text-muted-foreground mb-1 block font-bold">작업자 (선택)</label>
                <SearchableSelect options={[{ id: '', label: '선택 안함' }, ...data.workers.map(w => ({ id: w.id, label: w.name }))]} value={expWorkerId} onChange={setExpWorkerId} placeholder="이름" recentIds={recentWorkerIds} />
              </div>
              <div className="flex-1">
                <label className="text-micro-md text-muted-foreground mb-1 block font-bold">항목</label>
                <div className="relative">
                  <select value={expCategory} onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)} className="w-full p-2.5 rounded-xl bg-muted border border-border text-xs text-foreground outline-none font-bold appearance-none pr-6">
                    <option value="">선택</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                </div>
              </div>
            </div>
            <div>
              <label className="text-micro-md text-muted-foreground mb-1 block font-bold">상세 내용 (선택)</label>
              <input type="text" placeholder="식당명, 품목 등" value={expDesc} onChange={e => setExpDesc(e.target.value)} className="w-full p-2.5 rounded-xl bg-muted border border-border text-xs text-foreground outline-none font-bold placeholder:text-muted-foreground" />
            </div>
            <div>
              <label className="text-micro-md text-muted-foreground mb-1 block font-bold">지출 금액</label>
              <div className="relative">
                <input type="number" placeholder="0" value={expAmount} onChange={e => setExpAmount(e.target.value)} className="w-full p-2.5 rounded-xl bg-muted border border-border text-sm text-foreground outline-none font-black text-right pr-8" />
                <span className="absolute right-3 top-2.5 text-sm font-bold text-muted-foreground">원</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={downloadExpenseTemplate} className="w-full py-3 bg-muted hover:bg-secondary text-foreground border border-border rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1">
                <Download size={14} /> 양식
              </button>
              <button onClick={() => excelInputRef.current?.click()} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1">
                <FileSpreadsheet size={14} /> 일괄
              </button>
              <input type="file" ref={excelInputRef} onChange={handleExpenseFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
              <button onClick={handleAddTransaction} className="w-full py-3 bg-primary hover:brightness-110 text-primary-foreground rounded-xl font-bold text-xs shadow-lg shadow-neon transition-all active:scale-95 flex items-center justify-center gap-1">
                <Plus size={14} /> 등록
              </button>
            </div>
          </div>
        </AppCard>

        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <h3 className="font-bold text-foreground whitespace-nowrap">최근 지출 내역</h3>
            <div className="relative flex-1 max-w-[200px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="현장명 검색..." value={expenseSearch} onChange={e => { setExpenseSearch(e.target.value); setShowAllTransactions(false); }} className="w-full pl-8 pr-3 py-2 rounded-xl bg-muted border border-border text-xs font-bold text-foreground outline-none focus:border-primary transition-colors" />
            </div>
          </div>
          {(() => {
            const filtered = expenseSearch
              ? sortedTransactions.filter(t => {
                  const site = data.sites.find(s => s.id === t.site_id);
                  return (site?.name || '공통경비').toLowerCase().includes(expenseSearch.toLowerCase());
                })
              : sortedTransactions;
            const displayed = showAllTransactions ? filtered : filtered.slice(0, 5);
            const hasMore = filtered.length > 5 && !showAllTransactions;
            
            if (filtered.length === 0) return <div className="text-center py-10 text-muted-foreground text-xs bg-card rounded-2xl">{expenseSearch ? '검색 결과가 없습니다.' : '지출 내역이 없습니다.'}</div>;
            
            return (
              <>
                {displayed.map(t => {
                  const site = data.sites.find(s => s.id === t.site_id);
                  const worker = data.workers.find(w => w.id === t.worker_id);
                  return (
                    <div key={t.id} className="flex justify-between items-center p-4 bg-card rounded-2xl border border-border shadow-sm">
                      <div className="flex flex-col min-w-0 flex-1 mr-2 cursor-pointer" onClick={() => setEditingTx({ ...t })}>
                        <span className="text-micro-md text-muted-foreground mb-0.5 truncate">{t.date} · {site?.name || '공통경비'}</span>
                        <span className="font-bold text-sm text-foreground truncate">
                          {t.category}
                          {worker && <span className="text-info ml-1">[{worker.name}]</span>}
                          <span className="text-xs font-normal text-muted-foreground ml-1">({t.description})</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-black text-sm text-red-500">-{formatCurrency(t.amount)}</span>
                        <button onClick={() => setEditingTx({ ...t })} className="text-muted-foreground/50 hover:text-primary"><Edit2 size={14} /></button>
                        <button onClick={() => deleteTransaction(t.id)} className="text-muted-foreground/50 hover:text-destructive"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
                {hasMore && (
                  <button onClick={() => setShowAllTransactions(true)} className="w-full py-3 bg-muted hover:bg-secondary text-muted-foreground text-xs font-bold rounded-2xl transition-colors">
                    더보기 ({filtered.length - 5}건 더)
                  </button>
                )}
                {showAllTransactions && filtered.length > 5 && (
                  <button onClick={() => setShowAllTransactions(false)} className="w-full py-3 bg-muted hover:bg-secondary text-muted-foreground text-xs font-bold rounded-2xl transition-colors">
                    접기
                  </button>
                )}
                {expenseSearch && (
                  <div className="text-center text-micro-md text-muted-foreground py-1">
                    "{expenseSearch}" 검색결과: {filtered.length}건 · 총 {formatCurrency(filtered.reduce((s, t) => s + t.amount, 0))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-foreground">지출 내역 수정</h3>
              <button onClick={() => setEditingTx(null)} className="p-2 bg-muted rounded-full text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-micro-md font-bold text-muted-foreground mb-1">날짜</label>
                <input type="date" value={editingTx.date} onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm font-bold text-foreground outline-none" />
              </div>
              <div>
                <label className="block text-micro-md font-bold text-muted-foreground mb-1">현장</label>
                <SearchableSelect options={[{ id: '', label: '공통경비 (현장 미지정)' }, ...data.sites.map(s => ({ id: s.id, label: s.name }))]} value={editingTx.site_id} onChange={v => setEditingTx({ ...editingTx, site_id: v })} placeholder="현장 선택" recentIds={recentSiteIds} />
              </div>
              <div>
                <label className="block text-micro-md font-bold text-muted-foreground mb-1">항목</label>
                <div className="relative">
                  <select value={editingTx.category} onChange={e => setEditingTx({ ...editingTx, category: e.target.value })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm text-foreground outline-none font-bold appearance-none pr-6">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                </div>
              </div>
              <div>
                <label className="block text-micro-md font-bold text-muted-foreground mb-1">내용</label>
                <input type="text" value={editingTx.description} onChange={e => setEditingTx({ ...editingTx, description: e.target.value })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm font-bold text-foreground outline-none" />
              </div>
              <div>
                <label className="block text-micro-md font-bold text-muted-foreground mb-1">금액 (원)</label>
                <input type="number" value={editingTx.amount} onChange={e => setEditingTx({ ...editingTx, amount: parseInt(e.target.value) || 0 })} className="w-full p-3 rounded-xl bg-muted border border-border text-sm font-black text-right text-foreground outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { deleteTransaction(editingTx.id); setEditingTx(null); }} className="p-4 rounded-xl bg-red-50 text-red-500 font-bold"><Trash2 size={20} /></button>
                <button onClick={handleSaveEditTx} className="flex-1 py-4 bg-foreground text-background rounded-xl font-bold text-sm shadow-xl">수정사항 저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseView;
