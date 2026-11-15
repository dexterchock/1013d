import React from 'react';

export const ChevronUp: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4.5 9.75L8 6.25l3.5 3.5" />
  </svg>
);

export const ChevronDown: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.65"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4.5 6.25L8 9.75l3.5-3.5" />
  </svg>
);

export const InfoIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.5v3.5" />
    <circle cx="8" cy="5.25" r="0.85" fill="currentColor" stroke="none" />
  </svg>
);

export const CloseIcon: React.FC = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5" />
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
