/**
 * offlineQueue — persistent mutation queue for offline mode (B1)
 *
 * Stores pending mutations in IndexedDB ("loftdesk-offline" / "queue" store).
 * Each entry: { id, type, payload, timestamp, retries }
 * On reconnect: replayQueue(handlers) fires each handler in order, then removes entry.
 */

import { openDB, type IDBPDatabase } from 'idb'

export interface QueueEntry {
  id: string
  type: string
  payload: unknown
  timestamp: number
  retries: number
}

export type MutationHandlers = Record<string, (payload: unknown) => Promise<unknown>>

const DB_NAME = 'loftdesk-offline'
const STORE   = 'queue'
const VERSION = 1

let _db: IDBPDatabase | null = null

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    },
  })
  return _db
}

export async function enqueue(type: string, payload: unknown): Promise<void> {
  const db = await getDb()
  const entry: QueueEntry = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
  }
  await db.put(STORE, entry)
}

export async function getQueue(): Promise<QueueEntry[]> {
  const db = await getDb()
  const all = await db.getAll(STORE)
  return all.sort((a, b) => a.timestamp - b.timestamp)
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb()
  return db.count(STORE)
}

async function removeEntry(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, id)
}

async function incrementRetry(entry: QueueEntry): Promise<void> {
  const db = await getDb()
  await db.put(STORE, { ...entry, retries: entry.retries + 1 })
}

/**
 * Replay all queued mutations using registered handlers.
 * Returns { succeeded, failed } counts.
 */
export async function replayQueue(
  handlers: MutationHandlers,
  onProgress?: (done: number, total: number) => void
): Promise<{ succeeded: number; failed: number }> {
  const queue = await getQueue()
  let succeeded = 0
  let failed = 0

  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i]
    const handler = handlers[entry.type]
    onProgress?.(i, queue.length)

    if (!handler) {
      console.warn(`[offlineQueue] No handler for type "${entry.type}" — skipping`)
      await removeEntry(entry.id)
      failed++
      continue
    }

    try {
      await handler(entry.payload)
      await removeEntry(entry.id)
      succeeded++
    } catch (err) {
      console.error(`[offlineQueue] Failed to replay "${entry.type}":`, err)
      if (entry.retries >= 3) {
        // Give up after 3 retries — remove to avoid infinite loop
        await removeEntry(entry.id)
        failed++
      } else {
        await incrementRetry(entry)
        failed++
      }
    }
  }

  onProgress?.(queue.length, queue.length)
  return { succeeded, failed }
}

export async function clearQueue(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE)
}
