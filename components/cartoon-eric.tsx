"use client";

import { motion, useReducedMotion } from "motion/react";

export type EricExpression = "idle" | "listening" | "thinking" | "found" | "booked";

const SKIN = "#8A5A3C";
const HAIR = "#1C140F";
const SUIT = "#1A2433";
const SHIRT = "#F7F4EF";
const TIE = "#6EB8C0";

export function CartoonEric({
  expression = "idle",
  className = "h-24 w-24",
}: {
  expression?: EricExpression;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const thinking = expression === "thinking";
  const wide = expression === "found" || expression === "booked" || expression === "listening";
  const eyeY = thinking ? 40 : 44;
  const smile = thinking
    ? "M50 56h20"
    : wide
      ? "M46 54c4 10 24 10 28 0"
      : "M48 55c3 7 21 7 24 0";

  return (
    <motion.div
      className={className}
      aria-hidden
      animate={reduce || !thinking ? { y: 0 } : { y: [0, -4, 0] }}
      transition={thinking ? { repeat: Infinity, duration: 1.1, ease: "easeInOut" } : { duration: 0.2 }}
    >
      <svg viewBox="0 0 120 140" className="h-full w-full" role="img">
        <title>Cartoon Eric</title>
        <ellipse cx="60" cy="132" rx="22" ry="4" fill="currentColor" opacity="0.12" />

        <rect x="16" y="84" width="22" height="28" rx="11" fill={SUIT} />
        <rect x="82" y="84" width="22" height="28" rx="11" fill={SUIT} />
        <circle cx="27" cy="112" r="7" fill={SKIN} />
        <circle cx="93" cy="112" r="7" fill={SKIN} />

        <rect x="34" y="80" width="52" height="40" rx="10" fill={SUIT} />
        <rect x="51" y="70" width="18" height="12" fill={SKIN} />
        <rect x="51" y="80" width="18" height="26" fill={SHIRT} />
        <path d="M56 84h8l-4 18z" fill={TIE} />

        <rect x="34" y="22" width="52" height="52" rx="14" fill={SKIN} />
        <path
          d="M32 44C32 24 44 12 60 12s28 12 28 32c-6-12-16-16-28-16S38 32 32 44z"
          fill={HAIR}
        />

        <circle cx="50" cy={eyeY} r="3.1" fill={HAIR} />
        <circle cx="70" cy={eyeY} r="3.1" fill={HAIR} />
        <circle cx="51" cy={eyeY - 1} r="0.9" fill="#fff" />
        <circle cx="71" cy={eyeY - 1} r="0.9" fill="#fff" />

        <path d={smile} fill="none" stroke={HAIR} strokeWidth="2.8" strokeLinecap="round" />

        {expression === "thinking" ? (
          <g fill={TIE}>
            <circle cx="98" cy="28" r="3" />
            <circle cx="106" cy="18" r="4" />
            <circle cx="116" cy="10" r="5" />
          </g>
        ) : null}
        {expression === "found" ? (
          <g transform="translate(92 10)">
            <path d="M6 16V8l6-5 6 5v8H6z" fill="#f6f4ef" stroke="#1a2d42" strokeWidth="1.4" />
          </g>
        ) : null}
        {expression === "booked" ? (
          <g transform="translate(90 8)">
            <rect x="2" y="5" width="20" height="16" rx="3" fill="#f6f4ef" stroke="#1a2d42" strokeWidth="1.4" />
            <path d="M2 10h20M7 3v4M17 3v4" stroke="#1a2d42" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        ) : null}
      </svg>
    </motion.div>
  );
}
