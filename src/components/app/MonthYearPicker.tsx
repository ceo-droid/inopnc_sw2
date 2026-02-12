import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthYearPickerProps {
  date: Date;
  onChange: (d: Date) => void;
}

const MonthYearPicker = ({ date, onChange }: MonthYearPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(date.getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMonthSelect = (month: number) => {
    onChange(new Date(viewYear, month, 1));
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      <div className="flex items-center gap-2 sm:gap-4 bg-muted px-2 sm:px-4 py-1.5 rounded-xl border border-border shadow-sm">
        <button onClick={(e) => { e.stopPropagation(); onChange(new Date(date.getFullYear(), date.getMonth() - 1, 1)); }} className="p-1 rounded-full hover:bg-secondary text-muted-foreground transition-colors">
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => { setViewYear(date.getFullYear()); setIsOpen(!isOpen); }} className="text-base sm:text-lg font-black text-foreground tabular-nums tracking-tight hover:text-primary transition-colors">
          {date.getFullYear()}.{String(date.getMonth() + 1).padStart(2, '0')}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onChange(new Date(date.getFullYear(), date.getMonth() + 1, 1)); }} className="p-1 rounded-full hover:bg-secondary text-muted-foreground transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-card border border-border rounded-2xl shadow-2xl z-50 w-64 p-4 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setViewYear(viewYear - 1)} className="p-1 hover:bg-secondary rounded-full"><ChevronLeft size={16} /></button>
            <span className="font-bold text-lg text-foreground">{viewYear}년</span>
            <button onClick={() => setViewYear(viewYear + 1)} className="p-1 hover:bg-secondary rounded-full"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                onClick={() => handleMonthSelect(i)}
                className={`py-2 rounded-lg text-sm font-bold transition-colors ${date.getMonth() === i && date.getFullYear() === viewYear ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary text-muted-foreground'}`}
              >
                {i + 1}월
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthYearPicker;
