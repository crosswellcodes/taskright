'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type Task = { id: number; name: string; timeAllotmentMinutes: number };
type PageState = 'loading' | 'invalid' | 'ready' | 'success';

export default function SelectionPage() {
  const { token } = useParams<{ token: string }>();

  const [state, setState] = useState<PageState>('loading');
  const [businessName, setBusinessName] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/auth/selection/${token}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) { setState('invalid'); return; }
        setBusinessName(data.businessName);
        setServiceDate(data.serviceDate);
        setAvailableTasks(data.availableTasks);
        setSelected(new Set(data.currentTaskIds));
        setState('ready');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  function toggleTask(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function totalMinutes() {
    return availableTasks
      .filter(t => selected.has(t.id))
      .reduce((sum, t) => sum + t.timeAllotmentMinutes, 0);
  }

  function formatTime(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/selection/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedTaskIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); return; }
      setState('success');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const cardClass = 'bg-white rounded-2xl border border-border p-6 shadow-sm';

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="bg-white border-b border-border px-6 py-4">
        <Link href="/" className="text-brand font-bold text-xl tracking-tight">TaskRight</Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-4">

          {state === 'loading' && (
            <div className="text-center text-text-muted text-sm py-16">Loading…</div>
          )}

          {state === 'invalid' && (
            <div className={`${cardClass} text-center`}>
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-text mb-2">Link expired</h1>
              <p className="text-text-muted text-sm">
                This task selection link has expired or already been used. Reply T to your provider&apos;s number to get a new one.
              </p>
            </div>
          )}

          {state === 'ready' && (
            <>
              {/* Header card */}
              <div className={cardClass}>
                <p className="text-text-muted text-xs font-semibold uppercase tracking-wide mb-1">{businessName}</p>
                <h1 className="text-xl font-bold text-text">Your tasks for {serviceDate}</h1>
                <p className="text-text-muted text-sm mt-1">Check the tasks you want done. Tap confirm when you&apos;re ready.</p>
              </div>

              {/* Task list */}
              <div className={cardClass}>
                <div className="space-y-1">
                  {availableTasks.map(task => (
                    <label
                      key={task.id}
                      className="flex items-center gap-3 py-3 px-1 cursor-pointer rounded-lg hover:bg-bg transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(task.id)}
                        onChange={() => toggleTask(task.id)}
                        className="w-5 h-5 rounded text-brand focus:ring-brand/30 flex-shrink-0"
                      />
                      <span className="flex-1 text-text text-sm font-medium">{task.name}</span>
                      <span className="text-text-muted text-xs flex-shrink-0">{formatTime(task.timeAllotmentMinutes)}</span>
                    </label>
                  ))}
                </div>

                {availableTasks.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <span className="text-text-muted text-sm">{selected.size === 0 ? 'No specific tasks' : `${selected.size} task${selected.size !== 1 ? 's' : ''} selected`}</span>
                    <span className="text-text text-sm font-semibold">{formatTime(totalMinutes())}</span>
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="space-y-3">
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3.5 rounded-lg transition-colors text-base disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Confirming…' : 'Confirm my tasks'}
                </button>
              </div>
            </>
          )}

          {state === 'success' && (
            <div className={`${cardClass} text-center`}>
              <div className="w-14 h-14 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-text mb-2">You&apos;re confirmed!</h1>
              <p className="text-text-muted text-sm">
                Your selections for <span className="font-semibold text-text">{serviceDate}</span> have been sent to {businessName}.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
