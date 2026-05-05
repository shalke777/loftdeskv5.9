import { motion } from 'framer-motion'
import { PULSE_ANIMATE, PULSE_TRANSITION } from '@/shared/motion/tokens'

export function Spinner() {
  return (
    <motion.div
      className="spinner"
      aria-label="Ładowanie"
      animate={PULSE_ANIMATE}
      transition={PULSE_TRANSITION}
    />
  )
}
