import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Tooltip,
  Button,
  Modal,
  Input,
  App,
  Badge,
  Progress,
  Popover,
  Alert,
  Popconfirm,
  Pagination
} from 'antd'
import { useParams } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import { broadcastApi, Broadcast, TestResultsResponse } from '../services/api/broadcast'
import { listsApi } from '../services/api/list'
import { taskApi } from '../services/api/task'
import { listSegments } from '../services/api/segment'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCirclePause,
  faPenToSquare,
  faTrashCan,
  faCirclePlay,
  faCopy,
  faEye,
  faCircleQuestion,
  faPaperPlane
} from '@fortawesome/free-regular-svg-icons'
import { faBan, faSpinner, faRefresh } from '@fortawesome/free-solid-svg-icons'
import React, { useState } from 'react'
import dayjs from '../lib/dayjs'
import { UpsertBroadcastDrawer } from '../components/broadcasts/UpsertBroadcastDrawer'
import { SendOrScheduleModal } from '../components/broadcasts/SendOrScheduleModal'
import { useAuth, useWorkspacePermissions } from '../contexts/AuthContext'
import TemplatePreviewDrawer from '../components/templates/TemplatePreviewDrawer'
import { BroadcastStats, ProgressStats } from '../components/broadcasts/BroadcastStats'
import { SendingProgress } from '../components/broadcasts/SendingProgress'
import { List } from '../services/api/types'
import SendTemplateModal from '../components/templates/SendTemplateModal'
import { Workspace, UserPermissions } from '../services/api/types'
import { Template } from '../services/api/template'
import { Template as BroadcastTemplate } from '../services/api/broadcast'

const { Text } = Typography

// Helper to convert broadcast Template to template Template
const toTemplateApiType = (template: BroadcastTemplate): Template => {
  return template as unknown as Template
}

// Helper function to calculate remaining test time
const getRemainingTestTime = (broadcast: Broadcast, testResults?: TestResultsResponse) => {
  if (
    broadcast.status !== 'testing' ||
    !broadcast.test_settings.enabled ||
    !broadcast.test_settings.test_duration_hours
  ) {
    return null
  }

  // Use test_started_at from testResults if available, otherwise use test_sent_at from broadcast
  const testStartTime = testResults?.test_started_at || broadcast.test_sent_at
  if (!testStartTime || typeof testStartTime !== 'string') {
    return null
  }

  const startTime = dayjs(testStartTime)
  const endTime = startTime.add(broadcast.test_settings.test_duration_hours, 'hours')
  const now = dayjs()

  if (now.isAfter(endTime)) {
    return null // Don't show anything if expired
  }

  // Use dayjs .to() method for natural time formatting
  return now.to(endTime, true) + ' remaining'
}

