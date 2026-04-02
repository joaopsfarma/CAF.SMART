import React from 'react';

export const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Hexagonal Cross Background */}
    <g stroke="#4CAF50" strokeWidth="2.5" strokeLinejoin="round">
      {/* Center Hexagon */}
      <path d="M50 38 L60.39 44 V56 L50 62 L39.61 56 V44 Z" />
      {/* Top Hexagon */}
      <path d="M50 14 L60.39 20 V32 L50 38 L39.61 32 V20 Z" />
      {/* Bottom Hexagon */}
      <path d="M50 62 L60.39 68 V80 L50 86 L39.61 80 V68 Z" />
      {/* Left Hexagon */}
      <path d="M29.22 38 L39.61 44 V56 L29.22 62 L18.83 56 V44 Z" />
      {/* Right Hexagon */}
      <path d="M70.78 38 L81.17 44 V56 L70.78 62 L60.39 56 V44 Z" />
    </g>

    {/* Purple Orbitals */}
    <g stroke="#4B2C7F" strokeWidth="1.2" fill="none" opacity="0.9">
      <ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(-20 50 50)" />
      <ellipse cx="50" cy="50" rx="42" ry="16" transform="rotate(20 50 50)" />
    </g>

    {/* Orbital Dots */}
    <g fill="#4B2C7F">
      <circle cx="12" cy="42" r="2" />
      <circle cx="88" cy="58" r="2" />
      <circle cx="50" cy="32" r="2" />
      <circle cx="50" cy="68" r="2" />
      <circle cx="25" cy="65" r="2" />
      <circle cx="75" cy="35" r="2" />
    </g>

    {/* The Pill */}
    <g transform="rotate(-45 50 50)">
      {/* Pill Body */}
      <rect x="35" y="43" width="30" height="14" rx="7" fill="#FFFFFF" />
      {/* Purple Half */}
      <path d="M35 50 A 7 7 0 0 1 42 43 H 50 V 57 H 42 A 7 7 0 0 1 35 50 Z" fill="#4B2C7F" />
      {/* Green Half */}
      <path d="M50 43 H 58 A 7 7 0 0 1 65 50 A 7 7 0 0 1 58 57 H 50 V 43 Z" fill="#4CAF50" />
      {/* Center Divider */}
      <line x1="50" y1="43" x2="50" y2="57" stroke="#FFFFFF" strokeWidth="1" />
    </g>
  </svg>
);
