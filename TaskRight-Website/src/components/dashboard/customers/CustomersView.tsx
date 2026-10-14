'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { post, type ApiError } from '@/lib/apiClient';
import { type CustomerListItem, type MapPin, formatPhone, frequencyLabel, normalizePhone } from '@/lib/customers';
import CustomerMap from './CustomerMapLazy';

type Props = {
  businessId: string;
  customers: CustomerListItem[];
  todayCustomerIds: number[];
  view: 'list' | 'map';
};

function AddCustomerForm({ businessId, onCancel }: { businessId: string; onCancel: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter a name.');
    const phoneNumber = normalizePhone(phone);
    if (!/^\+[1-9]\d{9,14}$/.test(phoneNumber)) return setError('Enter a valid phone number.');
    setBusy(true);
    try {
      const res = await post(`/${businessId}/customers`, { name: name.trim(), phoneNumber });
      router.push(`/dashboard/customers/${res.customer.id}`);
    } catch (err) {
      setError((err as ApiError).code === 'DUPLICATE_CUSTOMER' ? 'A customer with this phone number already exists.' : (err as ApiError).message);
      setBusy(false);
    }
  }

  const input = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-text bg-white focus:outline-none focus:ring-2 focus:ring-brand/30';
  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-border p-6">
      <h3 className="text-text font-semibold text-base mb-4">Add a customer</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={input} placeholder="Name" value={name} onChange={e => setName(e.target.value)} aria-label="Customer name" autoFocus />
        <input className={input} placeholder="Phone, e.g. (402) 555-0123" value={phone} onChange={e => setPhone(e.target.value)} aria-label="Customer phone" inputMode="tel" />
      </div>
      <p className="text-text-muted text-xs mt-2">You can add their address, notes and services on the next screen.</p>
      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">
          {busy ? 'Adding…' : 'Add customer'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-border text-sm text-text hover:bg-bg">Cancel</button>
      </div>
    </form>
  );
}

export default function CustomersView({ businessId, customers, todayCustomerIds, view }: Props) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const todaySet = useMemo(() => new Set(todayCustomerIds), [todayCustomerIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    const qDigits = q.replace(/\D/g, '');
    return customers.filter(c =>
      c.name.toLowerCase().includes(q)
      || (c.address || '').toLowerCase().includes(q)
      || (qDigits.length >= 3 && c.phoneNumber.replace(/\D/g, '').includes(qDigits)),
    );
  }, [customers, query]);

  const pins = useMemo<MapPin[]>(() => filtered
    .filter(c => c.lat != null && c.lng != null)
    .map(c => ({ id: c.id, name: c.name, address: c.address, lat: c.lat!, lng: c.lng!, today: todaySet.has(c.id) })), [filtered, todaySet]);
  const unmapped = filtered.length - pins.length;

  const tab = (v: 'list' | 'map', label: string) => (
    <Link
      href={v === 'list' ? '/dashboard/customers' : '/dashboard/customers?view=map'}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${view === v ? 'bg-brand text-white' : 'text-text hover:bg-bg'}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-text mb-1">Customers</h2>
          <p className="text-text-muted text-sm">{customers.length} customer{customers.length === 1 ? '' : 's'}.</p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark">
            + Add customer
          </button>
        )}
      </div>

      {adding && <AddCustomerForm businessId={businessId} onCancel={() => setAdding(false)} />}

      <div className="bg-white rounded-2xl border border-border p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, phone or address"
            aria-label="Search customers"
            className="flex-1 min-w-0 rounded-lg border border-border px-3 py-2 text-sm text-text bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <div className="flex gap-1 bg-bg rounded-lg p-1">{tab('list', 'List')}{tab('map', 'Map')}</div>
        </div>

        {customers.length === 0 ? (
          <div className="rounded-xl bg-bg p-6 text-center">
            <p className="text-text text-sm font-medium">No customers yet</p>
            <p className="text-text-muted text-xs mt-1">Add your first customer — then give them a service and their visits show up on your Schedule.</p>
          </div>
        ) : view === 'map' ? (
          <>
            <CustomerMap pins={pins} />
            <div className="flex flex-wrap items-center gap-4 mt-3 text-text-muted text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand" />Customer</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" />Service call today</span>
              {unmapped > 0 && <span>{unmapped} customer{unmapped === 1 ? '' : 's'} without a mapped address not shown</span>}
            </div>
          </>
        ) : filtered.length === 0 ? (
          <p className="text-text-muted text-sm">No customers match “{query}”.</p>
        ) : (
          <div>
            {filtered.map(c => (
              <Link
                key={c.id}
                href={`/dashboard/customers/${c.id}`}
                className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0 hover:bg-bg -mx-2 px-2 rounded-lg"
              >
                <div className="min-w-0">
                  <p className="text-text text-sm font-medium truncate">
                    {c.name}
                    {todaySet.has(c.id) && <span className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700">Today</span>}
                  </p>
                  <p className="text-text-muted text-xs truncate">
                    {formatPhone(c.phoneNumber)}{c.address ? ` · ${c.address}` : ''}
                  </p>
                </div>
                <div className="hidden sm:flex flex-wrap justify-end gap-1 shrink-0 max-w-[50%]">
                  {c.assignedCycles.length === 0 ? (
                    <span className="text-text-muted text-xs">No services</span>
                  ) : c.assignedCycles.map(s => (
                    <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand">{s.name} · {frequencyLabel(s.frequency)}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
