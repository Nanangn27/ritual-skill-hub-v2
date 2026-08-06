'use client';

import React from 'react';

type RitualBrandProps = {
  className?: string;
  compact?: boolean;
  showText?: boolean;
};

export default function RitualBrand({ className = '', compact = false, showText = true }: RitualBrandProps) {
  return (
    <div className={`ritual-brand ${className}`.trim()} aria-label="Ritual logo">
      <img
        src="/ritual-logo.png"
        alt="Ritual logo"
        className={`ritual-mark ${compact ? 'ritual-mark-compact' : ''}`.trim()}
      />
      {showText ? <span className={`ritual-wordmark ${compact ? 'ritual-wordmark-compact' : ''}`.trim()}>Ritual</span> : null}
    </div>
  );
}
