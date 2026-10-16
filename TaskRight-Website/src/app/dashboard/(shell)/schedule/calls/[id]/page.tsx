import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession, businessGet, getTimeZone } from '@/lib/serverApi';
import { type LifecycleState, LIFECYCLE_CLASS, LIFECYCLE_LABEL, dayKey, formatDateTimeIn, formatLongDay } from '@/lib/schedule';
import CallActions from '@/components/dashboard/schedule/CallActions';
import JobCostingCard, { type JobCosts } from '@/components/dashboard/money/JobCostingCard';

type ServiceCall = {
  selectionCycleId: number;
  serviceDate: string;
  submissionDeadline: string | null;
  status: string;
  customerId: number;
  customerName: string;
  serviceCycleName: string | null;
  lifecycleState: LifecycleState;
  tasks: { id: number; name: string; minutes: number; source: 'proposed' | 'confirmed' }[];
  expectedHours: number | null;
  confirmedHours: number | null;
  expectedPrice: number | null;
  scopeIsAssumed: boolean;
  completedAt: string | null;
  completionNotes: string | null;
  teamMember: { id: number; name: string; phone: string } | null;
  team: { id: number; name: string } | null;
};

const LIFECYCLE_NOTE: Record<LifecycleState, string> = {
  proposed: 'Waiting on the customer to confirm. Showing the service’s default scope.',
  confirmed: 'The customer confirmed their tasks for this visit.',
  completed: 'This visit is done.',
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <h3 className="text-text font-semibold text-base mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="bg-bg rounded-lg p-3">
      <p className="text-text-muted text-xs mb-0.5">{label}</p>
      <p className={`text-base font-semibold ${muted ? 'text-text-muted' : 'text-text'}`}>{value}</p>
    </div>
  );
}

const hrs = (n: number | null) => (n == null ? '—' : `${n} hr${n === 1 ? '' : 's'}`);

export default async function ServiceCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const session = await requireSession();
  const timeZone = await getTimeZone(session);

  const [callRes, membersRes, groupsRes, costsRes, categoriesRes] = await Promise.all([
    businessGet<{ serviceCall: ServiceCall }>(session, `/selection-cycles/${id}`),
    businessGet<{ teamMembers: { id: number; name: string }[] }>(session, '/team-members'),
    businessGet<{ groups: { id: number; name: string }[] }>(session, '/groups'),
    businessGet<{ costs: JobCosts }>(session, `/jobs/${id}/costs`),
    businessGet<{ categories: { id: number; type: string; is_system: boolean }[] }>(session, '/cost-categories'),
  ]);
  // The single materials / overhead line edits against the system GAAP category.
  const categoryId = (type: string) => {
    const cats = (categoriesRes?.categories ?? []).filter(c => c.type === type);
    return (cats.find(c => c.is_system) ?? cats[0])?.id ?? null;
  };
  if (!callRes) notFound();
  const call = callRes.serviceCall;
  const date = dayKey(call.serviceDate);
  const backHref = `/dashboard/schedule?month=${date.slice(0, 7)}&day=${date}`;
  const isProposed = call.lifecycleState === 'proposed';

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-text-muted text-sm hover:text-text">‹ Back to schedule</Link>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <h2 className="text-xl font-bold text-text">{call.customerName}</h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${LIFECYCLE_CLASS[call.lifecycleState]}`}>
            {LIFECYCLE_LABEL[call.lifecycleState]}
          </span>
          <span className="text-text-muted text-xs font-semibold">Ref #{call.selectionCycleId}</span>
        </div>
        <p className="text-text-muted text-sm mt-1">
          {call.serviceCycleName || 'Service'} · {formatLongDay(date)}
          {call.submissionDeadline && call.lifecycleState === 'proposed' ? ` · confirm by ${formatLongDay(dayKey(call.submissionDeadline))}` : ''}
        </p>
      </div>

      {/* Lifecycle stepper: proposed → confirmed → completed */}
      <div className="bg-white rounded-2xl border border-border p-4 sm:p-6">
        <div className="flex items-center gap-2">
          {(['proposed', 'confirmed', 'completed'] as const).map((step, i, all) => {
            const reached = all.indexOf(call.lifecycleState) >= i;
            return (
              <div key={step} className="flex items-center gap-2 flex-1 last:flex-none">
                <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${reached ? 'bg-brand text-white' : 'bg-bg text-text-muted'}`}>{i + 1}</span>
                <span className={`text-sm ${reached ? 'text-text font-medium' : 'text-text-muted'}`}>{LIFECYCLE_LABEL[step]}</span>
                {i < all.length - 1 && <span className={`flex-1 h-px ${all.indexOf(call.lifecycleState) > i ? 'bg-brand' : 'bg-border'}`} />}
              </div>
            );
          })}
        </div>
        <p className="text-text-muted text-xs mt-3">{LIFECYCLE_NOTE[call.lifecycleState]}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-6">
          <Card title="Scope">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Stat label="Expected hours" value={hrs(call.expectedHours)} />
              <Stat label="Confirmed hours" value={hrs(call.confirmedHours)} muted={call.confirmedHours == null} />
              <Stat
                label="Price (expected)"
                value={call.expectedPrice == null ? 'Not set' : `$${call.expectedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                muted={call.expectedPrice == null}
              />
            </div>
            {call.scopeIsAssumed && (
              <p className="text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-xs mb-3">
                The customer never confirmed tasks for this visit — showing the service’s default scope.
              </p>
            )}
            {call.tasks.length === 0 ? (
              <p className="text-text-muted text-sm">No tasks on this service yet.</p>
            ) : (
              <div>
                {call.tasks.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <p className={`text-sm ${t.source === 'proposed' ? 'text-text-muted' : 'text-text font-medium'}`}>{t.name}</p>
                    <p className="text-text-muted text-xs">{t.minutes} min</p>
                  </div>
                ))}
                {isProposed && <p className="text-text-muted text-xs mt-3">Proposed scope — the customer may adjust before confirming.</p>}
              </div>
            )}
          </Card>

          {costsRes && (
            <JobCostingCard
              businessId={session.businessId}
              callId={call.selectionCycleId}
              costs={costsRes.costs}
              categoryIds={{ materials: categoryId('materials'), overhead: categoryId('overhead') }}
            />
          )}

          {call.lifecycleState === 'completed' && (
            <Card title="Completion">
              <p className="text-text text-sm">
                {call.completedAt
                  ? `Completed ${formatDateTimeIn(call.completedAt, timeZone)}`
                  : 'Marked completed.'}
              </p>
              {call.completionNotes && <p className="text-text-muted text-sm mt-2">{call.completionNotes}</p>}
            </Card>
          )}
        </div>

        <CallActions
          businessId={session.businessId}
          callId={call.selectionCycleId}
          serviceDate={date}
          isCompleted={call.lifecycleState === 'completed'}
          assignee={call.teamMember ? { kind: 'member', id: call.teamMember.id, name: call.teamMember.name } : call.team ? { kind: 'team', id: call.team.id, name: call.team.name } : null}
          members={membersRes?.teamMembers ?? []}
          groups={groupsRes?.groups ?? []}
        />
      </div>
    </div>
  );
}
