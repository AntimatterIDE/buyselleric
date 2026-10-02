export function EricMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#1a2d42" />
      <rect x="14" y="46" width="36" height="20" rx="6" fill="#0e1622" />
      <rect x="28" y="38" width="8" height="10" fill="#8A5A3C" />
      <rect x="28" y="46" width="8" height="14" fill="#f7f4ef" />
      <path d="M30.2 47.2h3.6L32 58z" fill="#6eb8c0" />
      <rect x="17" y="14" width="30" height="28" rx="8" fill="#8A5A3C" />
      <path
        d="M16 26.5C16 16.5 22.5 11 32 11s16 5.5 16 15.5c-3.2-6.2-8.6-8.5-16-8.5s-12.8 2.3-16 8.5z"
        fill="#1C140F"
      />
      <circle cx="25.5" cy="27" r="2.15" fill="#1C140F" />
      <circle cx="38.5" cy="27" r="2.15" fill="#1C140F" />
      <path
        d="M24.5 33.2c2.1 3.4 12.9 3.4 15 0"
        fill="none"
        stroke="#1C140F"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
