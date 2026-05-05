/**
 * Motion Design System — LoftDesk
 *
 * Purposeful, minimal animations. B2B tool rules:
 * - Speed > Animation
 * - Predictability > Wow effect
 *
 * Allowed animation zones: modal open/close, button micro-interaction, page transitions, loading pulse.
 * Lists use NO animation — instant render, instant delete.
 */

// ─── Buttons ──────────────────────────────────────────────────────────────────

export const BTN_HOVER = { scale: 1.02 }
export const BTN_TAP = { scale: 0.98 }
export const BTN_TRANSITION = { duration: 0.1 }

// ─── Page transitions ─────────────────────────────────────────────────────────

export const SPRING = { type: 'spring' as const, stiffness: 420, damping: 28, mass: 0.9 }

export const PAGE_ENTER = { opacity: 0, scale: 0.99 }
export const PAGE_VISIBLE = { opacity: 1, scale: 1 }
export const PAGE_EXIT = { opacity: 0, scale: 1.01 }

// ─── Loading pulse (infinite loop) ───────────────────────────────────────────

export const PULSE_ANIMATE = { opacity: [0.4, 1, 0.4], scale: [0.98, 1, 0.98] }
export const PULSE_TRANSITION = {
  duration: 1.6,
  repeat: Infinity,
  ease: 'easeInOut' as const,
}
