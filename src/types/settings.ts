import { DEFAULT_PAGE_SETTINGS, type PageSettings } from './layout'

export type Theme = 'light' | 'dark' | 'system'

export interface AppSettings {
  theme: Theme
  defaultPageSettings: PageSettings
  confirmBeforeDeletingJobs: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'light',
  defaultPageSettings: DEFAULT_PAGE_SETTINGS,
  confirmBeforeDeletingJobs: true,
}
