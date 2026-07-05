'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Load states. Expired and invalid tokens are indistinguishable on GET by design
// (the backend returns { valid: false } for both, so the page can't probe token
// validity) — they collapse into 'invalid' here. An expired-specific message can
// still surface on submit, when the backend returns 410.
type PageState = 'loading' | 'invalid' | 'submitted' | 'ready' | 'expired' | 'success';

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>();

  const [state, setState] = useState<PageState>('loading');
  const [customerName, setCustomerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/review/${token}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success || !data.valid) { setState('invalid'); return; }
        setCustomerName(data.customerName || '');
        setBusinessName(data.businessName || 'your provider');
        setServiceDate(data.serviceDate || '');
        setState(data.alreadySubmitted ? 'submitted' : 'ready');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  async function handleSubmit() {
    if (rating < 1) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/review/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 410) { setState('expired'); return; }
      if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); return; }
      setState('success');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const cardClass = 'bg-white rounded-2xl border border-border p-6 shadow-sm';
  const active = hover || rating; // stars fill to the hovered star, else the picked one

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
              <h1 className="text-xl font-bold text-text mb-2">This link isn&apos;t valid</h1>
              <p className="text-text-muted text-sm">
                This review link is no longer valid or has expired. If you&apos;d still like to share feedback, reply to your provider&apos;s text message.
              </p>
            </div>
          )}

          {state === 'expired' && (
            <div className={`${cardClass} text-center`}>
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-text mb-2">This review link has expired</h1>
              <p className="text-text-muted text-sm">
                Review links are active for 7 days. If you&apos;d still like to share feedback, reply to your provider&apos;s text message.
              </p>
            </div>
          )}

          {state === 'submitted' && (
            <div className={`${cardClass} text-center`}>
              <div className="w-14 h-14 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-text mb-2">Thank you!</h1>
              <p className="text-text-muted text-sm">
                You&apos;ve already shared feedback for this service. We appreciate it.
              </p>
            </div>
          )}

          {state === 'ready' && (
            <>
              <div className={cardClass}>
                <p className="text-text-muted text-xs font-semibold uppercase tracking-wide mb-1">{businessName}</p>
                <h1 className="text-xl font-bold text-text">
                  {customerName ? `Hi ${customerName}, how was your service?` : 'How was your service?'}
                </h1>
                {serviceDate && (
                  <p className="text-text-muted text-sm mt-1">Service on {serviceDate}</p>
                )}
              </div>

              <div className={cardClass}>
                {/* Star selector */}
                <div className="flex items-center justify-center gap-2" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} star${n !== 1 ? 's' : ''}`}
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHover(n)}
                      className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brand/30 rounded"
                    >
                      <svg
                        className={`w-10 h-10 transition-colors ${n <= active ? 'text-amber-400' : 'text-border'}`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2l2.9 6.26L21.5 9.27l-4.75 4.64 1.12 6.55L12 17.5l-5.87 3.06 1.12-6.55L2.5 9.27l6.6-1.01L12 2z" />
                      </svg>
                    </button>
                  ))}
                </div>
                <p className="text-center text-text-muted text-xs mt-2 h-4">
                  {active === 0 ? 'Tap a star to rate' : ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][active]}
                </p>

                {/* Optional comment */}
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Add a note (optional)"
                  rows={3}
                  maxLength={1000}
                  className="mt-4 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none"
                />
              </div>

              <div className="space-y-3">
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button
                  onClick={handleSubmit}
                  disabled={loading || rating < 1}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3.5 rounded-lg transition-colors text-base disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending…' : 'Share feedback'}
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
              <h1 className="text-xl font-bold text-text mb-2">Thank you!</h1>
              <p className="text-text-muted text-sm">
                Your feedback has been shared with {businessName}.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
