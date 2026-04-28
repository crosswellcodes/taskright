'use client';

import { useState, useEffect } from 'react';

type Hotspot = {
  title: string;
  description: string;
  top: string;
  left: string;
};

type Screen = {
  label: string;
  render: (onCalViewChange?: (v: boolean) => void) => React.ReactNode;
  hotspots: Hotspot[];
  calHotspots?: Hotspot[];
};

// ─── Business screen mocks ────────────────────────────────────────────────────

function BusinessDashboard({ onViewChange }: { onViewChange?: (v: boolean) => void }) {
  const [calView, setCalView] = useState(false);
  function toggle(v: boolean) { setCalView(v); onViewChange?.(v); }

  useEffect(() => {
    const t1 = setTimeout(() => { setCalView(true);  onViewChange?.(true);  }, 1500);
    const t2 = setTimeout(() => { setCalView(false); onViewChange?.(false); }, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = [
    { date: 'Mon, Mar 24', cycle: 'Weekly Clean', total: 4, submitted: 2, pending: 2 },
    { date: 'Thu, Mar 28', cycle: 'Weekly Clean', total: 3, submitted: 3, pending: 0 },
    { date: 'Wed, Apr 2',  cycle: 'Deep Clean',   total: 3, submitted: 1, pending: 2 },
  ];

  function barColor(s: number, t: number) {
    if (s === 0) return '#2563eb';
    if (s === t) return '#10b981';
    return '#f59e0b';
  }

  // March 2026 grid — Mar 1 = Sunday (index 0)
  // Each entry: { day, month: 'mar'|'apr', dot?: string, selected?: boolean, today?: boolean }
  type Cell = { day: number; faded?: boolean; dot?: string; selected?: boolean; today?: boolean };
  const grid: Cell[] = [
    // Week 1
    { day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: 5 }, { day: 6 }, { day: 7 },
    // Week 2
    { day: 8 }, { day: 9 }, { day: 10 }, { day: 11 }, { day: 12 }, { day: 13 }, { day: 14 },
    // Week 3
    { day: 15 }, { day: 16 }, { day: 17, today: true }, { day: 18 }, { day: 19 }, { day: 20 }, { day: 21 },
    // Week 4 — 24 selected (amber), 28 green
    { day: 22 }, { day: 23 }, { day: 24, dot: '#f59e0b', selected: true }, { day: 25 }, { day: 26 }, { day: 27 }, { day: 28, dot: '#10b981' },
    // Week 5 — 29,30,31 Mar then Apr 1,2(blue),3,4
    { day: 29 }, { day: 30 }, { day: 31 }, { day: 1, faded: true }, { day: 2, faded: true, dot: '#f59e0b' }, { day: 3, faded: true }, { day: 4, faded: true },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-2 pb-2 bg-white border-b border-gray-100">
        <p className="text-base font-bold text-[#1a1a1a]">My Business</p>
        <p className="text-xs text-gray-400">30-Day Forecast</p>
      </div>

      {/* List / Calendar toggle */}
      <div className="flex gap-1.5 px-3 pt-2 pb-0.5">
        <button
          onClick={() => toggle(false)}
          className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${
            !calView ? 'bg-white shadow-sm text-[#1a1a1a] border-gray-100' : 'text-gray-400 border-transparent'
          }`}
        >List</button>
        <button
          onClick={() => toggle(true)}
          className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${
            calView ? 'bg-white shadow-sm text-[#1a1a1a] border-gray-100' : 'text-gray-400 border-transparent'
          }`}
        >Calendar</button>
      </div>

      <p className="text-[9px] text-[#2563eb]/60 text-center pb-1 italic font-medium tracking-wide">↑ Interactive — try the toggle</p>

      {calView ? (
        /* ── Calendar view ── */
        <div className="flex-1 overflow-hidden px-2 pb-2">
          {/* Month nav */}
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[10px] text-[#2563eb] font-bold">‹</span>
            <span className="text-[10px] font-bold text-[#1a1a1a]">March 2026</span>
            <span className="text-[10px] text-[#2563eb] font-bold">›</span>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-0.5">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-center text-[8px] font-semibold text-gray-400">{d}</div>
            ))}
          </div>

          {/* Date grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {grid.map((cell, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center
                  ${cell.selected ? 'bg-[#2563eb]' : ''}
                  ${cell.today && !cell.selected ? 'ring-1 ring-gray-300' : ''}`}
                >
                  <span className={`text-[9px] font-semibold
                    ${cell.selected ? 'text-white' : cell.faded ? 'text-gray-300' : 'text-[#1a1a1a]'}`}
                  >
                    {cell.day}
                  </span>
                </div>
                {cell.dot
                  ? <div className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: cell.dot }} />
                  : <div className="w-1 h-1 mt-0.5" />
                }
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex gap-3 px-1 mt-2 mb-1.5">
            {[['#2563eb','Pending'],['#f59e0b','Mixed'],['#10b981','All submitted']].map(([color, label]) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[8px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>

          {/* Upcoming list */}
          <div className="space-y-1">
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wide px-1">Upcoming</p>
            {days.map((d) => (
              <div key={d.date} className="flex items-center gap-2 px-1 py-1 bg-white rounded-lg border border-gray-100">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: barColor(d.submitted, d.total) }} />
                <span className="text-[9px] font-semibold text-[#1a1a1a] flex-1">{d.date}</span>
                <span className="text-[8px] text-gray-400">{d.cycle}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── List view ── */
        <div className="flex-1 overflow-hidden px-3 space-y-2">
          {days.map((d) => {
            const pct = d.total > 0 ? Math.round((d.submitted / d.total) * 100) : 0;
            const color = barColor(d.submitted, d.total);
            return (
              <div key={d.date} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                <div className="mb-1.5">
                  <p className="text-xs font-bold text-[#1a1a1a]">{d.date}</p>
                  <p className="text-[10px] text-gray-400">{d.cycle}</p>
                </div>
                <div className="flex gap-3 mb-1.5">
                  <div className="text-center">
                    <p className="text-sm font-bold text-[#1a1a1a]">{d.total}</p>
                    <p className="text-[9px] text-gray-400">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-[#10b981]">{d.submitted}</p>
                    <p className="text-[9px] text-gray-400">Done</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-[#f59e0b]">{d.pending}</p>
                    <p className="text-[9px] text-gray-400">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold" style={{ color }}>{pct}%</p>
                    <p className="text-[9px] text-gray-400">Rate</p>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BusinessCustomer({ onViewChange }: { onViewChange?: (v: boolean) => void }) {
  const [showList, setShowList] = useState(false);

  function setList(v: boolean) { setShowList(v); onViewChange?.(v); }

  useEffect(() => {
    const t1 = setTimeout(() => setList(true),  1500);
    const t2 = setTimeout(() => setList(false), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customers = [
    { name: 'Nancy Fancy',       phone: '(555) 391-2847', cycles: 1 },
    { name: 'Robert Adams',      phone: '(555) 204-9183', cycles: 1 },
    { name: 'Jennifer Martinez', phone: '(555) 837-2041', cycles: 2 },
    { name: 'David Kim',         phone: '(555) 419-5672', cycles: 1 },
    { name: 'Lisa Kendall',      phone: '(555) 763-0284', cycles: 0 },
  ];

  const upcomingServices = [
    { date: 'Mon, Mar 24', cycle: 'Weekly Clean' },
  ];

  if (showList) {
    return (
      <div className="flex flex-col h-full bg-[#f5f5f5]">
        {/* Nav bar */}
        <div className="bg-white border-b border-gray-100 px-3 pt-2 pb-1 flex flex-col items-center shrink-0">
          <p className="text-xs font-bold text-[#1a1a1a]">Customers</p>
          <p className="text-[9px] text-[#2563eb]/60 text-center pt-1 italic font-medium tracking-wide">↓ Interactive — tap a customer to view their profile</p>
        </div>

        {/* Customer list */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 space-y-2 pb-16">
          {customers.map((c) => (
            <button
              key={c.name}
              onClick={() => setList(false)}
              className="w-full bg-white rounded-xl px-3 py-2.5 border border-gray-100 flex items-center justify-between text-left active:opacity-70 transition-opacity"
            >
              <div>
                <p className="text-[10px] font-semibold text-[#1a1a1a]">{c.name}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">{c.phone}</p>
              </div>
              <span className="text-[9px] font-semibold text-[#2563eb] bg-[#eff6ff] px-2 py-0.5 rounded-full shrink-0">
                {c.cycles} cycle{c.cycles !== 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>

        {/* Add Customer FAB */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-3 pt-2 pb-3">
          <div className="bg-[#2563eb] rounded-xl py-2.5 text-center">
            <p className="text-white text-[10px] font-semibold">+ Add Customer</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Nav bar */}
      <div className="bg-white border-b border-gray-100 px-3 pt-2 pb-0.5 flex flex-col shrink-0">
        <button
          onClick={() => setList(true)}
          className="flex items-center gap-1 text-[#2563eb] active:opacity-60 transition-opacity self-start"
        >
          <span className="text-sm font-light leading-none">‹</span>
          <span className="text-[10px] font-semibold">Customers</span>
        </button>
        <p className="text-[9px] text-[#2563eb]/60 text-center pb-1 italic font-medium tracking-wide">↑ Interactive — tap to browse your customers</p>
      </div>

      {/* Blue header */}
      <div className="bg-[#2563eb] px-4 pt-3 pb-3 shrink-0">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-sm font-bold text-white leading-tight">Nancy Fancy</p>
            <p className="text-[10px] text-white/70 mt-0.5">(555) 391-2847</p>
          </div>
          <span className="text-[10px] font-semibold text-white border border-white/50 rounded-lg px-2.5 py-1 shrink-0">
            Details
          </span>
        </div>
        {/* Address / Get Directions */}
        <div className="bg-white/15 rounded-lg px-3 py-2">
          <p className="text-[9px] text-white/70 mb-0.5">214 Elm St, Chicago, IL</p>
          <p className="text-[9px] font-bold text-white">Get Directions →</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f5f5f5] px-3 pt-2.5 space-y-2 pb-3">
        {/* Customer Notes */}
        <div className="flex bg-[#fffbeb] rounded-xl border border-gray-100 overflow-hidden">
          <div className="w-1 bg-[#f59e0b] shrink-0" />
          <div className="flex-1 px-2.5 py-2">
            <p className="text-[8px] font-bold text-[#b45309] uppercase tracking-wider mb-1">Customer Notes</p>
            <p className="text-[9px] text-[#1a1a1a] leading-relaxed">Gate Code 123. Prefers eco-friendly products.</p>
          </div>
        </div>

        {/* Assigned Cycles */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-1.5 border-b border-gray-100">
            Assigned Cycles
          </p>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#f3f4f6]">
            <span className="text-[10px] font-semibold text-[#1a1a1a]">Weekly Clean</span>
            <span className="text-[10px] text-gray-400">2.5h / visit</span>
          </div>
          <div className="px-3 py-1.5">
            <div className="text-[9px] font-semibold text-[#2563eb] border border-[#2563eb] rounded-lg px-2 py-1 text-center">
              + Assign Cycle
            </div>
          </div>
        </div>

        {/* Recent Feedback */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-1.5 border-b border-gray-100">
            Recent Feedback
          </p>
          <div className="px-3 py-2">
            <p className="text-[9px] text-gray-400 mb-0.5">Mon, Mar 17</p>
            <p className="text-[9px] text-[#1a1a1a] leading-relaxed mb-1">"Great attention to detail."</p>
            <p className="text-[9px] font-semibold text-[#2563eb]">View full feedback →</p>
          </div>
        </div>

        {/* Upcoming Services */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-1.5 border-b border-gray-100">
            Upcoming Services
          </p>
          {upcomingServices.map((s, i) => (
            <div
              key={s.date}
              className={`flex items-center justify-between px-3 py-1.5 ${i < upcomingServices.length - 1 ? 'border-b border-[#f3f4f6]' : ''}`}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[#1a1a1a]">{s.date}</p>
                <p className="text-[9px] text-gray-400">{s.cycle}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[9px] font-bold text-[#1d4ed8] bg-[#dbeafe] px-1.5 py-0.5 rounded-full">Open</span>
                <span className="text-[11px] text-[#c7d2fe] font-light">›</span>
              </div>
            </div>
          ))}
        </div>

        {/* Mark Service Complete */}
        <div className="bg-[#10b981] rounded-xl px-4 py-2 text-center">
          <p className="text-white text-[10px] font-semibold">Mark Service Complete</p>
        </div>
      </div>
    </div>
  );
}

function BusinessServiceDay() {
  // Pending customers first, submitted last — matches actual app order
  const customers = [
    { name: 'Robert A.',   status: 'pending',   assignment: { type: 'none' } },
    { name: 'David K.',    status: 'pending',   assignment: { type: 'person', name: 'Sarah J.' } },
    { name: 'Jennifer M.', status: 'submitted', assignment: { type: 'group',  name: 'Team A' } },
    { name: 'Lisa K.',     status: 'submitted', assignment: { type: 'person', name: 'Sarah J.' } },
  ];
  const submitted = customers.filter(c => c.status === 'submitted').length;
  const pending   = customers.filter(c => c.status === 'pending').length;

  function AssignPill({ a }: { a: typeof customers[0]['assignment'] }) {
    if (a.type === 'none')
      return <span className="text-[9px] font-semibold text-gray-500 bg-[#f3f4f6] px-2 py-0.5 rounded-full">Assign</span>;
    if (a.type === 'group')
      return <span className="text-[9px] font-semibold text-[#6d28d9] bg-[#ede9fe] px-2 py-0.5 rounded-full">●● {a.name}</span>;
    return <span className="text-[9px] font-semibold text-[#065f46] bg-[#d1fae5] px-2 py-0.5 rounded-full">{a.name}</span>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Blue summary header card */}
      <div className="mx-3 mt-3 rounded-2xl bg-[#2563eb] px-4 py-3 mb-3">
        <p className="text-[10px] text-white/70 mb-0.5">Service Day</p>
        <p className="text-sm font-bold text-white leading-tight mb-1">Monday, March 24, 2026</p>
        <p className="text-[10px] text-white/80 font-medium mb-2">Weekly Clean</p>
        <p className="text-[10px] text-white/60">
          {customers.length} customers · {submitted} submitted · {pending} pending
        </p>
      </div>

      {/* Customers section */}
      <div className="mx-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* Section header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <p className="text-[10px] font-bold text-[#1a1a1a]">Customers</p>
          <span className="text-[10px] text-gray-400">∨</span>
        </div>
        {/* Customer rows */}
        {customers.map((c, i) => (
          <div key={c.name} className={`flex items-center justify-between px-3 py-2 ${i < customers.length - 1 ? 'border-b border-[#f3f4f6]' : ''}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-semibold text-[#1a1a1a] truncate">{c.name}</span>
              {c.status === 'submitted'
                ? <span className="text-[9px] font-bold text-[#065f46] bg-[#d1fae5] px-1.5 py-0.5 rounded-full shrink-0">Submitted</span>
                : <span className="text-[9px] font-bold text-[#92400e] bg-[#fef3c7] px-1.5 py-0.5 rounded-full shrink-0">Pending</span>
              }
            </div>
            <AssignPill a={c.assignment} />
          </div>
        ))}
      </div>
    </div>
  );
}

function BusinessServiceCycle() {
  const cycles = [
    { name: 'Weekly Cycle',    freq: 'Weekly',    tasks: 6,  deadline: 3 },
    { name: 'Monthly Cycle',   freq: 'Monthly',   tasks: 12, deadline: 5 },
    { name: 'Quarterly Cycle', freq: 'Every 3 months',  tasks: 4,  deadline: 3 },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      {/* Nav bar */}
      <div className="bg-white border-b border-gray-100 px-3 py-2 flex items-center justify-center shrink-0">
        <p className="text-xs font-bold text-[#1a1a1a]">Service Cycles</p>
      </div>

      {/* Cycle cards */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 space-y-2 pb-16">
        {cycles.map((c) => (
          <div key={c.name} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#1a1a1a]">{c.name}</p>
              <p className="text-[9px] text-gray-400 mt-0.5 capitalize">
                {c.freq} · {c.tasks} tasks
              </p>
              <p className="text-[9px] text-gray-300 mt-0.5">
                Deadline: {c.deadline}d before service
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <span className="text-[9px] font-semibold text-[#2563eb] bg-[#eff6ff] px-2 py-0.5 rounded-lg">Edit</span>
              <span className="text-[9px] font-semibold text-[#ef4444] bg-[#fef2f2] px-2 py-0.5 rounded-lg">Delete</span>
            </div>
          </div>
        ))}
      </div>

      {/* New Cycle FAB */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-3 pt-2 pb-3">
        <div className="bg-[#2563eb] rounded-xl py-2.5 text-center">
          <p className="text-white text-[10px] font-semibold">+ New Cycle</p>
        </div>
      </div>
    </div>
  );
}

function BusinessTeam() {
  const [tab, setTab] = useState<'members' | 'groups'>('members');

  useEffect(() => {
    const t1 = setTimeout(() => setTab('groups'),  1500);
    const t2 = setTimeout(() => setTab('members'), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const members = [
    { name: 'Sarah Johnson', initials: 'SJ', phone: '(555) 201-4832', hours: 20, groups: 'Team A' },
    { name: 'Mike Torres',   initials: 'MT', phone: '(555) 384-9021', hours: 15, groups: 'Team A' },
    { name: 'Dana Lee',      initials: 'DL', phone: '(555) 467-3310', hours: 12, groups: 'Team B' },
  ];

  const groups = [
    { name: 'Team A', members: ['Sarah Johnson', 'Mike Torres'] },
    { name: 'Team B', members: ['Dana Lee'] },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-1 bg-white border-b border-gray-100">
        <p className="text-xs text-gray-400 mb-0.5">My Team</p>
        <div className="flex gap-3 mt-1">
          <button
            onClick={() => setTab('members')}
            className={`text-xs font-bold pb-0.5 border-b-2 transition-colors ${tab === 'members' ? 'text-[#2563eb] border-[#2563eb]' : 'text-gray-400 border-transparent'}`}
          >Members</button>
          <button
            onClick={() => setTab('groups')}
            className={`text-xs font-bold pb-0.5 border-b-2 transition-colors ${tab === 'groups' ? 'text-[#2563eb] border-[#2563eb]' : 'text-gray-400 border-transparent'}`}
          >Groups</button>
        </div>
        <p className="text-[9px] text-[#2563eb]/60 text-center py-1 italic font-medium tracking-wide">↑ Interactive — try the Members / Groups tabs</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {tab === 'members' ? (
          members.map((m) => (
            <div key={m.name} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#dbeafe] flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-[#2563eb]">{m.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#1a1a1a] truncate">{m.name}</p>
                <p className="text-[10px] text-gray-400">{m.phone}</p>
                <p className="text-[10px] text-[#2563eb]">{m.groups}</p>
              </div>
              <span className="bg-[#eff6ff] text-[#2563eb] text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">{m.hours} hrs/wk</span>
            </div>
          ))
        ) : (
          groups.map((g) => (
            <div key={g.name} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold text-[#1a1a1a]">{g.name}</p>
                <span className="text-[10px] text-gray-400">{g.members.length} member{g.members.length !== 1 ? 's' : ''}</span>
              </div>
              <p className="text-[10px] text-gray-400">{g.members.join(' · ')}</p>
            </div>
          ))
        )}
      </div>
      {tab === 'members' && (
        <div className="px-3 py-2 border-t border-gray-100 bg-white">
          <button className="w-full bg-[#2563eb] text-white text-xs font-semibold py-2.5 rounded-xl">+ Add Team Member</button>
        </div>
      )}
      {tab === 'groups' && (
        <div className="px-3 py-2 border-t border-gray-100 bg-white">
          <button className="w-full bg-[#2563eb] text-white text-xs font-semibold py-2.5 rounded-xl">+ Create Group</button>
        </div>
      )}
    </div>
  );
}

// ─── Customer screen mocks ────────────────────────────────────────────────────

function CustomerMyService({ onViewChange }: { onViewChange?: (v: boolean) => void }) {
  const [showList, setShowList] = useState(false);

  function setList(v: boolean) { setShowList(v); onViewChange?.(v); }

  useEffect(() => {
    const t1 = setTimeout(() => setList(true),  1500);
    const t2 = setTimeout(() => setList(false), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upcomingServices = [
    { date: 'Mon, Mar 24', label: 'Next', hours: 3, submitted: true,  tasks: 2 },
    { date: 'Mon, Mar 31', label: null,   hours: 3, submitted: false, tasks: 0 },
    { date: 'Mon, Apr 7',  label: null,   hours: 3, submitted: false, tasks: 0 },
    { date: 'Mon, Apr 14', label: null,   hours: 3, submitted: false, tasks: 0 },
  ];

  if (showList) {
    return (
      <div className="flex flex-col h-full bg-[#f5f5f5]">
        {/* Header */}
        <div className="px-4 pt-2 pb-2 bg-white border-b border-gray-100 shrink-0 flex items-center gap-2">
          <button onClick={() => setList(false)} className="text-[#2563eb] text-xs font-semibold">‹ Back</button>
          <p className="text-sm font-bold text-[#1a1a1a]">Upcoming Services</p>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 space-y-2 pb-4">
          {upcomingServices.map((s, i) => (
            <div key={s.date} className="bg-white rounded-2xl border border-gray-100 flex overflow-hidden">
              {/* Accent bar */}
              <div className={`w-1 shrink-0 ${i === 0 ? 'bg-[#2563eb]' : 'bg-gray-200'}`} />
              <div className="flex-1 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[11px] font-bold text-[#1a1a1a]">{s.date}</p>
                  {s.label && (
                    <span className="text-[9px] font-bold text-[#2563eb] bg-[#eff6ff] px-1.5 py-0.5 rounded-full">Next</span>
                  )}
                </div>
                <p className="text-[9px] text-gray-400 mb-1.5">{s.hours} hours available</p>
                <div className="flex items-center justify-between">
                  {s.submitted ? (
                    <span className="text-[9px] font-bold text-[#065f46] bg-[#d1fae5] px-2 py-0.5 rounded-full">✓ Tasks Selected</span>
                  ) : (
                    <span className="text-[9px] font-bold text-[#2563eb] bg-[#eff6ff] px-2 py-0.5 rounded-full">Select Tasks →</span>
                  )}
                  {s.tasks > 0 && (
                    <p className="text-[9px] text-gray-400">{s.tasks} task{s.tasks !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const calDays = [
    { d: 1 },  { d: 2 },  { d: 3 },  { d: 4 },  { d: 5 },  { d: 6 },  { d: 7 },
    { d: 8 },  { d: 9 },  { d: 10 }, { d: 11 }, { d: 12 }, { d: 13 }, { d: 14 },
    { d: 15 }, { d: 16 }, { d: 17 }, { d: 18 }, { d: 19 }, { d: 20 }, { d: 21 },
    { d: 22, today: true }, { d: 23 }, { d: 24, dot: '#10b981', selected: true }, { d: 25 }, { d: 26 }, { d: 27 }, { d: 28 },
    { d: 29 }, { d: 30 }, { d: 31, dot: '#2563eb' }, null, null, null, null,
  ];
  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      {/* Header */}
      <div className="px-4 pt-2 pb-2 flex items-center justify-between bg-white border-b border-gray-100 shrink-0">
        <p className="text-sm font-bold text-[#1a1a1a]">Hi, Jennifer</p>
        <p className="text-xs text-[#2563eb]">Sign Out</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {/* Blue Next Service card */}
        <div className="mx-3 mt-2 rounded-2xl bg-[#2563eb] p-3 mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-white/70">Next Service</p>
            <span className="text-[10px] font-bold text-[#86efac] bg-white/10 border border-white/20 px-2 py-0.5 rounded-full">✓ Submitted</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-xs font-bold text-white leading-tight mb-0.5">Monday, March 24</p>
              <p className="text-[10px] text-white/80 font-medium mb-0.5">ABC Cleaning Co.</p>
              <p className="text-[10px] text-white/70">3 hours available</p>
              <p className="text-[10px] text-white/50 mt-1.5">Tap to see your selections →</p>
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              <span className="bg-white/20 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">Sarah J.</span>
              <span className="bg-white/20 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">Mike T.</span>
            </div>
          </div>
        </div>

        {/* List View button */}
        <div className="mx-3 mb-1">
          <button onClick={() => setList(true)} className="w-full border-2 border-[#2563eb] rounded-xl px-4 py-2 text-center">
            <p className="text-[#2563eb] text-[11px] font-semibold">List View of Upcoming Services</p>
          </button>
        </div>
        <p className="text-[9px] text-[#2563eb]/60 text-center pb-1 italic font-medium tracking-wide">↑ Interactive — try the list view</p>

        {/* Inline Calendar */}
        <div className="mx-3 mb-2 bg-white rounded-2xl p-3 border border-gray-100">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-gray-400 font-medium px-1">‹</span>
            <p className="text-[10px] font-bold text-[#1a1a1a]">March 2026</p>
            <span className="text-[11px] text-gray-400 font-medium px-1">›</span>
          </div>
          {/* Day labels */}
          <div className="grid grid-cols-7 mb-0.5">
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <p key={i} className="text-[8px] text-center text-gray-400 font-medium">{d}</p>
            ))}
          </div>
          {/* Day grid */}
          <div className="grid grid-cols-7">
            {calDays.map((day, i) => day ? (
              <div key={i} className={`flex flex-col items-center justify-center h-5 rounded-full relative ${day.selected ? 'bg-[#2563eb]' : ''}`}>
                <p className={`text-[9px] font-medium leading-none ${day.selected ? 'text-white font-bold' : day.today ? 'text-[#2563eb] font-bold' : 'text-gray-500'}`}>{day.d}</p>
                {day.dot && !day.selected && (
                  <div className="w-1 h-1 rounded-full absolute bottom-0" style={{ backgroundColor: day.dot }} />
                )}
              </div>
            ) : <div key={i} className="h-5" />)}
          </div>

          {/* Selected date detail */}
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold text-[#1a1a1a]">Wed, Mar 24</p>
              <p className="text-[9px] text-gray-400 mt-0.5">Weekly Clean · 3 hrs</p>
            </div>
            <span className="text-[9px] font-bold text-[#065f46] bg-[#d1fae5] px-2 py-0.5 rounded-full">✓ Selected</span>
          </div>
        </div>

        {/* View History */}
        <div className="text-center py-1">
          <p className="text-xs text-[#2563eb] font-medium">View History</p>
        </div>
      </div>
    </div>
  );
}

function CustomerNextService() {
  const submittedTasks = [
    { name: 'Bathroom cleaning', mins: 45 },
    { name: 'Dusting surfaces',  mins: 20 },
  ];
  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      {/* Blue header */}
      <div className="bg-[#2563eb] px-4 pt-4 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-white/70 uppercase tracking-wide font-semibold">Next Service</p>
          <span className="text-[10px] font-bold text-[#86efac] bg-white/10 border border-white/20 px-2 py-0.5 rounded-full">✓ Submitted</span>
        </div>
        <p className="text-sm font-bold text-white mb-0.5">Monday, March 24</p>
        <p className="text-[10px] text-white/80">ABC Cleaning Co. · 3 hours</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {/* Who's Coming */}
        <div className="mx-3 mt-3 bg-white rounded-2xl p-3 border border-gray-100">
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Who&apos;s Coming</p>
          <div className="flex gap-2">
            <span className="bg-[#eff6ff] text-[#2563eb] text-[10px] font-semibold px-3 py-1 rounded-full">Sarah J.</span>
            <span className="bg-[#eff6ff] text-[#2563eb] text-[10px] font-semibold px-3 py-1 rounded-full">Mike T.</span>
          </div>
        </div>

        {/* Submitted Tasks */}
        <div className="mx-3 mt-2 bg-white rounded-2xl p-3 border border-gray-100">
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Selections</p>
          <div className="space-y-1">
            {submittedTasks.map((t, i) => (
              <div key={t.name} className={`flex items-center justify-between px-2 py-2 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <p className="text-[10px] font-medium text-[#1a1a1a]">{t.name}</p>
                <p className="text-[10px] font-medium text-gray-400">{t.mins} min</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-gray-400 mt-2 text-right">65 / 180 min used</p>
        </div>

        {/* Edit button */}
        <div className="mx-3 mt-2">
          <div className="border-2 border-[#2563eb] rounded-xl py-2 text-center">
            <p className="text-[#2563eb] text-[11px] font-semibold">Edit Task Selection</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerTaskPicker() {
  const tasks = [
    { name: 'Bathroom cleaning', mins: 45, checked: true },
    { name: 'Vacuum all rooms',  mins: 30, checked: false },
    { name: 'Kitchen deep clean',mins: 60, checked: false },
    { name: 'Dusting surfaces',  mins: 20, checked: false },
  ];
  const used = 45;
  const total = 180;
  const remaining = total - used;
  const pct = Math.round((used / total) * 100);
  const checkedCount = tasks.filter(t => t.checked).length;
  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      {/* Header */}
      <div className="px-4 pt-2 pb-2 bg-white border-b border-gray-100 shrink-0">
        <p className="text-[10px] text-gray-400 mb-0.5">Select Tasks</p>
        <p className="text-sm font-bold text-[#1a1a1a]">ABC Cleaning Co.</p>
      </div>

      {/* Time budget bar */}
      <div className="px-3 py-2 bg-white border-b border-gray-100 shrink-0">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
          <div className="h-full bg-[#2563eb] rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[9px] text-gray-400">
          {used} / {total} min used · <span className="text-[#2563eb] font-semibold">{remaining} min remaining</span>
        </p>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-3 pt-2 space-y-1.5 pb-14">
        {tasks.map((t) => (
          <div key={t.name} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${t.checked ? 'bg-[#eff6ff] border-[#2563eb]' : 'bg-white border-gray-100'}`}>
            <p className={`text-xs flex-1 ${t.checked ? 'font-semibold text-[#2563eb]' : 'text-[#1a1a1a]'}`}>{t.name}</p>
            <p className="text-[10px] text-gray-400 mr-1.5">{t.mins} min</p>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${t.checked ? 'bg-[#2563eb] border-[#2563eb]' : 'border-gray-300'}`}>
              {t.checked && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Submit footer */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-2 bg-white border-t border-gray-100">
        <div className="bg-[#2563eb] rounded-xl px-4 py-2.5 text-center">
          <p className="text-white text-xs font-semibold">
            Review Selection ({checkedCount} {checkedCount === 1 ? 'task' : 'tasks'})
          </p>
        </div>
      </div>
    </div>
  );
}

function CustomerSuccess() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#10b981] flex items-center justify-center mb-5 shadow-lg">
        <span className="text-white text-2xl font-bold">✓</span>
      </div>
      <p className="text-xl font-bold text-[#1a1a1a] mb-3">Selection Submitted!</p>
      <p className="text-xs text-gray-500 leading-relaxed mb-8">
        Your tasks have been locked in. We&apos;ll see you on your service date.
      </p>
      <div className="w-full bg-[#2563eb] rounded-xl px-4 py-2.5 text-center">
        <p className="text-white text-xs font-semibold">Back to Home</p>
      </div>
    </div>
  );
}

function CustomerHistory() {
  const pastServices = [
    { date: 'Mon, Mar 17', cycle: 'Weekly Clean', tasks: 3, ref: 28, rated: true },
    { date: 'Mon, Mar 10', cycle: 'Weekly Clean', tasks: 2, ref: 21, rated: true },
    { date: 'Mon, Mar 3',  cycle: 'Weekly Clean', tasks: 4, ref: 14, rated: false },
  ];
  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      <div className="px-4 pt-2 pb-2 bg-white border-b border-gray-100 shrink-0">
        <p className="text-sm font-bold text-[#1a1a1a]">Service History</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pt-3 space-y-2 pb-4">
        {pastServices.map((s) => (
          <div key={s.ref} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="text-[10px] font-bold text-[#1a1a1a]">{s.date}</p>
                <p className="text-[9px] text-gray-400">{s.cycle}</p>
              </div>
              {s.rated
                ? <span className="text-[9px] font-bold text-[#065f46] bg-[#d1fae5] px-1.5 py-0.5 rounded-full shrink-0">★ Rated</span>
                : <span className="text-[9px] font-bold text-[#2563eb] bg-[#eff6ff] px-1.5 py-0.5 rounded-full shrink-0">Rate</span>
              }
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[9px] text-gray-400">{s.tasks} tasks completed</p>
              <p className="text-[9px] text-gray-300">Ref #{s.ref}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerFeedback() {
  const [rating, setRating] = useState(4);
  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      <div className="bg-white border-b border-gray-100 px-3 py-2 flex items-center shrink-0">
        <button className="flex items-center gap-1 text-[#2563eb]">
          <span className="text-sm font-light leading-none">‹</span>
          <span className="text-[10px] font-semibold">History</span>
        </button>
      </div>
      <div className="bg-[#2563eb] px-4 pt-3 pb-3 shrink-0">
        <p className="text-[10px] text-white/70 mb-0.5">Mon, Mar 17</p>
        <p className="text-sm font-bold text-white">ABC Cleaning Co.</p>
        <p className="text-[10px] text-white/80 mt-0.5">Weekly Clean · 3 tasks</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pt-3 space-y-2 pb-3">
        <div className="bg-white rounded-xl px-3 py-3 border border-gray-100">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-2">How was your service?</p>
          <div className="flex gap-2 justify-center mb-1">
            {[1,2,3,4,5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="text-lg leading-none transition-transform active:scale-90"
              >
                <span style={{ color: star <= rating ? '#f59e0b' : '#d1d5db' }}>★</span>
              </button>
            ))}
          </div>
          <p className="text-center text-[9px] text-gray-400">
            {rating === 5 ? 'Excellent!' : rating === 4 ? 'Great' : rating === 3 ? 'Good' : 'Needs work'}
          </p>
        </div>
        <div className="bg-white rounded-xl px-3 py-3 border border-gray-100">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Comments (optional)</p>
          <div className="h-12 bg-[#f5f5f5] rounded-lg border border-gray-100 px-2 py-1.5 flex items-start">
            <p className="text-[9px] text-gray-300">Add any notes for your service provider…</p>
          </div>
        </div>
        <div className="bg-[#2563eb] rounded-xl px-4 py-2.5 text-center">
          <p className="text-white text-[10px] font-semibold">Submit Feedback</p>
        </div>
      </div>
    </div>
  );
}

function TeamMemberMyJobs() {
  const jobs = [
    { id: 1, customer: 'Nancy Fancy',       address: '214 Elm St, Chicago, IL',   date: 'Mon, Mar 24', time: '9:00 AM',  tasks: 4 },
    { id: 2, customer: 'Robert Adams',      address: '87 Oak Ave, Evanston, IL',  date: 'Mon, Mar 24', time: '11:30 AM', tasks: 3 },
    { id: 3, customer: 'Jennifer Martinez', address: '533 Maple Dr, Chicago, IL', date: 'Thu, Mar 28', time: '10:00 AM', tasks: 5 },
  ];
  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      <div className="px-4 pt-2 pb-2 bg-white border-b border-gray-100 shrink-0">
        <p className="text-sm font-bold text-[#1a1a1a]">My Jobs</p>
        <p className="text-xs text-gray-400">3 upcoming</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pt-3 space-y-2 pb-4">
        {jobs.map((j) => (
          <div key={j.id} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100 flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#1a1a1a]">{j.date} · {j.time}</p>
              <p className="text-[11px] font-semibold text-[#1a1a1a] mt-0.5">{j.customer}</p>
              <p className="text-[9px] text-gray-400 mt-0.5 truncate">{j.address}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
              <span className="text-[9px] font-bold text-[#1d4ed8] bg-[#dbeafe] px-1.5 py-0.5 rounded-full">{j.tasks} tasks</span>
              <span className="text-[11px] text-gray-300 font-light">›</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamMemberJobDetail() {
  const [checked, setChecked] = useState([true, false, false, false]);
  const tasks = [
    { name: 'Vacuum all rooms',   mins: 30 },
    { name: 'Bathroom cleaning',  mins: 45 },
    { name: 'Kitchen deep clean', mins: 60 },
    { name: 'Dusting surfaces',   mins: 20 },
  ];
  const doneCount = checked.filter(Boolean).length;
  return (
    <div className="flex flex-col h-full">
      {/* Blue header */}
      <div className="bg-[#2563eb] px-4 pt-3 pb-4 shrink-0">
        <button className="flex items-center gap-1 text-[#bfdbfe] mb-2.5">
          <span className="text-sm font-light leading-none">‹</span>
          <span className="text-[10px] font-medium">My Jobs</span>
        </button>
        <p className="text-sm font-extrabold text-white leading-tight mb-0.5">Nancy Fancy</p>
        <p className="text-[10px] text-[#bfdbfe] mb-0.5">Weekly Clean</p>
        <p className="text-[10px] text-[#dbeafe] font-medium mb-2">Monday, March 24, 2026</p>
        <span className="text-[9px] font-bold text-white bg-white/20 px-2.5 py-0.5 rounded-full">Open</span>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f5f5f5] px-3 pt-2.5 space-y-2 pb-3">
        {/* Address card */}
        <div className="bg-white rounded-xl px-3 py-2 border border-gray-100 flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Address</p>
            <p className="text-[10px] font-medium text-[#1a1a1a]">214 Elm St, Chicago, IL</p>
          </div>
          <div className="bg-[#2563eb] rounded-lg px-2 py-1 shrink-0">
            <p className="text-white text-[9px] font-bold">Get Directions</p>
          </div>
        </div>

        {/* Customer notes */}
        <div className="flex bg-[#fffbeb] rounded-xl border border-gray-100 overflow-hidden">
          <div className="w-1 bg-[#f59e0b] shrink-0" />
          <div className="flex-1 px-2.5 py-2">
            <p className="text-[8px] font-bold text-[#b45309] uppercase tracking-wider mb-1">Customer Notes</p>
            <p className="text-[9px] text-[#1a1a1a] leading-relaxed">Use the side entrance. The dog is friendly.</p>
          </div>
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-1.5 border-b border-gray-100">
            Tasks ({doneCount}/{tasks.length})
          </p>
          {tasks.map((t, i) => (
            <button
              key={t.name}
              onClick={() => setChecked(c => { const n = [...c]; n[i] = !n[i]; return n; })}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left ${i < tasks.length - 1 ? 'border-b border-[#f3f4f6]' : ''}`}
            >
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${checked[i] ? 'bg-[#10b981] border-[#10b981]' : 'border-gray-300'}`}>
                {checked[i] && <span className="text-white text-[8px] font-bold">✓</span>}
              </div>
              <p className={`text-[10px] flex-1 ${checked[i] ? 'line-through text-gray-400' : 'text-[#1a1a1a]'}`}>{t.name}</p>
              <p className="text-[9px] text-gray-400">{t.mins}m</p>
            </button>
          ))}
        </div>

        {/* Completion notes + Mark Complete */}
        <div className="bg-white rounded-xl px-3 py-2 border border-gray-100">
          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Completion Notes (Optional)</p>
          <div className="h-7 bg-[#fafafa] rounded-lg border border-gray-200 px-2 py-1 mb-2 flex items-center">
            <p className="text-[9px] text-gray-300">Gate code, access notes…</p>
          </div>
          <div className="bg-[#10b981] rounded-xl py-2 text-center">
            <p className="text-white text-[10px] font-bold">Mark Service Complete</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Screen definitions ───────────────────────────────────────────────────────

const businessScreens: Screen[] = [
  {
    label: 'Dashboard',
    render: (onViewChange) => <BusinessDashboard onViewChange={onViewChange} />,
    hotspots: [
      { title: 'List / Calendar toggle', description: 'Switch between a scrollable card list and a full month calendar — the same toggle available in the real app.', top: '13%', left: '0%' },
      { title: 'Service date tile',      description: 'Each tile represents an upcoming service date. The four numbers show: Total customers scheduled, Done (submitted their task selections), Pending (haven\'t selected yet), and Rate (the overall submission percentage for that day).', top: '46%', left: '0%' },
      { title: 'Progress bar',           description: 'The colored bar shows submission progress for that service date — green when all customers have selected, amber when mixed, blue when none have started yet.', top: '76%', left: '0%' },
    ],
    calHotspots: [
      { title: 'List / Calendar toggle', description: 'Switch between a scrollable card list and a full month calendar — the same toggle available in the real app.', top: '13%', left: '0%' },
      { title: 'Service date dots',      description: 'Colored dots mark every scheduled service date — blue when no customers have selected yet, amber when selections are mixed, green when all customers have submitted.', top: '52%', left: '55%' },
      { title: 'Color legend',           description: 'The legend below the calendar explains what each dot color represents so you can read your full schedule status at a glance.', top: '76%', left: '2%' },
    ],
  },
  {
    label: 'Service Day',
    render: () => <BusinessServiceDay />,
    hotspots: [
      { title: 'Service summary card',  description: 'The blue card shows the service date, cycle name, and a live count of how many customers have submitted their task selections vs. still pending.',  top: '12%', left: '2%' },
      { title: 'Submission status pill', description: 'Each customer row shows their submission status — green Submitted when tasks are locked in, amber Pending when they still need to select.',             top: '30%', left: '42%' },
      { title: 'Assignment pill',        description: 'Tap the pill on the right to assign a team member (green) or a group (purple) to that customer\'s service. Gray means unassigned.',                   top: '30%', left: '72%' },
    ],
  },
  {
    label: 'Customer',
    render: (onViewChange) => <BusinessCustomer onViewChange={onViewChange} />,
    calHotspots: [],
    hotspots: [
      { title: 'Get Directions',         description: 'The customer\'s address is stored on their profile and tappable right from the header — opens Maps so your team can navigate without copying anything out of a text.', top: '19%', left: '2%' },
      { title: 'Customer Notes',         description: 'Any notes you\'ve added to the customer profile are shown here — preferences, access instructions, anything the team needs to know before arriving.', top: '30%', left: '2%' },
      { title: 'Assigned Cycles',        description: 'Every service cycle assigned to this customer is listed with its hours per visit. Add or adjust cycles at any time — changes take effect on the next scheduled service.', top: '53%', left: '2%' },
      { title: 'Recent Feedback',        description: 'The latest feedback from this customer surfaces right on their profile. Tap to read the full response — so you always know where you stand before their next visit.', top: '65%', left: '2%' },
      { title: 'Upcoming service rows',  description: 'Each upcoming service date is tappable — opens the Service Call detail view with the submission status, assignment, deadline, and a reschedule option for that single visit.', top: '83%', left: '2%' },
    ],
  },
  {
    label: 'Service Cycle',
    render: () => <BusinessServiceCycle />,
    hotspots: [
      { title: 'Service cycle card',   description: 'Each card represents a named service cycle — with its frequency, how many tasks are attached, and the selection deadline. Tap Edit to adjust it at any time.', top: '10%', left: '2%' },
      { title: 'Task & frequency info', description: 'The frequency sets how often this cycle repeats (weekly, biweekly, monthly). Tasks are the menu of work items customers can choose from during their selection window.', top: '22%', left: '48%' },
      { title: '+ New Cycle',          description: 'Create a new service cycle — define the name, frequency, deadline window, and which tasks belong to it. Cycles are then assigned to individual customers.', top: '92%', left: '20%' },
    ],
  },
  {
    label: 'My Team',
    render: () => <BusinessTeam />,
    hotspots: [
      { title: 'Team member row', description: 'Add staff by name — each member appears here with their group assignment.',           top: '6%', left: '48%' },
      { title: 'Group badge',     description: 'Members belong to named groups for faster bulk scheduling and assignment.',           top: '25%', left: '65%' },
      { title: 'Team group card', description: 'Create groups and see every member at a glance — assign the whole group in one tap.', top: '88%', left: '20%' },
    ],
  },
];

const customerScreens: Screen[] = [
  {
    label: 'My Service',
    render: (onViewChange) => <CustomerMyService onViewChange={onViewChange} />,
    calHotspots: [],
    hotspots: [
      { title: 'Next Service card',       description: 'Tap the blue card to see your selected tasks or the full task list for the service.', top: '12%', left: '38%' },
      { title: 'Submitted badge',         description: 'Once you\'ve submitted tasks, a green badge confirms your selection is locked in. The pills on the right show the first name and last initial of each team member assigned to your service call.',    top: '12%', left: '83%' },
      { title: 'List View button',        description: 'Open a scrollable list of all upcoming service dates with status and hours for each.', top: '32%', left: '62%' },
      { title: 'Inline calendar',         description: 'Your scheduled service dates are marked right on the calendar — green means tasks are submitted, blue means they\'re still pending.', top: '44%', left: '12%' },
    ],
  },
  {
    label: 'Next Service',
    render: () => <CustomerNextService />,
    hotspots: [
      { title: 'Service header',    description: 'The blue card confirms the date, business, and total hours for the next scheduled visit — plus your submission status at a glance.', top: '14%', left: '78%' },
      { title: 'Who\'s Coming',     description: 'See the staff members assigned to your service call before they arrive — first name and last initial only.', top: '24%', left: '40%' },
      { title: 'Your selections',   description: 'Tasks you\'ve submitted are shown here with their time allotments — everything locked in and ready for your service team.', top: '35%', left: '2%' },
      { title: 'Edit tasks',        description: 'Need to change your mind? Tap here to go back and adjust your task selection before the deadline.', top: '59%', left: '2%' },
    ],
  },
  {
    label: 'Select Tasks',
    render: () => <CustomerTaskPicker />,
    hotspots: [
      { title: 'Time budget bar',  description: 'Your available time is shown as a budget — select tasks until it\'s filled.',           top: '12%', left: '50%' },
      { title: 'Selected task',    description: 'Checked tasks are confirmed for your upcoming service and shown in green.',              top: '18%', left: '78%' },
      { title: 'Unselected task',  description: 'Tap any task to add it to your selection — the time counter updates instantly.',        top: '55%', left: '78%' },
      { title: 'Review button',    description: 'When your selection is ready, review the full summary before confirming.',              top: '86%', left: '30%' },
    ],
  },
  {
    label: 'Confirmed',
    render: () => <CustomerSuccess />,
    hotspots: [
      { title: 'Locked in message', description: 'Your tasks are set — the team will arrive knowing exactly what needs to be done.',     top: '55%', left: '2%' },
      { title: 'Back to Home',      description: 'Returns to your My Service screen, now showing the ✓ Submitted badge on your card.',  top: '69%', left: '2%' },
    ],
  },
  {
    label: 'History',
    render: () => <CustomerHistory />,
    hotspots: [
      { title: 'Past service card',  description: 'Every completed service is listed here — date, cycle name, task count, and the reference number that links to the business owner\'s record.', top: '5%', left: '55%' },
      { title: 'Rate badge',         description: 'After a service is complete, you\'ll see a prompt to rate it. Once submitted, the badge shows ★ Rated so you know your feedback was received.', top: '17%', left: '67%' },
      { title: 'Reference number',   description: 'The Ref # matches the number the business owner sees on their end — useful for following up about a specific visit.', top: '49%', left: '67%' },
    ],
  },
  {
    label: 'Feedback',
    render: () => <CustomerFeedback />,
    hotspots: [
      { title: 'Star rating',      description: 'Rate your service from 1 to 5 stars — your feedback goes directly to the business owner so they can track satisfaction over time.', top: '37%', left: '30%' },
      { title: 'Comment field',    description: 'Add an optional comment — a shout-out for the team, a note about what to focus on next time, or anything else worth sharing.', top: '43%', left: '2%' },
    ],
  },
];

const teamMemberScreens: Screen[] = [
  {
    label: 'My Jobs',
    render: () => <TeamMemberMyJobs />,
    hotspots: [
      { title: 'Service date & time', description: 'Each job card shows the scheduled date and time — jobs are sorted so the next one is always first. No more checking texts to figure out where to be.',       top: '15%', left: '2%' },
      { title: 'Customer & address',  description: 'Name and full address are right on the card — tap any job to open the detail view with a directions-ready address and the full task list for that visit.',   top: '32%', left: '50%' },
      { title: 'Task count badge',    description: 'The blue badge shows how many tasks the customer selected for this visit, so you know what to expect before you even pull up.',                              top: '49%', left: '70%' },
    ],
  },
  {
    label: 'Job Detail',
    render: () => <TeamMemberJobDetail />,
    hotspots: [
      { title: 'Job header',            description: 'The blue card shows the customer name, service cycle, date, and Open/Completed status — everything needed to know before you arrive.',                              top: '5%', left: '2%' },
      { title: 'Address & Directions',  description: 'The customer\'s address is pulled directly from their profile. Tap Get Directions and it opens in Maps — no copying addresses out of a text thread.',              top: '27%', left: '2%' },
      { title: 'Customer Notes',        description: 'Any notes the business owner added to the customer profile show up here — gate codes, pet warnings, access instructions — right where you need them.',              top: '37%', left: '2%' },
      { title: 'Task checklist',        description: 'Work through the task list as you go — tap each item to check it off. The counter tracks your progress. Checkboxes are local so you can use them freely.',         top: '49%', left: '2%' },
      { title: 'Mark Service Complete', description: 'Add optional completion notes — a gate code for next time, something that came up — then tap to confirm. The business owner sees the timestamp instantly.',         top: '88%', left: '2%' },
    ],
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function AppShowcase() {
  const [activeTab, setActiveTab] = useState<'business' | 'customer' | 'teamMember'>('business');
  const [activeScreen, setActiveScreen] = useState(0);
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);
  const [dashCalView, setDashCalView] = useState(false);

  const screens = activeTab === 'business' ? businessScreens : activeTab === 'customer' ? customerScreens : teamMemberScreens;
  const current = screens[activeScreen];
  const hotspots = (dashCalView && current.calHotspots) ? current.calHotspots : current.hotspots;
  const activeHotspotData = activeHotspot !== null ? hotspots[activeHotspot] : null;

  function switchTab(tab: 'business' | 'customer' | 'teamMember') {
    setActiveTab(tab);
    setActiveScreen(0);
    setActiveHotspot(null);
    setDashCalView(false);
  }

  function switchScreen(i: number) {
    setActiveScreen(i);
    setActiveHotspot(null);
    setDashCalView(false);
  }

  function handleDashViewChange(v: boolean) {
    setDashCalView(v);
    setActiveHotspot(null);
  }

  function toggleHotspot(i: number) {
    setActiveHotspot(activeHotspot === i ? null : i);
  }

  return (
    <section id="app-showcase" className="bg-bg py-20 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Heading */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-text mb-4">See TaskRight in action</h2>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            Explore the Business Owner, Team Member, and Customer Experience.{' '}
            Click the blue dots on the screen to learn what each part does.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-surface border border-border rounded-xl p-1 gap-1">
            {(['business', 'teamMember', 'customer'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab === 'business' ? 'Business Account' : tab === 'teamMember' ? 'Team Member' : 'Customer Account'}
              </button>
            ))}
          </div>
        </div>

        {/* Screen selector — ABOVE the phone */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {screens.map((s, i) => (
            <button
              key={i}
              onClick={() => switchScreen(i)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeScreen === i
                  ? 'bg-brand text-white'
                  : 'bg-surface text-text-muted border border-border hover:border-brand/40 hover:text-text'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Main content: phone + popup panel */}
        <div className="flex flex-col lg:flex-row items-start gap-8 justify-center">

          {/* Phone frame */}
          <div className="relative mx-auto lg:mx-0 w-[280px] shrink-0">
            <div className="relative w-full bg-white rounded-[2.5rem] border-[8px] border-[#1a1a1a] shadow-2xl overflow-hidden">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#1a1a1a] rounded-b-xl z-20" />
              {/* Screen */}
              <div className="h-[560px] bg-[#f5f5f5] pt-6 relative overflow-hidden">
                {current.render(handleDashViewChange)}

                {/* Hotspot circles */}
                {hotspots.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => toggleHotspot(i)}
                    style={{ top: h.top, left: h.left }}
                    className={`absolute w-4 h-4 rounded-full ring-2 ring-white cursor-pointer z-30
                      transition-all duration-150
                      ${activeHotspot === i ? 'bg-success scale-110' : 'bg-brand animate-pulse'}`}
                    aria-label={h.title}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Popup panel — right of phone on desktop, below on mobile */}
          <div className="w-full lg:w-80 shrink-0">
            {activeHotspotData !== null ? (
              /* Active popup card */
              <div
                key={`${activeTab}-${activeScreen}-${activeHotspot}`}
                className="bg-surface rounded-2xl border-2 border-brand shadow-lg p-6 relative
                  animate-[fadeSlideIn_0.18s_ease-out]"
              >
                {/* Close button */}
                <button
                  onClick={() => setActiveHotspot(null)}
                  className="absolute top-4 right-4 w-6 h-6 rounded-full bg-border flex items-center justify-center text-text-muted hover:bg-brand/10 hover:text-brand transition-colors text-sm font-bold"
                  aria-label="Close"
                >
                  ✕
                </button>

                {/* Title */}
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-3 h-3 rounded-full bg-success shrink-0" />
                  <p className="font-bold text-text text-base leading-tight pr-6">
                    {activeHotspotData.title}
                  </p>
                </div>

                {/* Description */}
                <p className="text-text-muted text-sm leading-relaxed pl-5.5">
                  {activeHotspotData.description}
                </p>

                {/* Hotspot navigation dots */}
                <div className="flex gap-2 mt-5 pl-11">
                  {hotspots.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveHotspot(i)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        activeHotspot === i ? 'bg-brand w-4' : 'bg-border hover:bg-brand/40'
                      }`}
                      aria-label={`Hotspot ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              /* Idle hint */
              <div className="bg-surface rounded-2xl border border-dashed border-border p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-brand font-bold text-sm">?</span>
                </div>
                <p className="text-sm font-semibold text-text mb-1">Click a blue dot</p>
                <p className="text-xs text-text-muted">
                  Click any blue dot on the screen to see a description of that feature.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyframe for popup animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
