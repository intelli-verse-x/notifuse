import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'
import { Row, Col, Statistic, Space, Tooltip, Spin, Drawer, Button } from 'antd'
import { useLingui } from '@lingui/react/macro'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPaperPlane,
  faCircleCheck,
  faEye,
  faCircleXmark,
  faFaceFrown
} from '@fortawesome/free-regular-svg-icons'
import { faArrowPointer, faTriangleExclamation, faBan } from '@fortawesome/free-solid-svg-icons'
import {
  getBroadcastStats,
  listMessages,
  type MessageListParams
} from '../../services/api/messages_history'
import type { Workspace } from '../../services/api/types'
import { MessageHistoryTable } from '../messages/MessageHistoryTable'

export interface ProgressStats {
  remaining: number
  processed: number
  enqueuedCount: number
  sentCount: number
  failedCount: number
}

type ActivityFilter =
  | 'sent'
  | 'is_delivered'
  | 'is_opened'
  | 'is_clicked'
  | 'is_failed'
  | 'is_bounced'
  | 'is_complained'
  | 'is_unsubscribed'

interface BroadcastStatsProps {
  workspaceId: string
  broadcastId: string
  workspace?: Workspace
  enqueuedCount?: number
  broadcastStatus?: string
  onStatsUpdate?: (stats: ProgressStats) => void
}

const ACTIVITY_TITLES: Record<ActivityFilter, string> = {
  sent: 'Sent',
  is_delivered: 'Delivered',
  is_opened: 'Opens',
  is_clicked: 'Clicks',
  is_failed: 'Failed',
  is_bounced: 'Bounced',
  is_complained: 'Complaints',
  is_unsubscribed: 'Unsubscribes'
}

function buildMessageFilters(
  broadcastId: string,
  filter: ActivityFilter
): MessageListParams {
  const params: MessageListParams = {
    broadcast_id: broadcastId,
    limit: 20
  }
  if (filter !== 'sent') {
    params[filter] = true
  }
  return params
}

