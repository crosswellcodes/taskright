const personas = [
  {
    role: "Customer",
    tagline: "Always in the loop, never out of the way",
    points: [
      "More visibility with the app, still benefits from just using text messages",
      "Receive automated SMS reminders",
      "Confirm or update preferences without calling",
      "Leave feedback after each service",
      "Text photos that attach directly to their profile in the app",
    ],
  },
  {
    role: "Team Member",
    tagline: "Everything they need, right when they need it",
    points: [
      "See assigned jobs for the day or week",
      "Customer address, notes, and one-tap driving directions",
      "Work through the task checklist and mark the job complete from the field",
      "Log job photos and contact customers — all without leaving the app",
    ],
  },
  {
    role: "Business Owner",
    tagline: "Full visibility. Less back-and-forth.",
    points: [
      "Manage customers and service schedules",
      "Build task lists and group them into reusable service packages",
      "Dispatch jobs to specific team members",
      "Automated reminders sent on your behalf",
      "Track feedback and service history",
    ],
  },
];

export default function PersonaCards() {
  return (
    <section className="bg-bg py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-text mb-4">
            Built for Every Role in Your Business
          </h2>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            TaskRight connects your customers, your team, and you — each with their own focused experience.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {personas.map((p) => (
            <div
              key={p.role}
              className="bg-surface rounded-xl p-8 border border-border flex flex-col"
            >
              <h3 className="text-xl font-bold text-text mb-1">{p.role}</h3>
              <p className="text-text-muted text-sm mb-6 leading-relaxed">{p.tagline}</p>
              <ul className="space-y-3">
                {p.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-text-muted">
                    <span className="text-brand font-bold mt-0.5 shrink-0">✓</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
