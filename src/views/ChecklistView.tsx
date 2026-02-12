import React, { useState } from 'react';
import { Plus, Trash2, Check, CheckSquare } from 'lucide-react';
import type { AppState, ChecklistItem, ChecklistType } from '@/types';
import { formatCurrency } from '@/lib/helpers';
import AppCard from '@/components/app/AppCard';

interface ChecklistViewProps {
  data: AppState;
  setData: React.Dispatch<React.SetStateAction<AppState>>;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const ChecklistView = ({ data, setData, addToast }: ChecklistViewProps) => {
  const [newItemType, setNewItemType] = useState<ChecklistType>('task');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemDate, setNewItemDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<ChecklistType | 'all'>('all');

  const sortedChecklists = [...data.checklists]
    .filter(c => filterType === 'all' || c.type === filterType)
    .sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      return b.date.localeCompare(a.date);
    });

  const addItem = () => {
    if (!newItemTitle) return alert('제목을 입력해주세요.');
    const newItem: ChecklistItem = {
      id: crypto.randomUUID(), type: newItemType, date: newItemDate,
      title: newItemTitle, amount: parseInt(newItemAmount.replace(/,/g, '')) || 0,
      status: 'pending',
    };
    setData(prev => ({ ...prev, checklists: [...prev.checklists, newItem] }));
    setNewItemTitle(''); setNewItemAmount('');
    addToast('항목이 등록되었습니다.', 'success');
  };

  const toggleStatus = (id: string) => {
    setData(prev => ({
      ...prev,
      checklists: prev.checklists.map(c => c.id === id ? { ...c, status: c.status === 'completed' ? 'pending' : 'completed' } : c),
    }));
  };

  const deleteItem = (id: string) => {
    if (confirm('삭제하시겠습니까?')) {
      setData(prev => ({ ...prev, checklists: prev.checklists.filter(c => c.id !== id) }));
      addToast('삭제되었습니다.', 'info');
    }
  };

  const getTypeColor = (type: ChecklistType) => {
    if (type === 'receivable') return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    if (type === 'payable') return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  };

  return (
    <div className="pb-24 animate-fade-in max-w-4xl mx-auto">

      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {[
          { id: 'all' as const, label: '전체' },
          { id: 'receivable' as const, label: '미수금' },
          { id: 'payable' as const, label: '미지급' },
          { id: 'task' as const, label: '업무' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilterType(f.id)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${filterType === f.id ? 'bg-primary text-primary-foreground shadow-neon' : 'bg-card border border-border text-muted-foreground'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AppCard className="md:col-span-1 h-fit">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><CheckSquare size={18} className="text-primary" /> 새 항목 등록</h3>
          <div className="space-y-4">
            <div>
              <label className="text-micro-md text-muted-foreground mb-1 block font-bold">구분</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'receivable' as const, label: '미수금' },
                  { id: 'payable' as const, label: '미지급' },
                  { id: 'task' as const, label: '업무' },
                ] as const).map(t => (
                  <button key={t.id} onClick={() => setNewItemType(t.id)} className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${newItemType === t.id ? 'bg-accent border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-micro-md text-muted-foreground mb-1 block font-bold">날짜</label>
              <input type="date" value={newItemDate} onChange={e => setNewItemDate(e.target.value)} className="w-full p-2.5 rounded-xl bg-muted border border-border text-xs font-bold text-foreground outline-none" />
            </div>
            <div>
              <label className="text-micro-md text-muted-foreground mb-1 block font-bold">제목</label>
              <input type="text" placeholder="할 일 입력" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} className="w-full p-2.5 rounded-xl bg-muted border border-border text-xs text-foreground outline-none font-bold placeholder:text-muted-foreground" />
            </div>
            {newItemType !== 'task' && (
              <div>
                <label className="text-micro-md text-muted-foreground mb-1 block font-bold">금액</label>
                <div className="relative">
                  <input type="number" placeholder="0" value={newItemAmount} onChange={e => setNewItemAmount(e.target.value)} className="w-full p-2.5 rounded-xl bg-muted border border-border text-sm text-foreground outline-none font-black text-right pr-8" />
                  <span className="absolute right-3 top-2.5 text-sm font-bold text-muted-foreground">원</span>
                </div>
              </div>
            )}
            <button onClick={addItem} className="w-full py-3 bg-primary hover:brightness-110 text-primary-foreground rounded-xl font-bold text-xs shadow-lg shadow-neon transition-all active:scale-95 flex items-center justify-center gap-1">
              <Plus size={14} /> 등록하기
            </button>
          </div>
        </AppCard>

        <div className="md:col-span-2 space-y-3">
          {sortedChecklists.length === 0 && <div className="text-center py-10 text-muted-foreground text-xs bg-card rounded-2xl">등록된 항목이 없습니다.</div>}
          {sortedChecklists.map(item => (
            <div key={item.id} className={`flex items-center p-4 bg-card rounded-2xl border transition-all ${item.status === 'completed' ? 'opacity-60 border-border' : 'border-border shadow-sm'}`}>
              <button onClick={() => toggleStatus(item.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-colors ${item.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-muted-foreground/30 text-transparent hover:border-green-500'}`}>
                <Check size={14} strokeWidth={3} />
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-micro-md font-bold px-1.5 py-0.5 rounded ${getTypeColor(item.type)}`}>
                    {item.type === 'receivable' ? '미수금' : item.type === 'payable' ? '미지급' : '업무'}
                  </span>
                  <span className="text-micro-md text-muted-foreground">{item.date}</span>
                </div>
                <div className={`font-bold text-sm ${item.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.title}</div>
                {item.amount > 0 && (
                  <div className={`text-xs font-black mt-1 ${item.type === 'receivable' ? 'text-blue-500' : 'text-red-500'}`}>{formatCurrency(item.amount)}원</div>
                )}
              </div>
              <button onClick={() => deleteItem(item.id)} className="text-muted-foreground/30 hover:text-destructive p-2"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChecklistView;
