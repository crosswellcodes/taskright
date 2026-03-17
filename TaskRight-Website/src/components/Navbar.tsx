export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-xl font-bold text-brand">TaskRight</span>
        <a
          href="#early-access"
          className="bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          Get Early Access
        </a>
      </div>
    </nav>
  );
}
