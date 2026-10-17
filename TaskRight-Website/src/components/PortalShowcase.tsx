'use client';

import { useState } from 'react';
import { type Hotspot, HotspotDot, HotspotPanel } from './showcase/Hotspot';

// Coded mocks of the business web portal (/dashboard), mirroring the real
// screens' layout with made-up sample data — never screenshots, since the dev
// DB holds real-looking data. Account & Billing is left out on purpose: it
// isn't built yet (WEB_PORTAL.md M7 on hold).

type ViewProps = { a: number | null; tap: (i: number) => void };

const BUSINESS = 'Prairie Home Services';

// ─── Shared mock bits (same vocabulary as the real portal) ────────────────────

function Card({ title, dot, right, children, className = '' }: {
  title: string; dot?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-border p-3 sm:p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-text font-semibold text-sm truncate">{title}</p>
          {dot}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function PageHead({ title, sub, right }: { title: string; sub: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
      <div>
        <p className="text-base font-bold text-text">{title}</p>
        <p className="text-text-muted text-xs">{sub}</p>
      </div>
      {right}
    </div>
  );
}

const chip = 'text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap';
const row = 'flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0';

type Lifecycle = 'proposed' | 'confirmed' | 'completed';
const LC_LABEL: Record<Lifecycle, string> = { proposed: 'Proposed', confirmed: 'Confirmed', completed: 'Completed' };
const LC_CHIP: Record<Lifecycle, string> = {
  proposed: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-brand/10 text-brand',
  completed: 'bg-green-100 text-green-700',
};
const LC_DOT: Record<Lifecycle, string> = { proposed: 'bg-amber-400', confirmed: 'bg-brand', completed: 'bg-success' };

// ─── Home ─────────────────────────────────────────────────────────────────────

function ActionGroup({ label, hint, tone, count, open, children }: {
  label: string; hint: string; tone: 'blue' | 'amber' | 'red'; count: number; open?: boolean; children: React.ReactNode;
}) {
  const toneText = { blue: 'text-brand', amber: 'text-amber-700', red: 'text-red-600' }[tone];
  const toneChip = { blue: 'bg-brand/5 text-brand', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-600' }[tone];
  return (
    <details open={open} className="group border-b border-border last:border-0">
      <summary className="flex items-center justify-between gap-2 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className={`${toneText} text-[10px] font-semibold uppercase tracking-wide`}>{label}</p>
          <p className="text-text-muted text-[10px]">{hint}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`${chip} ${toneChip}`}>{count}</span>
          <span className="text-text-muted text-xs transition-transform group-open:rotate-90" aria-hidden>›</span>
        </div>
      </summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}

function CallRow({ name, sub, refNo }: { name: string; sub: string; refNo: number }) {
  return (
    <div className={row}>
      <div className="min-w-0">
        <p className="text-text text-xs font-medium truncate">{name}</p>
        <p className="text-text-muted text-[10px]">{sub}</p>
      </div>
      <span className={`${chip} bg-bg text-text-muted`}>Ref #{refNo}</span>
    </div>
  );
}

function HomeView({ a, tap }: ViewProps) {
  const week = [['Tue', 5], ['Wed', 3], ['Thu', 6], ['Fri', 4], ['Sat', 1], ['Sun', 0], ['Mon', 5]] as const;
  return (
    <div className="space-y-3">
      <PageHead title="Home" sub="What needs you today." />

      <Card title="Action Center" dot={<HotspotDot index={0} activeHotspot={a} onHotspotTap={tap} />} right={<span className="text-[10px] font-semibold text-text-muted">9 items</span>}>
        <div className="-mt-1">
          <ActionGroup label="Unread messages" hint="Customers waiting on a reply" tone="blue" count={2} open>
            <div className={row}>
              <div><p className="text-text text-xs font-medium">Avery Collins</p><p className="text-text-muted text-[10px]">last at 8:41 AM, Tue, Oct 20</p></div>
              <span className={`${chip} bg-brand text-white`}>2 new</span>
            </div>
            <div className={row}>
              <div><p className="text-text text-xs font-medium">Marcus Bell</p><p className="text-text-muted text-[10px]">last at 7:15 PM, Mon, Oct 19</p></div>
              <span className={`${chip} bg-brand text-white`}>1 new</span>
            </div>
          </ActionGroup>
          <ActionGroup label="Unassigned, coming up" hint="Next 7 days, no one assigned" tone="blue" count={3}>
            <CallRow name="Priya Shah" sub="Thu, Oct 22" refNo={1184} />
            <CallRow name="Leo Park" sub="Fri, Oct 23" refNo={1191} />
            <CallRow name="Grace Kim" sub="Mon, Oct 26" refNo={1203} />
          </ActionGroup>
          <ActionGroup label="Awaiting confirmation" hint="Waiting on the customer to confirm" tone="amber" count={3}>
            <CallRow name="Hannah Ortiz" sub="Wed, Oct 21 · deadline Tue, Oct 20" refNo={1177} />
            <CallRow name="Sam Whitfield" sub="Thu, Oct 22 · deadline Wed, Oct 21" refNo={1182} />
            <CallRow name="Jordan Ruiz" sub="Fri, Oct 23 · deadline Thu, Oct 22" refNo={1190} />
          </ActionGroup>
          <ActionGroup label="Past deadline" hint="Customer missed the confirmation deadline" tone="red" count={1}>
            <CallRow name="Nora Daniels" sub="Wed, Oct 21 · deadline Mon, Oct 19" refNo={1175} />
          </ActionGroup>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card title="Today" dot={<HotspotDot index={1} activeHotspot={a} onHotspotTap={tap} />} right={<span className="text-[10px] font-semibold text-brand">Schedule →</span>}>
          {[
            ['Avery Collins', true, true],
            ['Jordan Ruiz', true, true],
            ['Priya Shah', false, true],
            ['Marcus Bell', true, false],
          ].map(([n, conf, asg]) => (
            <div key={n as string} className={row}>
              <p className="text-text text-xs font-medium truncate">{n}</p>
              <div className="flex gap-1">
                <span className={`${chip} ${conf ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{conf ? 'Confirmed' : 'Pending'}</span>
                <span className={`${chip} ${asg ? 'bg-brand/10 text-brand' : 'bg-bg text-text-muted'}`}>{asg ? 'Assigned' : 'Unassigned'}</span>
              </div>
            </div>
          ))}
        </Card>

        <Card title="On the clock" dot={<HotspotDot index={2} activeHotspot={a} onHotspotTap={tap} />} right={<span className="text-[10px] font-semibold text-brand">Team →</span>}>
          {[
            ['Dana Moreno', 'Avery Collins', '9:12 AM'],
            ['Luis Romero', 'Jordan Ruiz', '9:40 AM'],
          ].map(([m, c, t]) => (
            <div key={m} className={row}>
              <div><p className="text-text text-xs font-medium">{m}</p><p className="text-text-muted text-[10px]">at {c} · since {t}</p></div>
              <span className="w-2 h-2 rounded-full bg-success" />
            </div>
          ))}
        </Card>
      </div>

      <Card title="This week">
        <div className="grid grid-cols-7 gap-1">
          {week.map(([d, n]) => (
            <div key={d} className="text-center">
              <p className="text-text-muted text-[10px] mb-1">{d}</p>
              <div className={`rounded-md py-1.5 text-xs font-semibold ${n > 0 ? 'bg-brand/10 text-brand' : 'bg-bg text-text-muted'}`}>{n}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="This month" dot={<HotspotDot index={3} activeHotspot={a} onHotspotTap={tap} />} right={<span className="text-[10px] font-semibold text-brand">Money →</span>}>
        <p className="text-text-muted text-[10px]">Margin</p>
        <p className="text-2xl font-bold text-text">$3,412<span className="text-xs font-semibold text-text-muted ml-1.5">42.6%</span></p>
        <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-border">
          <div><p className="text-text-muted text-[10px]">Revenue</p><p className="text-text text-xs font-semibold">$8,010</p><p className="text-text-muted text-[10px]">23 jobs done</p></div>
          <div><p className="text-text-muted text-[10px]">Cost</p><p className="text-text text-xs font-semibold">$4,598</p></div>
          <div><p className="text-text-muted text-[10px]">Still scheduled</p><p className="text-text-muted text-xs font-semibold">$2,940</p><p className="text-text-muted text-[10px]">14 open calls</p></div>
        </div>
      </Card>
    </div>
  );
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

type MockCall = { name: string; service: string; assignee: string | null; state: Lifecycle };

// October 2026 (Oct 1 is a Thursday). "Today" is Tue, Oct 20.
const SCHEDULE: Record<number, { hours: number; calls: MockCall[] }> = {
  6: { hours: 7, calls: [
    { name: 'Avery Collins', service: 'Weekly Clean', assignee: 'Dana Moreno', state: 'completed' },
    { name: 'Grace Kim', service: 'Deep Clean', assignee: 'Crew A (group)', state: 'completed' },
  ] },
  13: { hours: 7, calls: [
    { name: 'Avery Collins', service: 'Weekly Clean', assignee: 'Dana Moreno', state: 'completed' },
    { name: 'Jordan Ruiz', service: 'Lawn Care', assignee: 'Luis Romero', state: 'completed' },
  ] },
  15: { hours: 3, calls: [{ name: 'Leo Park', service: 'Biweekly Clean', assignee: 'Kayla Tran', state: 'completed' }] },
  20: { hours: 11, calls: [
    { name: 'Avery Collins', service: 'Weekly Clean', assignee: 'Dana Moreno', state: 'confirmed' },
    { name: 'Jordan Ruiz', service: 'Lawn Care', assignee: 'Luis Romero', state: 'confirmed' },
    { name: 'Priya Shah', service: 'Deep Clean', assignee: 'Crew A (group)', state: 'proposed' },
    { name: 'Marcus Bell', service: 'Weekly Clean', assignee: null, state: 'confirmed' },
  ] },
  21: { hours: 5, calls: [
    { name: 'Hannah Ortiz', service: 'Biweekly Clean', assignee: 'Kayla Tran', state: 'proposed' },
    { name: 'Nora Daniels', service: 'Lawn Care', assignee: 'Luis Romero', state: 'proposed' },
  ] },
  22: { hours: 6, calls: [
    { name: 'Sam Whitfield', service: 'Weekly Clean', assignee: 'Dana Moreno', state: 'proposed' },
    { name: 'Priya Shah', service: 'Window Wash', assignee: null, state: 'confirmed' },
  ] },
  23: { hours: 4, calls: [
    { name: 'Jordan Ruiz', service: 'Lawn Care', assignee: 'Luis Romero', state: 'proposed' },
    { name: 'Leo Park', service: 'Biweekly Clean', assignee: null, state: 'proposed' },
  ] },
  27: { hours: 7, calls: [
    { name: 'Avery Collins', service: 'Weekly Clean', assignee: 'Dana Moreno', state: 'proposed' },
    { name: 'Grace Kim', service: 'Deep Clean', assignee: null, state: 'proposed' },
  ] },
  29: { hours: 3, calls: [{ name: 'Leo Park', service: 'Biweekly Clean', assignee: 'Kayla Tran', state: 'proposed' }] },
};

function ScheduleView({ a, tap }: ViewProps) {
  const [day, setDay] = useState(20);
  // 6-week grid starting Sun, Sep 27.
  const cells = Array.from({ length: 42 }, (_, i) => {
    const n = i - 3; // index 4 → Oct 1
    if (n < 1) return { label: 27 + i, inMonth: false, date: 0 };
    if (n > 31) return { label: n - 31, inMonth: false, date: 0 };
    return { label: n, inMonth: true, date: n };
  });
  const sel = SCHEDULE[day];
  const unassigned = sel ? sel.calls.filter(c => !c.assignee && c.state !== 'completed').length : 0;

  return (
    <div>
      <PageHead title="Schedule" sub="Every service call, by day. Pick a day to see its snapshot." />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-3">
        <div className="bg-white rounded-xl border border-border p-2.5 sm:p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-text font-semibold text-sm">October 2026</p>
              <HotspotDot index={0} activeHotspot={a} onHotspotTap={tap} />
            </div>
            <div className="flex gap-1 text-xs">
              <span className="px-2 py-0.5 rounded-md border border-border text-text">‹</span>
              <span className="px-2 py-0.5 rounded-md border border-border text-text">Today</span>
              <span className="px-2 py-0.5 rounded-md border border-border text-text">›</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-0.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => (
              <p key={w} className="text-text-muted text-[10px] text-center font-medium">{w}</p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c, i) => {
              const data = c.inMonth ? SCHEDULE[c.date] : undefined;
              const isSel = c.inMonth && c.date === day;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!c.inMonth}
                  onClick={() => setDay(c.date)}
                  className={`min-h-11 sm:min-h-14 rounded-md border p-1 flex flex-col text-left transition-colors ${
                    isSel ? 'border-brand bg-brand/5' : 'border-border hover:bg-bg'
                  } ${c.inMonth ? '' : 'opacity-40'}`}
                >
                  <span className={`text-[10px] font-semibold w-4.5 h-4.5 flex items-center justify-center rounded-full ${c.date === 20 ? 'bg-brand text-white' : 'text-text'}`}>
                    {c.label}
                  </span>
                  {data && (
                    <div className="mt-auto">
                      <p className="hidden sm:block text-text text-[10px] font-semibold leading-tight">{data.calls.length} call{data.calls.length === 1 ? '' : 's'}</p>
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {data.calls.map((call, j) => <span key={j} className={`w-1.5 h-1.5 rounded-full ${LC_DOT[call.state]}`} />)}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2.5">
            {(['proposed', 'confirmed', 'completed'] as const).map(s => (
              <span key={s} className="flex items-center gap-1 text-text-muted text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${LC_DOT[s]}`} />{LC_LABEL[s]}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-3.5">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">Day snapshot</p>
            <HotspotDot index={1} activeHotspot={a} onHotspotTap={tap} />
          </div>
          <p className="text-text font-semibold text-sm mb-2.5">
            {new Date(Date.UTC(2026, 9, day)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
          </p>
          {!sel ? (
            <p className="text-text-muted text-xs">Nothing scheduled this day.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                <div className="bg-bg rounded-md p-1.5 text-center"><p className="text-sm font-bold text-text">{sel.calls.length}</p><p className="text-text-muted text-[10px]">calls</p></div>
                <div className="bg-bg rounded-md p-1.5 text-center"><p className="text-sm font-bold text-text">{sel.hours}</p><p className="text-text-muted text-[10px]">hours</p></div>
                <div className={`rounded-md p-1.5 text-center ${unassigned ? 'bg-amber-50' : 'bg-bg'}`}>
                  <p className={`text-sm font-bold ${unassigned ? 'text-amber-700' : 'text-text'}`}>{unassigned}</p>
                  <p className="text-text-muted text-[10px]">unassigned</p>
                </div>
              </div>
              {sel.calls.map((c, i) => (
                <div key={i} className={row}>
                  <div className="min-w-0">
                    <p className="text-text text-xs font-medium truncate">{c.name}</p>
                    <p className="text-text-muted text-[10px] truncate">{c.service} · {c.assignee || 'Unassigned'}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {i === 0 && <HotspotDot index={2} activeHotspot={a} onHotspotTap={tap} />}
                    <span className={`${chip} ${LC_CHIP[c.state]}`}>{LC_LABEL[c.state]}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Customers ────────────────────────────────────────────────────────────────

const CUSTOMERS = [
  { name: 'Avery Collins', phone: '(402) 555-0114', address: '1840 S 27th St', services: ['Weekly Clean · Weekly'], today: true, x: 38, y: 58 },
  { name: 'Grace Kim', phone: '(402) 555-0162', address: '612 Elm Ct', services: ['Deep Clean · Monthly'], today: false, x: 70, y: 30 },
  { name: 'Hannah Ortiz', phone: '(402) 555-0139', address: '4021 Prescott Ave', services: ['Biweekly Clean · Biweekly'], today: false, x: 22, y: 26 },
  { name: 'Jordan Ruiz', phone: '(402) 555-0187', address: '233 Pioneers Blvd', services: ['Lawn Care · Weekly'], today: true, x: 56, y: 72 },
  { name: 'Leo Park', phone: '(402) 555-0108', address: '97 Sheridan Blvd', services: ['Biweekly Clean · Biweekly'], today: false, x: 82, y: 64 },
  { name: 'Marcus Bell', phone: '(402) 555-0171', address: '1505 Garfield St', services: ['Weekly Clean · Weekly'], today: true, x: 30, y: 82 },
  { name: 'Priya Shah', phone: '(402) 555-0125', address: '3300 Calvert St', services: ['Deep Clean · Monthly', 'Window Wash · One-time'], today: true, x: 64, y: 46 },
];

function CustomersView({ a, tap, map, setMap }: ViewProps & { map: boolean; setMap: (v: boolean) => void }) {
  const [q, setQ] = useState('');
  const list = CUSTOMERS.filter(c => {
    const s = q.trim().toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || c.address.toLowerCase().includes(s) || c.phone.includes(s);
  });

  return (
    <div>
      <PageHead
        title="Customers"
        sub={`${CUSTOMERS.length} customers.`}
        right={<span className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold">+ Add customer</span>}
      />
      <div className="bg-white rounded-xl border border-border p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex-1 min-w-[140px] flex items-center gap-2">
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name, phone or address"
              aria-label="Search sample customers"
              className="flex-1 min-w-0 rounded-md border border-border px-2.5 py-1.5 text-xs text-text bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <HotspotDot index={0} activeHotspot={a} onHotspotTap={tap} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-bg rounded-md p-0.5">
              {[false, true].map(m => (
                <button
                  key={String(m)}
                  type="button"
                  onClick={() => setMap(m)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium ${map === m ? 'bg-brand text-white' : 'text-text hover:bg-white'}`}
                >
                  {m ? 'Map' : 'List'}
                </button>
              ))}
            </div>
            <HotspotDot index={1} activeHotspot={a} onHotspotTap={tap} />
          </div>
        </div>

        {map ? (
          <>
            <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden bg-[#eef2f6] border border-border">
              {/* Stylized streets — a sketch, not a real map */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 62.5" preserveAspectRatio="none" aria-hidden>
                <path d="M0 20 H100 M0 42 H100 M18 0 V62.5 M47 0 V62.5 M76 0 V62.5" stroke="#fff" strokeWidth="1.6" />
                <path d="M0 55 L100 8" stroke="#fff" strokeWidth="2.4" />
                <path d="M0 31 H100 M33 0 V62.5 M90 0 V62.5" stroke="#fff" strokeWidth="0.7" />
                <rect x="50" y="23" width="12" height="7" rx="1" fill="#dcefe0" />
              </svg>
              {list.map((c, i) => (
                <div key={c.name} className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
                  <span title={c.name} className={`block w-3 h-3 rounded-full ring-2 ring-white shadow ${c.today ? 'bg-orange-500' : 'bg-brand'}`} />
                  {i === 0 && <HotspotDot index={2} activeHotspot={a} onHotspotTap={tap} />}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-text-muted text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand" />Customer</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Service call today</span>
            </div>
          </>
        ) : list.length === 0 ? (
          <p className="text-text-muted text-xs">No customers match “{q}”.</p>
        ) : (
          list.map((c, i) => (
            <div key={c.name} className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0">
              <div className="min-w-0">
                <p className="text-text text-xs font-medium truncate">
                  {c.name}
                  {c.today && <span className={`${chip} ml-1.5 bg-orange-50 text-orange-700`}>Today</span>}
                </p>
                <p className="text-text-muted text-[10px] truncate">{c.phone} · {c.address}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="hidden sm:flex flex-wrap justify-end gap-1">
                  {c.services.map(s => <span key={s} className={`${chip} font-medium bg-brand/10 text-brand`}>{s}</span>)}
                </div>
                {i === 0 && <HotspotDot index={2} activeHotspot={a} onHotspotTap={tap} />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Messages ─────────────────────────────────────────────────────────────────

type Bubble = { out: boolean; body?: string; photo?: boolean; at: string };

const THREADS: { name: string; phone: string; preview: string; at: string; unread: number; messages: Bubble[] }[] = [
  {
    name: 'Avery Collins', phone: '(402) 555-0114', preview: 'Sent a photo', at: '8:41 AM', unread: 2,
    messages: [
      { out: true, body: 'Hi Avery! Your Weekly Clean is Tue, Oct 20. Reply T to pick your tasks for this visit.', at: 'Sat 9:00 AM' },
      { out: false, body: 'T', at: 'Sat 9:14 AM' },
      { out: false, body: 'Could the team take a look at this stain on the rug too?', at: '8:40 AM' },
      { out: false, photo: true, at: '8:41 AM' },
    ],
  },
  {
    name: 'Marcus Bell', phone: '(402) 555-0171', preview: 'Can we push to next week?', at: 'Mon', unread: 1,
    messages: [
      { out: true, body: 'Hi Marcus, a reminder that your Weekly Clean is Tue, Oct 20.', at: 'Sat 9:00 AM' },
      { out: false, body: 'Can we push to next week?', at: 'Mon 7:15 PM' },
    ],
  },
  {
    name: 'Grace Kim', phone: '(402) 555-0162', preview: 'Thank you, it looks great!', at: 'Oct 6', unread: 0,
    messages: [
      { out: true, body: 'All done for today, Grace. Let us know how we did!', at: 'Oct 6, 2:05 PM' },
      { out: false, body: 'Thank you, it looks great!', at: 'Oct 6, 2:31 PM' },
    ],
  },
  {
    name: 'Jordan Ruiz', phone: '(402) 555-0187', preview: 'Gate code is 4412', at: 'Oct 13', unread: 0,
    messages: [
      { out: false, body: 'Gate code is 4412', at: 'Oct 13, 8:02 AM' },
      { out: true, body: 'Got it, thanks Jordan. Luis will be there around 9:30.', at: 'Oct 13, 8:10 AM' },
    ],
  },
];

function MessagesView({ a, tap }: ViewProps) {
  const [open, setOpen] = useState(0);
  const [read, setRead] = useState<Set<number>>(new Set());
  const t = THREADS[open];

  function pick(i: number) {
    setOpen(i);
    setRead(prev => new Set(prev).add(i));
  }

  return (
    <div>
      <PageHead title="Messages" sub="Every customer conversation, in one inbox." />
      <div className="bg-white rounded-xl border border-border overflow-hidden grid grid-cols-1 md:grid-cols-[220px_1fr]">
        <div className="border-b md:border-b-0 md:border-r border-border">
          <div className="p-2.5 border-b border-border flex items-center gap-2">
            <div className="flex-1 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-text-muted">Search conversations</div>
            <HotspotDot index={0} activeHotspot={a} onHotspotTap={tap} />
          </div>
          {THREADS.map((th, i) => {
            const unread = read.has(i) ? 0 : th.unread;
            return (
              <button
                key={th.name}
                type="button"
                onClick={() => pick(i)}
                className={`w-full text-left px-3 py-2 border-b border-border last:border-0 ${open === i ? 'bg-brand/5' : 'hover:bg-bg'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-xs truncate ${unread ? 'font-bold text-text' : 'font-medium text-text'}`}>{th.name}</p>
                  <span className="text-text-muted text-[10px] shrink-0">{th.at}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[10px] truncate ${unread ? 'text-text' : 'text-text-muted'}`}>{th.preview}</p>
                  {unread > 0 && <span className="shrink-0 min-w-4 h-4 px-1 rounded-full bg-brand text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
            <div className="min-w-0">
              <p className="text-text text-sm font-semibold truncate">{t.name}</p>
              <p className="text-text-muted text-[10px]">{t.phone}</p>
            </div>
            <span className="text-brand text-[11px] font-medium shrink-0">View customer</span>
          </div>
          <div className="flex-1 px-3 py-3 space-y-2 bg-bg/50 min-h-[200px]">
            {t.messages.map((m, i) => (
              <div key={i} className={`flex items-end gap-1.5 ${m.out ? 'justify-end' : 'justify-start'}`}>
                {i === 0 && <HotspotDot index={1} activeHotspot={a} onHotspotTap={tap} />}
                <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${m.out ? 'bg-brand text-white rounded-br-md' : 'bg-white border border-border text-text rounded-bl-md'}`}>
                  {m.photo && (
                    <div className="w-36 h-24 rounded-lg mb-1 bg-gradient-to-br from-stone-300 to-stone-400 flex items-center justify-center text-[10px] text-white/90">Photo</div>
                  )}
                  {m.body && <p className="text-xs">{m.body}</p>}
                  <p className={`text-[9px] mt-0.5 ${m.out ? 'text-white/70' : 'text-text-muted'}`}>{m.at}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-2.5">
            <div className="flex gap-2 items-center">
              <div className="flex-1 rounded-md border border-border px-2.5 py-2 text-[11px] text-text-muted truncate">Text {t.name}…</div>
              <span className="px-3 py-2 rounded-md bg-brand text-white text-xs font-semibold">Send</span>
              <HotspotDot index={2} activeHotspot={a} onHotspotTap={tap} />
            </div>
            <p className="text-text-muted text-[9px] mt-1">Sends as a text from your business number.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────

type BoardCall = { name: string; day: string; service: string; state: Lifecycle };

function BoardList({ calls }: { calls: BoardCall[] }) {
  return (
    <div>
      {calls.map((c, i) => (
        <div key={i} className={row}>
          <div className="min-w-0">
            <p className="text-text text-xs truncate">{c.name}</p>
            <p className="text-text-muted text-[10px] truncate">{c.day} · {c.service}</p>
          </div>
          <span className={`${chip} ${LC_CHIP[c.state]}`}>{LC_LABEL[c.state]}</span>
        </div>
      ))}
    </div>
  );
}

function TeamView({ a, tap }: ViewProps) {
  const columns: { label: string; sub: string; calls: BoardCall[] }[] = [
    { label: 'Dana Moreno', sub: '32 hrs/week', calls: [
      { name: 'Avery Collins', day: 'Tue, Oct 20', service: 'Weekly Clean', state: 'confirmed' },
      { name: 'Sam Whitfield', day: 'Thu, Oct 22', service: 'Weekly Clean', state: 'proposed' },
    ] },
    { label: 'Luis Romero', sub: '40 hrs/week', calls: [
      { name: 'Jordan Ruiz', day: 'Tue, Oct 20', service: 'Lawn Care', state: 'confirmed' },
      { name: 'Nora Daniels', day: 'Wed, Oct 21', service: 'Lawn Care', state: 'proposed' },
    ] },
    { label: 'Crew A', sub: 'Group · 3 members', calls: [
      { name: 'Priya Shah', day: 'Tue, Oct 20', service: 'Deep Clean', state: 'proposed' },
    ] },
  ];
  const unassigned: BoardCall[] = [
    { name: 'Marcus Bell', day: 'Tue, Oct 20', service: 'Weekly Clean', state: 'confirmed' },
    { name: 'Priya Shah', day: 'Thu, Oct 22', service: 'Window Wash', state: 'confirmed' },
    { name: 'Leo Park', day: 'Fri, Oct 23', service: 'Biweekly Clean', state: 'proposed' },
  ];

  return (
    <div className="space-y-3">
      <PageHead
        title="Team"
        sub="4 members · 1 group"
        right={
          <div className="flex gap-0.5 bg-white border border-border rounded-md p-0.5 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-brand text-white font-medium">Overview</span>
            <span className="px-2.5 py-1 rounded-md text-text">Members</span>
            <span className="px-2.5 py-1 rounded-md text-text">Groups</span>
          </div>
        }
      />
      <Card title="On the clock" dot={<HotspotDot index={0} activeHotspot={a} onHotspotTap={tap} />} right={<span className="text-text-muted text-[10px]">Updates every 30s</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            ['Dana Moreno', 'Avery Collins', 'since 9:12 AM · 1h 24m'],
            ['Luis Romero', 'Jordan Ruiz', 'since 9:40 AM · 56m'],
          ].map(([m, c, s]) => (
            <div key={m} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
              <span className="w-2 h-2 rounded-full bg-success shrink-0" />
              <div className="min-w-0">
                <p className="text-text text-xs font-medium">{m}</p>
                <p className="text-text-muted text-[10px] truncate">at {c} · {s}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div>
        <p className="text-text font-semibold text-sm">This week’s assignments</p>
        <p className="text-text-muted text-[11px] mb-2">Tue, Oct 20 – Mon, Oct 26. Open a call to assign or reassign it.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <p className="text-amber-800 font-semibold text-xs">Unassigned</p>
                <HotspotDot index={1} activeHotspot={a} onHotspotTap={tap} />
              </div>
              <span className="text-amber-800 text-[10px] font-semibold">{unassigned.length}</span>
            </div>
            <BoardList calls={unassigned} />
          </div>
          {columns.map((col, i) => (
            <div key={col.label} className="bg-white rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-text font-semibold text-xs truncate">{col.label}</p>
                    {i === 0 && <HotspotDot index={2} activeHotspot={a} onHotspotTap={tap} />}
                  </div>
                  <p className="text-text-muted text-[10px]">{col.sub}</p>
                </div>
                <span className="text-text text-[10px] font-semibold shrink-0">{col.calls.length} call{col.calls.length === 1 ? '' : 's'}</span>
              </div>
              <BoardList calls={col.calls} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Money ────────────────────────────────────────────────────────────────────

function MoneyView({ a, tap }: ViewProps) {
  const tiles = [
    ['Revenue', '$8,010', '23 completed jobs'],
    ['Total cost', '$4,598', 'Labor + materials + overhead'],
    ['Margin', '$3,412', '42.6%'],
    ['Still scheduled', '$2,940', '14 open calls in this period'],
  ];
  const statement = [
    ['5000', 'Direct Labor', '$3,720'],
    ['5100', 'Materials / Supplies', '$618'],
    ['5200', 'Job Overhead', '$260'],
  ];
  const byCustomer = [
    ['Priya Shah', 3, '$1,140', '$512', '$628', '55.1%'],
    ['Avery Collins', 4, '$720', '$384', '$336', '46.7%'],
    ['Grace Kim', 2, '$560', '$402', '$158', '28.2%'],
    ['Jordan Ruiz', 4, '$480', '$436', '$44', '9.2%'],
  ];

  return (
    <div className="space-y-3">
      <PageHead
        title="Money"
        sub="True job cost and margin — October 1 to October 31."
        right={
          <div className="flex flex-wrap gap-0.5 bg-white border border-border rounded-md p-0.5 text-[11px]">
            {['This month', 'Last month', 'Last 90 days', 'This year'].map((p, i) => (
              <span key={p} className={`px-2 py-1 rounded-md ${i === 0 ? 'bg-brand text-white font-medium' : 'text-text'}`}>{p}</span>
            ))}
          </div>
        }
      />
      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2">
        {tiles.map(([label, value, sub], i) => (
          <div key={label} className="bg-white rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-1">
              <p className="text-text-muted text-[10px]">{label}</p>
              {i === 0 && <HotspotDot index={0} activeHotspot={a} onHotspotTap={tap} />}
            </div>
            <p className={`text-lg font-bold ${label === 'Still scheduled' ? 'text-text-muted' : 'text-text'}`}>{value}</p>
            <p className="text-text-muted text-[10px]">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
        <Card title="Statement" dot={<HotspotDot index={1} activeHotspot={a} onHotspotTap={tap} />}>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-border">
                <td className="py-1.5 text-text-muted tabular-nums w-10">4000</td>
                <td className="py-1.5 text-text font-medium">Service Revenue</td>
                <td className="py-1.5 text-right tabular-nums text-text font-medium">$8,010</td>
              </tr>
              {statement.map(([code, name, amt]) => (
                <tr key={code} className="border-b border-border">
                  <td className="py-1.5 text-text-muted tabular-nums">{code}</td>
                  <td className="py-1.5 text-text">{name}</td>
                  <td className="py-1.5 text-right tabular-nums text-text">({amt})</td>
                </tr>
              ))}
              <tr>
                <td />
                <td className="pt-2 text-text font-semibold">Gross margin</td>
                <td className="pt-2 text-right tabular-nums font-semibold text-text">$3,412<span className="block text-text-muted text-[10px] font-normal">42.6%</span></td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title="By customer" dot={<HotspotDot index={2} activeHotspot={a} onHotspotTap={tap} />} className="overflow-x-auto">
          <table className="w-full text-xs min-w-[340px]">
            <thead>
              <tr className="text-text-muted text-[10px] text-left border-b border-border">
                <th className="pb-1.5 font-medium">Customer</th>
                <th className="pb-1.5 font-medium text-right">Jobs</th>
                <th className="pb-1.5 font-medium text-right">Revenue</th>
                <th className="pb-1.5 font-medium text-right">Cost</th>
                <th className="pb-1.5 font-medium text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {byCustomer.map(([n, jobs, rev, cost, m, pct]) => (
                <tr key={n} className="border-b border-border last:border-0">
                  <td className="py-1.5 text-text">{n}</td>
                  <td className="py-1.5 text-right tabular-nums text-text-muted">{jobs}</td>
                  <td className="py-1.5 text-right tabular-nums text-text">{rev}</td>
                  <td className="py-1.5 text-right tabular-nums text-text">{cost}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-text">{m} <span className="text-text-muted text-[10px] font-normal">{pct}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─── View definitions ─────────────────────────────────────────────────────────

const CUSTOMER_HOTSPOTS_BASE: Hotspot[] = [
  { title: 'Search', description: 'Find any customer by name, phone number or address. Try it — the sample list filters as you type.' },
  { title: 'List / Map toggle', description: 'Flip between the customer list and a map of every customer’s address. Customers with a service call today stand out in orange, so the day’s route is easy to see.' },
];

const VIEWS: { label: string; hotspots: (map: boolean) => Hotspot[] }[] = [
  {
    label: 'Home',
    hotspots: () => [
      { title: 'Action Center', description: 'Everything waiting on you, in one place: unread texts, upcoming calls with no one assigned, customers who haven’t confirmed, and missed deadlines. Each group opens and closes, and every row links straight to the call or the conversation.' },
      { title: 'Today', description: 'Today’s calls at a glance — whether each customer confirmed and whether someone is assigned. The week strip below counts calls per day; click a day to open it on the Schedule.' },
      { title: 'On the clock', description: 'Who is on site right now, where, and since when. Team members clock in automatically when they arrive at the customer’s address, and Home refreshes itself while it’s open.' },
      { title: 'This month’s margin', description: 'Margin for the month so far: revenue from completed jobs minus labor, materials and overhead — plus the revenue still on the schedule. Same numbers as the Money page.' },
    ],
  },
  {
    label: 'Schedule',
    hotspots: () => [
      { title: 'Month calendar', description: 'Every service call on a month grid. Each dot is a call — amber when it’s proposed, blue once the customer confirms, green when the job is done. Click any day.' },
      { title: 'Day snapshot', description: 'The day you picked: how many calls, how many hours, and how many still need someone assigned.' },
      { title: 'Service call', description: 'Open a call to see the tasks the customer picked, expected hours and price, assign a team member or a whole group, reschedule (the customer gets a text), and track what the job cost.' },
    ],
  },
  {
    label: 'Customers',
    hotspots: (map) => [
      ...CUSTOMER_HOTSPOTS_BASE,
      map
        ? { title: 'Customer pins', description: 'Each pin is a customer’s address. Orange pins have a service call today. In the portal, click a pin to jump to that customer.' }
        : { title: 'Customer row', description: 'Phone, address and active services for every customer, with a Today badge for anyone on today’s schedule. Open a customer for their services, upcoming calls, profitability and messages.' },
    ],
  },
  {
    label: 'Messages',
    hotspots: () => [
      { title: 'Unified inbox', description: 'Every customer’s text thread in one inbox, newest first. Unread conversations are bold with a count. Click a conversation to open it.' },
      { title: 'Conversation', description: 'The whole two-way thread — automated reminders, your replies, and photos customers text in.' },
      { title: 'Reply from your desk', description: 'Type on a real keyboard and it goes out as a text from your business number. Your customers don’t need an app to talk to you.' },
    ],
  },
  {
    label: 'Team',
    hotspots: () => [
      { title: 'On the clock', description: 'A live board of who is clocked in, at which customer, and for how long. It updates every 30 seconds.' },
      { title: 'Unassigned', description: 'Calls in the next 7 days that still need someone. Open one to assign a team member or a whole group.' },
      { title: 'Assignment columns', description: 'Each team member and group gets a column with their calls for the week, so you can balance the workload at a glance.' },
    ],
  },
  {
    label: 'Money',
    hotspots: () => [
      { title: 'Revenue, cost, margin', description: 'Totals for the period, plus the revenue still on the schedule. Switch between this month, last month, the last 90 days and the year.' },
      { title: 'Statement', description: 'A simple profit-and-loss in standard accounting categories: service revenue, labor, materials and overhead.' },
      { title: 'Margin by customer', description: 'See which customers actually make you money — and the same breakdown by service and per job. Labor cost comes from time on site at each team member’s hourly rate.' },
    ],
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortalShowcase() {
  const [view, setView] = useState(0);
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);
  const [customersMap, setCustomersMap] = useState(false);

  const hotspots = VIEWS[view].hotspots(customersMap);

  function switchView(i: number) {
    setView(i);
    setActiveHotspot(null);
    setCustomersMap(false);
  }

  function toggleHotspot(i: number) {
    setActiveHotspot(activeHotspot === i ? null : i);
  }

  const props = { a: activeHotspot, tap: toggleHotspot };
  const label = VIEWS[view].label;

  return (
    <section id="portal-showcase" className="bg-surface py-20 px-6">
      <div className="max-w-6xl mx-auto">

        <div className="text-center mb-10">
          <p className="text-xs font-bold text-brand uppercase tracking-widest mb-3">Business web portal</p>
          <h2 className="text-3xl font-bold text-text mb-4">Run your business from your desk</h2>
          <p className="text-text-muted text-lg max-w-2xl mx-auto">
            Your team works from the app in the field. You get a web portal for the office — the same
            customers, calls and conversations on a bigger screen, plus a map, a team board and true job margins.
            Click the blue dots to see what each part does.
          </p>
        </div>

        {/* View selector */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {VIEWS.map((v, i) => (
            <button
              key={v.label}
              onClick={() => switchView(i)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                view === i
                  ? 'bg-brand text-white'
                  : 'bg-surface text-text-muted border border-border hover:border-brand/40 hover:text-text'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col xl:flex-row items-start gap-8">

          {/* Browser frame */}
          <div className="w-full min-w-0 flex-1 rounded-xl border border-border bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2 bg-[#eceef1] border-b border-border">
              <div className="flex gap-1.5 shrink-0" aria-hidden>
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="min-w-0 bg-white rounded-md px-3 py-1 text-[11px] text-text-muted truncate">
                TaskRight — {label}
              </div>
            </div>

            <div className="flex h-[580px] sm:h-[620px]">
              {/* Portal left nav (desktop) */}
              <nav className="hidden md:block w-40 shrink-0 bg-white border-r border-border">
                <p className="px-4 py-3 text-brand font-bold text-base tracking-tight border-b border-border">TaskRight</p>
                <ul className="px-2 py-3 space-y-0.5">
                  {VIEWS.map((v, i) => (
                    <li key={v.label}>
                      <button
                        type="button"
                        onClick={() => switchView(i)}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-semibold ${
                          view === i ? 'bg-brand/10 text-brand' : 'text-text-muted hover:bg-bg hover:text-text'
                        }`}
                      >
                        {v.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-white border-b border-border">
                  <p className="text-text font-semibold text-xs truncate">
                    <span className="md:hidden text-brand font-bold mr-2">TaskRight</span>{BUSINESS}
                  </p>
                  <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[11px] font-semibold flex items-center justify-center shrink-0">P</span>
                </div>
                <div className="flex-1 overflow-y-auto bg-bg p-3 sm:p-5">
                  {view === 0 && <HomeView {...props} />}
                  {view === 1 && <ScheduleView {...props} />}
                  {view === 2 && <CustomersView {...props} map={customersMap} setMap={(m) => { setCustomersMap(m); setActiveHotspot(null); }} />}
                  {view === 3 && <MessagesView {...props} />}
                  {view === 4 && <TeamView {...props} />}
                  {view === 5 && <MoneyView {...props} />}
                </div>
              </div>
            </div>
          </div>

          {/* Popup panel — right of the browser on wide screens, below otherwise */}
          <div className="w-full xl:w-80 shrink-0">
            <HotspotPanel
              hotspots={hotspots}
              activeHotspot={activeHotspot}
              onSelect={setActiveHotspot}
              panelKey={`${view}-${customersMap}-${activeHotspot}`}
            />
            <p className="text-text-muted text-xs mt-4 text-center xl:text-left">
              Sample data. The web portal comes with your TaskRight account, alongside the mobile app.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
