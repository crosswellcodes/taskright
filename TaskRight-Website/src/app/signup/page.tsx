'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { SIGNUP_OPEN } from '@/lib/signup';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type Step = 'entity' | 'info' | 'otp' | 'success';
type EntityType = 'sole_prop' | 'llc_corp';

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-border bg-white text-text text-base outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors placeholder-text-muted';
const labelClass = 'block text-text text-sm font-semibold mb-1.5';
const errorClass = 'text-red-500 text-sm mt-1';

// Closed until production has a backend (lib/signup.ts): a direct visit or old
// link lands here and gets sent to the Early Access form instead of failing at
// the code step.
export default function SignupPage() {
  return SIGNUP_OPEN ? <SignupFlow /> : <SignupClosed />;
}

function SignupClosed() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="bg-white border-b border-border px-6 py-4">
        <Link href="/" className="text-brand font-bold text-xl tracking-tight">
          TaskRight
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-border p-8 shadow-sm text-center">
          <div className="inline-block bg-brand/10 text-brand text-xs font-semibold px-3 py-1 rounded-full mb-4">
            Early Access
          </div>
          <h1 className="text-2xl font-bold text-text mb-3">Accounts aren&apos;t open yet</h1>
          <p className="text-text-muted text-base mb-8 leading-relaxed">
            We&apos;re finishing TaskRight and opening accounts to early access members first.
            Join the list and we&apos;ll reach out personally when your spot is ready.
          </p>
          <Link
            href="/#early-access"
            className="block w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-3.5 rounded-lg transition-colors text-base"
          >
            Join the early access list
          </Link>
          <Link
            href="/"
            className="block mt-5 text-text-muted text-sm hover:text-text transition-colors"
          >
            Back to homepage
          </Link>
        </div>
      </main>
    </div>
  );
}

