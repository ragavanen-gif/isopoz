import type { ReactNode } from "react";

/** Motif hexagonal discret (rappel du logo) en fond de section. */
export function HexPattern({ className = "", opacity = 0.06 }: { className?: string; opacity?: number }) {
  return (
    <svg className={className} width="100%" height="100%" aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <defs>
        <pattern id="hex" width="56" height="48" patternUnits="userSpaceOnUse" patternTransform="scale(1.4)">
          <path d="M28 0 L56 16 L56 40 L28 56 L0 40 L0 16 Z" fill="none" stroke="currentColor" strokeWidth="1.2" opacity={opacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
    </svg>
  );
}

/** Emblème hexagonal ISOPOZ (chevrons) — illustration vectorielle. */
export function HexEmblem({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <path d="M100 8 L166 46 L166 122 L100 160 L34 122 L34 46 Z" fill="none" stroke="#22304C" strokeWidth="10" />
      <path d="M52 96 L88 72 L124 96 L160 72" fill="none" stroke="#6E7B8C" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M40 116 L88 88 L124 112 L160 88" fill="none" stroke="#E8641C" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Panneau visuel dégradé avec emblème (remplace une photo, look intentionnel). */
export function VisualPanel({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-[var(--radius-app)] ${className}`}
      style={{ background: "linear-gradient(135deg, #22304C 0%, #2f4066 60%, #3a4d79 100%)" }}>
      <HexPattern className="text-white" opacity={0.12} />
      <div className="relative z-10 p-8 text-center text-white">{children}</div>
    </div>
  );
}
