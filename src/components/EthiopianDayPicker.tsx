import React, { useState } from 'react';
import { gregorianToEthiopian, ethiopianToGregorian, ETHIOPIAN_MONTHS } from '../lib/ethiopianCalendar';

interface Props {
  selected: Date | undefined;
  onSelect: (date: Date) => void;
  disabled?: { before: Date };
}

export function EthiopianDayPicker({ selected, onSelect, disabled }: Props) {
  const initialEth = selected ? gregorianToEthiopian(selected) : gregorianToEthiopian(new Date());
  const [currentYear, setCurrentYear] = useState(initialEth.year);
  const [currentMonth, setCurrentMonth] = useState(initialEth.month);

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(13);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 13) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const daysInMonth = currentMonth === 13 ? (currentYear % 4 === 3 ? 6 : 5) : 30;
  
  // Find the day of the week for the 1st of the current Ethiopian month
  const firstDayGregorian = ethiopianToGregorian(currentYear, currentMonth, 1);
  const startingDayOfWeek = firstDayGregorian.getDay(); // 0 for Sunday

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: startingDayOfWeek }, (_, i) => i);

  return (
    <div className="p-4 border rounded-lg bg-white inline-block">
      <div className="flex justify-between items-center mb-4">
        <button onClick={prevMonth} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">&lt;</button>
        <div className="font-bold">
          {ETHIOPIAN_MONTHS[currentMonth - 1]} {currentYear}
        </div>
        <button onClick={nextMonth} className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">&gt;</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2 font-medium text-gray-500">
        <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {blanks.map(b => <div key={`blank-${b}`} className="p-2" />)}
        {days.map(day => {
          const date = ethiopianToGregorian(currentYear, currentMonth, day);
          const isDisabled = disabled?.before && date < new Date(disabled.before.setHours(0,0,0,0));
          const isSelected = selected && date.toDateString() === selected.toDateString();
          
          return (
            <button
              key={day}
              disabled={isDisabled}
              onClick={() => onSelect(date)}
              className={`p-2 rounded-full w-9 h-9 flex items-center justify-center ${
                isDisabled ? 'text-gray-300 cursor-not-allowed' :
                isSelected ? 'bg-blue-600 text-white font-bold' :
                'hover:bg-gray-100'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
