import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarStripProps {
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
}

const CalendarStrip: React.FC<CalendarStripProps> = ({ onDateSelect, selectedDate }) => {
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const today = new Date();
  
  // Generate an array of 14 days (2 weeks) starting from 7 days ago
  const dates = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 7 + i);
    return date;
  });

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const formatDayInitial = (date: Date) => {
    return daysOfWeek[date.getDay()][0];
  };

  const formatDate = (date: Date) => {
    return date.getDate();
  };

  return (
    <div className="relative">
      <div className="flex items-center space-x-1 overflow-x-auto pb-2 scrollbar-hide">
        {dates.map((date, index) => {
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);
          
          return (
            <button
              key={index}
              onClick={() => onDateSelect(date)}
              className={`flex flex-col items-center justify-center w-12 h-16 rounded-lg transition-colors ${
                isSelected 
                  ? 'bg-sky-600 text-white' 
                  : isToday 
                    ? 'bg-slate-700 text-white' 
                    : 'hover:bg-slate-700/50 text-slate-300'
              }`}
            >
              <span className="text-xs font-medium">{formatDayInitial(date)}</span>
              <span className="text-lg font-semibold mt-1">{formatDate(date)}</span>
            </button>
          );
        })}
      </div>
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default CalendarStrip;
