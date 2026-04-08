'use client';

import { useState } from 'react';
import { track } from '@vercel/analytics';

const businessTypes = [
  { value: 'cleaning', label: 'House / Office Cleaning' },
  { value: 'lawn-care', label: 'Lawn Care / Landscaping' },
  { value: 'handyman', label: 'Handyman Services' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'other', label: 'Other' },
];

const midwestStates = [
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MO', label: 'Missouri' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'OH', label: 'Ohio' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'other', label: 'Other State' },
];

const customerCounts = [
  { value: 'under-10', label: 'Under 10' },
  { value: '10-30', label: '10–30' },
  { value: '31-75', label: '31–75' },
  { value: '75-plus', label: '75+' },
];

const inputClass =
  'w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 text-base outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40';
const labelClass = 'block text-white/90 text-sm font-semibold mb-1.5';
const selectClass =
  'w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white text-base outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40 appearance-none';

export default function EarlyAccessForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [state, setState] = useState('');
  const [customerCount, setCustomerCount] = useState('');
  const [wantsUpdates, setWantsUpdates] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (!businessType) { setError('Please select your type of service business.'); return; }
    if (!state) { setError('Please select your state.'); return; }
    if (!customerCount) { setError('Please select how many customers you serve.'); return; }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, businessType, state, customerCount, wantsUpdates }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
    } catch {
      setError('Something went wrong. Please try again.');
      return;
    } finally {
      setLoading(false);
    }

    setSubmitted(true);

    // Vercel Analytics conversion event
    track('beta_application', {
      business_type: businessType,
      state,
      customer_count: customerCount,
      wants_updates: wantsUpdates,
    });
  }

  return (
    <section id="early-access" className="bg-brand py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-4">
            Get Free Access to TaskRight Before We Launch
          </h2>
          <p className="text-white/75 text-lg leading-relaxed">
            TaskRight is built for small cleaning, lawn care, and home service businesses
            that need smarter customer communication without the enterprise price tag.
            Sign up and your free tier access is yours to keep — no credit card, no commitment,
            no expiration. Beta spots are limited. We review every application personally.
          </p>
        </div>

        {submitted ? (
          <div className="bg-white/10 rounded-2xl px-8 py-10 text-center">
            <div className="text-4xl mb-4">✓</div>
            <h3 className="text-white font-bold text-xl mb-2">Application received.</h3>
            <p className="text-white/70 leading-relaxed">
              We review every submission personally and will be in touch within a few days.
              If you&apos;re a fit, you&apos;ll get first access — free, forever.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className={labelClass}>Business Owner Name *</label>
              <input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                aria-label="Your name"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>Email Address *</label>
              <input
                id="email"
                type="email"
                placeholder="you@yourbusiness.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Your email address"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="business-type" className={labelClass}>Type of Service Business *</label>
              <select
                id="business-type"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                required
                aria-label="Type of service business"
                className={selectClass}
              >
                <option value="" disabled>Select one…</option>
                {businessTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="state" className={labelClass}>State *</label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                aria-label="Your state"
                className={selectClass}
              >
                <option value="" disabled>Select one…</option>
                {midwestStates.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="customer-count" className={labelClass}>
                How many active customers do you currently serve? *
              </label>
              <select
                id="customer-count"
                value={customerCount}
                onChange={(e) => setCustomerCount(e.target.value)}
                required
                aria-label="Number of active customers"
                className={selectClass}
              >
                <option value="" disabled>Select one…</option>
                {customerCounts.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <input
                id="wants-updates"
                type="checkbox"
                checked={wantsUpdates}
                onChange={(e) => setWantsUpdates(e.target.checked)}
                aria-label="I want to receive updates about TaskRight"
                className="mt-0.5 w-4 h-4 rounded border-white/30 bg-white/10 text-brand focus:ring-white/40"
              />
              <label htmlFor="wants-updates" className="text-white/80 text-sm leading-snug cursor-pointer">
                I want to receive updates about TaskRight (we&apos;ll email you ~2x/month)
              </label>
            </div>

            {error && (
              <p className="text-white/80 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-label="Apply for free beta access"
              className="w-full bg-white text-brand font-semibold px-6 py-4 rounded-lg hover:bg-white/90 transition-colors text-base disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting…' : 'Apply for Free Beta Access'}
            </button>

            <p className="text-white/60 text-sm text-center leading-relaxed">
              Beta access is limited and by approval. We&apos;re looking for active service business
              owners who will use TaskRight with real customers and share honest feedback as we build.
              <br />
              <span className="mt-2 inline-block">✓ No spam. Unsubscribe anytime. &nbsp;✓ Your data is safe and secure.</span>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
