import { useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence, motion } from 'framer-motion'
import { SPRING, LIST_ENTER, LIST_VISIBLE, LIST_EXIT, LIST_HOVER, LIST_TAP } from '@/shared/motion/tokens'

interface VirtualListProps<T> {
  items: T[]
  getKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  estimateSize?: number
  overscan?: number
  className?: string
}

/**
 * Lightweight wrapper around @tanstack/react-virtual for variable-height,
 * dynamically-measured row lists (expandable cards, etc).
 *
 * Activates virtualization only when there are enough items to make it worth it
 * (>= 20). Below that threshold it falls back to a plain mapped list — no
 * scroll-container required, no measurement overhead, no UI regression.
 */
export function VirtualList<T>({
  items,
  getKey,
  renderItem,
  estimateSize = 140,
  overscan = 6,
  className,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const enabled = items.length >= 100
  const virtualizer = useVirtualizer({
    count: enabled ? items.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    measureElement: (el) => el?.getBoundingClientRect().height ?? estimateSize,
  })

  if (!enabled) {
    return (
      <motion.div layout className={className}>
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={getKey(item, i)}
              layout
              initial={LIST_ENTER}
              animate={LIST_VISIBLE}
              exit={LIST_EXIT}
              transition={SPRING}
              whileHover={LIST_HOVER}
              whileTap={LIST_TAP}
            >
              {renderItem(item, i)}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    )
  }

  const total = virtualizer.getTotalSize()
  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div ref={parentRef} className={className} style={{ overflow: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
      <div style={{ height: total, width: '100%', position: 'relative' }}>
        {virtualItems.map((vi) => {
          const item = items[vi.index]
          return (
            <div
              key={getKey(item, vi.index)}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {renderItem(item, vi.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
