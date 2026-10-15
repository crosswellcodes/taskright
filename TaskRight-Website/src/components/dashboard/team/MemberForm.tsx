'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { post, put, type ApiError } from '@/lib/apiClient';
import { formatPhone, normalizePhone } from '@/lib/customers';
import { type TeamMember, inviteMessage } from '@/lib/team';

type Props = {
  businessId: string;
  member?: TeamMember;          // present → edit mode
  onDone: () => void;
};

// Add / edit a team member. On add, shows the invite code + the share text the
// app uses, so the owner can pass it on (the member accepts it in the app).
export default function MemberForm({ businessId, member, onDone }: Props) {
  const router = useRouter();
  const isEdit = !!member;
  const [name, setName] = useState(member?.name ?? '');
  const [phone, setPhone] = useState(member ? formatPhone(member.phoneNumber) : '');
  const [hours, setHours] = useState(member ? String(member.weeklyHours) : '40');
  const [rate, setRate] = useState(member?.hourlyRate != null ? String(member.hourlyRate) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ name: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter a name.');
    const phoneNumber = normalizePhone(phone);
    if (!/^\+[1-9]\d{9,14}$/.test(phoneNumber)) return setError('Enter a valid phone number.');
    const weeklyHours = parseInt(hours, 10);
    if (!weeklyHours || weeklyHours < 1 || weeklyHours > 168) return setError('Weekly hours must be between 1 and 168.');
    let hourlyRate: number | null = null;
    if (rate.trim() !== '') {
      hourlyRate = Number(rate);
      if (Number.isNaN(hourlyRate) || hourlyRate < 0) return setError('Enter a valid hourly rate, or leave it blank.');
    }

    setBusy(true);
    try {
      const body = { name: name.trim(), phoneNumber, weeklyHours, hourlyRate };
      if (isEdit) {
        await put(`/${businessId}/team-members/${member!.id}`, body);
        router.refresh();
        onDone();
      } else {
        const res = await post(`/${businessId}/team-members`, body);
        setInvite({ name: res.teamMember.name, code: res.teamMember.inviteCode });
        router.refresh();
      }
    } catch (err) {
      const e2 = err as ApiError;
      setError(e2.code === 'DUPLICATE_TEAM_MEMBER' ? 'Someone on your team already has this phone number.' : e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the text is visible to copy by hand */ }
  }

  if (invite) {
    const text = inviteMessage(invite.name, invite.code);
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <p className="text-green-800 text-sm font-semibold">{invite.name} was added.</p>
        <p className="text-green-800 text-sm mt-1">Invite code: <span className="font-mono font-bold tracking-wider">{invite.code}</span></p>
        <p className="text-text-muted text-xs mt-2 bg-white rounded-lg p-2 border border-border">{text}</p>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => copy(text)} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark">
            {copied ? 'Copied!' : 'Copy invite message'}
          </button>
          <button type="button" onClick={onDone} className="px-4 py-2 rounded-lg border border-border bg-white text-sm text-text hover:bg-bg">Done</button>
        </div>
      </div>
    );
  }

  const input = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-text bg-white focus:outline-none focus:ring-2 focus:ring-brand/30';
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block"><span className="text-text-muted text-xs">Name</span>
          <input className={input} value={name} onChange={e => setName(e.target.value)} autoFocus={!isEdit} />
        </label>
        <label className="block"><span className="text-text-muted text-xs">Phone</span>
          <input className={input} value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" placeholder="(402) 555-0123" />
        </label>
        <label className="block"><span className="text-text-muted text-xs">Weekly hours</span>
          <input className={input} type="number" min="1" max="168" value={hours} onChange={e => setHours(e.target.value)} />
        </label>
        <label className="block"><span className="text-text-muted text-xs">Hourly rate (for job costing)</span>
          <input className={input} type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="Optional" />
        </label>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">
          {busy ? 'Saving…' : isEdit ? 'Save' : 'Add team member'}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2 rounded-lg border border-border text-sm text-text hover:bg-bg">Cancel</button>
      </div>
    </form>
  );
}
