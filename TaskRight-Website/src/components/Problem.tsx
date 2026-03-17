const problems = [
  {
    icon: "👁",
    title: "No visibility",
    description:
      "Your team shows up without knowing what each customer needs. Every job starts from scratch.",
  },
  {
    icon: "❓",
    title: "No transparency",
    description:
      "Customers don't know who's coming or what to expect. Uncertainty erodes trust before the job even starts.",
  },
  {
    icon: "📋",
    title: "No system",
    description:
      "Scheduling runs on texts, calls, and spreadsheets. Details fall through the cracks.",
  },
];

export default function Problem() {
  return (
    <section className="bg-surface py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-text mb-4">
            Running a service business is harder than it looks
          </h2>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            Most service businesses are held back by the same operational gaps.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((p) => (
            <div
              key={p.title}
              className="bg-bg rounded-xl p-8 border border-border"
            >
              <div className="text-3xl mb-4">{p.icon}</div>
              <h3 className="text-lg font-bold text-text mb-2">{p.title}</h3>
              <p className="text-text-muted leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
