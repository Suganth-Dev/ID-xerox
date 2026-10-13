import type { ImageEditState } from './image'
import type { PageSettings } from './layout'

export interface StoredImageRecord {
  id: string
  slot: 'front' | 'back' | 'extra'
  fileName: string
  mimeType: string
  naturalWidth: number
  naturalHeight: number
  blob: Blob
  edit: ImageEditState
}

export interface SavedJob {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  pageSettings: PageSettings
  images: StoredImageRecord[]
}

export interface JobSummary {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  imageCount: number
}
