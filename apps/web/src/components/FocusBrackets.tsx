import type { CSSProperties } from 'react'

// Corner brackets that tighten onto a flagged evidence row, like a lens
// finding focus. The row (a div or a <tr>) must be position: relative.
export default function FocusBrackets({ inset = '3px 10px' }: { inset?: string }) {
  const corner = (rot: number, pos: string) => (
    <svg viewBox="0 0 12 12" className={`absolute h-3 w-3 text-high ${pos}`} style={{ transform: `rotate(${rot}deg)` }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 11V3a2 2 0 0 1 2-2h8" />
    </svg>
  )
  return (
    <span aria-hidden className="pointer-events-none absolute animate-bracket-in" style={{ inset, '--bracket-inset': inset } as CSSProperties}>
      {corner(0, 'left-0 top-0')}
      {corner(90, 'right-0 top-0')}
      {corner(270, 'left-0 bottom-0')}
      {corner(180, 'right-0 bottom-0')}
    </span>
  )
}
