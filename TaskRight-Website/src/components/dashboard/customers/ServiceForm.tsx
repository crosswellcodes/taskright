'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { post, patch, type ApiError } from '@/lib/apiClient';
import { DAY_NAMES, FREQUENCIES } from '@/lib/customers';
import { addDays } from '@/lib/schedule';

type Task = { id?: number; name: string; timeAllotmentMinutes: number };

export type ServiceDefinition = {
  id: number;
  name: string;
  frequency: string;
  totalHours: number | null;
  pricePerVisit: string | number | null;
  daysBeforeServiceDeadline: number | null;
  tasks: Task[];
};

type Template = { id: number; name: string; frequency: string; daysBeforeServiceDeadline: number | null; tasks: Task[] };

type Props = {
  businessId: string;
  customerId: number;
  customerName: string;
  schedulingFormat: 'date_based' | 'day_of_week';
  today: string;                        // business-local YYYY-MM-DD, from the server page
  service?: ServiceDefinition;          // present → edit mode
  templates?: Template[];               // create mode only
  members?: { id: number; name: string }[];
  groups?: { id: number; name: string }[];
};

// Next date (from tomorrow) falling on `day` — same rule as the app's builder.
function nextOccurrence(today: string, day: number) {
  const tomorrow = addDays(today, 1);
  const dow = new Date(`${tomorrow}T00:00:00Z`).getUTCDay();
  return addDays(tomorrow, (day - dow + 7) % 7);
}

