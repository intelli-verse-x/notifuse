/**
 * Mail Studio (portal) nav / settings items we keep out of the UI so brand
 * users do not open them. Routes still exist in the router; the layout and
 * settings page send people away when they hit one of these.
 */

export const HIDDEN_WORKSPACE_NAV_KEYS = [
  'automations',
  'blog',
  'file-manager',
  'logs'
] as const

export type HiddenWorkspaceNavKey = (typeof HIDDEN_WORKSPACE_NAV_KEYS)[number]

export const HIDDEN_SETTINGS_SECTIONS = [
  'team',
  'webhooks',
  'custom-fields',
  'smtp-bridge',
  'blog'
] as const

export type HiddenSettingsSection = (typeof HIDDEN_SETTINGS_SECTIONS)[number]

/** First settings tab that is still visible. */
export const DEFAULT_SETTINGS_SECTION = 'integrations'

export function isHiddenWorkspaceNavPath(pathname: string): boolean {
  return HIDDEN_WORKSPACE_NAV_KEYS.some(
    (key) => pathname.includes(`/${key}`) || pathname.endsWith(`/${key}`)
  )
}

export function isHiddenSettingsSection(section: string | undefined): boolean {
  if (!section) return false
  return (HIDDEN_SETTINGS_SECTIONS as readonly string[]).includes(section)
}
