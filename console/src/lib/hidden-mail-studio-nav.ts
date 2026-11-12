/**
 * Mail Studio nav / settings items hidden for brand users.
 * Root / admin (ROOT_EMAIL) keeps the full console chrome.
 */

import { isRootUser } from '../services/api/auth'

/** Sidebar keys brand users must not open. Admin still sees them. */
export const BRAND_HIDDEN_WORKSPACE_NAV_KEYS = [
  'automations',
  'blog',
  'file-manager',
  'logs',
  'lists',
  'transactional-notifications',
  'settings'
] as const

export type BrandHiddenWorkspaceNavKey = (typeof BRAND_HIDDEN_WORKSPACE_NAV_KEYS)[number]

/** Settings sub-tabs brand users must not open (admin keeps all). */
export const BRAND_HIDDEN_SETTINGS_SECTIONS = [
  'team',
  'webhooks',
  'custom-fields',
  'smtp-bridge',
  'blog'
] as const

export type BrandHiddenSettingsSection = (typeof BRAND_HIDDEN_SETTINGS_SECTIONS)[number]

/** @deprecated Prefer BRAND_HIDDEN_WORKSPACE_NAV_KEYS + isMailStudioAdmin */
export const HIDDEN_WORKSPACE_NAV_KEYS = BRAND_HIDDEN_WORKSPACE_NAV_KEYS

/** @deprecated Prefer BRAND_HIDDEN_SETTINGS_SECTIONS + isMailStudioAdmin */
export const HIDDEN_SETTINGS_SECTIONS = BRAND_HIDDEN_SETTINGS_SECTIONS

export type HiddenWorkspaceNavKey = BrandHiddenWorkspaceNavKey
export type HiddenSettingsSection = BrandHiddenSettingsSection

/** First settings tab when a brand somehow lands on settings (then redirected). */
export const DEFAULT_SETTINGS_SECTION = 'integrations'

export function isMailStudioAdmin(userEmail?: string): boolean {
  return isRootUser(userEmail)
}

export function getBrandHiddenWorkspaceNavKeys(
  userEmail?: string
): readonly string[] {
  if (isMailStudioAdmin(userEmail)) return []
  return BRAND_HIDDEN_WORKSPACE_NAV_KEYS
}

export function isHiddenWorkspaceNavPath(
  pathname: string,
  userEmail?: string
): boolean {
  if (isMailStudioAdmin(userEmail)) return false
  return BRAND_HIDDEN_WORKSPACE_NAV_KEYS.some(
    (key) => pathname.includes(`/${key}`) || pathname.endsWith(`/${key}`)
  )
}

export function isHiddenSettingsSection(
  section: string | undefined,
  userEmail?: string
): boolean {
  if (!section) return false
  if (isMailStudioAdmin(userEmail)) return false
  return (BRAND_HIDDEN_SETTINGS_SECTIONS as readonly string[]).includes(section)
}
