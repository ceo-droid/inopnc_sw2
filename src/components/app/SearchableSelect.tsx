import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';

interface SelectOption {
  id: string;
  label: string;
  sub?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  recentIds?: string[];
}

const SearchableSelect = ({ options, value, onChange, placeholder, recentIds = [] }: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.id === value);

  const sortedOptions = useMemo(() => {
    const recents = options.filter(o => recentIds.includes(o.id));
    const others = options.filter(o => !recentIds.includes(o.id));
    const uniqueRecents = Array.from(new Set(recents.map(o => o.id))).map(id => recents.find(o => o.id === id)!);
    const uniqueOthers = others.filter(o => !uniqueRecents.some(r => r.id === o.id));
    const all = [...uniqueRecents, ...uniqueOthers];
    if (!search) return all;
    return all.filter(o => o.label.toLowerCase().includes(search.toLowerCase()) || (o.sub && o.sub.toLowerCase().includes(search.toLowerCase())));
  }, [options, recentIds, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div
        className={`w-full p-2.5 rounded-xl bg-muted border text-xs font-bold cursor-pointer flex justify-between items-center transition-all ${isOpen ? 'border-primary ring-1 ring-primary' : 'border-border text-foreground'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? '' : 'text-muted-foreground'}>{selectedOption ? selectedOption.label : placeholder}</span>
        <div className="flex items-center gap-1">
          {value && (
            <div onClick={(e) => { e.stopPropagation(); onChange(''); setSearch(''); }} className="p-1 hover:bg-secondary rounded-full">
              <X size={12} />
            </div>
          )}
          <ChevronRight size={14} className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-[-90deg]' : 'rotate-90'}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-60 overflow-hidden flex flex-col animate-fade-in">
          <div className="p-2 border-b border-border sticky top-0 bg-card">
            <div className="flex items-center gap-2 bg-muted rounded-lg px-2 py-1.5 border border-transparent focus-within:border-primary/50 transition-colors">
              <Search size={12} className="text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                className="w-full bg-transparent text-xs outline-none text-foreground"
                placeholder="검색어 입력..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {sortedOptions.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">검색 결과가 없습니다.</div>}
            {sortedOptions.map((opt, idx) => {
              const isRecent = recentIds.includes(opt.id);
              return (
                <button
                  key={`${opt.id}-${idx}`}
                  onClick={() => { onChange(opt.id); setIsOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-accent text-xs transition-colors border-b border-border last:border-0 flex justify-between items-center group ${value === opt.id ? 'bg-accent text-primary' : 'text-foreground'}`}
                >
                  <div>
                    <div className="font-bold group-hover:text-primary transition-colors">{opt.label}</div>
                    {opt.sub && <div className="text-[10px] text-muted-foreground">{opt.sub}</div>}
                  </div>
                  {isRecent && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">최근</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
