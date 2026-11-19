import { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { Spin } from 'antd'
import { useAuth } from '../contexts/AuthContext'
import { Integrations } from '../components/settings/Integrations'
import { workspaceService } from '../services/api/workspace'
import { Workspace, WorkspaceMember } from '../services/api/types'
import { isRootUser } from '../services/api/auth'

/**
 * Brand-facing "Mail address" page — same Edit Integration drawer as Settings,
 * without the rest of the Settings chrome.
 */
export function EmailSendersPage() {
  const { t } = useLingui()
  const { workspaceId } = useParams({ from: '/console/workspace/$workspaceId/email-senders' })
  const { user, workspaces, refreshWorkspaces } = useAuth()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [canManageSenders, setCanManageSenders] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const current = workspaces.find((w) => w.id === workspaceId) || null
    setWorkspace(current)
  }, [workspaceId, workspaces])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!user || !workspaceId) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        if (isRootUser(user.email)) {
          if (!cancelled) {
            setIsOwner(true)
            setCanManageSenders(true)
            setLoading(false)
          }
          return
        }
        const response = await workspaceService.getMembers(workspaceId)
        if (cancelled) return
        const member = response.members.find((m: WorkspaceMember) => m.user_id === user.id)
        setIsOwner(member?.role === 'owner')
        setCanManageSenders(
          member?.role === 'owner' || member?.permissions?.workspace?.write === true
        )
      } catch (error) {
        console.error("Failed to load mail address permissions", error)
        if (!cancelled) {
          setIsOwner(false)
          setCanManageSenders(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user, workspaceId, t])

  const handleSave = async (updated: Workspace) => {
    setWorkspace(updated)
    await refreshWorkspaces()
  }

  if (loading && !workspace) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <Integrations
        workspace={workspace}
        loading={false}
        onSave={handleSave}
        isOwner={isOwner}
        canManageSenders={canManageSenders}
        sendersOnly
      />
    </div>
  )
}
