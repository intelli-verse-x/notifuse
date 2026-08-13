import { Tabs } from 'antd'
import { useParams, useSearch } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useLingui } from '@lingui/react/macro'
import { MessageHistoryTab } from '../components/messages/MessageHistoryTab'
import { InboundWebhookEventsTab } from '../components/webhooks/InboundWebhookEventsTab'
import { OutgoingWebhooksTab } from '../components/webhooks/OutgoingWebhooksTab'

export function LogsPage() {
  const { workspaceId } = useParams({ strict: false })
  const search = useSearch({ strict: false }) as { tab?: string }
  const queryClient = useQueryClient()
  const { t } = useLingui()

  if (!workspaceId) {
    return <div>{t`Loading...`}</div>
  }

  const handleRefreshInboundWebhookEvents = () => {
    queryClient.invalidateQueries({ queryKey: ['inbound-webhook-events', workspaceId] })
  }

  return (
    <div className="p-6 space-y-4">
      {/* Delivery log header strip */}
      <div className="mailstudio-card px-5 py-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-slate-100 m-0 tracking-tight">
            {t`Delivery log`}
          </h1>
          <p className="mt-1 mb-0 text-sm text-slate-400">
            {t`Monitor message delivery status and webhook events`}
          </p>
        </div>
      </div>

      {/* Tab control deck + content */}
      <div className="mailstudio-card overflow-hidden px-4 pt-3 pb-4">
        <Tabs
          defaultActiveKey={search.tab || 'messages'}
          items={[
            {
              key: 'messages',
              label: t`Message History`,
              children: <MessageHistoryTab workspaceId={workspaceId} />
            },
            {
              key: 'incoming-webhooks',
              label: t`Incoming Webhooks`,
              children: (
                <InboundWebhookEventsTab
                  workspaceId={workspaceId}
                  onRefresh={handleRefreshInboundWebhookEvents}
                />
              )
            },
            {
              key: 'outgoing-webhooks',
              label: t`Outgoing Webhooks`,
              children: <OutgoingWebhooksTab workspaceId={workspaceId} />
            }
          ]}
        />
      </div>
    </div>
  )
}
