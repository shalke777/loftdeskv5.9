/**
 * queryPersister — React Query cache persisted to IndexedDB (B1 offline mode)
 *
 * Stores the full query cache snapshot in IDB so users can browse cached
 * data (projects, estimates, expenses) when offline.
 */

import { openDB } from 'idb'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

const DB_NAME  = 'loftdesk-query-cache'
const STORE    = 'cache'
const CACHE_KEY = 'query-cache'
const VERSION  = 1

async function getCacheDb() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    },
  })
}

export const idbPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    try {
      const db = await getCacheDb()
      await db.put(STORE, client, CACHE_KEY)
    } catch (err) {
      // Storage quota or serialization error — silently ignore
      console.warn('[queryPersister] persist failed:', err)
    }
  },
  restoreClient: async (): Promise<PersistedClient | undefined> => {
    try {
      const db = await getCacheDb()
      return db.get(STORE, CACHE_KEY) as Promise<PersistedClient | undefined>
    } catch (err) {
      console.warn('[queryPersister] restore failed:', err)
      return undefined
    }
  },
  removeClient: async () => {
    try {
      const db = await getCacheDb()
      await db.delete(STORE, CACHE_KEY)
    } catch {
      // ignore
    }
  },
}
