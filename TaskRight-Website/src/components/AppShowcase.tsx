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
  render: () => React.ReactNode;
  hotspots: Hotspot[];
};

// ─── Business screen mocks ────────────────────────────────────────────────────

function BusinessDashboard() {
  const customers = [
    { name: 'Jennifer M.', date: 'March 24 · 3 hrs', submitted: true },
    { name: 'Robert A.',   date: 'March 24 · 2 hrs', submitted: false },
    { name: 'Lisa K.',     date: 'March 25 · 3 hrs', submitted: true },
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-3 bg-white border-b border-gray-100">
        <p className="text-xs text-gray-400 mb-0.5">My Customers</p>
        <p className="text-base font-bold text-[#1a1a1a]">3 active customers</p>
      </div>
      <div className="flex-1 overflow-hidden px-3 py-2 space-y-2">
        {customers.map((c) => (
          <div key={c.name} className="bg-white rounded-xl px-3 py-3 border border-gray-100">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#1a1a1a]">{c.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.date}</p>
              </div>
              {c.submitted ? (
                <span className="text-[10px] font-bold text-[#065f46] bg-[#d1fae5] px-2 py-0.5 rounded-full whitespace-nowrap">✓ Tasks Selected</span>
              ) : (
                <span className="text-[10px] font-bold text-[#92400e] bg-[#fef3c7] px-2 py-0.5 rounded-full whitespace-nowrap">Pending</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3">
        <div className="bg-[#2563eb] rounded-xl px-4 py-2.5 text-center">
          <p className="text-white text-xs font-semibold">+ Add Customer</p>
        </div>
      </div>
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
    render: () => <BusinessDashboard />,
    hotspots: [
      { title: 'Customer card',   description: 'Each row shows the customer name, next service date, and hours available.',         top: '25%', left: '12%' },
      { title: 'Status badge',    description: 'Green means tasks are submitted. Amber means the customer hasn\'t selected yet.',   top: '33%', left: '65%' },
      { title: 'Add Customer',    description: 'Add new customers and link them to your scheduled service cycles.',                 top: '82%', left: '40%' },
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

  const screens = activeTab === 'business' ? businessScreens : customerScreens;
  const current = screens[activeScreen];

  function switchTab(tab: 'business' | 'customer') {
    setActiveTab(tab);
    setActiveScreen(0);
    setActiveHotspot(null);
  }

  function switchScreen(i: number) {
    setActiveScreen(i);
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
            Explore the business and customer experience — tap the numbered hotspots to learn what each screen does.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-10">
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

        {/* Main content: phone + callouts */}
        <div className="flex flex-col lg:flex-row items-start gap-10 justify-center">

          {/* Phone frame */}
          <div className="relative mx-auto lg:mx-0 w-[280px] shrink-0">
            <div className="relative w-full bg-white rounded-[2.5rem] border-[8px] border-[#1a1a1a] shadow-2xl overflow-hidden">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#1a1a1a] rounded-b-xl z-20" />
              {/* Screen */}
              <div className="h-[560px] bg-[#f5f5f5] pt-6 relative overflow-hidden">
                {current.render()}

                {/* Hotspot circles */}
                {current.hotspots.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => toggleHotspot(i)}
                    style={{ top: h.top, left: h.left }}
                    className={`absolute w-7 h-7 rounded-full text-white text-xs font-bold
                      flex items-center justify-center ring-2 ring-white cursor-pointer z-30
                      transition-all duration-150 hover:scale-110 active:scale-95
                      ${activeHotspot === i ? 'bg-brand scale-110' : 'bg-[#1d4ed8]'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Callout list */}
          <div className="flex-1 max-w-md w-full space-y-3">
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">
              {activeTab === 'business' ? 'Business Account' : 'Customer Account'} · {current.label}
            </p>
            {current.hotspots.map((h, i) => (
              <button
                key={i}
                onClick={() => toggleHotspot(i)}
                className={`w-full flex gap-3 items-start text-left px-4 py-4 rounded-xl border transition-all duration-150 ${
                  activeHotspot === i
                    ? 'border-brand bg-brand/5 shadow-sm'
                    : 'border-border bg-surface hover:border-brand/40'
                }`}
              >
                <span className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  activeHotspot === i ? 'bg-brand' : 'bg-[#1d4ed8]'
                }`}>
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold text-text text-sm">{h.title}</p>
                  <p className={`text-sm mt-0.5 transition-colors ${activeHotspot === i ? 'text-text-muted' : 'text-text-muted/60'}`}>
                    {h.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Screen selector */}
        <div className="flex justify-center gap-2 mt-10">
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
      </div>
    </section>
  );
}
