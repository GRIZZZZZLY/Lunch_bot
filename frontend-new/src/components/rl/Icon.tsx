/* ROCKET LUNCH — ICON SET (redesign v2)
   Inline line-icons, stroke=currentColor, round caps/joins.
   Usage: <Icon name="home" size={20} />
   Ported from "Redisign v2/src/icons.jsx". */
import type { CSSProperties, ReactNode } from 'react';

const ICON_PATHS = {
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.5 2.5 2.5 14.5 0 17" />
      <path d="M12 3.5c-2.5 2.5-2.5 14.5 0 17" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  // --- nav ---
  home: (
    <>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-5h5v5" />
    </>
  ),
  menu: (
    <>
      <path d="M7 3v4" />
      <path d="M9.5 3v4" />
      <path d="M12 3v4" />
      <path d="M7 7h5" />
      <path d="M9.5 7v14" />
      <path d="M16.5 21V3c2.4 1 3.5 3.8 3.5 6.8 0 2.3-1.4 3.7-3.5 3.7" />
    </>
  ),
  stats: (
    <>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    </>
  ),
  // --- product ---
  wallet: (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v0H5.5" />
      <rect x="3" y="7.5" width="18" height="12" rx="2.5" />
      <path d="M16 13.5h.01" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M3 4h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 8H6" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5 5 5h14l1 4.5" />
      <path d="M4 9.5h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  chevronUp: <path d="m6 14 6-6 6 6" />,
  chevronDown: <path d="m6 10 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  /* Копирование реквизитов на экране бюджета: два скруглённых прямоугольника
     со сдвигом — линейный стиль набора, без заливки. */
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 6.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v6.5A2.5 2.5 0 0 0 6 15h.5" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5" />
      <path d="M12 16h.01" />
    </>
  ),
  crown: (
    <>
      <path d="M4 17h16" />
      <path d="M4 17 3 7l5 4 4-6 4 6 5-4-1 10z" />
    </>
  ),
  star: <path d="m12 3 2.6 5.6 6 .7-4.4 4.2 1.1 6L12 16.9 6.7 19.5l1.1-6L3.4 9.3l6-.7z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.8" />
      <path d="M17.5 14.2c2 .7 3.5 2.4 3.5 4.8" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" />
    </>
  ),
  roulette: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.8 4.5 18 8.2l-3.7-.6" />
    </>
  ),
  bank: (
    <>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 9.5V18M9 9.5V18M15 9.5V18M19 9.5V18" />
      <path d="M3.5 20.5h17" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h8" />
      <path d="M16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1 1-4z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" />
      <path d="M6 7v12a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4 12h16" />
      <path d="m14 6 6 6-6 6" />
    </>
  ),
  sort: (
    <>
      <path d="M7 4v16M7 20l-3-3M7 20l3-3" />
      <path d="M17 20V4M17 4l-3 3M17 4l3 3" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  wifiOff: (
    <>
      <path d="M2 8.5a16 16 0 0 1 5-3M22 8.5a16 16 0 0 0-4.5-2.9" />
      <path d="M5.5 12.5a11 11 0 0 1 3-1.9M18.5 12.5a11 11 0 0 0-3.2-2" />
      <path d="M9 16.2a6 6 0 0 1 6 0" />
      <path d="M12 20h.01" />
      <path d="m3 3 18 18" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6 6 2.5 2.5M18 18l-2.5-2.5M6 18l2.5-2.5M18 6l-2.5 2.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  send: (
    <>
      <path d="M21 4 3 11l7 3 3 7z" />
      <path d="m10 14 11-10" />
    </>
  ),
  heart: <path d="M12 20s-7-4.3-9.3-9A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 9.3 4c-2.3 4.7-9.3 9-9.3 9z" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5M12 19v2.5M21.5 12H19M5 12H2.5M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 4v5h-5" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 12H3" />
      <path d="m6 8-4 4 4 4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </>
  ),
  flame: <path d="M12 3c1.5 3 4.5 4.2 4.5 8.5A4.5 4.5 0 0 1 12 16a4.5 4.5 0 0 1-4.5-4.5C7.5 9 9 8 9 6c1.5.8 1.8 2 1.8 2S11 5 12 3z" />,
  dots: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 20, stroke = 1.75, className = '', style }: IconProps) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, display: 'block', ...style }}
      aria-hidden="true"
    >
      {d}
    </svg>
  );
}
