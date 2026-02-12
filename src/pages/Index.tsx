import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LayoutDashboard, Wallet, CheckSquare, Users, Sun, Moon, Bell, RefreshCw, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import type { Toast } from '@/types';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import HomeView from '@/views/HomeView';
import ExpenseView from '@/views/ExpenseView';
import ChecklistView from '@/views/ChecklistView';
import AdminView from '@/views/AdminView';
import WorkLogModal from '@/components/app/WorkLogModal';
import NotificationModal from '@/components/app/NotificationModal';

const Index = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [darkMode, setDarkMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLogModalOpen, setLogModalOpen] = useState(false);
  const [logModalDate, setLogModalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isNotifModalOpen, setNotifModalOpen] = useState(false);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 1500);
  }, []);

  const { data, setData, loading, reload } = useSupabaseData(addToast);

  useEffect(() => {
    if (localStorage.getItem('theme') === 'dark' || !localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {document.documentElement.classList.add('dark');localStorage.setItem('theme', 'dark');} else
    {document.documentElement.classList.remove('dark');localStorage.setItem('theme', 'light');}
  };

  const clearCache = async () => {
    try {
      if ('caches' in window) {const keys = await caches.keys();await Promise.all(keys.map((k) => caches.delete(k)));}
      try {sessionStorage.clear();} catch {}
      await reload();
      addToast('캐시를 정리했습니다', 'success');
    } catch {addToast('캐시 정리 실패', 'error');}
  };

  const recentSiteIds = useMemo(() => Array.from(new Set(data.workLogs.map((l) => l.site_id))).slice(0, 5), [data.workLogs]);
  const recentWorkerIds = useMemo(() => Array.from(new Set(data.workLogs.map((l) => l.worker_id))).slice(0, 5), [data.workLogs]);

  const navItems = [
  { id: 'home', icon: LayoutDashboard, label: '작업 캘린더', mobileIcon: Calendar, mobileLabel: '달력' },
  { id: 'expenses', icon: Wallet, label: '수익/경비', mobileIcon: Wallet, mobileLabel: '수익' },
  { id: 'checklist', icon: CheckSquare, label: '자금/업무', mobileIcon: CheckSquare, mobileLabel: '업무' },
  { id: 'admin', icon: Users, label: '관리자 설정', mobileIcon: Users, mobileLabel: '관리' }];


  return (
    <div className="min-h-screen bg-background text-foreground transition-colors md:pl-64 safe-area-pb">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex-col p-6 z-50">
        <div className="flex items-center gap-3 mb-10">
          <span onClick={() => setActiveTab('home')} className="font-extrabold text-3xl text-foreground tracking-tighter cursor-pointer">INOPNC</span>
        </div>
        <nav className="space-y-2 flex-1">
          {navItems.map((item) =>
          <button key={item.id} onClick={() => setActiveTab(item.id)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === item.id ? 'bg-primary text-primary-foreground shadow-lg shadow-neon' : 'text-muted-foreground hover:bg-muted'}`}>
              <item.icon size={20} /> {item.label}
            </button>
          )}
        </nav>
        <div className="mt-auto pt-6 border-t border-border space-y-3">
          <button onClick={() => setNotifModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted transition-colors relative">
            <Bell size={18} /> 알림
            {data.checklists.some((i) => i.status !== 'completed') && <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>}
          </button>
          <div className="flex items-center gap-2 px-4">
            <button onClick={toggleTheme} className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />} {darkMode ? '라이트 모드' : '다크 모드'}
            </button>
            <button onClick={clearCache} className="p-2 text-muted-foreground hover:text-primary transition-colors" title="캐시 정리"><RefreshCw size={16} /></button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden sticky top-0 z-40 bg-background/80 backdrop-blur-md px-4 py-4 flex justify-between items-center border-b border-border">
        <span onClick={() => setActiveTab('home')} className="font-extrabold text-2xl text-foreground tracking-tighter cursor-pointer">INOPNC</span>
        <div className="flex items-center gap-3">
          <button onClick={clearCache} className="p-2 bg-card rounded-full shadow-sm text-muted-foreground" title="캐시 정리"><RefreshCw size={18} /></button>
          <button onClick={toggleTheme} className="p-2 bg-card rounded-full shadow-sm text-foreground">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button onClick={() => setNotifModalOpen(true)} className="p-2 bg-card rounded-full shadow-sm text-foreground relative">
            <Bell size={18} />
            {data.checklists.some((i) => i.status !== 'completed') && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-card"></span>}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen">
        {loading ?
        <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div> :

        <>
            {activeTab === 'home' && <HomeView data={data} setData={setData} addToast={addToast} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setLogModalOpen={setLogModalOpen} setLogModalDate={setLogModalDate} recentSiteIds={recentSiteIds} recentWorkerIds={recentWorkerIds} />}
            {activeTab === 'expenses' && <ExpenseView data={data} setData={setData} addToast={addToast} recentSiteIds={recentSiteIds} recentWorkerIds={recentWorkerIds} />}
            {activeTab === 'checklist' && <ChecklistView data={data} setData={setData} addToast={addToast} />}
            {activeTab === 'admin' && <AdminView data={data} setData={setData} addToast={addToast} />}
          </>
        }
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 flex justify-between items-center z-40 safe-area-pb my-0 py-[15px]">
        {navItems.map((item) =>
        <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1 ${activeTab === item.id ? 'text-primary' : 'text-muted-foreground'}`}>
            <item.mobileIcon size={24} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            <span className="text-micro-md font-medium">{item.mobileLabel}</span>
          </button>
        )}
      </nav>

      {/* Modals */}
      <WorkLogModal data={data} setData={setData} addToast={addToast} isLogModalOpen={isLogModalOpen} setLogModalOpen={setLogModalOpen} logModalDate={logModalDate} recentSiteIds={recentSiteIds} recentWorkerIds={recentWorkerIds} />
      <NotificationModal isOpen={isNotifModalOpen} onClose={() => setNotifModalOpen(false)} checklists={data.checklists} />

      {/* Toasts */}
      <div className="fixed top-14 md:top-6 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) =>
        <div key={toast.id} className="bg-foreground text-background px-3 py-2 rounded-xl shadow-lg flex items-center text-xs font-semibold animate-slide-in-top">
            {toast.type === 'success' && <CheckCircle size={13} className="mr-1.5 text-green-400 shrink-0" />}
            {toast.message}
          </div>
        )}
      </div>
    </div>);

};

export default Index;