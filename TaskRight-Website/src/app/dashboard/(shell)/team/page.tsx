import Link from 'next/link';
import { requireSession, businessGet } from '@/lib/serverApi';
import { type Forecast, LIFECYCLE_CLASS, LIFECYCLE_LABEL, addDays, callsForDay, dayKey, todayKey } from '@/lib/schedule';
import type { ActiveClock, RangeAssignment, TeamGroup, TeamMember } from '@/lib/team';
import AutoRefresh from '@/components/dashboard/AutoRefresh';
import MembersPanel from '@/components/dashboard/team/MembersPanel';
import GroupsPanel from '@/components/dashboard/team/GroupsPanel';

type Tab = 'overview' | 'members' | 'groups';

function formatSince(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const since = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `since ${since} · ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`}`;
}

function shortDay(key: string) {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

type BoardCall = { selectionCycleId: number; customerName: string; serviceName: string | null; date: string; lifecycleState: keyof typeof LIFECYCLE_LABEL };

function CallList({ calls }: { calls: BoardCall[] }) {
  return (
    <div>
      {calls.map(c => (
        <Link
          key={c.selectionCycleId}
          href={`/dashboard/schedule/calls/${c.selectionCycleId}`}
          className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0 hover:bg-bg -mx-2 px-2 rounded-lg"
        >
          <div className="min-w-0">
            <p className="text-text text-sm truncate">{c.customerName}</p>
            <p className="text-text-muted text-xs truncate">{shortDay(c.date)} · {c.serviceName || 'Service'}</p>
          </div>
          <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${LIFECYCLE_CLASS[c.lifecycleState]}`}>{LIFECYCLE_LABEL[c.lifecycleState]}</span>
        </Link>
      ))}
    </div>
  );
}

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requireSession();
  const { tab: tabParam } = await searchParams;
  const tab: Tab = tabParam === 'members' || tabParam === 'groups' ? tabParam : 'overview';

  const today = todayKey();
  const weekEnd = addDays(today, 6);

  const [membersRes, groupsRes, clocksRes, forecastRes, assignmentsRes] = await Promise.all([
    businessGet<{ teamMembers: TeamMember[] }>(session, '/team-members'),
    businessGet<{ groups: TeamGroup[] }>(session, '/groups'),
    tab === 'overview' ? businessGet<{ activeClocks: ActiveClock[] }>(session, '/active-clocks') : null,
    tab === 'overview' ? businessGet<{ summary: Forecast }>(session, `/selections?from=${today}&to=${weekEnd}`) : null,
    tab === 'overview' ? businessGet<{ assignments: RangeAssignment[] }>(session, `/assignments?from=${today}&to=${weekEnd}`) : null,
  ]);
  const members = membersRes?.teamMembers ?? [];
  const groups = groupsRes?.groups ?? [];

  const tabLink = (t: Tab, label: string) => (
    <Link
      href={t === 'overview' ? '/dashboard/team' : `/dashboard/team?tab=${t}`}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === t ? 'bg-brand text-white' : 'text-text hover:bg-bg'}`}
    >
      {label}
    </Link>
  );

  // This-week board: every Call in the next 7 days, bucketed by assignee.
  let board: { key: string; label: string; sub: string; calls: BoardCall[] }[] = [];
  let unassigned: BoardCall[] = [];
  if (tab === 'overview') {
    const calls: BoardCall[] = (forecastRes?.summary.upcomingServices ?? []).flatMap(d =>
      callsForDay(d).map(c => ({ selectionCycleId: c.selectionCycleId, customerName: c.name, serviceName: c.serviceName, date: dayKey(d.serviceDate), lifecycleState: c.lifecycleState })),
    );
    const byCall = new Map((assignmentsRes?.assignments ?? []).map(a => [a.selectionCycleId, a]));
    const buckets = new Map<string, BoardCall[]>();
    for (const c of calls) {
      const a = byCall.get(c.selectionCycleId);
      const key = a?.teamMemberId ? `m:${a.teamMemberId}` : a?.teamId ? `t:${a.teamId}` : null;
      if (!key) { if (c.lifecycleState !== 'completed') unassigned.push(c); continue; }
      buckets.set(key, [...(buckets.get(key) ?? []), c]);
    }
    board = [
      ...members.map(m => ({ key: `m:${m.id}`, label: m.name, sub: `${m.weeklyHours} hrs/week`, calls: buckets.get(`m:${m.id}`) ?? [] })),
      ...groups.map(g => ({ key: `t:${g.id}`, label: g.name, sub: `Group · ${g.memberCount} member${g.memberCount === 1 ? '' : 's'}`, calls: buckets.get(`t:${g.id}`) ?? [] })),
    ].sort((a, b) => b.calls.length - a.calls.length);
    unassigned = unassigned.sort((a, b) => a.date.localeCompare(b.date));
  }
  const clocks = clocksRes?.activeClocks ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-text mb-1">Team</h2>
          <p className="text-text-muted text-sm">{members.length} member{members.length === 1 ? '' : 's'} · {groups.length} group{groups.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex gap-1 bg-white border border-border rounded-lg p-1">
          {tabLink('overview', 'Overview')}{tabLink('members', 'Members')}{tabLink('groups', 'Groups')}
        </div>
      </div>

      {tab === 'members' && <MembersPanel businessId={session.businessId} members={members} />}
      {tab === 'groups' && <GroupsPanel businessId={session.businessId} groups={groups} members={members.map(m => ({ id: m.id, name: m.name }))} />}

      {tab === 'overview' && (
        <>
          <AutoRefresh ms={30000} />
          <div className="bg-white rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-text font-semibold text-base">On the clock</h3>
              <span className="text-text-muted text-xs">Updates every 30s</span>
            </div>
            {clocks.length === 0 ? (
              <p className="text-text-muted text-sm">No one is clocked in right now.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {clocks.map(c => (
                  <Link key={c.teamMemberId} href={`/dashboard/schedule/calls/${c.selectionCycleId}`} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-bg">
                    <span className="w-2.5 h-2.5 rounded-full bg-success shrink-0" />
                    <div className="min-w-0">
                      <p className="text-text text-sm font-medium">{c.teamMemberName}</p>
                      <p className="text-text-muted text-xs truncate">at {c.customerName} · {formatSince(c.arrivalAt)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-text font-semibold text-base mb-1">This week’s assignments</h3>
            <p className="text-text-muted text-sm mb-4">{shortDay(today)} – {shortDay(weekEnd)}. Open a call to assign or reassign it.</p>
            {members.length === 0 && groups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-border p-6">
                <p className="text-text text-sm font-medium">No team yet</p>
                <p className="text-text-muted text-xs mt-0.5">Add team members (Members tab) to assign calls, track time on site and cost labor per job.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {unassigned.length > 0 && (
                  <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-amber-800 font-semibold text-sm">Unassigned</p>
                      <span className="text-amber-800 text-xs font-semibold">{unassigned.length}</span>
                    </div>
                    <CallList calls={unassigned} />
                  </div>
                )}
                {board.map(b => (
                  <div key={b.key} className="bg-white rounded-2xl border border-border p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0">
                        <p className="text-text font-semibold text-sm truncate">{b.label}</p>
                        <p className="text-text-muted text-xs">{b.sub}</p>
                      </div>
                      <span className="text-text text-xs font-semibold shrink-0">{b.calls.length} call{b.calls.length === 1 ? '' : 's'}</span>
                    </div>
                    {b.calls.length === 0 ? <p className="text-text-muted text-xs">Nothing assigned this week.</p> : <CallList calls={b.calls} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
