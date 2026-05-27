const iconStyle = { width: 14, height: 14, display: 'block', flexShrink: 0 } as const;

export function PinIcon({ filled = false }: { filled?: boolean }) {
  if (filled) {
    return (
      <svg
        style={iconStyle}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M14 2.5l7.5 7.5-3 1-1 4-4-4-6 6-1-1 6-6-4-4 4-1 1.5-2.5z" />
      </svg>
    );
  }
  return (
    <svg
      style={iconStyle}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14 2.5l7.5 7.5-3 1-1 4-4-4-6 6-1-1 6-6-4-4 4-1 1.5-2.5z" />
      <line x1="9" y1="15" x2="3.5" y2="20.5" />
    </svg>
  );
}

export function HideIcon() {
  return (
    <svg
      style={iconStyle}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 4l18 16" />
      <path d="M10.7 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17.5 17.5 0 0 1-3 3.7" />
      <path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s4 7 10 7a10 10 0 0 0 4.7-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
