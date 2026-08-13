import React, { useState, useEffect } from 'react'
import { Card, Button } from 'antd'
import { useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { MessageHistoryTable } from '../messages/MessageHistoryTable'
import {
  listMessages,
  MessageHistory,
  MessageListParams
} from '../../services/api/messages_history'
import { Workspace } from '../../services/api/types'

interface FailedMessagesTableProps {
  workspace: Workspace
}

export const FailedMessagesTable: React.FC<FailedMessagesTableProps> = ({ workspace }) => {
  const { t } = useLingui()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<MessageHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildParams = (): MessageListParams => ({
    limit: 5,
    is_failed: true
  })

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = buildParams()
      const response = await listMessages(workspace.id, params)
      setMessages(response.messages)
    } catch (err) {
      console.error('Failed to fetch failed messages data:', err)
      setError(err instanceof Error ? err.message : t`Failed to fetch failed messages data`)
    } finally {
      setLoading(false)
    }
  }

  const handleViewMore = () => {
    navigate({
      to: '/console/workspace/$workspaceId/logs',
      params: { workspaceId: workspace.id },
      search: { is_failed: 'true' }
    })
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id])

  const cardExtra = (
    <Button type="link" size="small" onClick={handleViewMore}>
      {t`View more`}
    </Button>
  )

  return (
    <div className="mailstudio-card p-4 sm:p-6 overflow-x-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight m-0">{t`Recent Failed Messages`}</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-0">{t`Messages requiring deliverability diagnosis`}</p>
        </div>
        <button
          onClick={handleViewMore}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
        >
          {t`View failed logs →`}
        </button>
      </div>

      {error ? (
        <div className="text-red-500 p-4 text-xs">
          <p>{t`Error`}: {error}</p>
        </div>
      ) : (
        <MessageHistoryTable
          messages={messages}
          loading={loading}
          isLoadingMore={false}
          nextCursor={undefined}
          onLoadMore={() => {}}
          show_email={true}
          bordered={false}
          size="small"
          workspace={workspace}
        />
      )}
    </div>
  )
}
