import type { AppState } from '@/types';

export const STORAGE_KEY = 'app_data_inopnc_v1';

export const loadInitialData = (): AppState => {
  const initialSites = [
    { id: 's1', name: '포항 환호 1블럭', company_name: '현대건설', budget: 150000000, status: 'active' as const },
    { id: 's2', name: '포항 환호 2블럭', company_name: '현대건설', budget: 120000000, status: 'active' as const },
    { id: 's3', name: '힐스테이트 레이크 송도 4차', company_name: '현대건설', budget: 200000000, status: 'scheduled' as const },
    { id: 's4', name: '동탄 파크릭스', company_name: '현대건설', budget: 80000000, status: 'completed' as const },
    { id: 's5', name: '용인 둔전', company_name: '현대건설', budget: 50000000, status: 'active' as const },
    { id: 's6', name: '창원 마크로엔', company_name: '현대건설', budget: 90000000, status: 'active' as const },
  ];

  const initialWorkers = [
    { id: 'w1', name: '김반장', daily: 250000 },
    { id: 'w2', name: '이두환', daily: 180000 },
    { id: 'w3', name: '송용호', daily: 180000 },
    { id: 'w4', name: '박상호', daily: 170000 },
    { id: 'w5', name: '최중주', daily: 200000 },
  ];

  const today = new Date();
  const initialWorkLogs = Array.from({ length: 10 }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (i % 5));
    return {
      id: `log-${i}`,
      date: date.toISOString().split('T')[0],
      site_id: initialSites[i % 3].id,
      worker_id: initialWorkers[i % initialWorkers.length].id,
      md: 1.0,
      note: i % 2 === 0 ? '오전 비' : '',
    };
  });

  return {
    sites: initialSites,
    workers: initialWorkers,
    workLogs: initialWorkLogs,
    transactions: [],
    checklists: [],
  };
};
