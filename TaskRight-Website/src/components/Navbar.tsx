export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="text-xl font-bold text-brand hover:text-brand-dark transition-colors">TaskRight</a>
        <a
          href="#early-access"
          className="bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          Apply for Free Beta Access
        </a>
      </div>
    </nav>
  );
}