// Helper function to get status badge with tooltips
const getStatusBadge = (
  broadcast: Broadcast,
  remainingTime?: string | null,
  progressStats?: ProgressStats,
  t?: (strings: TemplateStringsArray, ...values: unknown[]) => string
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const translate = t || ((s: TemplateStringsArray) => s[0] as any)
  switch (broadcast.status) {
    case 'draft':
      return (
        <Tooltip title={translate`This broadcast is a draft and has not been scheduled or sent yet.`}>
          <span>
            <Badge status="default" text={translate`Draft`} />
          </span>
        </Tooltip>
      )
    case 'scheduled':
      return (
        <Tooltip title={translate`This broadcast is scheduled and will start sending at the specified time.`}>
          <span>
            <Badge status="processing" text={translate`Scheduled`} />
          </span>
        </Tooltip>
      )
    case 'processing':
      return (
        <Tooltip title={translate`Preparing emails for delivery. Contacts are being added to the sending queue.`}>
          <span>
            <Badge status="processing" text={translate`Preparing...`} />
          </span>
        </Tooltip>
      )
    case 'paused':
      return (
        <Tooltip
          title={broadcast.pause_reason || translate`Sending has been paused. You can resume at any time.`}
        >
          <Space size="small">
            <Badge status="warning" text={translate`Paused`} />
            {broadcast.pause_reason && (
              <FontAwesomeIcon
                icon={faCircleQuestion}
                className="text-orange-500 cursor-help"
                style={{ opacity: 0.7 }}
              />
            )}
          </Space>
        </Tooltip>
      )
    case 'processed': {
      if (progressStats && progressStats.remaining > 0) {
        const tooltipText = translate`Emails are being delivered. ${progressStats.processed.toLocaleString()} sent, ${progressStats.remaining.toLocaleString()} remaining.`
        return (
          <Tooltip title={tooltipText}>
            <span>
              <Badge
                status="warning"
                text={translate`Sending ${progressStats.remaining.toLocaleString()} remaining`}
              />
            </span>
          </Tooltip>
        )
      }
      const completeTooltip = progressStats
        ? translate`All ${progressStats.enqueuedCount.toLocaleString()} emails have been processed.`
        : translate`All emails have been sent.`
      return (
        <Tooltip title={completeTooltip}>
          <span>
            <Badge status="success" text={translate`Complete`} />
          </span>
        </Tooltip>
      )
    }
    case 'cancelled':
      return (
        <Tooltip title={translate`This broadcast was cancelled before completion.`}>
          <span>
            <Badge status="error" text={translate`Cancelled`} />
          </span>
        </Tooltip>
      )
    case 'failed':
      return (
        <Tooltip title={translate`This broadcast failed due to an error. Check the logs for details.`}>
          <span>
            <Badge status="error" text={translate`Failed`} />
          </span>
        </Tooltip>
      )
    case 'testing':
      return (
        <Tooltip title={translate`A/B test is in progress. Emails are being sent to the test group.`}>
          <Space size="small">
            <Badge status="processing" text={translate`A/B Testing`} />
            {remainingTime && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                ({remainingTime})
              </Text>
            )}
          </Space>
        </Tooltip>
      )
    case 'test_completed':
      return (
        <Tooltip title={translate`A/B test has completed. Select a winner to send to the remaining recipients.`}>
          <span>
            <Badge status="success" text={translate`Test Completed`} />
          </span>
        </Tooltip>
      )
    case 'winner_selected':
      return (
        <Tooltip title={translate`A winner has been selected. Emails are being sent to the remaining recipients.`}>
          <span>
            <Badge status="success" text={translate`Winner Selected`} />
          </span>
        </Tooltip>
      )
    default:
      return <Badge status="default" text={broadcast.status} />
  }
}

// Component for rendering a single broadcast card
interface BroadcastCardProps {
  broadcast: Broadcast
  lists: List[]
  segments: { id: string; name: string; color: string; users_count?: number }[]
  workspaceId: string
  onDelete: (broadcast: Broadcast) => void
  onPause: (broadcast: Broadcast) => void
  onResume: (broadcast: Broadcast) => void
  onCancel: (broadcast: Broadcast) => void
  onSchedule: (broadcast: Broadcast) => void
  onRefresh: (broadcast: Broadcast) => void
  currentWorkspace: Workspace | undefined
  permissions: UserPermissions | null
}

