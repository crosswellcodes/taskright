import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AutoRefresh from '@/components/dashboard/AutoRefresh';
import { formatMoney } from '@/lib/customers';
import { type Profitability, formatPercent, periodRange } from '@/lib/money';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type ActionItem = {
  selectionCycleId: number;
  customerId: number;
  customerName: string | null;
  serviceDate: string;
  submissionDeadline?: string | null;
};

type TodayItem = {
  selectionCycleId: number;
  customerId: number;
  customerName: string | null;
  serviceDate: string;
  submitted: boolean;
  assigned: boolean;
};

type ActiveClock = {
  teamMemberId: number;
  teamMemberName: string;
  selectionCycleId: number;
  customerId: number;
  customerName: string;
  arrivalAt: string;
};

type Review = {
  id: number;
  rating: number | null;
  feedbackText: string | null;
  customerName: string | null;
  createdAt: string;
};

type UnreadThread = {
  customerId: number;
  customerName: string | null;
  unreadCount: number;
  lastMessageAt: string;
};

type HomeSummary = {
  actionCenter: {
    awaitingConfirmation: ActionItem[];
    pastDeadline: ActionItem[];
    unassignedUpcoming: ActionItem[];
    unreadMessages: UnreadThread[];
  };
  today: { serviceDate: string; items: TodayItem[] };
  weekStrip: { date: string; count: number }[];
  revenue: { monthToDate: number };
  recentReviews: Review[];
  activeClocks: ActiveClock[];
};

function formatDay(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const callHref = (id: number) => `/dashboard/schedule/calls/${id}`;
const dayHref = (date: string) => `/dashboard/schedule?month=${date.slice(0, 7)}&day=${date}`;
const rowLink = 'flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-bg -mx-2 px-2 rounded-lg';

function CardLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="text-xs font-semibold text-brand hover:underline">{label} →</Link>;
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-text font-semibold text-base">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-text-muted text-sm">{text}</p>;
}

type Tone = 'amber' | 'red' | 'blue' | 'muted';

const TONE_LABEL: Record<Tone, string> = {
  red: 'text-red-600',
  amber: 'text-amber-700',
  blue: 'text-brand',
  muted: 'text-text-muted',
};

const TONE_CHIP: Record<Tone, string> = {
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-brand/5 text-brand',
  muted: 'bg-bg text-text-muted',
};

