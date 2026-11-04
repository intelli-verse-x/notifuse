import React, { useState, useEffect } from 'react'
import { Segmented, Alert, Row, Col, Statistic, Space, Tooltip, Spin, Card } from 'antd'
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
import { ChartVisualization } from './ChartVisualization'
import { analyticsService, AnalyticsQuery, AnalyticsResponse } from '../../services/api/analytics'
import { Workspace } from '../../services/api/types'

interface EmailMetricsChartProps {
  workspace: Workspace
  timeRange?: [string, string]
  timezone?: string
}

type MessageTypeFilter = 'all' | 'broadcasts' | 'transactional'

export const EmailMetricsChart: React.FC<EmailMetricsChartProps> = ({
  workspace,
  timeRange = ['2024-01-01', '2024-12-31'],
  timezone
}) => {
  const { t } = useLingui()
  const [messageTypeFilter, setMessageTypeFilter] = useState<MessageTypeFilter>('all')
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [statsData, setStatsData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // State to track which chart lines are visible
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    count_sent: true,
    count_delivered: true,
    count_opened: true,
    count_clicked: true,
    count_bounced: true,
    count_complained: true,
    count_unsubscribed: true,
    count_failed: true
  })

  // Function to toggle line visibility
  const toggleLineVisibility = (measure: string) => {
    setVisibleLines((prev) => ({
      ...prev,
      [measure]: !prev[measure]
    }))
  }

  const buildQuery = (filter: MessageTypeFilter): AnalyticsQuery => {
    // Only include measures that are visible
    const visibleMeasures = [
      'count_sent',
      'count_delivered',
      'count_bounced',
      'count_complained',
      'count_opened',
      'count_clicked',
      'count_unsubscribed',
      'count_failed'
    ].filter((measure) => visibleLines[measure])

    const baseQuery: AnalyticsQuery = {
      schema: 'message_history',
      measures: visibleMeasures,
      dimensions: [],
      timezone: timezone || workspace.settings.timezone || 'UTC',
      timeDimensions: [
        {
          dimension: 'created_at',
          granularity: 'day',
          dateRange: timeRange
        }
      ],
      filters: []
    }

    // Add broadcast_id filter if not 'all'
    if (filter === 'broadcasts') {
      baseQuery.filters?.push({
        member: 'broadcast_id',
        operator: 'set',
        values: []
      })
    } else if (filter === 'transactional') {
      baseQuery.filters?.push({
        member: 'broadcast_id',
        operator: 'notSet',
        values: []
      })
    }

    return baseQuery
  }

  const buildStatsQuery = (filter: MessageTypeFilter): AnalyticsQuery => {
    // Stats query should always include all measures regardless of visibility
    const baseQuery: AnalyticsQuery = {
      schema: 'message_history',
      measures: [
        'count_sent',
        'count_delivered',
        'count_bounced',
        'count_complained',
        'count_opened',
        'count_clicked',
        'count_unsubscribed',
        'count_failed'
      ],
      dimensions: [],
      timezone: timezone || workspace.settings.timezone || 'UTC',
      timeDimensions: [
        {
          dimension: 'created_at',
          granularity: 'day', // We need granularity, but we'll aggregate the results
          dateRange: timeRange
        }
      ],
      filters: []
    }

    // Add broadcast_id filter if not 'all'
    if (filter === 'broadcasts') {
      baseQuery.filters?.push({
        member: 'broadcast_id',
        operator: 'set',
        values: []
      })
    } else if (filter === 'transactional') {
      baseQuery.filters?.push({
        member: 'broadcast_id',
        operator: 'notSet',
        values: []
      })
    }

    return baseQuery
  }

  const fetchData = async (filter: MessageTypeFilter) => {
    try {
      setLoading(true)
      setStatsLoading(true)
      setError(null)

      // Fetch both chart data and stats data in parallel
      const [chartResponse, statsResponse] = await Promise.all([
        analyticsService.query(buildQuery(filter), workspace.id),
        analyticsService.query(buildStatsQuery(filter), workspace.id)
      ])

      setData(chartResponse)
      setStatsData(statsResponse)
    } catch (err) {
      console.error('Failed to fetch email metrics:', err)
      setError(err instanceof Error ? err.message : t`Failed to fetch email metrics`)
    } finally {
      setLoading(false)
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    fetchData(messageTypeFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id, messageTypeFilter, timeRange, visibleLines])

  const handleFilterChange = (value: MessageTypeFilter) => {
    setMessageTypeFilter(value)
  }

  // Define the stats type
  interface EmailStats {
    count_sent: number
    count_delivered: number
    count_opened: number
    count_clicked: number
    count_bounced: number
    count_complained: number
    count_unsubscribed: number
    count_failed: number
  }

  // Helper function to safely convert unknown to number
  const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const parsed = parseFloat(value)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }

  // Extract and aggregate stats from the stats response (sum up all daily values)
  const stats: EmailStats = statsData?.data?.reduce<EmailStats>(
    (acc, row) => ({
      count_sent: acc.count_sent + toNumber(row.count_sent),
      count_delivered: acc.count_delivered + toNumber(row.count_delivered),
      count_opened: acc.count_opened + toNumber(row.count_opened),
      count_clicked: acc.count_clicked + toNumber(row.count_clicked),
      count_bounced: acc.count_bounced + toNumber(row.count_bounced),
      count_complained: acc.count_complained + toNumber(row.count_complained),
      count_unsubscribed: acc.count_unsubscribed + toNumber(row.count_unsubscribed),
      count_failed: acc.count_failed + toNumber(row.count_failed)
    }),
    {
      count_sent: 0,
      count_delivered: 0,
      count_opened: 0,
      count_clicked: 0,
      count_bounced: 0,
      count_complained: 0,
      count_unsubscribed: 0,
      count_failed: 0
    }
  ) || {
    count_sent: 0,
    count_delivered: 0,
    count_opened: 0,
    count_clicked: 0,
    count_bounced: 0,
    count_complained: 0,
    count_unsubscribed: 0,
    count_failed: 0
  }

  const getRate = (numerator: number, denominator: number) => {
    if (denominator === 0) return '-'
    const percentage = (numerator / denominator) * 100
    if (percentage === 0 || percentage >= 10) {
      return `${Math.round(percentage)}%`
    }
    return `${percentage.toFixed(1)}%`
  }

  // Formatter function for statistics that handles loading state
  const formatStat = (value: number | string) => {
    if (statsLoading) {
      return <Spin size="small" />
    }
    return value
  }

  // Admin sky palette — matches metric pill dots
  const chartColors = {
    count_sent: '#2457d6',
    count_delivered: '#1d9a6c',
    count_opened: '#7a5bff',
    count_clicked: '#0891b2',
    count_bounced: '#e2701f',
    count_complained: '#d97706',
    count_unsubscribed: '#e11d48',
    count_failed: '#c2410c'
  }

  // Define measure titles for tooltip display
  const measureTitles = {
    count_sent: t`Sent`,
    count_delivered: t`Delivered`,
    count_opened: t`Opens`,
    count_clicked: t`Clicks`,
    count_bounced: t`Bounced`,
    count_complained: t`Complaints`,
    count_unsubscribed: t`Unsubscribes`,
    count_failed: t`Failed`
  }

  return (
    <div className="mailstudio-card p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-[#e6ecf8]">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-[#0b1433] tracking-tight m-0">{t`Email Metrics`}</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-0">{t`Click metrics below to toggle chart lines`}</p>
        </div>
        <div className="w-full sm:w-auto overflow-x-auto">
          <Segmented
            value={messageTypeFilter}
            onChange={handleFilterChange}
            options={[
              { label: t`All Messages`, value: 'all' },
              { label: t`Broadcasts`, value: 'broadcasts' },
              { label: t`Transactional`, value: 'transactional' }
            ]}
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          message={t`Error`}
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Stats Row - 8 metric pills (Admin sky soft tints) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3 mb-4 sm:mb-6">
        {/* Sent */}
        <Tooltip title={!visibleLines.count_sent ? t`${stats.count_sent} total sent (hidden)` : t`${stats.count_sent} total sent`}>
          <div
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              visibleLines.count_sent
                ? 'bg-[#e8efff] border-[#9db6f0] shadow-sm'
                : 'bg-[#f2f6ff] border-[#e6ecf8] opacity-40 hover:opacity-70'
            }`}
            onClick={() => toggleLineVisibility('count_sent')}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2457d6] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#2457d6]"></span>
              {t`Sent`}
            </div>
            <div className="text-base font-bold text-[#0b1433]">
              {formatStat(stats.count_sent)}
            </div>
          </div>
        </Tooltip>

        {/* Delivered */}
        <Tooltip title={!visibleLines.count_delivered ? t`${stats.count_delivered} delivered (hidden)` : t`${stats.count_delivered} delivered`}>
          <div
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              visibleLines.count_delivered
                ? 'bg-[#e3f6ee] border-[#b7e5d0] shadow-sm'
                : 'bg-[#f2f6ff] border-[#e6ecf8] opacity-40 hover:opacity-70'
            }`}
            onClick={() => toggleLineVisibility('count_delivered')}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1d9a6c] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#1d9a6c]"></span>
              {t`Delivered`}
            </div>
            <div className="text-base font-bold text-[#0b1433]">
              {formatStat(getRate(stats.count_delivered, stats.count_sent))}
            </div>
          </div>
        </Tooltip>

        {/* Opens */}
        <Tooltip title={!visibleLines.count_opened ? t`${stats.count_opened} opens (hidden)` : t`${stats.count_opened} opens`}>
          <div
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              visibleLines.count_opened
                ? 'bg-[#f0ebff] border-[#c9b8ff] shadow-sm'
                : 'bg-[#f2f6ff] border-[#e6ecf8] opacity-40 hover:opacity-70'
            }`}
            onClick={() => toggleLineVisibility('count_opened')}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#7a5bff] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#7a5bff]"></span>
              {t`Opens`}
            </div>
            <div className="text-base font-bold text-[#0b1433]">
              {formatStat(getRate(stats.count_opened, stats.count_sent))}
            </div>
          </div>
        </Tooltip>

        {/* Clicks */}
        <Tooltip title={!visibleLines.count_clicked ? t`${stats.count_clicked} clicks (hidden)` : t`${stats.count_clicked} clicks`}>
          <div
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              visibleLines.count_clicked
                ? 'bg-[#e8f7fb] border-[#9ed6e8] shadow-sm'
                : 'bg-[#f2f6ff] border-[#e6ecf8] opacity-40 hover:opacity-70'
            }`}
            onClick={() => toggleLineVisibility('count_clicked')}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0891b2] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#0891b2]"></span>
              {t`Clicks`}
            </div>
            <div className="text-base font-bold text-[#0b1433]">
              {formatStat(getRate(stats.count_clicked, stats.count_sent))}
            </div>
          </div>
        </Tooltip>

        {/* Bounced */}
        <Tooltip title={!visibleLines.count_bounced ? t`${stats.count_bounced} bounced (hidden)` : t`${stats.count_bounced} bounced`}>
          <div
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              visibleLines.count_bounced
                ? 'bg-[#fff1e5] border-[#f0c49a] shadow-sm'
                : 'bg-[#f2f6ff] border-[#e6ecf8] opacity-40 hover:opacity-70'
            }`}
            onClick={() => toggleLineVisibility('count_bounced')}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e2701f] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#e2701f]"></span>
              {t`Bounced`}
            </div>
            <div className="text-base font-bold text-[#0b1433]">
              {formatStat(getRate(stats.count_bounced, stats.count_sent))}
            </div>
          </div>
        </Tooltip>

        {/* Complaints */}
        <Tooltip title={!visibleLines.count_complained ? t`${stats.count_complained} complaints (hidden)` : t`${stats.count_complained} complaints`}>
          <div
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              visibleLines.count_complained
                ? 'bg-[#fff8e8] border-[#f0d48a] shadow-sm'
                : 'bg-[#f2f6ff] border-[#e6ecf8] opacity-40 hover:opacity-70'
            }`}
            onClick={() => toggleLineVisibility('count_complained')}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#b45309] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#d97706]"></span>
              {t`Complaints`}
            </div>
            <div className="text-base font-bold text-[#0b1433]">
              {formatStat(getRate(stats.count_complained, stats.count_sent))}
            </div>
          </div>
        </Tooltip>

        {/* Unsubscribed */}
        <Tooltip title={!visibleLines.count_unsubscribed ? t`${stats.count_unsubscribed} unsubscribes (hidden)` : t`${stats.count_unsubscribed} unsubscribes`}>
          <div
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              visibleLines.count_unsubscribed
                ? 'bg-[#fef0f4] border-[#f5b8c8] shadow-sm'
                : 'bg-[#f2f6ff] border-[#e6ecf8] opacity-40 hover:opacity-70'
            }`}
            onClick={() => toggleLineVisibility('count_unsubscribed')}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e11d48] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#e11d48]"></span>
              {t`Unsub.`}
            </div>
            <div className="text-base font-bold text-[#0b1433]">
              {formatStat(getRate(stats.count_unsubscribed, stats.count_sent))}
            </div>
          </div>
        </Tooltip>

        {/* Failed */}
        <Tooltip title={!visibleLines.count_failed ? t`${stats.count_failed} failed (hidden)` : t`${stats.count_failed} failed`}>
          <div
            className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
              visibleLines.count_failed
                ? 'bg-[#fef2f2] border-[#f0b4a8] shadow-sm'
                : 'bg-[#f2f6ff] border-[#e6ecf8] opacity-40 hover:opacity-70'
            }`}
            onClick={() => toggleLineVisibility('count_failed')}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#c2410c] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#c2410c]"></span>
              {t`Failed`}
            </div>
            <div className="text-base font-bold text-[#0b1433]">
              {formatStat(getRate(stats.count_failed, stats.count_sent))}
            </div>
          </div>
        </Tooltip>
      </div>

      {/* Chart */}
      <div className="pt-2">
        <ChartVisualization
          data={data}
          chartType="line"
          query={buildQuery(messageTypeFilter)}
          loading={loading}
          error={error}
          height={240}
          showLegend={false}
          colors={chartColors}
          measureTitles={measureTitles}
        />
      </div>
    </div>
  )
}
