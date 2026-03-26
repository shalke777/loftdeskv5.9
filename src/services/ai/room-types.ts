// =============================================================================
// Room Types — extensible room type definitions for Scope Engine
// =============================================================================

export type RoomTypeId = 'bathroom' | 'kitchen' | 'room' | 'hallway' | 'facade' | 'other'

export interface RoomType {
  id: RoomTypeId
  name: string           // Polish, user-facing
  icon: string
  description: string    // short hint
  hasLibrary: boolean    // whether a task library exists for this type
}

export const ROOM_TYPES: RoomType[] = [
  { id: 'bathroom', name: 'Łazienka',          icon: '🚿', description: 'Remont łazienki / WC',           hasLibrary: true },
  { id: 'kitchen',  name: 'Kuchnia',           icon: '🍳', description: 'Remont kuchni',                  hasLibrary: false },
  { id: 'room',     name: 'Pokój / Salon',     icon: '🛋️', description: 'Wykończenie pokoju lub salonu',   hasLibrary: false },
  { id: 'hallway',  name: 'Korytarz / Hol',    icon: '🚪', description: 'Korytarz, hol, przedpokój',      hasLibrary: false },
  { id: 'facade',   name: 'Elewacja / Taras',  icon: '🏠', description: 'Elewacja, balkon, taras',        hasLibrary: false },
  { id: 'other',    name: 'Inne',              icon: '📐', description: 'Inne pomieszczenie lub obiekt',   hasLibrary: false },
]

export function getRoomType(id: RoomTypeId): RoomType | undefined {
  return ROOM_TYPES.find(r => r.id === id)
}

export function getRoomTypeName(id: string): string {
  return ROOM_TYPES.find(r => r.id === id)?.name ?? id
}
