import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../types/settings'

const STORAGE_KEY = 'xeroxmate.settings.v1'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_APP_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      defaultPageSettings: { ...DEFAULT_APP_SETTINGS.defaultPageSettings, ...parsed.defaultPageSettings },
    }
  } catch {
    return DEFAULT_APP_SETTINGS
  }
}

export function useLocalSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // localStorage can throw in private-browsing / quota-exceeded situations; preferences simply won't persist.
    }
  }, [settings])

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const updatePageDefaults = useCallback((patch: Partial<AppSettings['defaultPageSettings']>) => {
    setSettings((prev) => ({ ...prev, defaultPageSettings: { ...prev.defaultPageSettings, ...patch } }))
  }, [])

  const restoreDefaults = useCallback(() => {
    setSettings(DEFAULT_APP_SETTINGS)
  }, [])

  return { settings, update, updatePageDefaults, restoreDefaults }
}
