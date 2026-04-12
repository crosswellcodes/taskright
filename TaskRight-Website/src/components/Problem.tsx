const problems = [
  {
    icon: "💬",
    title: "Lost Communication",
    description:
      "Customers forget what they requested. You spend time re-explaining preferences every single visit.",
  },
  {
    icon: "📉",
    title: "No Customer Feedback Loop",
    description:
      "You don't know why customers leave. You can't improve what you don't measure.",
  },
  {
    icon: "💸",
    title: "Premium Tools Don't Fit Your Budget",
    description:
      "Enterprise platforms have features you don't need yet, but it's included in the price you pay. TaskRight delivers the essentials without charging you for complexity that doesn't apply to your business.",
  },
  {
    icon: "📱",
    title: "Manual Text Messages",
    description:
      "Sending reminders one-by-one wastes time every week. Growing businesses need automation, not extra busywork.",
  },
];

export default function Problem() {
  return (
    <section className="bg-surface py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-text mb-4">
            The Struggle is Real for Growing Service Businesses
          </h2>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            Most service businesses are held back by the same operational gaps — and the tools that exist were built for someone else.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {problems.map((p) => (
            <div
              key={p.title}
              className="bg-bg rounded-xl p-8 border border-border"
            >
              <div className="text-3xl mb-4" role="img" aria-label={p.title}>{p.icon}</div>
              <h3 className="text-lg font-bold text-text mb-2">{p.title}</h3>
              <p className="text-text-muted leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