function ActionRow({ item, tone }: { item: ActionItem; tone: Tone }) {
  return (
    <Link href={callHref(item.selectionCycleId)} className={rowLink}>
      <div>
        <p className="text-text text-sm font-medium">{item.customerName || `Customer #${item.customerId}`}</p>
        <p className="text-text-muted text-xs">
          {formatDay(item.serviceDate)}
          {item.submissionDeadline ? ` · deadline ${formatDay(item.submissionDeadline)}` : ''}
        </p>
      </div>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TONE_CHIP[tone]}`}>Ref #{item.selectionCycleId}</span>
    </Link>
  );
}

const GROUP_PREVIEW = 10;

// A collapsible Action Center group (native <details>, no client JS). The header
// carries the count so a closed group still says how much is waiting; long groups
// show the first GROUP_PREVIEW rows with the rest behind a nested "Show more".
function ActionGroup({ label, hint, tone, count, defaultOpen, children }: {
  label: string; hint?: string; tone: Tone; count: number; defaultOpen?: boolean; children: React.ReactNode[];
}) {
  if (count === 0) return null;
  const head = children.slice(0, GROUP_PREVIEW);
  const rest = children.slice(GROUP_PREVIEW);
  return (
    <details open={defaultOpen} className="group border-b border-border last:border-0">
      <summary className="flex items-center justify-between gap-3 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className={`${TONE_LABEL[tone]} text-xs font-semibold uppercase tracking-wide`}>{label}</p>
          {hint && <p className="text-text-muted text-xs mt-0.5">{hint}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TONE_CHIP[tone]}`}>{count}</span>
          <span className="text-text-muted text-sm transition-transform group-open:rotate-90" aria-hidden>›</span>
        </div>
      </summary>
      <div className="pb-3">
        {head}
        {rest.length > 0 && (
          <details className="group/more">
            <summary className="py-2 text-xs font-semibold text-brand cursor-pointer list-none [&::-webkit-details-marker]:hidden group-open/more:hidden">
              Show {rest.length} more
            </summary>
            {rest}
          </details>
        )}
      </div>
    </details>
  );
}

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect('/dashboard/login');

  const headers = { Authorization: `Bearer ${session.token}` };
  const month = periodRange('month');
  const [res, profitRes] = await Promise.all([
    fetch(`${API_BASE}/api/businesses/${session.businessId}/home-summary`, { headers, cache: 'no-store' }),
    fetch(`${API_BASE}/api/businesses/${session.businessId}/profitability?from=${month.from}&to=${month.to}`, { headers, cache: 'no-store' }),
  ]);
  if (!res.ok) redirect('/dashboard/login');
  const { summary }: { summary: HomeSummary } = await res.json();
  // The margin snapshot is an enrichment — if the rollup fails, fall back to the lean MTD number.
  const profit: Profitability | null = profitRes.ok ? (await profitRes.json()).profitability : null;

  const { actionCenter, today, weekStrip, revenue, recentReviews, activeClocks } = summary;
  const unreadMessages = actionCenter.unreadMessages ?? [];

  // "Missed" = the service date has already passed and the call was never
  // confirmed or completed. Split out so Past deadline / Awaiting confirmation
  // only hold calls that can still happen.
  const isMissed = (i: ActionItem) => i.serviceDate < today.serviceDate;
  const pastDeadline = actionCenter.pastDeadline.filter((i) => !isMissed(i));
  const awaiting = actionCenter.awaitingConfirmation.filter((i) => !isMissed(i));
  const missed = [...actionCenter.pastDeadline, ...actionCenter.awaitingConfirmation]
    .filter(isMissed)
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
  const unassigned = actionCenter.unassignedUpcoming;
  const actionCount = unreadMessages.length + pastDeadline.length + awaiting.length + unassigned.length + missed.length;

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div>
        <h2 className="text-xl font-bold text-text mb-1">Home</h2>
        <p className="text-text-muted text-sm">What needs you today.</p>
      </div>

      <Card title="Action Center" right={actionCount > 0 ? <span className="text-xs font-semibold text-text-muted">{actionCount} item{actionCount === 1 ? '' : 's'}</span> : undefined}>
        {actionCount === 0 ? (
          <EmptyNote text="Nothing needs your attention right now." />
        ) : (
          <div className="-mt-3">
            <ActionGroup label="Unread messages" tone="blue" count={unreadMessages.length} defaultOpen>
              {unreadMessages.map((t) => (
                <Link key={t.customerId} href={`/dashboard/messages?customer=${t.customerId}`} className={rowLink}>
                  <div>
                    <p className="text-text text-sm font-medium">{t.customerName || `Customer #${t.customerId}`}</p>
                    <p className="text-text-muted text-xs">last at {formatTime(t.lastMessageAt)}, {formatDay(t.lastMessageAt.split('T')[0])}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand text-white">{t.unreadCount} new</span>
                </Link>
              ))}
            </ActionGroup>
            <ActionGroup label="Unassigned, coming up" hint="Next 7 days, no one assigned" tone="blue" count={unassigned.length}>
              {unassigned.map((item) => <ActionRow key={item.selectionCycleId} item={item} tone="blue" />)}
            </ActionGroup>
            <ActionGroup label="Past deadline" hint="Customer missed the confirmation deadline" tone="red" count={pastDeadline.length}>
              {pastDeadline.map((item) => <ActionRow key={item.selectionCycleId} item={item} tone="red" />)}
            </ActionGroup>
            <ActionGroup label="Awaiting confirmation" hint="Waiting on the customer to confirm" tone="amber" count={awaiting.length}>
              {awaiting.map((item) => <ActionRow key={item.selectionCycleId} item={item} tone="amber" />)}
            </ActionGroup>
            <ActionGroup label="Missed" hint="Service date passed — never confirmed or completed" tone="muted" count={missed.length}>
              {missed.map((item) => <ActionRow key={item.selectionCycleId} item={item} tone="muted" />)}
            </ActionGroup>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Today" right={<CardLink href={dayHref(today.serviceDate)} label="Schedule" />}>
          {today.items.length === 0 ? (
            <EmptyNote text="No service calls scheduled today." />
          ) : (
            <div>
              {today.items.map((item) => (
                <Link key={item.selectionCycleId} href={callHref(item.selectionCycleId)} className={rowLink}>
                  <p className="text-text text-sm font-medium">{item.customerName || `Customer #${item.customerId}`}</p>
                  <div className="flex gap-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.submitted ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {item.submitted ? 'Confirmed' : 'Pending'}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.assigned ? 'bg-brand/10 text-brand' : 'bg-bg text-text-muted'}`}>
                      {item.assigned ? 'Assigned' : 'Unassigned'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title="On the clock" right={<CardLink href="/dashboard/team" label="Team" />}>
          {activeClocks.length === 0 ? (
            <EmptyNote text="No one is currently clocked in." />
          ) : (
            <div>
              {activeClocks.map((c) => (
                <Link key={c.teamMemberId} href={callHref(c.selectionCycleId)} className={rowLink}>
                  <div>
                    <p className="text-text text-sm font-medium">{c.teamMemberName}</p>
                    <p className="text-text-muted text-xs">at {c.customerName} · since {formatTime(c.arrivalAt)}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-success" />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="This week" right={<CardLink href={dayHref(today.serviceDate)} label="Schedule" />}>
        <div className="grid grid-cols-7 gap-2">
          {weekStrip.map((day) => (
            <Link key={day.date} href={dayHref(day.date)} className="text-center group/day">
              <p className="text-text-muted text-xs mb-1.5">{formatDay(day.date).split(' ')[0]}</p>
              <div className={`rounded-lg py-3 text-sm font-semibold group-hover/day:ring-2 group-hover/day:ring-brand/30 ${day.count > 0 ? 'bg-brand/10 text-brand' : 'bg-bg text-text-muted'}`}>
                {day.count}
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="This month" right={<CardLink href="/dashboard/money" label="Money" />}>
          {profit ? (
            <MarginSnapshot p={profit} />
          ) : (
            <>
              <p className="text-3xl font-bold text-text">{formatMoney(revenue.monthToDate)}</p>
              <p className="text-text-muted text-xs mt-1">Completed jobs, month to date</p>
            </>
          )}
        </Card>

        <Card title="Recent reviews">
          {recentReviews.length === 0 ? (
            <EmptyNote text="No reviews yet." />
          ) : (
            <div>
              {recentReviews.map((r) => (
                <div key={r.id} className="py-2.5 border-b border-border last:border-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-text text-sm font-medium">{r.customerName || 'A customer'}</p>
                    {r.rating != null && <span className="text-amber-500 text-xs">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>}
                  </div>
                  {r.feedbackText && <p className="text-text-muted text-xs">{r.feedbackText}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// Month snapshot over the M6 rollup — same range and numbers as Money's "This month".
function MarginSnapshot({ p }: { p: Profitability }) {
  const t = p.totals;
  const neg = t.marginDollars < 0;
  return (
    <div>
      <p className="text-text-muted text-xs mb-1">Margin</p>
      <p className={`text-3xl font-bold ${neg ? 'text-red-600' : 'text-text'}`}>
        {formatMoney(t.marginDollars)}
        <span className="text-base font-semibold text-text-muted ml-2">{formatPercent(t.marginPercent)}</span>
      </p>
      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
        <div>
          <p className="text-text-muted text-xs">Revenue</p>
          <p className="text-text text-sm font-semibold">{formatMoney(t.revenue)}</p>
          <p className="text-text-muted text-xs">{t.completedJobCount} job{t.completedJobCount === 1 ? '' : 's'} done</p>
        </div>
        <div>
          <p className="text-text-muted text-xs">Cost</p>
          <p className="text-text text-sm font-semibold">{formatMoney(t.totalCost)}</p>
        </div>
        <div>
          <p className="text-text-muted text-xs">Still scheduled</p>
          <p className="text-text-muted text-sm font-semibold">{formatMoney(p.pipeline.expectedRevenue)}</p>
          <p className="text-text-muted text-xs">{p.pipeline.openJobCount} open call{p.pipeline.openJobCount === 1 ? '' : 's'}</p>
        </div>
      </div>
      {t.unpricedJobCount > 0 && (
        <p className="text-amber-700 text-xs mt-3">
          {t.unpricedJobCount} completed job{t.unpricedJobCount === 1 ? ' has' : 's have'} no price — revenue is understated.
        </p>
      )}
    </div>
  );
}
