'use client';

import { useState } from 'react';
import { formatMoney, formatPhone } from '@/lib/customers';
import { type TeamMember, inviteMessage } from '@/lib/team';
import DeleteButton from '@/components/dashboard/DeleteButton';
import MemberForm from './MemberForm';

// Members tab: roster with rate, hours, groups and invite status; add / edit /
// delete. Pending members keep showing their invite code until they accept.
export default function MembersPanel({ businessId, members }: { businessId: string; members: TeamMember[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  async function copyInvite(m: TeamMember) {
    try {
      await navigator.clipboard.writeText(inviteMessage(m.name, m.inviteCode!));
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text font-semibold text-base">Add a team member</h3>
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark">+ Add</button>
          )}
        </div>
        {adding
          ? <MemberForm businessId={businessId} onDone={() => setAdding(false)} />
          : <p className="text-text-muted text-sm">They’ll get an invite code to join from the TaskRight app — then they see their jobs and clock in automatically.</p>}
      </div>

      <div className="bg-white rounded-2xl border border-border p-6">
        <h3 className="text-text font-semibold text-base mb-4">Team ({members.length})</h3>
        {members.length === 0 ? (
          <p className="text-text-muted text-sm">No team members yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {members.map(m => (
              <div key={m.id} className="py-4">
                {editingId === m.id ? (
                  <div className="space-y-4">
                    <MemberForm businessId={businessId} member={m} onDone={() => setEditingId(null)} />
                    <DeleteButton
                      path={`/${businessId}/team-members/${m.id}`}
                      label="Remove from team"
                      warning={`Removes ${m.name} from your team. Their assigned calls become unassigned and their clock-in history is deleted; labor costs already recorded stay on the jobs.`}
                      redirectTo="/dashboard/team?tab=members"
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-text text-sm font-medium">{m.name}</p>
                      <p className="text-text-muted text-xs">
                        {formatPhone(m.phoneNumber)} · {m.weeklyHours} hrs/week · {m.hourlyRate != null ? `${formatMoney(m.hourlyRate)}/hr` : <span className="text-amber-700">no rate set</span>}
                      </p>
                      {m.groups.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {m.groups.map(g => <span key={g.id} className="text-[11px] px-2 py-0.5 rounded-full bg-brand/10 text-brand">{g.name}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.inviteAccepted ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Joined</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => m.inviteCode && copyInvite(m)}
                          title="Copy invite message"
                          className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100"
                        >
                          {copiedId === m.id ? 'Copied!' : `Invite pending${m.inviteCode ? ` · ${m.inviteCode}` : ''}`}
                        </button>
                      )}
                      <button type="button" onClick={() => setEditingId(m.id)} className="text-brand text-sm font-medium hover:underline">Edit</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {members.some(m => m.hourlyRate == null) && (
          <p className="text-amber-700 text-xs mt-3">Members without an hourly rate count as $0 labor in job costing and margins.</p>
        )}
      </div>
    </div>
  );
}
