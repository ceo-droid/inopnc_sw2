import React from 'react';
import { X, CheckCircle } from 'lucide-react';
import type { ChecklistItem } from '@/types';
import { formatCurrency } from '@/lib/helpers';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  checklists: ChecklistItem[];
}

const NotificationModal = ({ isOpen, onClose, checklists }: NotificationModalProps) => {
  if (!isOpen) return null;
  const pendingItems = checklists.filter(c => c.status === 'pending');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-6 border-b border-border shrink-0">
          <h3 className="text-xl font-bold text-foreground">알림 (할 일)</h3>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full text-muted-foreground"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto">
          {pendingItems.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">예정된 할 일이 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {pendingItems.map(item => (
                <div key={item.id} className="bg-muted p-4 rounded-2xl border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-micro-md font-bold px-1.5 py-0.5 rounded ${item.type === 'receivable' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : item.type === 'payable' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                      {item.type === 'receivable' ? '미수금' : item.type === 'payable' ? '미지급' : '업무'}
                    </span>
                    <span className="text-micro-md text-muted-foreground">{item.date}</span>
                  </div>
                  <div className="font-bold text-foreground text-sm mb-1">{item.title}</div>
                  {item.amount > 0 && <div className="text-right font-black text-xs text-muted-foreground">{formatCurrency(item.amount)}원</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border bg-muted">
          <button onClick={onClose} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-lg shadow-neon">확인</button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