// The web Service builder (create + definition-only edit). Mirrors the app's
// AssignCycleScreen payload: tasks are diff-upserted by id on edit, so existing
// task ids are preserved; new rows omit id.
export default function ServiceForm({ businessId, customerId, customerName, schedulingFormat, today, service, templates = [], members = [], groups = [] }: Props) {
  const router = useRouter();
  const isEdit = !!service;
  const isDayOfWeek = schedulingFormat === 'day_of_week';

  const [templateId, setTemplateId] = useState<number | null>(null);
  const [name, setName] = useState(service?.name ?? '');
  const [frequency, setFrequency] = useState(service?.frequency ?? 'weekly');
  const [totalHours, setTotalHours] = useState(service?.totalHours != null ? String(service.totalHours) : '');
  const [price, setPrice] = useState(service?.pricePerVisit != null ? String(Number(service.pricePerVisit)) : '');
  const [deadlineDays, setDeadlineDays] = useState(service?.daysBeforeServiceDeadline != null ? String(service.daysBeforeServiceDeadline) : '3');
  const [tasks, setTasks] = useState<Task[]>(service?.tasks ?? []);
  const [startDate, setStartDate] = useState(addDays(today, 1));
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [assignee, setAssignee] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyTemplate(id: number | null) {
    setTemplateId(id);
    const t = templates.find(x => x.id === id);
    if (!t) return;
    setName(t.name);
    setFrequency(t.frequency);
    if (t.daysBeforeServiceDeadline != null) setDeadlineDays(String(t.daysBeforeServiceDeadline));
    // Copy-on-instantiate: template task ids never become service task ids.
    setTasks(t.tasks.map(x => ({ name: x.name, timeAllotmentMinutes: x.timeAllotmentMinutes })));
  }

  const updateTask = (i: number, patchTask: Partial<Task>) =>
    setTasks(tasks.map((t, j) => (j === i ? { ...t, ...patchTask } : t)));
  const taskMinutes = tasks.reduce((sum, t) => sum + (t.timeAllotmentMinutes || 0), 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter a service name.');
    const hours = parseFloat(totalHours);
    if (!hours || hours <= 0) return setError('Enter a valid number of hours.');
    let pricePerVisit: number | null = null;
    if (price.trim() !== '') {
      pricePerVisit = Number(price);
      if (Number.isNaN(pricePerVisit) || pricePerVisit < 0) return setError('Enter a valid price, or leave it blank.');
    }
    const deadline = parseInt(deadlineDays, 10);
    if (Number.isNaN(deadline) || deadline < 0) return setError('Deadline days must be a whole number, 0 or more.');
    const cleanTasks = tasks.filter(t => t.name.trim() !== '');
    if (cleanTasks.some(t => !(t.timeAllotmentMinutes >= 0))) return setError('Each task needs minutes (0 or more).');

    const base = {
      name: name.trim(),
      frequency,
      totalHours: hours,
      pricePerVisit,
      daysBeforeServiceDeadline: deadline,
      tasks: cleanTasks.map(t => ({ ...(t.id != null ? { id: t.id } : {}), name: t.name.trim(), timeAllotmentMinutes: t.timeAllotmentMinutes })),
    };

    let body: Record<string, unknown> = base;
    if (!isEdit) {
      if (isDayOfWeek && dayOfWeek == null) return setError('Pick a service day.');
      if (!isDayOfWeek && !startDate) return setError('Pick the first service date.');
      const [kind, aid] = assignee.split(':');
      body = {
        ...base,
        ...(templateId != null ? { templateId } : {}),
        startDate: isDayOfWeek ? nextOccurrence(today, dayOfWeek!) : startDate,
        ...(isDayOfWeek ? { dayOfWeek } : {}),
        ...(assignee ? { assignee: kind === 'm' ? { teamMemberId: Number(aid) } : { teamId: Number(aid) } } : {}),
      };
    }

    setBusy(true);
    try {
      const path = `/${businessId}/customers/${customerId}/services`;
      if (isEdit) await patch(`${path}/${service!.id}`, body);
      else await post(path, body);
      router.push(`/dashboard/customers/${customerId}`);
      router.refresh();
    } catch (err) {
      setError((err as ApiError).message || 'Failed to save service');
      setBusy(false);
    }
  }

  const input = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-text bg-white focus:outline-none focus:ring-2 focus:ring-brand/30';
  const label = 'text-text-muted text-xs';

  return (
    <form onSubmit={save} className="space-y-6">
      {!isEdit && templates.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="text-text font-semibold text-base mb-1">Start from a template</h3>
          <p className="text-text-muted text-xs mb-3">Optional — fills in the name, frequency and tasks. You can still change anything.</p>
          <select className={input} value={templateId ?? ''} onChange={e => applyTemplate(e.target.value ? Number(e.target.value) : null)} aria-label="Template">
            <option value="">Start from scratch</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border p-6">
        <h3 className="text-text font-semibold text-base mb-4">Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2">
            <span className={label}>Service name</span>
            <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekly lawn care" />
          </label>
          <label className="block">
            <span className={label}>Frequency</span>
            <select className={input} value={frequency} onChange={e => setFrequency(e.target.value)}>
              {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={label}>Hours per visit</span>
            <input className={input} type="number" min="0" step="0.25" value={totalHours} onChange={e => setTotalHours(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>Price per visit (optional)</span>
            <input className={input} type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
          </label>
          <label className="block">
            <span className={label}>Customer confirms tasks this many days before</span>
            <input className={input} type="number" min="0" step="1" value={deadlineDays} onChange={e => setDeadlineDays(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-text font-semibold text-base">Tasks</h3>
          <span className="text-text-muted text-xs">{tasks.length} task{tasks.length === 1 ? '' : 's'} · {taskMinutes} min</span>
        </div>
        <p className="text-text-muted text-xs mb-4">The menu your customer prioritizes before each visit.</p>
        <div className="space-y-2">
          {tasks.map((t, i) => (
            <div key={t.id ?? `new-${i}`} className="flex gap-2">
              <input className={input} value={t.name} onChange={e => updateTask(i, { name: e.target.value })} placeholder="Task name" aria-label={`Task ${i + 1} name`} />
              <input
                className={`${input} max-w-28`}
                type="number"
                min="0"
                value={Number.isNaN(t.timeAllotmentMinutes) ? '' : t.timeAllotmentMinutes}
                onChange={e => updateTask(i, { timeAllotmentMinutes: e.target.value === '' ? NaN : Number(e.target.value) })}
                aria-label={`Task ${i + 1} minutes`}
              />
              <button type="button" onClick={() => setTasks(tasks.filter((_, j) => j !== i))} className="px-3 rounded-lg border border-border text-text-muted hover:bg-bg" aria-label={`Remove task ${i + 1}`}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setTasks([...tasks, { name: '', timeAllotmentMinutes: 30 }])} className="mt-3 text-brand text-sm font-medium hover:underline">
          + Add task
        </button>
      </div>

      {!isEdit && (
        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="text-text font-semibold text-base mb-4">Schedule & crew</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isDayOfWeek ? (
              <label className="block">
                <span className={label}>Service day</span>
                <select className={input} value={dayOfWeek ?? ''} onChange={e => setDayOfWeek(e.target.value === '' ? null : Number(e.target.value))}>
                  <option value="">Pick a day…</option>
                  {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
                {dayOfWeek != null && <span className="text-text-muted text-xs">First visit {nextOccurrence(today, dayOfWeek)}</span>}
              </label>
            ) : (
              <label className="block">
                <span className={label}>First service date</span>
                <input className={input} type="date" min={today} value={startDate} onChange={e => setStartDate(e.target.value)} />
              </label>
            )}
            <label className="block">
              <span className={label}>Assign to (optional)</span>
              <select className={input} value={assignee} onChange={e => setAssignee(e.target.value)}>
                <option value="">Leave unassigned</option>
                {members.length > 0 && (
                  <optgroup label="Team members">{members.map(m => <option key={`m${m.id}`} value={`m:${m.id}`}>{m.name}</option>)}</optgroup>
                )}
                {groups.length > 0 && (
                  <optgroup label="Groups">{groups.map(g => <option key={`t${g.id}`} value={`t:${g.id}`}>{g.name}</option>)}</optgroup>
                )}
              </select>
            </label>
          </div>
          <p className="text-text-muted text-xs mt-3">Creating the service schedules its upcoming visits and texts {customerName} a welcome message.</p>
        </div>
      )}

      {isEdit && (
        <p className="text-text-muted text-xs">Edits change the service definition only — already-scheduled visits keep their dates. Reschedule individual visits from the Schedule.</p>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark disabled:opacity-50">
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create service'}
        </button>
        <button type="button" onClick={() => router.push(`/dashboard/customers/${customerId}`)} className="px-5 py-2.5 rounded-lg border border-border text-sm text-text hover:bg-bg">
          Cancel
        </button>
      </div>
    </form>
  );
}
