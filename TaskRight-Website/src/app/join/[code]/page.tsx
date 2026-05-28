'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type Step = 'loading' | 'invalid' | 'info' | 'otp' | 'success';

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-border bg-white text-text text-base outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors placeholder-text-muted';
const labelClass = 'block text-text text-sm font-semibold mb-1.5';
const errorClass = 'text-red-500 text-sm mt-1';

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();

  const [step, setStep] = useState<Step>('loading');
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [businessName, setBusinessName] = useState('');

  // Step 1 fields
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2 fields
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const otpInputRef = useRef<HTMLInputElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve the join code on mount
  useEffect(() => {
    async function resolveCode() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/businesses/join/${code}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setStep('invalid');
          return;
        }
        setBusinessId(data.businessId);
        setBusinessName(data.businessName);
        setStep('info');
      } catch {
        setStep('invalid');
      }
    }
    if (code) resolveCode();
  }, [code]);

  // Focus OTP input when step changes to otp
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRef.current?.focus(), 100);
      startCountdown();
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [step]);

  function startCountdown() {
    setCountdown(30);
    setCanResend(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function formatPhoneDisplay(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhone(formatPhoneDisplay(e.target.value));
  }

  async function handleSendCode() {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (!customerName.trim()) { setError('Please enter your name.'); return; }
    if (digits.length !== 10) { setError('Enter a valid 10-digit US phone number.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'RATE_LIMITED') {
          setError('Too many attempts. Please wait a moment before requesting another code.');
        } else {
          setError(data.error || 'Failed to send code. Please try again.');
        }
        return;
      }
      setStep('otp');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!canResend) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to resend code.');
        return;
      }
      startCountdown();
      setOtp('');
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndCreate() {
    setError('');
    if (otp.length !== 6) { setError('Enter the 6-digit code we texted you.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/customers/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phone,
          businessId,
          name: customerName.trim(),
          otpCode: otp,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'INVALID_OTP') {
          setError('That code is incorrect or expired. Check your messages or request a new code.');
        } else if (data.code === 'DUPLICATE_CUSTOMER') {
          setError('This phone number is already registered with this business. Download the app and log in.');
        } else {
          setError(data.error || 'Something went wrong. Please try again.');
        }
        return;
      }
      setStep('success');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="bg-white border-b border-border px-6 py-4">
        <Link href="/" className="text-brand font-bold text-xl tracking-tight">
          TaskRight
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Loading */}
          {step === 'loading' && (
            <div className="text-center text-text-muted text-sm py-16">Loading…</div>
          )}

          {/* Invalid code */}
          {step === 'invalid' && (
            <div className="bg-white rounded-2xl border border-border p-8 shadow-sm text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-text mb-3">Invalid invite link</h1>
              <p className="text-text-muted text-sm mb-6">
                This link doesn&apos;t match any business in our system. Ask your service provider for a new invite link.
              </p>
              <Link href="/" className="text-brand text-sm font-semibold hover:underline">
                Back to homepage
              </Link>
            </div>
          )}

          {/* Step 1 — Customer Info */}
          {step === 'info' && (
            <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
              <div className="mb-8">
                <div className="inline-block bg-brand/10 text-brand text-xs font-semibold px-3 py-1 rounded-full mb-4">
                  Customer Signup
                </div>
                <h1 className="text-2xl font-bold text-text mb-2">
                  You&apos;re joining {businessName}
                </h1>
                <p className="text-text-muted text-sm">
                  Create your account to manage your service schedule and select tasks.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelClass} htmlFor="customer-name">Your name</label>
                  <input
                    id="customer-name"
                    type="text"
                    className={inputClass}
                    placeholder="Sarah Johnson"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="phone">Your phone number</label>
                  <input
                    id="phone"
                    type="tel"
                    className={inputClass}
                    placeholder="(555) 000-0000"
                    value={phone}
                    onChange={handlePhoneChange}
                    autoComplete="tel"
                    inputMode="numeric"
                  />
                  <p className="text-text-muted text-xs mt-1.5">
                    We&apos;ll text a verification code to this number.
                  </p>
                </div>

                {error && <p className={errorClass}>{error}</p>}

                <button
                  onClick={handleSendCode}
                  disabled={loading}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3.5 rounded-lg transition-colors text-base disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending code…' : 'Send verification code'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — OTP */}
          {step === 'otp' && (
            <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
              <button
                onClick={() => { setStep('info'); setError(''); setOtp(''); }}
                className="text-text-muted text-sm mb-6 hover:text-text transition-colors flex items-center gap-1"
              >
                ← Back
              </button>

              <div className="mb-8">
                <h1 className="text-2xl font-bold text-text mb-2">Check your texts</h1>
                <p className="text-text-muted text-sm">
                  We sent a 6-digit code to <span className="font-semibold text-text">{phone}</span>.
                  Enter it below to verify your number.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelClass} htmlFor="otp">Verification code</label>
                  <input
                    id="otp"
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className={`${inputClass} text-center text-2xl tracking-[0.5em] font-bold`}
                    placeholder="------"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>

                <div className="text-center text-sm text-text-muted">
                  {canResend ? (
                    <button
                      onClick={handleResend}
                      disabled={loading}
                      className="text-brand font-semibold hover:underline disabled:opacity-60"
                    >
                      Resend code
                    </button>
                  ) : (
                    <span>Resend code in {countdown}s</span>
                  )}
                </div>

                {error && <p className={errorClass}>{error}</p>}

                <button
                  onClick={handleVerifyAndCreate}
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3.5 rounded-lg transition-colors text-base disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Success */}
          {step === 'success' && (
            <div className="bg-white rounded-2xl border border-border p-8 shadow-sm text-center">
              <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h1 className="text-2xl font-bold text-text mb-3">You&apos;re all set!</h1>
              <p className="text-text-muted text-base mb-2">
                Your account with <span className="font-semibold text-text">{businessName}</span> is ready.
              </p>
              <p className="text-text-muted text-sm mb-8">
                Download the TaskRight app and log in with{' '}
                <span className="font-semibold text-text">{phone}</span> to manage your service schedule.
              </p>

              <a
                href="#"
                className="inline-block w-full bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3.5 rounded-lg transition-colors text-base mb-4"
              >
                Download on the App Store
              </a>

              <Link
                href="/"
                className="block text-text-muted text-sm hover:text-text transition-colors"
              >
                Back to homepage
              </Link>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
