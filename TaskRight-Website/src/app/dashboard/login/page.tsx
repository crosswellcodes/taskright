'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 'phone' | 'code';

const inputClass =
  'w-full px-4 py-3 rounded-lg border border-border bg-white text-text text-base outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors placeholder-text-muted';
const labelClass = 'block text-text text-sm font-semibold mb-1.5';
const errorClass = 'text-red-500 text-sm mt-1';

export default function BusinessLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function formatPhoneDisplay(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // The backend's business-login lookup matches the stored phone number
  // exactly (no normalization on that line) — send E.164, not the display format.
  function toE164(val: string) {
    return `+1${val.replace(/\D/g, '')}`;
  }

  async function handleSendCode() {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Enter a valid 10-digit US phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: toE164(phone) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not send a code. Please try again.');
        return;
      }
      setStep('code');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    setError('');
    if (code.replace(/\D/g, '').length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: toE164(phone), otpCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'BUSINESS_NOT_FOUND') {
          setError('No business account found for this phone number.');
        } else if (data.code === 'INVALID_OTP') {
          setError('That code is incorrect or has expired.');
        } else {
          setError(data.error || 'Something went wrong. Please try again.');
        }
        return;
      }
      router.push('/dashboard');
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
          <div className="bg-white rounded-2xl border border-border p-8 shadow-sm">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-text mb-2">Business login</h1>
              <p className="text-text-muted text-sm">
                {step === 'phone'
                  ? "Enter your business's phone number to get a login code."
                  : `We sent a 6-digit code to ${phone}.`}
              </p>
            </div>

            {step === 'phone' && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="phone">Phone number</label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    className={inputClass}
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                  />
                  {error && <p className={errorClass}>{error}</p>}
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={loading}
                  className="w-full bg-brand hover:bg-brand-dark text-white text-base font-semibold rounded-lg py-3.5 transition-colors disabled:opacity-60"
                >
                  {loading ? 'Sending...' : 'Send code'}
                </button>
              </div>
            )}

            {step === 'code' && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="code">6-digit code</label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className={`${inputClass} tracking-[0.3em] text-center`}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                  />
                  {error && <p className={errorClass}>{error}</p>}
                </div>
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={loading}
                  className="w-full bg-brand hover:bg-brand-dark text-white text-base font-semibold rounded-lg py-3.5 transition-colors disabled:opacity-60"
                >
                  {loading ? 'Verifying...' : 'Log in'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setCode(''); setError(''); }}
                  className="w-full text-text-muted text-sm font-medium py-1"
                >
                  Use a different number
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
