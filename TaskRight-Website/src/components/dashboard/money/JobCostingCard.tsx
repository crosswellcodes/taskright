'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { patch, post, del, type ApiError } from '@/lib/apiClient';
import { formatMoney } from '@/lib/customers';
import { formatPercent } from '@/lib/money';

export type JobCosts = {
  status: string;
  price: number | null;
  estimatedHours: number;
  laborLines: { costId: number; teamMemberId: number | null; memberName: string | null; hoursActual: number | null; hourlyRate: number | null; amount: number; source: 'auto' | 'manual' }[];
  materialsAmount: number;
  materialsCostId: number | null;
  overheadAmount: number;
  overheadCostId: number | null;
  totalCost: number;
  marginDollars: number | null;
  marginPercent: number | null;
  proposedLaborHours: number | null;
  proposedLabor: number | null;
  proposedLaborBreakdown: { teamMemberId: number; name: string; hourlyRate: number | null }[];
  expectedLaborIncomplete: boolean;
  expectedTotalCost: number;
  expectedMarginDollars: number | null;
  expectedMarginPercent: number | null;
};

type Props = {
  businessId: string;
  callId: number;
  costs: JobCosts;
  categoryIds: { materials: number | null; overhead: number | null };
};

// One editable money field (price / materials / overhead): click → input → Save.
// Blank clears (price → null; materials/overhead line deleted).
function MoneyField({ label, value, onSave, hint }: { label: string; value: number | null; onSave: (v: number | null) => Promise<void>; hint?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = draft.trim();
    const v = trimmed === '' ? null : Number(trimmed);
    if (v != null && (Number.isNaN(v) || v < 0)) return setError('Enter an amount of 0 or more, or leave blank.');
    setBusy(true);
    setError(null);
    try {
      await onSave(v);
      setEditing(false);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-2.5 border-b border-border">
      <div className="flex items-center justify-between gap-3">
        <span className="text-text text-sm">{label}</span>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-sm">$</span>
            <input
              type="number" min="0" step="0.01" autoFocus value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              aria-label={label}
              className="w-28 rounded-lg border border-border px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <button type="button" onClick={save} disabled={busy} className="px-2.5 py-1 rounded-lg bg-brand text-white text-xs font-semibold disabled:opacity-50">{busy ? '…' : 'Save'}</button>
            <button type="button" onClick={() => { setEditing(false); setDraft(value != null ? String(value) : ''); setError(null); }} className="text-text-muted text-xs">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => { setDraft(value != null ? String(value) : ''); setEditing(true); }} className="text-sm tabular-nums text-text hover:text-brand underline decoration-dotted underline-offset-4">
            {value == null ? <span className="text-amber-700">Not set</span> : formatMoney(value)}
          </button>
        )}
      </div>
      {hint && !editing && <p className="text-text-muted text-xs mt-0.5">{hint}</p>}
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}

