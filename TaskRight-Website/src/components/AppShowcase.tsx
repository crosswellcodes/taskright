'use client';

import { useState } from 'react';

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

  const days = [
    { date: 'Mon, Mar 24', cycle: 'Weekly Clean', total: 4, submitted: 2, pending: 2 },
    { date: 'Thu, Mar 28', cycle: 'Weekly Clean', total: 3, submitted: 3, pending: 0 },
    { date: 'Wed, Apr 2',  cycle: 'Deep Clean',   total: 3, submitted: 0, pending: 3 },
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
    { day: 29 }, { day: 30 }, { day: 31 }, { day: 1, faded: true }, { day: 2, faded: true, dot: '#2563eb' }, { day: 3, faded: true }, { day: 4, faded: true },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-2 pb-2 bg-white border-b border-gray-100">
        <p className="text-base font-bold text-[#1a1a1a]">My Business</p>
        <p className="text-xs text-gray-400">30-Day Forecast</p>
      </div>

      {/* List / Calendar toggle */}
      <div className="flex gap-1.5 px-3 py-2">
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

function BusinessServiceDay() {
  const customers = [
    { name: 'Jennifer M.', tasks: ['Bathroom', 'Vacuum'] },
    { name: 'Robert A.',   tasks: ['Kitchen', 'Dusting'] },
    { name: 'Lisa K.',     tasks: ['Bathroom', 'Laundry'] },
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <p className="text-xs text-gray-400 mb-0.5">Service Day</p>
        <p className="text-base font-bold text-[#1a1a1a]">March 24, 2026</p>
      </div>
      <div className="px-3 py-2">
        <p className="text-[10px] font-bold text-[#2563eb] uppercase tracking-wide mb-1.5">Assigned Staff</p>
        <div className="flex gap-1.5 flex-wrap">
          <span className="bg-[#2563eb] text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">Sarah J.</span>
          <span className="bg-[#2563eb] text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">Team A</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden px-3 space-y-2">
        {customers.map((c) => (
          <div key={c.name} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
            <p className="text-xs font-semibold text-[#1a1a1a] mb-1.5">{c.name}</p>
            <div className="flex gap-1.5 flex-wrap">
              {c.tasks.map((t) => (
                <span key={t} className="bg-[#f0f4ff] text-[#2563eb] text-[10px] font-medium px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BusinessTeam() {
  const members = [
    { name: 'Sarah Johnson', group: 'Team A' },
    { name: 'Mike Torres',   group: 'Team A' },
    { name: 'Dana Lee',      group: 'Team B' },
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <p className="text-xs text-gray-400 mb-0.5">My Team</p>
        <div className="flex gap-3 mt-1">
          <span className="text-xs font-bold text-[#2563eb] border-b-2 border-[#2563eb] pb-0.5">Members</span>
          <span className="text-xs text-gray-400">Groups</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden px-3 py-2 space-y-2">
        {members.map((m) => (
          <div key={m.name} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#dbeafe] flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-[#2563eb]">{m.name.split(' ').map(n => n[0]).join('')}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#1a1a1a] truncate">{m.name}</p>
            </div>
            <span className="bg-[#f0f4ff] text-[#2563eb] text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">{m.group}</span>
          </div>
        ))}
        <div className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
          <p className="text-[10px] font-bold text-[#1a1a1a] mb-1.5">Team A · 2 members</p>
          <p className="text-[10px] text-gray-400">Sarah Johnson · Mike Torres</p>
        </div>
      </div>
    </div>
  );
}

// ─── Customer screen mocks ────────────────────────────────────────────────────

function CustomerMyService() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-2 flex items-center justify-between">
        <p className="text-base font-bold text-[#1a1a1a]">Hi, Jennifer</p>
        <p className="text-xs text-[#2563eb]">Sign Out</p>
      </div>
      {/* Blue card */}
      <div className="mx-3 rounded-2xl bg-[#2563eb] p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-white/70">Next Service</p>
          <span className="text-[10px] font-bold text-[#86efac] bg-white/10 border border-white/20 px-2 py-0.5 rounded-full">✓ Submitted</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <p className="text-sm font-bold text-white leading-tight mb-0.5">Monday, March 24</p>
            <p className="text-[10px] text-white/80 font-medium mb-0.5">ABC Cleaning Co.</p>
            <p className="text-[10px] text-white/70">3 hours available</p>
            <p className="text-[10px] text-white/50 mt-2">Tap to see your selections →</p>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <span className="bg-white/20 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">Sarah J.</span>
            <span className="bg-white/20 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">Mike T.</span>
          </div>
        </div>
      </div>
      <div className="mx-3">
        <div className="border-2 border-[#2563eb] rounded-xl px-4 py-2.5 text-center">
          <p className="text-[#2563eb] text-xs font-semibold">View Upcoming Services</p>
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
  const pct = Math.round((used / total) * 100);
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-2 bg-white border-b border-gray-100">
        <p className="text-xs text-gray-400 mb-0.5">Select Tasks</p>
        <p className="text-base font-bold text-[#1a1a1a]">ABC Cleaning Co.</p>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-gray-400">Time selected</p>
          <p className="text-[10px] font-bold text-[#2563eb]">{used} / {total} min</p>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#2563eb] rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex-1 overflow-hidden px-3 space-y-1.5">
        {tasks.map((t) => (
          <div key={t.name} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${t.checked ? 'bg-[#f0fdf4] border-[#86efac]/40' : 'bg-white border-gray-100'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${t.checked ? 'bg-[#16a34a] border-[#16a34a]' : 'border-gray-300'}`}>
              {t.checked && <span className="text-white text-[10px] font-bold">✓</span>}
            </div>
            <p className={`text-xs flex-1 ${t.checked ? 'font-semibold text-[#15803d]' : 'text-[#1a1a1a]'}`}>{t.name}</p>
            <p className="text-[10px] text-gray-400">{t.mins} min</p>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 pt-2">
        <div className="bg-[#2563eb] rounded-xl px-4 py-2.5 text-center">
          <p className="text-white text-xs font-semibold">Review Selection</p>
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

// ─── Screen definitions ───────────────────────────────────────────────────────

const businessScreens: Screen[] = [
  {
    label: 'Dashboard',
    render: (onViewChange) => <BusinessDashboard onViewChange={onViewChange} />,
    hotspots: [
      { title: 'List / Calendar toggle', description: 'Switch between a scrollable card list and a full month calendar — the same toggle available in the real app.', top: '13%', left: '0%' },
      { title: 'Service date tile',      description: 'Each tile represents an upcoming service date. The four numbers show: Total customers scheduled, Done (submitted their task selections), Pending (haven\'t selected yet), and Rate (the overall submission percentage for that day).', top: '46%', left: '0%' },
      { title: 'Progress bar',           description: 'The colored bar shows submission progress for that service date — green when all customers have selected, amber when mixed, blue when none have started yet.', top: '62%', left: '0%' },
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
      { title: 'Service date',          description: 'See every job scheduled for a given day — date, time, and customer count.',       top: '12%', left: '40%' },
      { title: 'Staff assignment pills', description: 'Assign individual team members or named groups to cover the day\'s jobs.',       top: '30%', left: '12%' },
      { title: 'Customer task preview', description: 'See exactly what each customer has selected before your team arrives.',           top: '58%', left: '12%' },
    ],
  },
  {
    label: 'My Team',
    render: () => <BusinessTeam />,
    hotspots: [
      { title: 'Team member row', description: 'Add staff by name — each member appears here with their group assignment.',           top: '27%', left: '12%' },
      { title: 'Group badge',     description: 'Members belong to named groups for faster bulk scheduling and assignment.',           top: '42%', left: '65%' },
      { title: 'Team group card', description: 'Create groups and see every member at a glance — assign the whole group in one tap.', top: '73%', left: '20%' },
    ],
  },
];

const customerScreens: Screen[] = [
  {
    label: 'My Service',
    render: () => <CustomerMyService />,
    hotspots: [
      { title: 'Next Service card',  description: 'Tap the blue card to see your selected tasks or the full task list for the service.', top: '22%', left: '10%' },
      { title: 'Submitted badge',    description: 'Once you\'ve submitted tasks, a green badge confirms your selection is locked in.',    top: '18%', left: '60%' },
      { title: 'Staff pills',        description: 'See exactly who\'s coming — first name and last initial for privacy.',                 top: '36%', left: '64%' },
      { title: 'Upcoming services',  description: 'View all future scheduled dates and submit task preferences for each one.',            top: '62%', left: '20%' },
    ],
  },
  {
    label: 'Select Tasks',
    render: () => <CustomerTaskPicker />,
    hotspots: [
      { title: 'Time budget bar',  description: 'Your available time is shown as a budget — select tasks until it\'s filled.',           top: '22%', left: '12%' },
      { title: 'Selected task',    description: 'Checked tasks are confirmed for your upcoming service and shown in green.',              top: '43%', left: '10%' },
      { title: 'Unselected task',  description: 'Tap any task to add it to your selection — the time counter updates instantly.',        top: '55%', left: '10%' },
      { title: 'Review button',    description: 'When your selection is ready, review the full summary before confirming.',              top: '86%', left: '30%' },
    ],
  },
  {
    label: 'Confirmed',
    render: () => <CustomerSuccess />,
    hotspots: [
      { title: 'Confirmation',      description: 'The green checkmark confirms your selection was received by your service provider.',   top: '22%', left: '55%' },
      { title: 'Locked in message', description: 'Your tasks are set — the team will arrive knowing exactly what needs to be done.',     top: '52%', left: '20%' },
      { title: 'Back to Home',      description: 'Returns to your My Service screen, now showing the ✓ Submitted badge on your card.',  top: '74%', left: '20%' },
    ],
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function AppShowcase() {
  const [activeTab, setActiveTab] = useState<'business' | 'customer'>('business');
  const [activeScreen, setActiveScreen] = useState(0);
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);
  const [dashCalView, setDashCalView] = useState(false);

  const screens = activeTab === 'business' ? businessScreens : customerScreens;
  const current = screens[activeScreen];
  const hotspots = (dashCalView && current.calHotspots) ? current.calHotspots : current.hotspots;
  const activeHotspotData = activeHotspot !== null ? hotspots[activeHotspot] : null;

  function switchTab(tab: 'business' | 'customer') {
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
    <section className="bg-bg py-20 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Heading */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-text mb-4">See TaskRight in action</h2>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            Explore the business and customer experience — tap the numbered circles on the screen to learn what each part does.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-surface border border-border rounded-xl p-1 gap-1">
            {(['business', 'customer'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab === 'business' ? 'Business Account' : 'Customer Account'}
              </button>
            ))}
          </div>
        </div>

        {/* Screen selector — ABOVE the phone */}
        <div className="flex justify-center gap-2 mb-8">
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
                    className={`absolute w-7 h-7 rounded-full text-white text-xs font-bold
                      flex items-center justify-center ring-2 ring-white cursor-pointer z-30
                      transition-all duration-150 hover:scale-110 active:scale-95
                      ${activeHotspot === i ? 'bg-brand scale-110 ring-brand/40' : 'bg-[#1d4ed8]'}`}
                  >
                    {i + 1}
                  </button>
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

                {/* Number + title */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-full bg-brand text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {(activeHotspot ?? 0) + 1}
                  </span>
                  <p className="font-bold text-text text-base leading-tight pr-6">
                    {activeHotspotData.title}
                  </p>
                </div>

                {/* Description */}
                <p className="text-text-muted text-sm leading-relaxed pl-11">
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
                <p className="text-sm font-semibold text-text mb-1">Tap a numbered circle</p>
                <p className="text-xs text-text-muted">
                  Click any number on the screen to see a description of that feature.
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
