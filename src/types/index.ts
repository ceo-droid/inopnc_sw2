export type ExpenseCategory = '아침' | '점심' | '저녁' | '주유' | '숙박' | '자재' | '기타';

export interface Transaction {
  id: string;
  date: string;
  site_id: string;
  worker_id?: string;
  type: 'expense';
  category: ExpenseCategory | string;
  description: string;
  amount: number;
}

export interface Worker {
  id: string;
  name: string;
  daily: number;
}

export type SiteStatus = 'scheduled' | 'active' | 'completed';

export interface Site {
  id: string;
  name: string;
  budget: number;
  company_name?: string;
  status: SiteStatus;
}

export interface WorkLog {
  id: string;
  date: string;
  site_id: string;
  worker_id: string;
  md: number;
  note?: string;
}

export type ChecklistType = 'receivable' | 'payable' | 'task';
export type ChecklistStatus = 'pending' | 'invoiced' | 'completed';

export interface ChecklistItem {
  id: string;
  type: ChecklistType;
  date: string;
  title: string;
  amount: number;
  status: ChecklistStatus;
  memo?: string;
}

export interface AppState {
  sites: Site[];
  workers: Worker[];
  workLogs: WorkLog[];
  transactions: Transaction[];
  checklists: ChecklistItem[];
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
