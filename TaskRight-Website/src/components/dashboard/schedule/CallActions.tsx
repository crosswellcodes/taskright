'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { put, patch, del, type ApiError } from '@/lib/apiClient';

type Assignee = { kind: 'member' | 'team'; id: number; name: string } | null;

type Props = {
  businessId: string;
  callId: number;
  serviceDate: string;
  isCompleted: boolean;
  assignee: Assignee;
  members: { id: number; name: string }[];
  groups: { id: number; name: string }[];
};

const assigneeValue = (a: Assignee) => (a ? `${a.kind === 'member' ? 'm' : 't'}:${a.id}` : '');

// Assign + reschedule for one service call. Writes go through the BFF proxy
// (apiClient), then router.refresh() re-runs the Server Component page.
export default function CallActions({ businessId, callId, serviceDate, isCompleted, assignee, members, groups }: Props) {
  const router = useRouter();
  const base = `/${businessId}`;

  const [pick, setPick] = useState(assigneeValue(assignee));
  const [newDate, setNewDate] = useState(serviceDate);
  const [busy, setBusy] = useState<'assign' | 'unassign' | 'reschedule' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<unknown>, ok: string) {
    setBusy(kind);
    setMessage(null);
    try {
      await fn();
      setMessage({ tone: 'ok', text: ok });
      router.refresh();
      return true;
    } catch (err) {
      setMessage({ tone: 'error', text: (err as ApiError).message || 'Something went wrong' });
      return false;
    } finally {
      setBusy(null);
    }
  }

  function saveAssignment() {
    const [kind, id] = pick.split(':');
    const body = kind === 'm' ? { teamMemberId: Number(id) } : { teamId: Number(id) };
    run('assign', () => put(`${base}/assignments/${callId}`, body), 'Assignment saved.');
  }

  function unassign() {
    run('unassign', () => del(`${base}/assignments/${callId}`), 'Assignment removed.').then(ok => { if (ok) setPick(''); });
  }

  function reschedule() {
    run('reschedule', () => patch(`${base}/selection-cycles/${callId}/reschedule`, { newServiceDate: newDate }), 'Rescheduled — the customer has been notified.');
  }

  const noTeam = members.length === 0 && groups.length === 0;
  const inputClass = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-text bg-white focus:outline-none focus:ring-2 focus:ring-brand/30';
  const primary = 'px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:opacity-50';
  const secondary = 'px-4 py-2 rounded-lg border border-border text-sm text-text hover:bg-bg disabled:opacity-50';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-border p-6">
        <h3 className="text-text font-semibold text-base mb-1">Assignment</h3>
        <p className="text-text-muted text-xs mb-4">
          {assignee ? `Assigned to ${assignee.name}${assignee.kind === 'team' ? ' (group)' : ''}.` : 'No one is assigned yet.'}
        </p>
        {noTeam ? (
          <p className="text-text-muted text-sm">Add team members or groups in Team to assign this call.</p>
        ) : (
          <>
            <select value={pick} onChange={e => setPick(e.target.value)} disabled={isCompleted} className={inputClass} aria-label="Assignee">
              <option value="">Choose a person or group…</option>
              {members.length > 0 && (
                <optgroup label="Team members">
                  {members.map(m => <option key={`m${m.id}`} value={`m:${m.id}`}>{m.name}</option>)}
                </optgroup>
              )}
              {groups.length > 0 && (
                <optgroup label="Groups">
                  {groups.map(g => <option key={`t${g.id}`} value={`t:${g.id}`}>{g.name}</option>)}
                </optgroup>
              )}
            </select>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={saveAssignment}
                disabled={isCompleted || !pick || pick === assigneeValue(assignee) || busy !== null}
                className={primary}
              >
                {busy === 'assign' ? 'Saving…' : 'Save'}
              </button>
              {assignee && (
                <button type="button" onClick={unassign} disabled={isCompleted || busy !== null} className={secondary}>
                  {busy === 'unassign' ? 'Removing…' : 'Unassign'}
                </button>
              )}
            </div>
          </>
        )}
        {isCompleted && <p className="text-text-muted text-xs mt-3">Completed calls can’t be reassigned.</p>}
      </div>

      <div className="bg-white rounded-2xl border border-border p-6">
        <h3 className="text-text font-semibold text-base mb-1">Reschedule</h3>
        {isCompleted ? (
          <p className="text-text-muted text-sm">Completed calls can’t be rescheduled.</p>
        ) : (
          <>
            <p className="text-text-muted text-xs mb-4">Moves only this call. The customer gets a text with the new date.</p>
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={inputClass} aria-label="New service date" />
            <button
              type="button"
              onClick={reschedule}
              disabled={!newDate || newDate === serviceDate || busy !== null}
              className={`${primary} mt-3`}
            >
              {busy === 'reschedule' ? 'Saving…' : 'Reschedule'}
            </button>
          </>
        )}
      </div>

      {message && (
        <p className={`text-sm rounded-lg px-3 py-2 ${message.tone === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
