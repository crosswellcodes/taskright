'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { del, type ApiError } from '@/lib/apiClient';

// Two-step destructive action (click → confirm) for a customer or a service.
// Navigates to `redirectTo` on success; surfaces 409 HAS_HISTORY etc. inline.
export default function DeleteButton({ path, label, warning, redirectTo }: {
  path: string;
  label: string;
  warning: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await del(path);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50">
        {label}
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-red-700 text-sm">{warning}</p>
      {error && <p className="text-red-700 text-sm font-medium mt-2">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={confirm} disabled={busy} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
          {busy ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button type="button" onClick={() => { setConfirming(false); setError(null); }} className="px-4 py-2 rounded-lg border border-border bg-white text-sm text-text hover:bg-bg">
          Cancel
        </button>
      </div>
    </div>
  );
}
