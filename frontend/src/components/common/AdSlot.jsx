'use client';
import { useEffect, useRef } from 'react';

/**
 * AdSlot component - integrates Google AdSense ad units.
 * Replace data-ad-client and data-ad-slot with your actual AdSense values.
 *
 * Available slots:
 *   - 'banner'    → 728×90 leaderboard (top/bottom)
 *   - 'sidebar'   → 300×250 medium rectangle
 *   - 'between'   → 320×100 mobile banner (between swipe cards)
 */
const AD_SIZES = {
  banner:  { width: '100%', height: '90px', format: 'horizontal' },
  sidebar: { width: '300px', height: '250px', format: 'rectangle' },
  between: { width: '100%', height: '100px', format: 'fluid' },
};

export default function AdSlot({ slot = 'banner', className = '' }) {
  const adRef = useRef(null);
  const size = AD_SIZES[slot] || AD_SIZES.banner;
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-XXXXXXXXXX';
  const slotId = process.env[`NEXT_PUBLIC_ADSENSE_SLOT_${slot.toUpperCase()}`] || '0000000000';

  useEffect(() => {
    try {
      if (window.adsbygoogle && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {
      // AdSense not loaded in dev
    }
  }, []);

  // In development, show placeholder
  if (process.env.NODE_ENV === 'development') {
    return (
      <div
        className={`bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm rounded ${className}`}
        style={{ width: size.width, height: size.height }}
      >
        Ad Slot: {slot} ({size.width} × {size.height})
      </div>
    );
  }

  return (
    <div className={className}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: size.width, height: size.height }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format={size.format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