// Per-call job costing (mirrors the app's ServiceCallDetailScreen section):
// price + materials + overhead editable; labor lines read-only with Auto/Edited
// source badges; proposed/expected costing before completion, actuals + the
// expected-vs-actual comparison after.
export default function JobCostingCard({ businessId, callId, costs, categoryIds }: Props) {
  const router = useRouter();
  const base = `/${businessId}/jobs/${callId}`;
  const completed = costs.status === 'completed';

  async function savePrice(v: number | null) {
    await patch(`${base}/price`, { price: v });
    router.refresh();
  }

  // POST-if-null / PATCH-if-present / DELETE-on-blank, so edits replace.
  function saveLine(costId: number | null, categoryId: number | null) {
    return async (v: number | null) => {
      if (v == null || v === 0) {
        if (costId != null) await del(`${base}/costs/${costId}`);
      } else if (costId != null) {
        await patch(`${base}/costs/${costId}`, { amount: v });
      } else if (categoryId != null) {
        await post(`${base}/costs`, { costCategoryId: categoryId, amount: v });
      }
      router.refresh();
    };
  }

  const marginRow = (label: string, dollars: number | null, percent: number | null, emphasis = true) => (
    <div className="flex items-center justify-between py-2.5">
      <span className={`text-sm ${emphasis ? 'text-text font-semibold' : 'text-text-muted'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${emphasis ? 'font-semibold' : ''} ${dollars != null && dollars < 0 ? 'text-red-600' : emphasis ? 'text-text' : 'text-text-muted'}`}>
        {dollars == null ? 'Price not set' : <>{formatMoney(dollars)} <span className="text-text-muted text-xs font-normal">{formatPercent(percent)}</span></>}
      </span>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-text font-semibold text-base">Job costing</h3>
        <span className="text-text-muted text-xs">{completed ? 'Actuals' : 'Expected'}</span>
      </div>

      <MoneyField label="Price" value={costs.price} onSave={savePrice} hint={completed ? undefined : 'Copied from the service’s price per visit — override for this visit only.'} />

      {completed ? (
        <div className="py-2.5 border-b border-border">
          <p className="text-text text-sm mb-2">Labor</p>
          {costs.laborLines.length === 0 ? (
            <p className="text-text-muted text-xs">No labor recorded — nobody clocked in on this job.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted text-left">
                  <th className="font-medium pb-1">Member</th>
                  <th className="font-medium pb-1 text-right">Est</th>
                  <th className="font-medium pb-1 text-right">Actual</th>
                  <th className="font-medium pb-1 text-right">Rate</th>
                  <th className="font-medium pb-1 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {costs.laborLines.map(l => (
                  <tr key={l.costId}>
                    <td className="py-1 text-text">
                      {l.memberName || 'Former member'}
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${l.source === 'manual' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                        {l.source === 'manual' ? 'Edited' : 'Auto-tracked'}
                      </span>
                    </td>
                    <td className="py-1 text-right tabular-nums text-text-muted">{costs.estimatedHours}h</td>
                    <td className="py-1 text-right tabular-nums text-text">{l.hoursActual ?? '—'}h</td>
                    <td className="py-1 text-right tabular-nums text-text-muted">{l.hourlyRate != null ? formatMoney(l.hourlyRate) : '—'}</td>
                    <td className="py-1 text-right tabular-nums text-text">{formatMoney(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {costs.laborLines.some(l => l.hourlyRate == null) && (
            <p className="text-amber-700 text-xs mt-1">A member without an hourly rate is costed at $0 — set rates in Team.</p>
          )}
        </div>
      ) : (
        <div className="py-2.5 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-text text-sm">Proposed labor</span>
            <span className="text-sm tabular-nums text-text">{costs.proposedLabor == null ? '—' : formatMoney(costs.proposedLabor)}</span>
          </div>
          <p className="text-text-muted text-xs mt-0.5">
            {costs.proposedLaborBreakdown.length === 0
              ? 'Assign someone to estimate labor.'
              : `${costs.proposedLaborHours ?? '?'} hrs × ${costs.proposedLaborBreakdown.map(m => `${m.name} ${m.hourlyRate != null ? formatMoney(m.hourlyRate) : '(no rate)'}`).join(' + ')}`}
          </p>
          {costs.expectedLaborIncomplete && costs.proposedLaborBreakdown.length > 0 && (
            <p className="text-amber-700 text-xs mt-0.5">Estimate is a floor — a rate or the hours are missing.</p>
          )}
        </div>
      )}

      <MoneyField label="Materials / supplies" value={costs.materialsAmount || null} onSave={saveLine(costs.materialsCostId, categoryIds.materials)} />
      <MoneyField label="Job overhead" value={costs.overheadAmount || null} onSave={saveLine(costs.overheadCostId, categoryIds.overhead)} />

      {completed ? (
        <>
          <div className="flex items-center justify-between py-2.5 border-b border-border">
            <span className="text-text text-sm font-medium">Total cost</span>
            <span className="text-sm tabular-nums text-text font-medium">{formatMoney(costs.totalCost)}</span>
          </div>
          {marginRow('Margin', costs.marginDollars, costs.marginPercent)}
          {costs.expectedMarginDollars != null && costs.marginDollars != null && (
            <p className={`text-xs ${costs.marginDollars >= costs.expectedMarginDollars ? 'text-green-700' : 'text-amber-700'}`}>
              Expected {formatMoney(costs.expectedMarginDollars)} ({formatPercent(costs.expectedMarginPercent)}) —
              {' '}{costs.marginDollars >= costs.expectedMarginDollars ? 'came in ahead by' : 'came in short by'}{' '}
              {formatMoney(Math.abs(costs.marginDollars - costs.expectedMarginDollars))}.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between py-2.5 border-b border-border">
            <span className="text-text text-sm font-medium">Expected total cost</span>
            <span className="text-sm tabular-nums text-text font-medium">{formatMoney(costs.expectedTotalCost)}</span>
          </div>
          {marginRow('Expected margin', costs.expectedMarginDollars, costs.expectedMarginPercent)}
        </>
      )}
    </div>
  );
}
