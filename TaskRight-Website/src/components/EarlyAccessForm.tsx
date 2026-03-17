'use client';

import { useState } from 'react';

export default function EarlyAccessForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setSubmitted(true);
  }

  return (
    <section id="early-access" className="bg-brand py-20 px-6">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          Be the first to know
        </h2>
        <p className="text-white/75 text-lg leading-relaxed mb-10">
          We&apos;re rolling out to service businesses in select cities. Join
          the waitlist for early access.
        </p>

        {submitted ? (
          <div className="bg-white/10 rounded-xl px-8 py-6 inline-block">
            <div className="text-success text-3xl mb-3">✓</div>
            <p className="text-white font-semibold text-lg">
              You&apos;re on the list!
            </p>
            <p className="text-white/70 mt-1">We&apos;ll be in touch soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="Your work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 px-4 py-3.5 rounded-lg bg-white text-text placeholder-text-muted text-base outline-none focus:ring-2 focus:ring-white/40"
            />
            <button
              type="submit"
              className="bg-white text-brand font-semibold px-6 py-3.5 rounded-lg hover:bg-white/90 transition-colors whitespace-nowrap"
            >
              Join Waitlist
            </button>
          </form>
        )}

        {error && (
          <p className="text-white/80 text-sm mt-3">{error}</p>
        )}
      </div>
    </section>
  );
}