function SignupFlow() {
  const [step, setStep] = useState<Step>('entity');

  const [entityType, setEntityType] = useState<EntityType>('sole_prop');

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [schedulingFormat, setSchedulingFormat] = useState<'date_based' | 'day_of_week'>('date_based');

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function formatPhoneDisplay(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhone(formatPhoneDisplay(e.target.value));
  }

  // Every prospect lands on the MailerLite early-access list (same as the
  // homepage form), sent before the backend call so we keep the contact even if
  // account creation fails. Fire-and-forget: the list is a side channel, never
  // a blocker. Once per email, so retries don't resend.
  const subscribedEmail = useRef('');
  function addToEarlyAccessList() {
    const addr = email.trim();
    if (subscribedEmail.current === addr) return;
    subscribedEmail.current = addr;
    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: businessName.trim(), email: addr, wantsUpdates: false }),
    })
      .then((res) => { if (!res.ok) subscribedEmail.current = ''; })
      .catch(() => { subscribedEmail.current = ''; }); // retry on the next attempt
  }

  // Signup requires a texted code. Posting without one first lets the backend
  // answer 409 for an already-registered number before any code is sent;
  // otherwise it answers 401 OTP_REQUIRED and we text the code.
  async function postSignup(otpCode?: string) {
    const res = await fetch(`${API_BASE}/api/auth/businesses/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: businessName.trim(),
        phoneNumber: phone,
        schedulingFormat,
        entityType,
        ...(otpCode ? { otpCode } : {}),
      }),
    });
    return { res, data: await res.json() };
  }

  async function sendCode() {
    const res = await fetch(`${API_BASE}/api/auth/verify/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.code === 'RATE_LIMITED'
        ? 'Too many attempts. Please wait a moment before requesting another code.'
        : data.error || 'Failed to send code. Please try again.');
      return false;
    }
    return true;
  }

  async function handleCreateAccount() {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (!businessName.trim()) { setError('Business name is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (digits.length !== 10) { setError('Enter a valid 10-digit US phone number.'); return; }

    addToEarlyAccessList();
    setLoading(true);
    try {
      const { res, data } = await postSignup();
      if (data.code === 'DUPLICATE_PHONE') {
        setError('This phone number is already registered.');
      } else if (data.code === 'OTP_REQUIRED') {
        if (await sendCode()) { setOtp(''); setStep('otp'); }
      } else if (res.ok) {
        setStep('success');
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setLoading(true);
    try {
      if (await sendCode()) setOtp('');
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
      const { res, data } = await postSignup(otp);
      if (!res.ok) {
        if (data.code === 'INVALID_OTP') {
          setError('That code is incorrect or expired. Check your messages or request a new code.');
        } else if (data.code === 'DUPLICATE_PHONE') {
          setError('This phone number is already registered.');
        } else {
          setError(data.error || 'Something went wrong. Please try again.');
        }
        return;
      }
      setStep('success');
    } catch {
      setError('Network error. Make sure the backend is running.');
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

          {/* Step 0 — Entity type */}
          {step === 'entity' && (
            <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
              <div className="mb-8">
                <div className="inline-block bg-brand/10 text-brand text-xs font-semibold px-3 py-1 rounded-full mb-4">
                  Early Access
                </div>
                <h1 className="text-2xl font-bold text-text mb-2">What type of business is this?</h1>
                <p className="text-text-muted text-sm">
                  This helps us set up your SMS communication correctly when you go live.
                </p>
              </div>

              <div className="space-y-3 mb-8">
                <label
                  className={`flex items-start gap-3 cursor-pointer p-4 rounded-xl border-2 transition-colors ${
                    entityType === 'sole_prop'
                      ? 'border-brand bg-brand/5'
                      : 'border-border hover:border-brand/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="entityType"
                    value="sole_prop"
                    checked={entityType === 'sole_prop'}
                    onChange={() => setEntityType('sole_prop')}
                    className="mt-0.5 text-brand focus:ring-brand/30"
                  />
                  <span>
                    <span className="block text-text text-sm font-semibold">Sole Proprietor</span>
                    <span className="block text-text-muted text-xs mt-0.5">
                      Individual or informal business
                    </span>
                  </span>
                </label>

                <label
                  className={`flex items-start gap-3 cursor-pointer p-4 rounded-xl border-2 transition-colors ${
                    entityType === 'llc_corp'
                      ? 'border-brand bg-brand/5'
                      : 'border-border hover:border-brand/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="entityType"
                    value="llc_corp"
                    checked={entityType === 'llc_corp'}
                    onChange={() => setEntityType('llc_corp')}
                    className="mt-0.5 text-brand focus:ring-brand/30"
                  />
                  <span>
                    <span className="block text-text text-sm font-semibold">LLC or Corporation</span>
                    <span className="block text-text-muted text-xs mt-0.5">
                      Formally registered entity
                    </span>
                  </span>
                </label>
              </div>

              <button
                onClick={() => setStep('info')}
                className="w-full bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3.5 rounded-lg transition-colors text-base"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 1 — Business Info */}
          {step === 'info' && (
            <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
              <button
                onClick={() => { setStep('entity'); setError(''); }}
                className="text-text-muted text-sm mb-6 hover:text-text transition-colors flex items-center gap-1"
              >
                ← Back
              </button>

              <div className="mb-8">
                <div className="inline-block bg-brand/10 text-brand text-xs font-semibold px-3 py-1 rounded-full mb-4">
                  Early Access
                </div>
                <h1 className="text-2xl font-bold text-text mb-2">Reserve your spot</h1>
                <p className="text-text-muted text-sm">
                  We&apos;ll reach out personally when your access is ready.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className={labelClass} htmlFor="business-name">Business name</label>
                  <input
                    id="business-name"
                    type="text"
                    className={inputClass}
                    placeholder="ABC Cleaning Co."
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    autoComplete="organization"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    className={inputClass}
                    placeholder="you@yourbusiness.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="phone">Business phone number</label>
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
                    This is how we&apos;ll reach you — and eventually how your customers will text you.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>How do you schedule services?</label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="scheduling"
                        value="date_based"
                        checked={schedulingFormat === 'date_based'}
                        onChange={() => setSchedulingFormat('date_based')}
                        className="mt-0.5 text-brand focus:ring-brand/30"
                      />
                      <span className="text-text text-sm leading-snug">
                        <span className="font-semibold">By specific date</span>
                        <span className="text-text-muted"> — each job is scheduled on a calendar date</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="scheduling"
                        value="day_of_week"
                        checked={schedulingFormat === 'day_of_week'}
                        onChange={() => setSchedulingFormat('day_of_week')}
                        className="mt-0.5 text-brand focus:ring-brand/30"
                      />
                      <span className="text-text text-sm leading-snug">
                        <span className="font-semibold">By day of week</span>
                        <span className="text-text-muted"> — customers have a recurring day (e.g., every Thursday)</span>
                      </span>
                    </label>
                  </div>
                </div>

                {error && <p className={errorClass}>{error}</p>}

                <button
                  onClick={handleCreateAccount}
                  disabled={loading}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3.5 rounded-lg transition-colors text-base disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Reserving your spot…' : 'Get TaskRight'}
                </button>
              </div>

              <p className="text-text-muted text-xs text-center mt-6 leading-relaxed">
                Early access is limited. We review every registration personally.
              </p>
            </div>
          )}

          {/* Step 2 — Verify phone */}
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
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    className={`${inputClass} text-center text-2xl tracking-[0.5em] font-bold`}
                    placeholder="------"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>

                <div className="text-center text-sm">
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    className="text-brand font-semibold hover:underline disabled:opacity-60"
                  >
                    Resend code
                  </button>
                </div>

                {error && <p className={errorClass}>{error}</p>}

                <button
                  onClick={handleVerifyAndCreate}
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3.5 rounded-lg transition-colors text-base disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Reserving your spot…' : 'Verify & reserve'}
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

              <h1 className="text-2xl font-bold text-text mb-3">You&apos;re in.</h1>
              <p className="text-text-muted text-base mb-1">
                <span className="font-semibold text-text">{businessName}</span> is registered for early access.
              </p>
              <p className="text-text-muted text-sm mb-8">
                We&apos;ll reach out personally to{' '}
                <span className="font-semibold text-text">{phone}</span>{' '}
                when your account is ready. You&apos;re one of our first.
              </p>

              <div className="border-t border-border pt-6">
                <p className="text-text-muted text-xs mb-4 leading-relaxed">
                  While you wait, spread the word — early access spots are limited and going fast.
                </p>
                <Link
                  href="/"
                  className="block text-text-muted text-sm hover:text-text transition-colors"
                >
                  Back to homepage
                </Link>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