export function BroadcastStats({
  workspaceId,
  broadcastId,
  workspace,
  enqueuedCount,
  broadcastStatus,
  onStatsUpdate
}: BroadcastStatsProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const [activityFilter, setActivityFilter] = useState<ActivityFilter | null>(null)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['broadcast-stats', workspaceId, broadcastId],
    queryFn: async () => {
      return getBroadcastStats(workspaceId, broadcastId)
    },
    refetchInterval:
      broadcastStatus === 'cancelled' || broadcastStatus === 'failed' ? false : 5000
  })

  const stats = data?.stats || {
    total_sent: 0,
    total_delivered: 0,
    total_opened: 0,
    total_clicked: 0,
    total_failed: 0,
    total_bounced: 0,
    total_complained: 0,
    total_unsubscribed: 0
  }

  const processed = stats.total_sent + stats.total_failed
  const remaining = enqueuedCount ? Math.max(0, enqueuedCount - processed) : 0

  const onStatsUpdateRef = React.useRef(onStatsUpdate)
  useEffect(() => {
    onStatsUpdateRef.current = onStatsUpdate
  })

  useEffect(() => {
    if (enqueuedCount !== undefined) {
      onStatsUpdateRef.current?.({
        remaining,
        processed,
        enqueuedCount,
        sentCount: stats.total_sent,
        failedCount: stats.total_failed
      })
    }
  }, [remaining, processed, enqueuedCount, stats.total_sent, stats.total_failed])

  const isSmtpProvider = (() => {
    if (!workspace?.settings?.marketing_email_provider_id) return false
    const marketingProviderId = workspace.settings.marketing_email_provider_id
    const integration = workspace.integrations?.find((i) => i.id === marketingProviderId)
    return integration?.email_provider?.kind === 'smtp'
  })()

  const getRate = (numerator: number, denominator: number) => {
    if (denominator === 0) return '-'
    const percentage = (numerator / denominator) * 100
    if (percentage === 0 || percentage >= 10) {
      return `${Math.round(percentage)}%`
    }
    return `${percentage.toFixed(1)}%`
  }

  const formatStat = (value: number | string) => {
    if (isLoading) {
      return <Spin size="small" />
    }
    return value
  }

  const openActivity = (filter: ActivityFilter) => {
    setCursor(undefined)
    setIsLoadingMore(false)
    setActivityFilter(filter)
  }

  const closeActivity = () => {
    setActivityFilter(null)
    setCursor(undefined)
    setIsLoadingMore(false)
  }

  const messageFilters =
    activityFilter != null ? buildMessageFilters(broadcastId, activityFilter) : null

  const {
    data: messagesData,
    isLoading: messagesLoading,
    isFetching: messagesFetching
  } = useQuery({
    queryKey: ['broadcast-activity', workspaceId, broadcastId, activityFilter, cursor],
    queryFn: async () => {
      if (!messageFilters) return { messages: [], has_more: false }
      return listMessages(workspaceId, {
        ...messageFilters,
        cursor
      })
    },
    enabled: activityFilter != null && !!workspace,
    staleTime: 5000,
    refetchOnWindowFocus: false
  })

  const [allMessages, setAllMessages] = useState<
    NonNullable<typeof messagesData>['messages']
  >([])

  useEffect(() => {
    if (activityFilter == null) {
      setAllMessages([])
      return
    }
    if (messagesLoading || !messagesData) return
    if (!cursor) {
      setAllMessages(messagesData.messages || [])
    } else if (messagesData.messages?.length) {
      setAllMessages((prev) => [...prev, ...messagesData.messages])
    }
    setIsLoadingMore(false)
  }, [messagesData, cursor, messagesLoading, activityFilter])

  const handleLoadMore = () => {
    if (messagesData?.next_cursor) {
      setIsLoadingMore(true)
      setCursor(messagesData.next_cursor)
    }
  }

  const handleRefresh = () => {
    setCursor(undefined)
    setAllMessages([])
    queryClient.invalidateQueries({
      queryKey: ['broadcast-activity', workspaceId, broadcastId, activityFilter]
    })
  }

  const activityTitle = activityFilter
    ? t`${ACTIVITY_TITLES[activityFilter]} for this campaign`
    : ''

  return (
    <>
      <Row gutter={[16, 16]} wrap className="flex-nowrap overflow-x-auto">
        <Col span={3}>
          <Tooltip title={t`${stats.total_sent} total emails sent - Click to view details`}>
            <div
              className="cursor-pointer hover:bg-[#f2f6ff] p-2 rounded transition-colors"
              onClick={() => openActivity('sent')}
            >
              <Statistic
                title={
                  <Space className="font-medium">
                    <FontAwesomeIcon
                      icon={faPaperPlane}
                      style={{ opacity: 0.7 }}
                      className="text-blue-500"
                    />{' '}
                    {t`Sent`}
                  </Space>
                }
                value={stats.total_sent}
                valueStyle={{ fontSize: '16px' }}
                formatter={formatStat}
              />
            </div>
          </Tooltip>
        </Col>
        <Col span={3}>
          <Tooltip
            title={
              isSmtpProvider
                ? t`SMTP provider doesn't support delivery webhooks, so delivery status cannot be tracked`
                : t`${stats.total_delivered} emails successfully delivered - Click to view details`
            }
          >
            <div
              className={`p-2 rounded transition-colors ${
                isSmtpProvider
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:bg-[#f2f6ff]'
              }`}
              onClick={isSmtpProvider ? undefined : () => openActivity('is_delivered')}
            >
              <Statistic
                title={
                  <Space className="font-medium">
                    <FontAwesomeIcon
                      icon={faCircleCheck}
                      style={{ opacity: 0.7 }}
                      className="text-green-500"
                    />{' '}
                    {t`Delivered`}
                  </Space>
                }
                value={isSmtpProvider ? '-' : getRate(stats.total_delivered, stats.total_sent)}
                valueStyle={{ fontSize: '16px' }}
                formatter={formatStat}
              />
            </div>
          </Tooltip>
        </Col>
        <Col span={3}>
          <Tooltip title={t`${stats.total_opened} total opens - Click to view details`}>
            <div
              className="cursor-pointer hover:bg-[#f2f6ff] p-2 rounded transition-colors"
              onClick={() => openActivity('is_opened')}
            >
              <Statistic
                title={
                  <Space className="font-medium">
                    <FontAwesomeIcon
                      icon={faEye}
                      style={{ opacity: 0.7 }}
                      className="text-purple-500"
                    />{' '}
                    {t`Opens`}
                  </Space>
                }
                value={getRate(stats.total_opened, stats.total_sent)}
                valueStyle={{ fontSize: '16px' }}
                formatter={formatStat}
              />
            </div>
          </Tooltip>
        </Col>
        <Col span={3}>
          <Tooltip title={t`${stats.total_clicked} total clicks - Click to view details`}>
            <div
              className="cursor-pointer hover:bg-[#f2f6ff] p-2 rounded transition-colors"
              onClick={() => openActivity('is_clicked')}
            >
              <Statistic
                title={
                  <Space className="font-medium">
                    <FontAwesomeIcon
                      icon={faArrowPointer}
                      style={{ opacity: 0.7 }}
                      className="text-cyan-500 mr-1"
                    />{' '}
                    {t`Clicks`}
                  </Space>
                }
                value={getRate(stats.total_clicked, stats.total_sent)}
                valueStyle={{ fontSize: '16px' }}
                formatter={formatStat}
              />
            </div>
          </Tooltip>
        </Col>
        <Col span={3}>
          <Tooltip title={t`${stats.total_failed} emails failed to send - Click to view details`}>
            <div
              className="cursor-pointer hover:bg-[#f2f6ff] p-2 rounded transition-colors"
              onClick={() => openActivity('is_failed')}
            >
              <Statistic
                title={
                  <Space className="font-medium">
                    <FontAwesomeIcon
                      icon={faCircleXmark}
                      style={{ opacity: 0.7 }}
                      className="text-orange-500"
                    />{' '}
                    {t`Failed`}
                  </Space>
                }
                value={getRate(stats.total_failed, stats.total_sent)}
                valueStyle={{ fontSize: '16px' }}
                formatter={formatStat}
              />
            </div>
          </Tooltip>
        </Col>
        <Col span={3}>
          <Tooltip
            title={
              isSmtpProvider
                ? t`SMTP provider doesn't support bounce webhooks, so bounce status cannot be tracked`
                : t`${stats.total_bounced} emails bounced back - Click to view details`
            }
          >
            <div
              className={`p-2 rounded transition-colors ${
                isSmtpProvider
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:bg-[#f2f6ff]'
              }`}
              onClick={isSmtpProvider ? undefined : () => openActivity('is_bounced')}
            >
              <Statistic
                title={
                  <Space className="font-medium">
                    <FontAwesomeIcon
                      icon={faTriangleExclamation}
                      style={{ opacity: 0.7 }}
                      className="text-orange-500"
                    />{' '}
                    {t`Bounced`}
                  </Space>
                }
                value={isSmtpProvider ? '-' : getRate(stats.total_bounced, stats.total_sent)}
                valueStyle={{ fontSize: '16px' }}
                formatter={formatStat}
              />
            </div>
          </Tooltip>
        </Col>
        <Col span={3}>
          <Tooltip
            title={
              isSmtpProvider
                ? t`SMTP provider doesn't support complaint webhooks, so spam complaints cannot be tracked`
                : t`${stats.total_complained} total complaints - Click to view details`
            }
          >
            <div
              className={`p-2 rounded transition-colors ${
                isSmtpProvider
                  ? 'cursor-not-allowed opacity-50'
                  : 'cursor-pointer hover:bg-[#f2f6ff]'
              }`}
              onClick={isSmtpProvider ? undefined : () => openActivity('is_complained')}
            >
              <Statistic
                title={
                  <Space className="font-medium">
                    <FontAwesomeIcon
                      icon={faFaceFrown}
                      style={{ opacity: 0.7 }}
                      className="text-orange-500"
                    />{' '}
                    {t`Complaints`}
                  </Space>
                }
                value={isSmtpProvider ? '-' : getRate(stats.total_complained, stats.total_sent)}
                valueStyle={{ fontSize: '16px' }}
                formatter={formatStat}
              />
            </div>
          </Tooltip>
        </Col>
        <Col span={3}>
          <Tooltip title={t`${stats.total_unsubscribed} total unsubscribes - Click to view details`}>
            <div
              className="cursor-pointer hover:bg-[#f2f6ff] p-2 rounded transition-colors"
              onClick={() => openActivity('is_unsubscribed')}
            >
              <Statistic
                title={
                  <Space className="font-medium">
                    <FontAwesomeIcon
                      icon={faBan}
                      style={{ opacity: 0.7 }}
                      className="text-orange-500"
                    />{' '}
                    {t`Unsub.`}
                  </Space>
                }
                value={getRate(stats.total_unsubscribed, stats.total_sent)}
                valueStyle={{ fontSize: '16px' }}
                formatter={formatStat}
              />
            </div>
          </Tooltip>
        </Col>
      </Row>

      <Drawer
        title={activityTitle}
        placement="right"
        width={Math.min(920, typeof window !== 'undefined' ? window.innerWidth - 48 : 920)}
        open={activityFilter != null}
        onClose={closeActivity}
        destroyOnClose
        extra={
          <Button type="link" onClick={handleRefresh} disabled={messagesFetching}>
            {t`Refresh`}
          </Button>
        }
      >
        {workspace ? (
          <MessageHistoryTable
            messages={allMessages}
            loading={messagesLoading && !cursor}
            isLoadingMore={isLoadingMore}
            nextCursor={messagesData?.next_cursor}
            onLoadMore={handleLoadMore}
            onRefresh={handleRefresh}
            workspace={workspace}
            size="small"
            visibleColumns={{
              id: false,
              external_id: false,
              contact_email: true,
              template_id: true,
              broadcast_id: false,
              list_id: false,
              events: true,
              error: true,
              created_at: true
            }}
          />
        ) : (
          <div className="text-slate-400 text-sm">{t`Workspace unavailable`}</div>
        )}
      </Drawer>
    </>
  )
}
