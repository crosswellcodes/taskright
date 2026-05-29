export default function Footer() {
  return (
    <footer className="bg-text py-14 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <span className="text-white font-bold text-xl">TaskRight</span>
            <p className="text-white/50 text-sm mt-1">Service management, simplified.</p>
            <p className="text-white/40 text-sm mt-1 italic">Not enterprise. Not expensive. Just right.</p>
          </div>

          {/* Learn */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wide mb-4">Learn</h4>
            <ul className="space-y-2">
              <li>
                <a href="/blog/" className="text-white/50 hover:text-white/80 text-sm transition-colors">
                  Blog
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wide mb-4">Company</h4>
            <ul className="space-y-2">
              <li>
                <a href="#early-access" className="text-white/50 hover:text-white/80 text-sm transition-colors">
                  Get Early Access
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-white/50 hover:text-white/80 text-sm transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="text-white/50 hover:text-white/80 text-sm transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="mailto:support@taskrightpro.com" className="text-white/50 hover:text-white/80 text-sm transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6">
          <p className="text-white/30 text-sm text-center">
            © 2026 TaskRight. All rights reserved. | Midwest-based service software.
          </p>
        </div>
      </div>
    </footer>
  );
}
