"use client";

import { motion, useReducedMotion } from "motion/react";

export type EricExpression = "idle" | "listening" | "thinking" | "found" | "booked";

export function CartoonEric({
  expression = "idle",
  className = "h-24 w-24",
}: {
  expression?: EricExpression;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const thinking = expression === "thinking";
  const smile =
    expression === "found" || expression === "booked"
      ? "M38 62c4 6 12 8 20 8s16-2 20-8"
      : "M42 64c3 4 8 6 16 6s13-2 16-6";

  return (
    <motion.div
      className={className}
      aria-hidden
      animate={reduce || !thinking ? { y: 0 } : { y: [0, -4, 0] }}
      transition={thinking ? { repeat: Infinity, duration: 1.1, ease: "easeInOut" } : { duration: 0.2 }}
    >
      <svg viewBox="0 0 120 140" className="h-full w-full" role="img">
        <title>Cartoon Eric</title>
        <ellipse cx="60" cy="128" rx="28" ry="6" fill="currentColor" opacity="0.12" />
        <path d="M34 78h52l8 42H26l8-42z" fill="#1a2d42" />
        <path d="M56 78h8l2 42h-12l2-42z" fill="#6eb8c0" />
        <circle cx="60" cy="52" r="30" fill="#f3d2b3" />
        <path d="M32 48c2-18 14-28 28-28s26 10 28 28c-6-6-14-8-28-8s-22 2-28 8z" fill="#2a2118" />
        <circle cx="48" cy="54" r="3.2" fill="#1a2d42" />
        <circle cx="72" cy="54" r="3.2" fill="#1a2d42" />
        <path d={smile} fill="none" stroke="#1a2d42" strokeWidth="2.4" strokeLinecap="round" />
        {expression === "thinking" ? (
          <g fill="#6eb8c0">
            <circle cx="96" cy="28" r="3" />
            <circle cx="104" cy="18" r="4" />
            <circle cx="114" cy="10" r="5" />
          </g>
        ) : null}
        {expression === "found" ? (
          <g transform="translate(86 18)">
            <path d="M12 22V10l10-7 10 7v12h-8v-6h-4v6H12z" fill="#f6f4ef" stroke="#1a2d42" strokeWidth="1.6" />
          </g>
        ) : null}
        {expression === "booked" ? (
          <g transform="translate(84 16)">
            <rect x="2" y="6" width="26" height="22" rx="3" fill="#f6f4ef" stroke="#1a2d42" strokeWidth="1.6" />
            <path d="M2 12h26M8 4v6M22 4v6" stroke="#1a2d42" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        ) : null}
      </svg>
    </motion.div>
  );
}
