export default function Footer() {
  return (
    <footer className="bg-text py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-white font-bold text-lg">TaskRight</span>
          <p className="text-white/50 text-sm mt-0.5">Service management, simplified.</p>
        </div>
        <p className="text-white/40 text-sm">
          © 2026 TaskRight. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
