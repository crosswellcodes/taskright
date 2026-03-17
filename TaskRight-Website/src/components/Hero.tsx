export default function Hero() {
  return (
    <section className="bg-bg py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-block bg-brand/10 text-brand text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
          Now accepting early access requests
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-text leading-tight mb-6">
          Organize Your Team.<br />Delight Your Customers.
        </h1>
        <p className="text-lg text-text-muted leading-relaxed mb-10 max-w-xl mx-auto">
          TaskRight gives service businesses the tools to manage tasks, assign staff,
          and keep customers in the loop — all in one app.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#early-access"
            className="bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-lg transition-colors text-base"
          >
            Request Early Access
          </a>
          <a
            href="#how-it-works"
            className="text-brand font-semibold px-8 py-3.5 rounded-lg border border-brand/30 hover:border-brand transition-colors text-base"
          >
            See how it works →
          </a>
        </div>
      </div>
    </section>
  );
}
