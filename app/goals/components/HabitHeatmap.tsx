"use client";

import { useMemo } from "react";

export default function HabitHeatmap({ startDate, endDate, scheduleDays, doneDates, today, dateValues, dailyTarget }: {
  startDate: string;
  endDate: string | null;
  scheduleDays: number[];
  doneDates: Set<string>;
  today: string;
  dateValues?: Map<string, number>;
  dailyTarget?: number | null;
}) {
  const { weeks } = useMemo(() => {
    const todayDate = new Date(today + 'T12:00:00');
    const goalStart = new Date(startDate + 'T12:00:00');
    const goalEnd = endDate ? new Date(endDate + 'T12:00:00') : todayDate;
    const daysArray: { date: string; status: 'done' | 'missed' | 'today' | 'future' | 'off'; dayOfWeek: number }[] = [];

    const d = new Date(goalStart);
    while (d <= goalEnd) {
      const dateStr = d.toISOString().split('T')[0];
      const dow = d.getDay();
      const isScheduled = scheduleDays.length === 0 || scheduleDays.includes(dow);

      if (!isScheduled) {
        daysArray.push({ date: dateStr, status: 'off', dayOfWeek: dow });
      } else if (d > todayDate) {
        daysArray.push({ date: dateStr, status: 'future', dayOfWeek: dow });
      } else if (doneDates.has(dateStr)) {
        daysArray.push({ date: dateStr, status: 'done', dayOfWeek: dow });
      } else if (dateStr === today) {
        daysArray.push({ date: dateStr, status: 'today', dayOfWeek: dow });
      } else {
        daysArray.push({ date: dateStr, status: 'missed', dayOfWeek: dow });
      }
      d.setDate(d.getDate() + 1);
    }

    const weeksArray: typeof daysArray[] = [];
    let currentWeek: typeof daysArray = [];

    if (daysArray.length > 0) {
      const firstDow = daysArray[0].dayOfWeek;
      const mondayOffset = firstDow === 0 ? 6 : firstDow - 1;
      for (let i = 0; i < mondayOffset; i++) {
        currentWeek.push({ date: '', status: 'off', dayOfWeek: -1 });
      }
    }

    for (const day of daysArray) {
      const mondayDow = day.dayOfWeek === 0 ? 6 : day.dayOfWeek - 1;
      if (mondayDow === 0 && currentWeek.length > 0) {
        weeksArray.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) weeksArray.push(currentWeek);

    return { weeks: weeksArray };
  }, [today, startDate, endDate, scheduleDays, doneDates]);

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5">
        <div className="flex flex-col gap-0.5 mr-1">
          {dayLabels.map((label, i) => (
            <div key={i} className="w-3 h-3 text-[9px] text-zinc-400 dark:text-zinc-500 flex items-center justify-center">
              {i % 2 === 0 ? label : ''}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day, di) => (
              <div
                key={di}
                title={day.date ? `${new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${
                  day.status === 'done' ? 'Done' : day.status === 'today' ? 'In progress' : day.status === 'missed' ? 'Missed' : day.status === 'off' ? 'Off day' : 'Upcoming'
                }` : ''}
                className={`w-3 h-3 rounded-sm ${
                  day.date === '' ? 'bg-zinc-200 dark:bg-zinc-700' :
                  day.status === 'done' ? (
                    dateValues && dailyTarget && dailyTarget > 0
                      ? (() => {
                          const val = dateValues.get(day.date) || 0;
                          const pct = val / dailyTarget;
                          if (pct >= 1.5) return 'bg-emerald-600 dark:bg-emerald-500';
                          if (pct >= 1) return 'bg-green-500 dark:bg-green-400';
                          if (pct >= 0.5) return 'bg-amber-400 dark:bg-amber-400';
                          return 'bg-orange-400 dark:bg-orange-400';
                        })()
                      : 'bg-green-500 dark:bg-green-400'
                  ) :
                  day.status === 'today' ? 'bg-blue-400 dark:bg-blue-500 ring-1 ring-blue-500/50' :
                  day.status === 'missed' ? 'bg-red-400 dark:bg-red-500/70' :
                  day.status === 'off' ? 'bg-zinc-200 dark:bg-zinc-700' :
                  'bg-zinc-200 dark:bg-zinc-700'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
        {dateValues && dailyTarget && dailyTarget > 0 ? (
          <>
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
            <span>150%+</span>
            <div className="w-2.5 h-2.5 rounded-sm bg-green-500 dark:bg-green-400 ml-1" />
            <span>100%</span>
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-400 ml-1" />
            <span>50%+</span>
            <div className="w-2.5 h-2.5 rounded-sm bg-orange-400 ml-1" />
            <span>&lt;50%</span>
          </>
        ) : (
          <>
            <div className="w-2.5 h-2.5 rounded-sm bg-green-500 dark:bg-green-400" />
            <span>Done</span>
          </>
        )}
        <div className="w-2.5 h-2.5 rounded-sm bg-blue-400 dark:bg-blue-500 ml-1" />
        <span>Today</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-red-400 dark:bg-red-500/70 ml-1" />
        <span>Missed</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-zinc-200 dark:bg-zinc-700 ml-1" />
        <span>Off</span>
      </div>
    </div>
  );
}