const BroadcastCard: React.FC<BroadcastCardProps> = ({
  broadcast,
  lists,
  segments,
  workspaceId,
  onDelete,
  onPause,
  onResume,
  onCancel,
  onSchedule,
  onRefresh,
  currentWorkspace,
  permissions
}) => {
  const { t } = useLingui()
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [templateToTest, setTemplateToTest] = useState<Template | null>(null)
  const [progressStats, setProgressStats] = useState<ProgressStats | undefined>()

  // Fetch task associated with this broadcast
  const { data: task, isLoading: isTaskLoading } = useQuery({
    queryKey: ['task', workspaceId, broadcast.id],
    queryFn: () => {
      return taskApi.findByBroadcastId(workspaceId, broadcast.id)
    },
    // Only fetch task data if the broadcast status indicates a task might exist
    // enabled: ['scheduled', 'processing', 'paused', 'failed'].includes(broadcast.status),
    refetchInterval:
      broadcast.status === 'processing'
        ? 5000 // Refetch every 5 seconds for processing broadcasts
        : broadcast.status === 'scheduled'
          ? 30000 // Refetch every 30 seconds for scheduled broadcasts
          : broadcast.status === 'processed'
            ? 10000 // Mid-drain (Phase 2): poll every 10s while remaining > 0
            : false // Don't auto-refetch for terminal statuses
  })

  // Fetch test results if broadcast has A/B testing enabled and is in testing phase
  const { data: testResults } = useQuery({
    queryKey: ['testResults', workspaceId, broadcast.id],
    queryFn: () => {
      return broadcastApi.getTestResults({
        workspace_id: workspaceId,
        id: broadcast.id
      })
    },
    enabled:
      broadcast.test_settings.enabled &&
      ['testing', 'test_completed', 'winner_selected'].includes(broadcast.status),
    refetchInterval: broadcast.status === 'testing' ? 10000 : false // Refetch every 10 seconds during testing
  })

  // Calculate remaining test time
  const remainingTestTime = getRemainingTestTime(broadcast, testResults)

  // Get enqueued count from task state
  const enqueuedCount = task?.state?.send_broadcast?.enqueued_count

  // Handler for testing a template
  const handleTestTemplate = (template: Template) => {
    setTemplateToTest(template)
    setTestModalOpen(true)
  }

  // Helper function to render task status badge
  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge status="processing" text={t`Pending`} />
      case 'running':
        return <Badge status="processing" text={t`Running`} />
      case 'completed':
        return <Badge status="success" text={t`Completed`} />
      case 'failed':
        return <Badge status="error" text={t`Failed`} />
      case 'cancelled':
        return <Badge status="warning" text={t`Cancelled`} />
      case 'paused':
        return <Badge status="warning" text={t`Paused`} />
      default:
        return <Badge status="default" text={status} />
    }
  }

  // Create popover content for details
  const taskPopoverContent = () => {
    if (!task) return null

    return (
      <div className="max-w-xs">
        <div className="mb-2">
          <div className="font-medium text-gray-500">{t`Status`}</div>
          <div>{getTaskStatusBadge(task.status)}</div>
        </div>

        {task.next_run_after && task.status !== 'completed' && (
          <div className="mb-2">
            <div className="font-medium text-gray-500">{t`Next Run`}</div>
            <div className="text-sm">
              {task.status === 'paused' ? (
                <Tooltip title={dayjs(task.next_run_after).format('lll')}>
                  <span className="text-orange-600">{dayjs(task.next_run_after).fromNow()}</span>
                </Tooltip>
              ) : task.status === 'pending' ? (
                <Tooltip title={dayjs(task.next_run_after).format('lll')}>
                  <span className="text-blue-600">{dayjs(task.next_run_after).fromNow()}</span>
                </Tooltip>
              ) : (
                <Tooltip title={dayjs(task.next_run_after).format('lll')}>
                  <span>{dayjs(task.next_run_after).fromNow()}</span>
                </Tooltip>
              )}
            </div>
          </div>
        )}

        {(task.progress > 0 || task.state?.send_broadcast) && (
          <div className="mb-2">
            <div className="font-medium text-gray-500">{t`Progress`}</div>
            <Progress
              percent={Math.round(
                task.state?.send_broadcast
                  ? (task.state.send_broadcast.enqueued_count /
                      task.state.send_broadcast.total_recipients) *
                      100
                  : task.progress * 100
              )}
              size="small"
            />
          </div>
        )}

        {task.state?.message && (
          <div className="mb-2">
            <div className="font-medium text-gray-500">{t`Message`}</div>
            <div>{task.state.message}</div>
          </div>
        )}

        {task.state?.send_broadcast && task.state.send_broadcast.failed_count > 0 && (
          <div className="mb-2">
            <div className="font-medium text-gray-500">{t`Failed`}</div>
            <div className="text-sm text-red-500">{task.state.send_broadcast.failed_count}</div>
          </div>
        )}

        {task.error_message && (
          <div className="mb-2">
            <div className="font-medium text-gray-500">{t`Error`}</div>
            <div className="text-red-500 text-sm">{task.error_message}</div>
          </div>
        )}

        {task.type && <div className="text-xs text-gray-500 mt-2">{t`Task type:`} {task.type}</div>}
      </div>
    )
  }

  return (
    <div className="mailstudio-card overflow-hidden mb-6">
      <Card
        variant="borderless"
        styles={{
          header: {
            background: 'transparent',
            borderBottom: '1px solid #e6ecf8',
            padding: '12px 16px'
          },
          body: {
            padding: 0,
            background: 'transparent'
          }
        }}
        title={
          <div className="min-w-0 flex flex-col gap-1 py-0.5">
            <Space size="large" className="min-w-0">
              <div className="text-[#0b1433] font-medium truncate">{broadcast.name}</div>
              <div className="text-xs font-normal shrink-0">
                {task ? (
                  <Popover
                    content={taskPopoverContent}
                    title={t`Task Status`}
                    placement="bottom"
                    trigger="hover"
                  >
                    <span className="cursor-help">
                      {getStatusBadge(broadcast, remainingTestTime, progressStats, t)}
                      <FontAwesomeIcon
                        icon={faCircleQuestion}
                        style={{ opacity: 0.7 }}
                        className="ml-2"
                      />
                    </span>
                  </Popover>
                ) : isTaskLoading ? (
                  <span className="text-gray-400">
                    {getStatusBadge(broadcast, remainingTestTime, progressStats, t)}
                    <FontAwesomeIcon icon={faSpinner} spin className="ml-2" />
                  </span>
                ) : (
                  getStatusBadge(broadcast, remainingTestTime, progressStats, t)
                )}
              </div>
            </Space>
            {(() => {
              if (broadcast.completed_at) {
                return (
                  <Text type="secondary" className="text-xs">
                    {t`Completed`} {dayjs(broadcast.completed_at).format('lll')}
                  </Text>
                )
              }
              if (broadcast.started_at) {
                return (
                  <Text type="secondary" className="text-xs">
                    {t`Started`} {dayjs(broadcast.started_at).format('lll')}
                  </Text>
                )
              }
              if (
                broadcast.schedule?.is_scheduled &&
                broadcast.schedule.scheduled_date &&
                broadcast.schedule.scheduled_time
              ) {
                const scheduledAt = dayjs(
                  `${broadcast.schedule.scheduled_date} ${broadcast.schedule.scheduled_time}`
                )
                return (
                  <Text type="secondary" className="text-xs">
                    {t`Scheduled`} {scheduledAt.format('lll')}
                    {broadcast.schedule.timezone ? ` (${broadcast.schedule.timezone})` : ''}
                  </Text>
                )
              }
              if (broadcast.created_at) {
                return (
                  <Text type="secondary" className="text-xs">
                    {t`Created`} {dayjs(broadcast.created_at).format('lll')}
                  </Text>
                )
              }
              return null
            })()}
          </div>
        }
        extra={
          <Space>
          <Tooltip title={t`Refresh Broadcast`}>
            <Button
              type="text"
              size="small"
              icon={<FontAwesomeIcon icon={faRefresh} />}
              onClick={() => onRefresh(broadcast)}
              className="opacity-70 hover:opacity-100"
            />
          </Tooltip>
          {(broadcast.status === 'draft' || broadcast.status === 'scheduled') && (
            <Tooltip
              title={
                !permissions?.broadcasts?.write
                  ? t`You don't have write permission for broadcasts`
                  : t`Edit Broadcast`
              }
            >
              <div>
                {currentWorkspace && (
                  <UpsertBroadcastDrawer
                    workspace={currentWorkspace}
                    broadcast={broadcast}
                    lists={lists}
                    segments={segments}
                    buttonContent={<FontAwesomeIcon icon={faPenToSquare} style={{ opacity: 0.7 }} />}
                    buttonProps={{
                      size: 'small',
                      type: 'text',
                      disabled: !permissions?.broadcasts?.write
                    }}
                  />
                )}
              </div>
            </Tooltip>
          )}
          {(broadcast.status === 'processing' ||
            (broadcast.status === 'processed' && (progressStats?.remaining ?? 0) > 0)) && (
            <Tooltip
              title={
                !permissions?.broadcasts?.write
                  ? t`You don't have write permission for broadcasts`
                  : t`Pause Broadcast`
              }
            >
              <Popconfirm
                title={t`Pause broadcast?`}
                description={t`The broadcast will stop sending and can be resumed later.`}
                onConfirm={() => onPause(broadcast)}
                okText={t`Yes, pause`}
                cancelText={t`Cancel`}
                disabled={!permissions?.broadcasts?.write}
              >
                <Button type="text" size="small" disabled={!permissions?.broadcasts?.write}>
                  <FontAwesomeIcon icon={faCirclePause} style={{ opacity: 0.7 }} />
                </Button>
              </Popconfirm>
            </Tooltip>
          )}
          {broadcast.status === 'paused' && (
            <Tooltip
              title={
                !permissions?.broadcasts?.write
                  ? t`You don't have write permission for broadcasts`
                  : t`Resume Broadcast`
              }
            >
              <Popconfirm
                title={t`Resume broadcast?`}
                description={t`The broadcast will continue sending from where it was paused.`}
                onConfirm={() => onResume(broadcast)}
                okText={t`Yes, resume`}
                cancelText={t`Cancel`}
                disabled={!permissions?.broadcasts?.write}
              >
                <Button type="text" size="small" disabled={!permissions?.broadcasts?.write}>
                  <FontAwesomeIcon icon={faCirclePlay} style={{ opacity: 0.7 }} />
                </Button>
              </Popconfirm>
            </Tooltip>
          )}
          {(broadcast.status === 'scheduled' ||
            broadcast.status === 'paused' ||
            broadcast.status === 'processing' ||
            (broadcast.status === 'processed' && (progressStats?.remaining ?? 0) > 0)) && (
            <Tooltip
              title={
                !permissions?.broadcasts?.write
                  ? t`You don't have write permission for broadcasts`
                  : t`Cancel Broadcast`
              }
            >
              <Popconfirm
                title={t`Cancel broadcast?`}
                description={t`Queued emails will not be sent. In-flight sends will complete.`}
                onConfirm={() => onCancel(broadcast)}
                okText={t`Yes, cancel`}
                cancelText={t`No`}
                disabled={!permissions?.broadcasts?.write}
              >
                <Button type="text" size="small" disabled={!permissions?.broadcasts?.write}>
                  <FontAwesomeIcon icon={faBan} style={{ opacity: 0.7 }} />
                </Button>
              </Popconfirm>
            </Tooltip>
          )}
          {broadcast.status === 'draft' && (
            <>
              <Tooltip
                title={
                  !permissions?.broadcasts?.write
                    ? t`You don't have write permission for broadcasts`
                    : t`Delete Broadcast`
                }
              >
                <Button
                  type="text"
                  size="small"
                  onClick={() => onDelete(broadcast)}
                  disabled={!permissions?.broadcasts?.write}
                >
                  <FontAwesomeIcon icon={faTrashCan} style={{ opacity: 0.7 }} />
                </Button>
              </Tooltip>
              <Tooltip
                title={
                  !permissions?.broadcasts?.write
                    ? t`You don't have write permission for broadcasts`
                    : undefined
                }
              >
                <Button
                  type="primary"
                  size="small"
                  ghost
                  disabled={
                    !permissions?.broadcasts?.write ||
                    !currentWorkspace?.settings?.marketing_email_provider_id
                  }
                  onClick={() => onSchedule(broadcast)}
                >
                  {t`Send or Schedule`}
                </Button>
              </Tooltip>
            </>
          )}
        </Space>
      }
      key={broadcast.id}
    >
      <div className="p-6">
        {/* Show progress bar when sending */}
        {broadcast.status === 'processed' &&
          enqueuedCount &&
          progressStats &&
          progressStats.remaining > 0 && (
            <SendingProgress
              enqueuedCount={enqueuedCount}
              sentCount={progressStats.sentCount}
              failedCount={progressStats.failedCount}
              startedAt={broadcast.started_at}
            />
          )}
        <BroadcastStats
          workspaceId={workspaceId}
          broadcastId={broadcast.id}
          workspace={currentWorkspace}
          enqueuedCount={enqueuedCount}
          broadcastStatus={broadcast.status}
          onStatsUpdate={setProgressStats}
        />
      </div>

      {/* Variations / Audience / advanced details hidden for a simpler campaign card.
          Sent + Opens stay in BroadcastStats above. Preview / test icons stay on the card. */}
      {(() => {
        const primaryTemplate = broadcast.test_settings.variations?.[0]?.template
        if (!primaryTemplate || !currentWorkspace) return null
        return (
          <div className="border-t border-[#e6ecf8] px-6 py-3 flex items-center justify-end gap-1">
            <Tooltip
              title={
                !(permissions?.templates?.read && permissions?.contacts?.write)
                  ? t`You need read template and write contact permissions to send test emails`
                  : t`Send Test Email`
              }
            >
              <Button
                size="small"
                type="text"
                icon={<FontAwesomeIcon icon={faPaperPlane} className="opacity-70" />}
                onClick={() => handleTestTemplate(toTemplateApiType(primaryTemplate))}
                disabled={!(permissions?.templates?.read && permissions?.contacts?.write)}
              />
            </Tooltip>
            <Tooltip title={t`Preview Template`}>
              <span>
                <TemplatePreviewDrawer
                  record={toTemplateApiType(primaryTemplate)}
                  workspace={currentWorkspace}
                >
                  <Button
                    size="small"
                    type="text"
                    ghost
                    icon={<FontAwesomeIcon icon={faEye} className="opacity-70" />}
                  />
                </TemplatePreviewDrawer>
              </span>
            </Tooltip>
          </div>
        )
      })()}

      {/* Test Template Modal */}
      {currentWorkspace && (
        <SendTemplateModal
          isOpen={testModalOpen}
          onClose={() => setTestModalOpen(false)}
          template={templateToTest}
          workspace={currentWorkspace}
        />
      )}
    </Card>
    </div>
  )
}

