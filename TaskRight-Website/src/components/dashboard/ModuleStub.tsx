// Pre-launch module placeholder. Per WEB_PORTAL.md §9.2 ("walk the house"),
// access isn't payment-gated and empty states should be inviting and
// illustrative — showing what a module will do — rather than dead ends.
export default function ModuleStub({
  title,
  description,
  comingSoon,
}: {
  title: string;
  description: string;
  comingSoon: string[];
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-text mb-1">{title}</h2>
      <p className="text-text-muted text-sm mb-6">{description}</p>

      <div className="bg-white rounded-2xl border border-border p-8">
        <div className="inline-block bg-brand/10 text-brand text-xs font-semibold px-3 py-1 rounded-full mb-4">
          Coming soon
        </div>
        <p className="text-text text-sm font-semibold mb-3">Here&apos;s what this module will do:</p>
        <ul className="space-y-2">
          {comingSoon.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-text-muted text-sm">
              <span className="text-brand mt-0.5">&#10003;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
