/**
 * Unified Motion Design System — LoftDesk
 *
 * Single source of truth for all Framer Motion spring physics and animation
 * variants. Every modal, list item, button, and page uses these tokens.
 *
 * Rules:
 * - Spring physics only (no duration/ease for UI transitions)
 * - Animate: transform, opacity, filter only (GPU-accelerated)
 * - Never cause layout shift or remount flicker
 */

// ─── Global spring token ──────────────────────────────────────────────────────

export const SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 28,
  mass: 0.9,
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export const BACKDROP_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const MODAL_ENTER = {
  scale: 0.82,
  opacity: 0,
  y: 70,
  rotateX: -12,
  filter: 'blur(14px)',
  transformPerspective: 1200,
}

export const MODAL_VISIBLE = {
  scale: 1,
  opacity: 1,
  y: 0,
  rotateX: 0,
  filter: 'blur(0px)',
  transformPerspective: 1200,
}

export const MODAL_EXIT = {
  scale: 0.9,
  opacity: 0,
  y: 40,
  filter: 'blur(10px)',
  transformPerspective: 1200,
}

// ─── List items ───────────────────────────────────────────────────────────────

export const LIST_ENTER = {
  opacity: 0,
  y: 20,
  scale: 0.98,
  filter: 'blur(10px)',
}

export const LIST_VISIBLE = {
  opacity: 1,
  y: 0,
  scale: 1,
  filter: 'blur(0px)',
}

export const LIST_EXIT = {
  opacity: 0,
  y: -10,
  scale: 0.98,
}

export const LIST_HOVER = { scale: 1.015, y: -2, zIndex: 10 }
export const LIST_TAP = { scale: 0.97 }

// ─── Buttons ──────────────────────────────────────────────────────────────────

export const BTN_HOVER = { scale: 1.03, y: -1 }
export const BTN_TAP = { scale: 0.97 }

// ─── Page transitions ─────────────────────────────────────────────────────────

export const PAGE_ENTER = { opacity: 0, scale: 0.99 }
export const PAGE_VISIBLE = { opacity: 1, scale: 1 }
export const PAGE_EXIT = { opacity: 0, scale: 1.01 }

// ─── Loading pulse (infinite loop — uses tween, not spring) ──────────────────

export const PULSE_ANIMATE = { opacity: [0.4, 1, 0.4], scale: [0.98, 1, 0.98] }
export const PULSE_TRANSITION = {
  duration: 1.6,
  repeat: Infinity,
  ease: 'easeInOut' as const,
}
