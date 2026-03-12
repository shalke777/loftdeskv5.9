// Thin API layer over lib/timeline.ts.
// Hooks and components import from here rather than directly from lib/.
export {
  createTimelineEvent,
  getProjectTimeline,
  buildTimelineEvent,
  getDemoTimeline,
} from '@/features/projects/lib/timeline'

export type { GetTimelineOptions } from '@/features/projects/lib/timeline'
