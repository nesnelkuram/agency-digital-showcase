import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export type CalendarViewMode = 'month' | 'week' | 'day';

interface CalendarHeaderProps {
  mode: CalendarViewMode;
  onModeChange: (mode: CalendarViewMode) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  readOnly?: boolean;
}

const MONTH_LABELS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function titleForMode(mode: CalendarViewMode, date: Date): string {
  if (mode === 'month') {
    return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
  }
  if (mode === 'day') {
    return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
  }
  // week — start of week (Mon)
  const start = new Date(date);
  const dayOfWeek = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dayOfWeek);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTH_LABELS[start.getMonth()]} – ${end.getDate()} ${MONTH_LABELS[end.getMonth()]} ${end.getFullYear()}`;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({ mode, onModeChange, currentDate, onDateChange }) => {
  const shift = (direction: -1 | 1) => {
    const d = new Date(currentDate);
    if (mode === 'month') d.setMonth(d.getMonth() + direction);
    else if (mode === 'week') d.setDate(d.getDate() + 7 * direction);
    else d.setDate(d.getDate() + direction);
    onDateChange(d);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-neutral-100 bg-white rounded-t-xl">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="p-1.5 hover:bg-neutral-100 rounded-lg"
        >
          <ChevronLeft className="w-4 h-4 text-neutral-600" />
        </button>
        <button
          type="button"
          onClick={() => onDateChange(new Date())}
          className="px-3 py-1.5 font-grotesk text-xs font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg inline-flex items-center gap-1"
        >
          <Calendar className="w-3.5 h-3.5" />
          Bugün
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          className="p-1.5 hover:bg-neutral-100 rounded-lg"
        >
          <ChevronRight className="w-4 h-4 text-neutral-600" />
        </button>
        <span className="ml-2 font-grotesk text-sm font-semibold text-[#171717]">
          {titleForMode(mode, currentDate)}
        </span>
      </div>

      <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-full">
        {(['month', 'week', 'day'] as CalendarViewMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={`px-3 py-1 rounded-full font-grotesk text-xs font-medium transition-colors ${
              mode === m ? 'bg-white text-[#171717] shadow-sm' : 'text-neutral-500 hover:text-[#171717]'
            }`}
          >
            {m === 'month' ? 'Ay' : m === 'week' ? 'Hafta' : 'Gün'}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CalendarHeader;
