'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { patch, type ApiError } from '@/lib/apiClient';
import { type GeocodeStatus, GEOCODE_NOTE } from '@/lib/customers';

type Props = {
  businessId: string;
  customerId: number;
  email: string | null;
  address: string | null;
  notes: string | null;
  reviewRequestsOptedOut: boolean;
  geocodeStatus: GeocodeStatus;
};

// Contact details (email / address / notes) + review-request opt-out, via
// PATCH .../customers/:id. An address change re-geocodes server-side.
export default function ContactCard({ businessId, customerId, email, address, notes, reviewRequestsOptedOut, geocodeStatus }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ email: email ?? '', address: address ?? '', notes: notes ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = `/${businessId}/customers/${customerId}`;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string | null> = {};
      if (form.email.trim() !== (email ?? '')) body.email = form.email.trim() || null;
      if (form.address.trim() !== (address ?? '')) body.address = form.address.trim() || null;
      if (form.notes.trim() !== (notes ?? '')) body.notes = form.notes.trim() || null;
      if (Object.keys(body).length > 0) await patch(path, body);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleOptOut() {
    setBusy(true);
    setError(null);
    try {
      await patch(path, { reviewRequestsOptedOut: !reviewRequestsOptedOut });
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-text bg-white focus:outline-none focus:ring-2 focus:ring-brand/30';
  const geoNote = GEOCODE_NOTE[geocodeStatus];

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-text font-semibold text-base">Contact</h3>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-brand text-sm font-medium hover:underline">Edit</button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-text-muted text-xs">Email</span>
            <input className={input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-text-muted text-xs">Address</span>
            <input className={input} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street, city, state" />
          </label>
          <label className="block">
            <span className="text-text-muted text-xs">Notes</span>
            <textarea className={input} rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setForm({ email: email ?? '', address: address ?? '', notes: notes ?? '' }); }}
              className="px-4 py-2 rounded-lg border border-border text-sm text-text hover:bg-bg"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-text-muted text-xs">Email</dt>
            <dd className="text-text">{email || <span className="text-text-muted">—</span>}</dd>
          </div>
          <div>
            <dt className="text-text-muted text-xs">Address</dt>
            <dd className="text-text">{address || <span className="text-text-muted">—</span>}</dd>
            {geoNote && (
              <p className={`text-xs mt-1 ${geocodeStatus === 'failed' ? 'text-red-600' : 'text-text-muted'}`}>{geoNote}</p>
            )}
          </div>
          <div>
            <dt className="text-text-muted text-xs">Notes</dt>
            <dd className="text-text whitespace-pre-wrap">{notes || <span className="text-text-muted">—</span>}</dd>
          </div>
        </dl>
      )}

      <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-border">
        <div>
          <p className="text-text text-sm font-medium">Review requests</p>
          <p className="text-text-muted text-xs">{reviewRequestsOptedOut ? 'Opted out — no review texts after visits.' : 'Gets a review text after each completed visit.'}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!reviewRequestsOptedOut}
          aria-label="Send review requests"
          onClick={toggleOptOut}
          disabled={busy}
          className={`relative w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-50 ${reviewRequestsOptedOut ? 'bg-border' : 'bg-brand'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${reviewRequestsOptedOut ? 'left-0.5' : 'left-[22px]'}`} />
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
    </div>
  );
}
