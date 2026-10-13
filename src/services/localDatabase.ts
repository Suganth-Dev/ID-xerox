import { openDB, type IDBPDatabase } from 'idb'
import type { JobSummary, SavedJob } from '../types/job'

const DB_NAME = 'xeroxmate'
const DB_VERSION = 1
const STORE = 'jobs'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

export async function saveJob(job: SavedJob): Promise<void> {
  const db = await getDb()
  await db.put(STORE, job)
}

export async function loadJob(id: string): Promise<SavedJob | undefined> {
  const db = await getDb()
  return db.get(STORE, id)
}

export async function deleteJob(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, id)
}

export async function listJobs(): Promise<JobSummary[]> {
  const db = await getDb()
  const all = (await db.getAll(STORE)) as SavedJob[]
  return all
    .map((j) => ({ id: j.id, name: j.name, createdAt: j.createdAt, updatedAt: j.updatedAt, imageCount: j.images.length }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteAllJobs(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE)
}

export async function estimateStorageUsage(): Promise<{ usageMb: number; quotaMb: number } | null> {
  if (navigator.storage?.estimate) {
    const { usage, quota } = await navigator.storage.estimate()
    return { usageMb: (usage ?? 0) / (1024 * 1024), quotaMb: (quota ?? 0) / (1024 * 1024) }
  }
  return null
}
