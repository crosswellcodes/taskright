'use client';

import dynamic from 'next/dynamic';

// mapbox-gl touches `window` at import time — load it client-only.
const CustomerMapLazy = dynamic(() => import('./CustomerMap'), {
  ssr: false,
  loading: () => <div className="w-full rounded-xl bg-bg animate-pulse" style={{ height: 320 }} />,
});

export default CustomerMapLazy;
