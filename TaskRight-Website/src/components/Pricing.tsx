const features = [
  "Unlimited customers",
  "Unlimited team members",
  "Automated SMS to customers & team",
  "Customer task selection & preferences",
  "All features — no upgrade tiers",
];

export default function Pricing() {
  return (
    <section className="bg-bg py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-text mb-4">
            One price. Everything included.
          </h2>
          <p className="text-text-muted text-lg max-w-xl mx-auto">
            Unlimited customers. Unlimited team members. No seat limits, no
            per-service fees — just one flat rate.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Monthly */}
          <div className="bg-surface rounded-2xl p-8 border border-border flex flex-col">
            <div className="mb-6">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
                Monthly
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-5xl font-bold text-text">$29</span>
                <span className="text-text-muted text-lg mb-2">/mo</span>
              </div>
              <p className="text-text-muted text-sm mt-2">
                Billed monthly. Cancel anytime.
              </p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="text-success font-bold mt-0.5 shrink-0">
                    ✓
                  </span>
                  <span className="text-text-muted text-sm">{f}</span>
                </li>
              ))}
            </ul>
            <a
              href="#early-access"
              className="block text-center py-3 px-6 rounded-xl border-2 border-brand text-brand font-semibold hover:bg-brand/5 transition-colors"
            >
              Apply for Early Access
            </a>
          </div>

          {/* Yearly */}
          <div className="bg-brand rounded-2xl p-8 flex flex-col relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="bg-success text-white text-xs font-bold px-4 py-1.5 rounded-full">
                2 MONTHS FREE
              </span>
            </div>
            <div className="mb-6">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">
                Yearly
              </p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-5xl font-bold text-white">$290</span>
                <span className="text-white/60 text-lg mb-2">/yr</span>
              </div>
              <p className="text-white/60 text-sm mt-2">
                $24.17/mo, billed annually
              </p>
              <p className="text-white font-semibold text-sm mt-1">
                Save $58 vs monthly
              </p>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="text-white font-bold mt-0.5 shrink-0">
                    ✓
                  </span>
                  <span className="text-white/80 text-sm">{f}</span>
                </li>
              ))}
            </ul>
            <a
              href="#early-access"
              className="block text-center py-3 px-6 rounded-xl bg-white text-brand font-semibold hover:bg-white/90 transition-colors"
            >
              Apply for Early Access
            </a>
          </div>
        </div>

        <p className="text-center text-text-muted text-sm mt-10">
          Early access pricing is locked for life as long as you stay
          subscribed.
        </p>
      </div>
    </section>
  );
}