export function BroadcastsPage() {
  const { t } = useLingui()
  const { workspaceId } = useParams({ from: '/console/workspace/$workspaceId/broadcasts' })
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [broadcastToDelete, setBroadcastToDelete] = useState<Broadcast | null>(null)
  const [confirmationInput, setConfirmationInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false)
  const [broadcastToSchedule, setBroadcastToSchedule] = useState<Broadcast | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(5)
  const queryClient = useQueryClient()
  const { workspaces } = useAuth()
  const { permissions } = useWorkspacePermissions(workspaceId)
  const { message } = App.useApp()

  // Find the current workspace from the workspaces array
  const currentWorkspace = workspaces.find((workspace) => workspace.id === workspaceId)

  const { data, isLoading } = useQuery({
    queryKey: ['broadcasts', workspaceId, currentPage, pageSize],
    queryFn: () => {
      return broadcastApi.list({
        workspace_id: workspaceId,
        with_templates: true,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
      })
    }
  })

  // Fetch lists for the current workspace
  const { data: listsData } = useQuery({
    queryKey: ['lists', workspaceId],
    queryFn: () => {
      return listsApi.list({ workspace_id: workspaceId, with_templates: true })
    }
  })

  const lists = listsData?.lists || []

  // Fetch segments for the current workspace
  const { data: segmentsData } = useQuery({
    queryKey: ['segments', workspaceId],
    queryFn: () => {
      return listSegments({ workspace_id: workspaceId, with_count: true })
    }
  })

  const segments = segmentsData?.segments || []

  const handleDeleteBroadcast = async () => {
    if (!broadcastToDelete) return

    setIsDeleting(true)
    try {
      await broadcastApi.delete({
        workspace_id: workspaceId,
        id: broadcastToDelete.id
      })

      message.success(t`Broadcast "${broadcastToDelete.name}" deleted successfully`)
      queryClient.invalidateQueries({
        queryKey: ['broadcasts', workspaceId, currentPage, pageSize]
      })

      // If we're on a page > 1 and this was the last item on the page, go to previous page
      if (currentPage > 1 && data?.broadcasts.length === 1) {
        setCurrentPage(currentPage - 1)
      }
      setDeleteModalVisible(false)
      setBroadcastToDelete(null)
      setConfirmationInput('')
    } catch (error) {
      message.error(t`Failed to delete broadcast`)
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePauseBroadcast = async (broadcast: Broadcast) => {
    try {
      await broadcastApi.pause({
        workspace_id: workspaceId,
        id: broadcast.id
      })
      message.success(t`Broadcast "${broadcast.name}" paused successfully`)
      queryClient.invalidateQueries({
        queryKey: ['broadcasts', workspaceId, currentPage, pageSize]
      })
    } catch (error) {
      message.error(t`Failed to pause broadcast`)
      console.error(error)
    }
  }

  const handleResumeBroadcast = async (broadcast: Broadcast) => {
    try {
      await broadcastApi.resume({
        workspace_id: workspaceId,
        id: broadcast.id
      })
      message.success(t`Broadcast "${broadcast.name}" resumed successfully`)
      queryClient.invalidateQueries({
        queryKey: ['broadcasts', workspaceId, currentPage, pageSize]
      })
    } catch (error) {
      message.error(t`Failed to resume broadcast`)
      console.error(error)
    }
  }

  const handleCancelBroadcast = async (broadcast: Broadcast) => {
    try {
      await broadcastApi.cancel({
        workspace_id: workspaceId,
        id: broadcast.id
      })
      message.success(t`Broadcast "${broadcast.name}" cancelled successfully`)
      queryClient.invalidateQueries({
        queryKey: ['broadcasts', workspaceId, currentPage, pageSize]
      })
    } catch (error) {
      message.error(t`Failed to cancel broadcast`)
      console.error(error)
    }
  }

  const openDeleteModal = (broadcast: Broadcast) => {
    setBroadcastToDelete(broadcast)
    setDeleteModalVisible(true)
  }

  const closeDeleteModal = () => {
    setDeleteModalVisible(false)
    setBroadcastToDelete(null)
    setConfirmationInput('')
  }

  const handleScheduleBroadcast = (broadcast: Broadcast) => {
    setBroadcastToSchedule(broadcast)
    setIsScheduleModalVisible(true)
  }

  const closeScheduleModal = () => {
    setIsScheduleModalVisible(false)
    setBroadcastToSchedule(null)
  }

  const handleRefreshBroadcast = (broadcast: Broadcast) => {
    // Refresh specific broadcast data
    queryClient.invalidateQueries({ queryKey: ['broadcast-stats', workspaceId, broadcast.id] })
    queryClient.invalidateQueries({ queryKey: ['task', workspaceId, broadcast.id] })
    queryClient.invalidateQueries({ queryKey: ['testResults', workspaceId, broadcast.id] })
    // Also refresh the main broadcast data to get updated status
    queryClient.invalidateQueries({ queryKey: ['broadcasts', workspaceId, currentPage, pageSize] })
    message.success(t`Broadcast "${broadcast.name}" refreshed`)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasBroadcasts = !isLoading && data?.broadcasts && data.broadcasts.length > 0
  const hasMarketingEmailProvider = currentWorkspace?.settings?.marketing_email_provider_id
  const broadcastCount = data?.total_count ?? data?.broadcasts?.length ?? 0

  return (
    <div className="p-6 space-y-4">
      {/* Campaigns header strip */}
      <div className="mailstudio-card px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-[#0b1433] m-0 tracking-tight">
                {t`Campaigns`}
              </h1>
              {!isLoading && (
                <span className="inline-flex items-center rounded-md border border-[#c7d2e8] bg-[#e8efff] px-2.5 py-0.5 text-xs font-medium text-[#2457d6]">
                  {broadcastCount}
                </span>
              )}
            </div>
            <p className="mt-1 mb-0 text-sm text-slate-400">
              {t`Schedule and send bulk email to your audiences`}
            </p>
          </div>
          {currentWorkspace && (
            <Tooltip
              title={
                !permissions?.broadcasts?.write
                  ? t`You don't have write permission for broadcasts`
                  : undefined
              }
            >
              <div>
                <UpsertBroadcastDrawer
                  workspace={currentWorkspace}
                  lists={lists}
                  segments={segments}
                  buttonContent={<>{t`Create campaign`}</>}
                  buttonProps={{
                    type: 'primary',
                    disabled: !permissions?.broadcasts?.write
                  }}
                />
              </div>
            </Tooltip>
          )}
        </div>
      </div>

      {!hasMarketingEmailProvider && (
        <Alert
          message={t`Email Provider Required`}
          description={t`You don't have a marketing email provider configured. Please set up an email provider in your workspace settings to send campaigns.`}
          type="warning"
          showIcon
          className="!mb-0"
          action={
            <Button
              type="primary"
              size="small"
              href={`/console/workspace/${workspaceId}/settings/integrations`}
            >
              {t`Configure Provider`}
            </Button>
          }
        />
      )}

      {isLoading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map((key) => (
            <Col xs={24} key={key}>
              <div className="mailstudio-card overflow-hidden">
                <Card loading variant="borderless" styles={{ body: { background: 'transparent' } }} />
              </div>
            </Col>
          ))}
        </Row>
      ) : hasBroadcasts ? (
        <div>
          {data.broadcasts.map((broadcast: Broadcast, index) => (
            <BroadcastCard
              key={broadcast.id}
              broadcast={broadcast}
              lists={lists}
              segments={segments}
              workspaceId={workspaceId}
              onDelete={openDeleteModal}
              onPause={handlePauseBroadcast}
              onResume={handleResumeBroadcast}
              onCancel={handleCancelBroadcast}
              onSchedule={handleScheduleBroadcast}
              onRefresh={handleRefreshBroadcast}
              currentWorkspace={currentWorkspace}
              permissions={permissions}
            />
          ))}

          {/* Pagination */}
          {data && data.total_count > pageSize && (
            <div className="flex justify-center mt-4">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={data.total_count}
                onChange={handlePageChange}
                showSizeChanger={false}
                showQuickJumper={false}
                showTotal={(total, range) => t`${range[0]}-${range[1]} of ${total} campaigns`}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="mailstudio-card px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-[#0b1433] m-0">{t`No campaigns yet`}</h2>
          <p className="mt-2 mb-6 text-sm text-slate-400">
            {t`Create your first campaign to schedule or send bulk email.`}
          </p>
          {currentWorkspace && (
            <Tooltip
              title={
                !permissions?.broadcasts?.write
                  ? t`You don't have write permission for broadcasts`
                  : undefined
              }
            >
              <div>
                <UpsertBroadcastDrawer
                  workspace={currentWorkspace}
                  lists={lists}
                  segments={segments}
                  buttonContent={t`Create campaign`}
                  buttonProps={{
                    type: 'primary',
                    size: 'large',
                    disabled: !permissions?.broadcasts?.write
                  }}
                />
              </div>
            </Tooltip>
          )}
        </div>
      )}

      <SendOrScheduleModal
        broadcast={broadcastToSchedule}
        visible={isScheduleModalVisible}
        onClose={closeScheduleModal}
        workspaceId={workspaceId}
        workspace={currentWorkspace}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: ['broadcasts', workspaceId, currentPage, pageSize]
          })
        }}
      />

      <Modal
        title={t`Delete Broadcast`}
        open={deleteModalVisible}
        onCancel={closeDeleteModal}
        footer={[
          <Button key="cancel" onClick={closeDeleteModal}>
            {t`Cancel`}
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            loading={isDeleting}
            disabled={confirmationInput !== (broadcastToDelete?.id || '')}
            onClick={handleDeleteBroadcast}
          >
            {t`Delete`}
          </Button>
        ]}
      >
        {broadcastToDelete && (
          <>
            <p>{t`Are you sure you want to delete the broadcast "${broadcastToDelete.name}"?`}</p>
            <p>
              {t`This action cannot be undone. To confirm, please enter the broadcast ID:`}{' '}
              <Text code>{broadcastToDelete.id}</Text>
              <Tooltip title={t`Copy to clipboard`}>
                <Button
                  type="text"
                  icon={<FontAwesomeIcon icon={faCopy} style={{ opacity: 0.7 }} />}
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(broadcastToDelete.id)
                    message.success(t`Broadcast ID copied to clipboard`)
                  }}
                />
              </Tooltip>
            </p>
            <Input
              placeholder={t`Enter broadcast ID to confirm`}
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              status={
                confirmationInput && confirmationInput !== broadcastToDelete.id ? 'error' : ''
              }
            />
            {confirmationInput && confirmationInput !== broadcastToDelete.id && (
              <p className="text-red-500 mt-2">{t`ID doesn't match`}</p>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
