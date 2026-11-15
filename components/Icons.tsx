import React from 'react';

export const ChevronUp: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 15l-6-6-6 6" />
  </svg>
);

export const ChevronDown: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const InfoIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

export const MoveIcon: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5.5 9.5L3 12l2.5 2.5" />
    <path d="M18.5 9.5L21 12l-2.5 2.5" />
    <path d="M9.5 5.5L12 3l2.5 2.5" />
    <path d="M9.5 18.5L12 21l2.5-2.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5v17" />
  </svg>
);

export const RotateIcon: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.5 4v5h-5" />
    <path d="M20.25 9A8.75 8.75 0 1 0 19 16.5" />
  </svg>
);

export const MagnetIcon: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5.5 5h3.75v7.25a2.75 2.75 0 0 0 5.5 0V5h3.75v7.25a6.5 6.5 0 0 1-13 0V5z" />
    <path d="M5.5 8.75h3.75" />
    <path d="M14.75 8.75h3.75" />
  </svg>
);

export const WireframeIcon: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2.75L20 7.35v9.3L12 21.25l-8-4.6v-9.3L12 2.75z" />
    <path d="M4 7.35L12 12l8-4.65" />
    <path d="M12 21.25V12" />
  </svg>
);
