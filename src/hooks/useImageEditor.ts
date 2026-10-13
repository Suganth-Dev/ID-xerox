import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_EDIT_STATE, MAX_HISTORY, type ImageEditState, type ImageSlot, type ManagedImage } from '../types/image'
import type { Quad } from '../types/geometry'
import type { StoredImageRecord } from '../types/job'
import { renderEditedImageWithSize } from '../services/imageProcessing'
import { detectDocumentCorners } from '../services/documentScan'
import { createId } from '../utils/id'
import { validateDimensions, validateFile, loadImageElement } from '../utils/validation'

export interface AddImageResult {
  added: ManagedImage[]
  errors: string[]
}

export function useImageEditor() {
  const [images, setImages] = useState<ManagedImage[]>([])
  const [activeImageId, setActiveImageId] = useState<string | null>(null)
  const previewRenderToken = useRef<Map<string, number>>(new Map())

  // revoke all object urls on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        URL.revokeObjectURL(img.originalUrl)
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const regeneratePreview = useCallback(async (id: string, blob: Blob, edit: ImageEditState) => {
    const token = (previewRenderToken.current.get(id) ?? 0) + 1
    previewRenderToken.current.set(id, token)

    try {
      const result = await renderEditedImageWithSize(blob, edit, 'image/jpeg', 0.95)
      if (previewRenderToken.current.get(id) !== token) return // superseded by a newer edit
      const url = URL.createObjectURL(result.blob)
      setImages((prev) =>
        prev.map((i) => {
          if (i.id !== id) return i
          if (i.previewUrl && i.previewUrl !== i.originalUrl) URL.revokeObjectURL(i.previewUrl)
          return { ...i, previewUrl: url, previewWidth: result.width, previewHeight: result.height }
        }),
      )
    } catch {
      // leave previous preview in place; caller surfaces errors via toast at a higher level if needed
    }
  }, [])

  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const updateEdit = useCallback(
    (id: string, patch: Partial<ImageEditState>, options: { commit?: boolean; debounceMs?: number } = {}) => {
      const { commit = true, debounceMs = 150 } = options
      setImages((prev) =>
        prev.map((img) => {
          if (img.id !== id) return img
          const nextEdit: ImageEditState = { ...img.edit, ...patch }
          if (!commit) {
            return { ...img, edit: nextEdit }
          }
          const truncated = img.history.slice(0, img.historyIndex + 1)
          truncated.push(nextEdit)
          const overflow = truncated.length - MAX_HISTORY
          const history = overflow > 0 ? truncated.slice(overflow) : truncated
          return { ...img, edit: nextEdit, history, historyIndex: history.length - 1 }
        }),
      )

      const existingTimer = debounceTimers.current.get(id)
      if (existingTimer) clearTimeout(existingTimer)
      const timer = setTimeout(() => {
        setImages((prev) => {
          const target = prev.find((i) => i.id === id)
          if (target) void regeneratePreview(id, target.originalBlob, target.edit)
          return prev
        })
      }, debounceMs)
      debounceTimers.current.set(id, timer)
    },
    [regeneratePreview],
  )

  /** Runs OpenCV document detection and applies the result (or flags for manual review) via updateEdit. */
  const runAutoScan = useCallback(
    async (id: string, originalUrl: string) => {
      updateEdit(id, { scanStatus: 'detecting' }, { commit: false })
      try {
        const img = await loadImageElement(originalUrl)
        const result = await detectDocumentCorners(img)
        if (result) {
          updateEdit(id, { documentCorners: result.corners, scanStatus: 'detected', crop: null }, { commit: true })
        } else {
          updateEdit(id, { documentCorners: null, scanStatus: 'needs-review' }, { commit: false })
        }
      } catch {
        // OpenCV failed to load or threw — never block the workflow, just ask for manual review
        updateEdit(id, { documentCorners: null, scanStatus: 'needs-review' }, { commit: false })
      }
    },
    [updateEdit],
  )

  const addImages = useCallback(
    async (files: File[], slot: ImageSlot): Promise<AddImageResult> => {
      const added: ManagedImage[] = []
      const errors: string[] = []

      for (const file of files) {
        const fileCheck = validateFile(file)
        if (!fileCheck.ok) {
          errors.push(fileCheck.error!)
          continue
        }
        const url = URL.createObjectURL(file)
        try {
          const img = await loadImageElement(url)
          const dimCheck = validateDimensions(img.naturalWidth, img.naturalHeight, file.name)
          if (!dimCheck.ok) {
            errors.push(dimCheck.error!)
            URL.revokeObjectURL(url)
            continue
          }
          const managed: ManagedImage = {
            id: createId(),
            slot,
            fileName: file.name,
            mimeType: file.type,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            originalBlob: file,
            originalUrl: url,
            edit: DEFAULT_EDIT_STATE,
            history: [DEFAULT_EDIT_STATE],
            historyIndex: 0,
            previewUrl: url,
            previewWidth: img.naturalWidth,
            previewHeight: img.naturalHeight,
            createdAt: Date.now(),
          }
          added.push(managed)
        } catch {
          errors.push(`"${file.name}" could not be decoded. It may be corrupted or in an unsupported format.`)
          URL.revokeObjectURL(url)
        }
      }

      if (added.length > 0) {
        setImages((prev) => {
          // only one image per front/back slot: replace existing
          const withoutSlotCollision = slot === 'extra' ? prev : prev.filter((i) => i.slot !== slot)
          const removed = slot === 'extra' ? [] : prev.filter((i) => i.slot === slot)
          removed.forEach((r) => {
            URL.revokeObjectURL(r.originalUrl)
            if (r.previewUrl && r.previewUrl !== r.originalUrl) URL.revokeObjectURL(r.previewUrl)
          })
          return [...withoutSlotCollision, ...added]
        })
        setActiveImageId(added[0].id)
        added.forEach((img) => void runAutoScan(img.id, img.originalUrl))
      }

      return { added, errors }
    },
    [runAutoScan],
  )

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target) {
        URL.revokeObjectURL(target.originalUrl)
        if (target.previewUrl && target.previewUrl !== target.originalUrl) URL.revokeObjectURL(target.previewUrl)
      }
      return prev.filter((i) => i.id !== id)
    })
    setActiveImageId((prev) => (prev === id ? null : prev))
  }, [])

  const clearAll = useCallback(() => {
    setImages((prev) => {
      prev.forEach((img) => {
        URL.revokeObjectURL(img.originalUrl)
        if (img.previewUrl && img.previewUrl !== img.originalUrl) URL.revokeObjectURL(img.previewUrl)
      })
      return []
    })
    setActiveImageId(null)
  }, [])

  const undo = useCallback(
    (id: string) => {
      setImages((prev) =>
        prev.map((img) => {
          if (img.id !== id || img.historyIndex <= 0) return img
          const newIndex = img.historyIndex - 1
          const edit = img.history[newIndex]
          void regeneratePreview(id, img.originalBlob, edit)
          return { ...img, edit, historyIndex: newIndex }
        }),
      )
    },
    [regeneratePreview],
  )

  const redo = useCallback(
    (id: string) => {
      setImages((prev) =>
        prev.map((img) => {
          if (img.id !== id || img.historyIndex >= img.history.length - 1) return img
          const newIndex = img.historyIndex + 1
          const edit = img.history[newIndex]
          void regeneratePreview(id, img.originalBlob, edit)
          return { ...img, edit, historyIndex: newIndex }
        }),
      )
    },
    [regeneratePreview],
  )

  const resetEdit = useCallback(
    (id: string) => {
      setImages((prev) =>
        prev.map((img) => {
          if (img.id !== id) return img
          void regeneratePreview(id, img.originalBlob, DEFAULT_EDIT_STATE)
          return { ...img, edit: DEFAULT_EDIT_STATE, history: [DEFAULT_EDIT_STATE], historyIndex: 0 }
        }),
      )
    },
    [regeneratePreview],
  )

  const rescan = useCallback(
    (id: string) => {
      const target = images.find((i) => i.id === id)
      if (!target) return
      void runAutoScan(id, target.originalUrl)
    },
    [images, runAutoScan],
  )

  const applyManualCorners = useCallback(
    (id: string, corners: Quad) => {
      updateEdit(id, { documentCorners: corners, scanStatus: 'manual', crop: null }, { commit: true })
    },
    [updateEdit],
  )

  const skipScan = useCallback(
    (id: string) => {
      updateEdit(id, { documentCorners: null, scanStatus: 'skipped', crop: null }, { commit: true })
    },
    [updateEdit],
  )

  const replaceImage = useCallback(
    async (id: string, file: File) => {
      const existing = images.find((i) => i.id === id)
      if (!existing) return { errors: ['Image not found.'] }
      const result = await addImages([file], existing.slot)
      if (result.added.length > 0) {
        removeImage(id)
      }
      return { errors: result.errors }
    },
    [images, addImages, removeImage],
  )

  const getImage = useCallback((id: string | null) => images.find((i) => i.id === id) ?? null, [images])

  const loadManagedImages = useCallback(
    (records: StoredImageRecord[]) => {
      setImages((prev) => {
        prev.forEach((img) => {
          URL.revokeObjectURL(img.originalUrl)
          if (img.previewUrl && img.previewUrl !== img.originalUrl) URL.revokeObjectURL(img.previewUrl)
        })
        return []
      })

      const loaded: ManagedImage[] = records.map((r) => {
        const url = URL.createObjectURL(r.blob)
        return {
          id: r.id,
          slot: r.slot,
          fileName: r.fileName,
          mimeType: r.mimeType,
          naturalWidth: r.naturalWidth,
          naturalHeight: r.naturalHeight,
          originalBlob: r.blob,
          originalUrl: url,
          edit: r.edit,
          history: [r.edit],
          historyIndex: 0,
          previewUrl: url,
          previewWidth: r.naturalWidth,
          previewHeight: r.naturalHeight,
          createdAt: Date.now(),
        }
      })

      setImages(loaded)
      setActiveImageId(loaded.length > 0 ? loaded[0].id : null)

      loaded.forEach((img) => {
        if (JSON.stringify(img.edit) !== JSON.stringify(DEFAULT_EDIT_STATE)) {
          void regeneratePreview(img.id, img.originalBlob, img.edit)
        }
      })
    },
    [regeneratePreview],
  )

  return {
    images,
    activeImageId,
    setActiveImageId,
    addImages,
    removeImage,
    clearAll,
    updateEdit,
    undo,
    redo,
    resetEdit,
    rescan,
    applyManualCorners,
    skipScan,
    replaceImage,
    getImage,
    loadManagedImages,
  }
}

export type ImageEditorApi = ReturnType<typeof useImageEditor>
