import React from 'react';

export const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Shield Bottom Curve */}
    <path d="M50 160 C 100 195, 100 195, 150 160" stroke="#0f4c81" strokeWidth="6" strokeLinecap="round" fill="none" />
    
    {/* Orbital Lines */}
    <ellipse cx="100" cy="85" rx="65" ry="45" transform="rotate(-30 100 85)" stroke="#2b7bb9" strokeWidth="4" fill="none" />
    <ellipse cx="100" cy="85" rx="65" ry="45" transform="rotate(30 100 85)" stroke="#2b7bb9" strokeWidth="4" fill="none" />
    
    {/* Orbital Dots */}
    <circle cx="40" cy="75" r="6" fill="#2b7bb9" />
    <circle cx="160" cy="95" r="6" fill="#2b7bb9" />
    <circle cx="100" cy="145" r="6" fill="#2b7bb9" />
    <circle cx="100" cy="25" r="6" fill="#2b7bb9" />
    <circle cx="145" cy="125" r="7" fill="#4caf50" />
    <circle cx="55" cy="125" r="7" fill="#4caf50" />

    {/* Green Cross */}
    <path d="M80 35 H120 V65 H150 V105 H120 V135 H80 V105 H50 V65 H80 V35 Z" fill="#4caf50" />
    
    {/* Pill */}
    <g transform="rotate(-45 100 85)">
      <rect x="70" y="65" width="60" height="40" rx="20" fill="#ffffff" stroke="#0f4c81" strokeWidth="4" />
      <path d="M100 65 H110 A 20 20 0 0 1 130 85 A 20 20 0 0 1 110 105 H100 Z" fill="#0f4c81" />
      <line x1="100" y1="65" x2="100" y2="105" stroke="#ffffff" strokeWidth="3" />
    </g>
  </svg>
);
