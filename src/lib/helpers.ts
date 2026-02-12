export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ko-KR', { style: 'decimal' }).format(amount);
};

export const calcPayroll = (daily: number, md: number) => {
  const gross = (daily || 0) * (md || 0);
  const tax = Math.floor(gross * 0.033);
  const net = gross - tax;
  return { gross, tax, net };
};

export const normalizeText = (v: unknown) => String(v ?? '').replace(/\uFEFF/g, '').trim();

export const int = (v: unknown, fallback = 0) => {
  const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) ? n : fallback;
};

export const num = (v: unknown, fallback = 0) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
};

export const parseKoreanDateToISO = (raw: string) => {
  const s = normalizeText(raw);
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = s.match(/(\d{2,4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (m) {
    let y = int(m[1]);
    if (y < 100) y = 2000 + y;
    const mm = int(m[2]);
    const dd = int(m[3]);
    if (y >= 1900 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
};

export const median = (arr: number[]) => {
  const a = arr.filter(n => Number.isFinite(n)).slice().sort((x, y) => x - y);
  if (a.length === 0) return 0;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
};

export const formatMd = (md: number) => {
  if (!Number.isFinite(md)) return '0';
  return Number.isInteger(md) ? md.toFixed(0) : md.toFixed(1);
};

export const formatCurrencyShort = (amount: number) => {
  const a = Math.abs(amount || 0);
  if (a >= 100000000) return `${(amount / 100000000).toFixed(1)}억`;
  if (a >= 10000) return `${(amount / 10000).toFixed(0)}만`;
  if (a >= 1000) return `${(amount / 1000).toFixed(0)}천`;
  return `${formatCurrency(amount)}원`;
};

export const SITE_COLOR_THEMES = [
  { header: 'bg-gray-100 text-gray-800 dark:bg-gray-700/60 dark:text-gray-100', border: 'border-gray-200 dark:border-gray-700' },
  { header: 'bg-orange-50 text-orange-800 dark:bg-orange-800/40 dark:text-orange-100', border: 'border-orange-200 dark:border-orange-800' },
  { header: 'bg-gray-50 text-gray-700 dark:bg-gray-700/50 dark:text-gray-200', border: 'border-gray-200 dark:border-gray-700' },
  { header: 'bg-amber-50 text-amber-800 dark:bg-amber-800/30 dark:text-amber-100', border: 'border-amber-200 dark:border-amber-800' },
  { header: 'bg-stone-100 text-stone-800 dark:bg-stone-700/50 dark:text-stone-100', border: 'border-stone-200 dark:border-stone-700' },
  { header: 'bg-orange-100 text-orange-900 dark:bg-orange-800/50 dark:text-orange-50', border: 'border-orange-300 dark:border-orange-800' },
  { header: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700/50 dark:text-neutral-100', border: 'border-neutral-200 dark:border-neutral-700' },
  { header: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700/50 dark:text-zinc-100', border: 'border-zinc-200 dark:border-zinc-700' },
];

export const hashString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
};

export const getSiteTheme = (siteId: string) => {
  if (!siteId) return SITE_COLOR_THEMES[0];
  return SITE_COLOR_THEMES[hashString(siteId) % SITE_COLOR_THEMES.length];
};

export const formatDateFriendly = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (d.getTime() === t.getTime()) return "오늘";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};
