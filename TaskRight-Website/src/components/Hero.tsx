export default function Hero() {
  return (
    <section className="bg-bg py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-block bg-brand/10 text-brand text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
          Now accepting early access requests
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-text leading-tight mb-6">
          Your customers, your team, and your jobs — all in sync, all the time.
        </h1>
        <p className="text-lg text-text-muted leading-relaxed mb-10 max-w-2xl mx-auto">
          Built for residential cleaning, lawn care, and home service businesses that need
          a tool for connecting teams, managing relationships, and logistics without the
          enterprise bloat.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <a
            href="#early-access"
            className="bg-brand hover:bg-brand-dark text-white font-semibold px-8 py-3.5 rounded-lg transition-colors text-base"
          >
            Apply for Early Access
          </a>
          <a
            href="#app-showcase"
            className="text-brand font-semibold px-8 py-3.5 rounded-lg border border-brand/30 hover:border-brand transition-colors text-base"
          >
            See how it works →
          </a>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-text-muted">
          <span>✓ Two plans — Monthly and Yearly</span>
          <span>✓ No credit card required</span>
          <span>✓ Help shape the product</span>
        </div>
      </div>
    </section>
  );
}
