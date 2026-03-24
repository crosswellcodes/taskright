const features = [
  {
    icon: "✓",
    ariaLabel: "Checkmark icon",
    title: "Capture Customer Preferences",
    description:
      "Customers select their preferred service options before each visit. You remember exactly what they want — no more re-explaining every time.",
  },
  {
    icon: "📲",
    ariaLabel: "Phone with notification icon",
    title: "Automated SMS Reminders",
    description:
      "Three days before service, customers get a reminder. They confirm or update their preferences without calling you.",
  },
  {
    icon: "⭐",
    ariaLabel: "Star icon",
    title: "Collect Customer Feedback",
    description:
      "After every service, customers rate their experience and can leave comments. Understand what's working before you lose them.",
  },
  {
    icon: "💰",
    ariaLabel: "Money icon",
    title: "Affordable Pricing",
    description:
      "No $100+/month enterprise fees. TaskRight is built for businesses with 10–75 customers, not 500 — and priced to match.",
  },
];

export default function Features() {
  return (
    <section className="bg-bg py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-text mb-4">
            TaskRight: Built for Small Service Businesses
          </h2>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            Everything you need to manage customer communication and retention —
            without the complexity or cost of enterprise software.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-surface rounded-xl p-8 border border-border"
            >
              <div
                className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center text-brand font-bold text-lg mb-5"
                role="img"
                aria-label={f.ariaLabel}
              >
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-text mb-2">{f.title}</h3>
              <p className="text-text-muted leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
