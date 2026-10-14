import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

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

type HomeSummary = {
  actionCenter: {
    awaitingConfirmation: ActionItem[];
    pastDeadline: ActionItem[];
    unassignedUpcoming: ActionItem[];
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

function ActionRow({ item, tone }: { item: ActionItem; tone: 'amber' | 'red' | 'blue' }) {
  const toneClass = tone === 'red' ? 'bg-red-50 text-red-600' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-brand/5 text-brand';
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div>
        <p className="text-text text-sm font-medium">{item.customerName || `Customer #${item.customerId}`}</p>
        <p className="text-text-muted text-xs">
          {formatDay(item.serviceDate)}
          {item.submissionDeadline ? ` · deadline ${formatDay(item.submissionDeadline)}` : ''}
        </p>
      </div>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${toneClass}`}>Ref #{item.selectionCycleId}</span>
    </div>
  );
}

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect('/dashboard/login');

  const res = await fetch(`${API_BASE}/api/businesses/${session.businessId}/home-summary`, {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: 'no-store',
  });
  if (!res.ok) redirect('/dashboard/login');
  const { summary }: { summary: HomeSummary } = await res.json();

  const { actionCenter, today, weekStrip, revenue, recentReviews, activeClocks } = summary;
  const actionCount = actionCenter.awaitingConfirmation.length + actionCenter.pastDeadline.length + actionCenter.unassignedUpcoming.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text mb-1">Home</h2>
        <p className="text-text-muted text-sm">What needs you today.</p>
      </div>

      <Card title="Action Center" right={actionCount > 0 ? <span className="text-xs font-semibold text-text-muted">{actionCount} item{actionCount === 1 ? '' : 's'}</span> : undefined}>
        {actionCount === 0 ? (
          <EmptyNote text="Nothing needs your attention right now." />
        ) : (
          <div className="space-y-5">
            {actionCenter.pastDeadline.length > 0 && (
              <div>
                <p className="text-red-600 text-xs font-semibold uppercase tracking-wide mb-1">Past deadline</p>
                {actionCenter.pastDeadline.map((item) => <ActionRow key={item.selectionCycleId} item={item} tone="red" />)}
              </div>
            )}
            {actionCenter.awaitingConfirmation.length > 0 && (
              <div>
                <p className="text-amber-700 text-xs font-semibold uppercase tracking-wide mb-1">Awaiting confirmation</p>
                {actionCenter.awaitingConfirmation.map((item) => <ActionRow key={item.selectionCycleId} item={item} tone="amber" />)}
              </div>
            )}
            {actionCenter.unassignedUpcoming.length > 0 && (
              <div>
                <p className="text-brand text-xs font-semibold uppercase tracking-wide mb-1">Unassigned, coming up</p>
                {actionCenter.unassignedUpcoming.map((item) => <ActionRow key={item.selectionCycleId} item={item} tone="blue" />)}
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Today">
          {today.items.length === 0 ? (
            <EmptyNote text="No service calls scheduled today." />
          ) : (
            <div>
              {today.items.map((item) => (
                <div key={item.selectionCycleId} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <p className="text-text text-sm font-medium">{item.customerName || `Customer #${item.customerId}`}</p>
                  <div className="flex gap-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.submitted ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {item.submitted ? 'Confirmed' : 'Pending'}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.assigned ? 'bg-brand/10 text-brand' : 'bg-bg text-text-muted'}`}>
                      {item.assigned ? 'Assigned' : 'Unassigned'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="On the clock">
          {activeClocks.length === 0 ? (
            <EmptyNote text="No one is currently clocked in." />
          ) : (
            <div>
              {activeClocks.map((c) => (
                <div key={c.teamMemberId} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div>
                    <p className="text-text text-sm font-medium">{c.teamMemberName}</p>
                    <p className="text-text-muted text-xs">at {c.customerName} · since {formatTime(c.arrivalAt)}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-success" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="This week">
        <div className="grid grid-cols-7 gap-2">
          {weekStrip.map((day) => (
            <div key={day.date} className="text-center">
              <p className="text-text-muted text-xs mb-1.5">{formatDay(day.date).split(' ')[0]}</p>
              <div className={`rounded-lg py-3 text-sm font-semibold ${day.count > 0 ? 'bg-brand/10 text-brand' : 'bg-bg text-text-muted'}`}>
                {day.count}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Revenue this month">
          <p className="text-3xl font-bold text-text">
            ${revenue.monthToDate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-text-muted text-xs mt-1">Completed jobs, month to date</p>
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
