'use client';

// Shared by AppShowcase (phone mocks) and PortalShowcase (browser mocks):
// the pulsing dot placed inside a mock, and the panel that explains it.

export type Hotspot = {
  title: string;
  description: string;
  top?: string;
  left?: string;
};

export function HotspotDot({ index, activeHotspot, onHotspotTap }: {
  index: number;
  activeHotspot?: number | null;
  onHotspotTap?: (i: number) => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onHotspotTap?.(index); }}
      className={`w-4 h-4 rounded-full ring-2 ring-white cursor-pointer z-30 transition-all duration-150 shrink-0 ${
        activeHotspot === index ? 'bg-[#10b981] scale-110' : 'bg-[#2563eb] animate-pulse'
      }`}
      aria-label={`Hotspot ${index + 1}`}
    />
  );
}

// Active hotspot card, or the idle "click a blue dot" hint when none is open.
export function HotspotPanel({ hotspots, activeHotspot, onSelect, panelKey }: {
  hotspots: Hotspot[];
  activeHotspot: number | null;
  onSelect: (i: number | null) => void;
  panelKey: string;
}) {
  const active = activeHotspot !== null ? hotspots[activeHotspot] : null;

  if (!active) {
    return (
      <div className="bg-surface rounded-2xl border border-dashed border-border p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-3">
          <span className="text-brand font-bold text-sm">?</span>
        </div>
        <p className="text-sm font-semibold text-text mb-1">Click a blue dot</p>
        <p className="text-xs text-text-muted">
          Click any blue dot on the screen to see a description of that feature.
        </p>
      </div>
    );
  }

  return (
    <div
      key={panelKey}
      className="bg-surface rounded-2xl border-2 border-brand shadow-lg p-6 relative
        animate-[fadeSlideIn_0.18s_ease-out]"
    >
      <button
        onClick={() => onSelect(null)}
        className="absolute top-4 right-4 w-6 h-6 rounded-full bg-border flex items-center justify-center text-text-muted hover:bg-brand/10 hover:text-brand transition-colors text-sm font-bold"
        aria-label="Close"
      >
        ✕
      </button>

      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-3 h-3 rounded-full bg-success shrink-0" />
        <p className="font-bold text-text text-base leading-tight pr-6">{active.title}</p>
      </div>

      <p className="text-text-muted text-sm leading-relaxed pl-5.5">{active.description}</p>

      <div className="flex gap-2 mt-5 pl-11">
        {hotspots.map((_, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`w-2 h-2 rounded-full transition-all ${
              activeHotspot === i ? 'bg-brand w-4' : 'bg-border hover:bg-brand/40'
            }`}
            aria-label={`Hotspot ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
