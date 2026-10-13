import { useCallback, useEffect, useState } from 'react'
import * as db from '../services/localDatabase'
import type { JobSummary, SavedJob } from '../types/job'
import { createId } from '../utils/id'
import { sanitizeJobName } from '../utils/filenames'

export function useSavedJobs() {
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await db.listJobs()
      setJobs(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveJob = useCallback(
    async (job: Omit<SavedJob, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number }) => {
      const now = Date.now()
      const toSave: SavedJob = {
        id: job.id ?? createId(),
        name: sanitizeJobName(job.name),
        createdAt: job.createdAt ?? now,
        updatedAt: now,
        pageSettings: job.pageSettings,
        images: job.images,
      }
      await db.saveJob(toSave)
      await refresh()
      return toSave
    },
    [refresh],
  )

  const openJob = useCallback(async (id: string) => db.loadJob(id), [])

  const deleteJob = useCallback(
    async (id: string) => {
      await db.deleteJob(id)
      await refresh()
    },
    [refresh],
  )

  const duplicateJob = useCallback(
    async (id: string) => {
      const job = await db.loadJob(id)
      if (!job) return
      const now = Date.now()
      const copy: SavedJob = { ...job, id: createId(), name: `${job.name} (copy)`, createdAt: now, updatedAt: now }
      await db.saveJob(copy)
      await refresh()
    },
    [refresh],
  )

  const renameJob = useCallback(
    async (id: string, name: string) => {
      const job = await db.loadJob(id)
      if (!job) return
      await db.saveJob({ ...job, name: sanitizeJobName(name), updatedAt: Date.now() })
      await refresh()
    },
    [refresh],
  )

  const deleteAll = useCallback(async () => {
    await db.deleteAllJobs()
    await refresh()
  }, [refresh])

  return { jobs, loading, refresh, saveJob, openJob, deleteJob, duplicateJob, renameJob, deleteAll }
}

export type SavedJobsApi = ReturnType<typeof useSavedJobs>
