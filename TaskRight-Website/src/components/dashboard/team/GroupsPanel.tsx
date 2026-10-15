'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { post, put, type ApiError } from '@/lib/apiClient';
import type { TeamGroup } from '@/lib/team';
import DeleteButton from '@/components/dashboard/DeleteButton';

type Member = { id: number; name: string };

function GroupEditor({ businessId, group, members, onDone }: { businessId: string; group: TeamGroup; members: Member[]; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(group.name);
  const [selected, setSelected] = useState<Set<number>>(new Set(group.members.map(m => m.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  async function save() {
    if (!name.trim()) return setError('Enter a group name.');
    setBusy(true);
    setError(null);
    try {
      if (name.trim() !== group.name) await put(`/${businessId}/groups/${group.id}`, { name: name.trim() });
      await put(`/${businessId}/groups/${group.id}/members`, { memberIds: [...selected] });
      router.refresh();
      onDone();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        aria-label="Group name"
        className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      {members.length === 0 ? (
        <p className="text-text-muted text-sm">Add team members first, then put them in groups.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {members.map(m => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-text rounded-lg px-2 py-1.5 hover:bg-bg cursor-pointer">
              <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} className="accent-[var(--color-brand)]" />
              {m.name}
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">
          {busy ? 'Saving…' : 'Save group'}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2 rounded-lg border border-border text-sm text-text hover:bg-bg">Cancel</button>
      </div>
      <DeleteButton
        path={`/${businessId}/groups/${group.id}`}
        label="Delete group"
        warning={`Deletes ${group.name}. Calls assigned to this group become unassigned; the members themselves stay on your team.`}
        redirectTo="/dashboard/team?tab=groups"
      />
    </div>
  );
}

// Groups tab: crews that can be assigned to a call as a unit (every member sees
// the job and can clock in; labor is costed per member).
export default function GroupsPanel({ businessId, groups, members }: { businessId: string; groups: TeamGroup[]; members: Member[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await post(`/${businessId}/groups`, { name: newName.trim() });
      setNewName('');
      setEditingId(res.group.id);
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="bg-white rounded-2xl border border-border p-6">
        <h3 className="text-text font-semibold text-base mb-1">New group</h3>
        <p className="text-text-muted text-xs mb-3">Assign a whole crew to a call at once — everyone in it sees the job and can clock in.</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Crew A"
            aria-label="New group name"
            className="flex-1 min-w-0 rounded-lg border border-border px-3 py-2 text-sm text-text bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button type="submit" disabled={busy || !newName.trim()} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </form>

      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-6">
          <p className="text-text-muted text-sm">No groups yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {groups.map(g => (
            <div key={g.id} className="bg-white rounded-2xl border border-border p-6">
              {editingId === g.id ? (
                <GroupEditor businessId={businessId} group={g} members={members} onDone={() => setEditingId(null)} />
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-text font-semibold text-base">{g.name}</h3>
                    <button type="button" onClick={() => setEditingId(g.id)} className="text-brand text-sm font-medium hover:underline">Edit</button>
                  </div>
                  {g.members.length === 0 ? (
                    <p className="text-text-muted text-sm">No members yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {g.members.map(m => <span key={m.id} className="text-xs px-2.5 py-1 rounded-full bg-bg text-text">{m.name}</span>)}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
