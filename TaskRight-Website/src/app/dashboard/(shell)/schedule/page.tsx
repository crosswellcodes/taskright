import Link from 'next/link';
import { requireSession, businessGet, getTimeZone } from '@/lib/serverApi';
import {
  type Forecast, type ForecastDay, LIFECYCLE_CLASS, LIFECYCLE_DOT, LIFECYCLE_LABEL,
  callsForDay, dayKey, formatLongDay, formatMonth, isDateKey, isMonthKey, monthGrid, shiftMonth, todayKey,
} from '@/lib/schedule';

type Assignment = {
  selectionCycleId: number;
  teamMemberName: string | null;
  teamName: string | null;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function scheduleHref(month: string, day?: string) {
  return `/dashboard/schedule?month=${month}${day ? `&day=${day}` : ''}`;
}

function DaySnapshot({ day, dayData, assignments, month }: {
  day: string;
  dayData: ForecastDay | undefined;
  assignments: Assignment[];
  month: string;
}) {
  const calls = dayData ? callsForDay(dayData) : [];
  const assigneeOf = new Map(assignments.map(a => [a.selectionCycleId, a.teamMemberName || (a.teamName ? `${a.teamName} (group)` : null)]));
  const unassigned = calls.filter(c => !assigneeOf.get(c.selectionCycleId) && c.lifecycleState !== 'completed').length;

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <p className="text-text-muted text-xs font-semibold uppercase tracking-wide mb-0.5">Day snapshot</p>
          <h3 className="text-text font-semibold text-base">{formatLongDay(day)}</h3>
        </div>
        <Link href={scheduleHref(month)} className="text-text-muted text-sm hover:text-text" aria-label="Close day snapshot">✕</Link>
      </div>

      {calls.length === 0 ? (
        <p className="text-text-muted text-sm">Nothing scheduled this day.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-bg rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-text">{calls.length}</p>
              <p className="text-text-muted text-xs">call{calls.length === 1 ? '' : 's'}</p>
            </div>
            <div className="bg-bg rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-text">{dayData!.totalHours}</p>
              <p className="text-text-muted text-xs">hours</p>
            </div>
            <div className={`rounded-lg p-2.5 text-center ${unassigned > 0 ? 'bg-amber-50' : 'bg-bg'}`}>
              <p className={`text-lg font-bold ${unassigned > 0 ? 'text-amber-700' : 'text-text'}`}>{unassigned}</p>
              <p className="text-text-muted text-xs">unassigned</p>
            </div>
          </div>
          <div>
            {calls.map(call => {
              const assignee = assigneeOf.get(call.selectionCycleId);
              return (
                <Link
                  key={call.selectionCycleId}
                  href={`/dashboard/schedule/calls/${call.selectionCycleId}`}
                  className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0 hover:bg-bg -mx-2 px-2 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-text text-sm font-medium truncate">{call.name}</p>
                    <p className="text-text-muted text-xs truncate">
                      {call.serviceName || 'Service'} · {assignee || 'Unassigned'}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${LIFECYCLE_CLASS[call.lifecycleState]}`}>
                    {LIFECYCLE_LABEL[call.lifecycleState]}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ month?: string; day?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;

  const today = todayKey(await getTimeZone(session));
  const day = isDateKey(params.day) ? params.day : undefined;
  // A selected day must sit inside the visible grid (its data comes from the
  // same ranged fetch) — otherwise follow the day to its own month.
  let month = isMonthKey(params.month) ? params.month : (day ?? today).slice(0, 7);
  if (day && !monthGrid(month).days.includes(day)) month = day.slice(0, 7);
  const grid = monthGrid(month);

  const [forecastRes, assignmentsRes] = await Promise.all([
    businessGet<{ summary: Forecast }>(session, `/selections?from=${grid.from}&to=${grid.to}`),
    day ? businessGet<{ assignments: Assignment[] }>(session, `/assignments?serviceDate=${day}`) : null,
  ]);
  const forecast = forecastRes?.summary ?? { totalCustomers: 0, upcomingServices: [] };
  const byDay = new Map(forecast.upcomingServices.map(d => [dayKey(d.serviceDate), d]));
  const monthHasCalls = grid.days.some(d => d.startsWith(month) && byDay.has(d));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text mb-1">Schedule</h2>
        <p className="text-text-muted text-sm">Every service call, by day. Pick a day to see its snapshot.</p>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${day ? 'xl:grid-cols-[1fr_360px]' : ''}`}>
        <div className="bg-white rounded-2xl border border-border p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h3 className="text-text font-semibold text-base">{formatMonth(month)}</h3>
            <div className="flex items-center gap-1.5">
              <Link href={scheduleHref(shiftMonth(month, -1))} className="px-2.5 py-1 rounded-lg border border-border text-sm text-text hover:bg-bg" aria-label="Previous month">‹</Link>
              <Link href={scheduleHref(today.slice(0, 7), today)} className="px-3 py-1 rounded-lg border border-border text-sm text-text hover:bg-bg">Today</Link>
              <Link href={scheduleHref(shiftMonth(month, 1))} className="px-2.5 py-1 rounded-lg border border-border text-sm text-text hover:bg-bg" aria-label="Next month">›</Link>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(w => <p key={w} className="text-text-muted text-xs text-center font-medium py-1">{w}</p>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.days.map(d => {
              const data = byDay.get(d);
              const calls = data ? callsForDay(data) : [];
              const inMonth = d.startsWith(month);
              const isToday = d === today;
              const isSelected = d === day;
              const counts = { proposed: 0, confirmed: 0, completed: 0 };
              calls.forEach(c => { counts[c.lifecycleState] += 1; });
              return (
                <Link
                  key={d}
                  href={scheduleHref(month, d)}
                  className={`min-h-16 sm:min-h-24 rounded-lg border p-1.5 sm:p-2 flex flex-col transition-colors ${
                    isSelected ? 'border-brand bg-brand/5' : 'border-border hover:bg-bg'
                  } ${inMonth ? '' : 'opacity-40'}`}
                >
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand text-white' : 'text-text'}`}>
                    {Number(d.slice(8))}
                  </span>
                  {calls.length > 0 && (
                    <div className="mt-auto">
                      <p className="text-text text-xs font-semibold">
                        {calls.length}<span className="hidden sm:inline"> call{calls.length === 1 ? '' : 's'}</span>
                      </p>
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {(['proposed', 'confirmed', 'completed'] as const).flatMap(s =>
                          Array.from({ length: Math.min(counts[s], 6) }, (_, i) => (
                            <span key={`${s}-${i}`} className={`w-1.5 h-1.5 rounded-full ${LIFECYCLE_DOT[s]}`} />
                          )),
                        )}
                      </div>
                      <p className="hidden sm:block text-text-muted text-[11px] mt-0.5">{data!.totalHours} hrs</p>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4">
            {(['proposed', 'confirmed', 'completed'] as const).map(s => (
              <span key={s} className="flex items-center gap-1.5 text-text-muted text-xs">
                <span className={`w-2 h-2 rounded-full ${LIFECYCLE_DOT[s]}`} />{LIFECYCLE_LABEL[s]}
              </span>
            ))}
          </div>

          {!monthHasCalls && (
            <div className="mt-4 rounded-xl bg-bg p-4">
              <p className="text-text text-sm font-medium">No service calls in {formatMonth(month)}.</p>
              <p className="text-text-muted text-xs mt-0.5">
                {forecast.totalCustomers === 0
                  ? 'Add customers and give them a service — their calls land here automatically, from proposed to completed.'
                  : 'Calls appear here as your customers’ services come due.'}
              </p>
            </div>
          )}
        </div>

        {day && (
          <DaySnapshot day={day} dayData={byDay.get(day)} assignments={assignmentsRes?.assignments ?? []} month={month} />
        )}
      </div>
    </div>
  );
}
