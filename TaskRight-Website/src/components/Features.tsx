const features = [
  {
    icon: "✓",
    title: "Task Management",
    description:
      "Define your full service menu, assign tasks to each job, and set time budgets so every visit is planned before it starts.",
  },
  {
    icon: "👥",
    title: "Staff Assignments",
    description:
      "Add team members, create groups, and assign individuals or entire crews to any service in seconds.",
  },
  {
    icon: "🔒",
    title: "Customer Transparency",
    description:
      "Customers see who's coming before you arrive — first name and last initial. Transparency builds trust before the first knock.",
  },
  {
    icon: "📝",
    title: "Task Selection",
    description:
      "Customers choose exactly what gets done within their time block. No surprises on arrival, no wasted minutes on-site.",
  },
];

export default function Features() {
  return (
    <section className="bg-bg py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-text mb-4">
            Everything your service business needs
          </h2>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            From scheduling to completion, TaskRight keeps your team aligned and
            your customers confident.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-surface rounded-xl p-8 border border-border"
            >
              <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center text-brand font-bold text-lg mb-5">
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
