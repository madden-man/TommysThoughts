import React from 'react';

// Small line icons for the activity row actions. Drawn here rather than pulled
// from an icon package: three glyphs don't justify a dependency, and drawing
// them means they inherit `currentColor` and size with the button.

const base = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
};

export const CalendarIcon = () => (
    <svg {...base}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
        <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
    </svg>
);

export const PencilIcon = () => (
    <svg {...base}>
        <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" />
        <path d="M14.5 6.5 17.5 9.5" />
    </svg>
);

export const CrossIcon = () => (
    <svg {...base}>
        <path d="M6 6l12 12M18 6L6 18" />
    </svg>
);

export const CheckIcon = () => (
    <svg {...base}>
        <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
);
