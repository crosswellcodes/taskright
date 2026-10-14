'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MapPin } from '@/lib/customers';

// Public (pk.) token from env — never committed (the repo is public).
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

const BRAND = '#2563eb';
const TODAY = '#f97316';

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// Interactive customer map: one pin per geocoded customer, today's jobs in
// orange. Fits the view to all pins; each popup links to the customer.
export default function CustomerMap({ pins, height = 480 }: { pins: MapPin[]; height?: number }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TOKEN || !container.current || pins.length === 0) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [pins[0].lng, pins[0].lat],
      zoom: 12,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    const bounds = new mapboxgl.LngLatBounds();
    for (const pin of pins) {
      const popup = new mapboxgl.Popup({ offset: 24 }).setHTML(
        `<div style="font-family:inherit">
          <a href="/dashboard/customers/${pin.id}" style="font-weight:600;color:${BRAND}">${escapeHtml(pin.name)}</a>
          ${pin.address ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${escapeHtml(pin.address)}</div>` : ''}
          ${pin.today ? '<div style="font-size:12px;color:#c2410c;margin-top:2px;font-weight:600">Service call today</div>' : ''}
        </div>`,
      );
      new mapboxgl.Marker({ color: pin.today ? TODAY : BRAND }).setLngLat([pin.lng, pin.lat]).setPopup(popup).addTo(map);
      bounds.extend([pin.lng, pin.lat]);
    }
    if (pins.length > 1) map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });

    return () => map.remove();
  }, [pins]);

  if (!TOKEN) {
    return (
      <div className="rounded-xl bg-bg p-6 text-center" style={{ minHeight: 160 }}>
        <p className="text-text text-sm font-medium">Map unavailable</p>
        <p className="text-text-muted text-xs mt-1">Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to show customer pins here.</p>
      </div>
    );
  }
  if (pins.length === 0) {
    return (
      <div className="rounded-xl bg-bg p-6 text-center" style={{ minHeight: 160 }}>
        <p className="text-text text-sm font-medium">No mapped customers yet</p>
        <p className="text-text-muted text-xs mt-1">Add an address to a customer and they’ll appear here as a pin — today’s jobs highlighted.</p>
      </div>
    );
  }
  return <div ref={container} className="w-full rounded-xl overflow-hidden border border-border" style={{ height }} />;
}
