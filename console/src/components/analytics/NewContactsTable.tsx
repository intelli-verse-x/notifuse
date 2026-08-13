import React, { useState, useEffect } from 'react'
import { Card, Button, Table, Tag, Space, Tooltip } from 'antd'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useLingui } from '@lingui/react/macro'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBan, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { faHourglass, faFaceFrown, faCircleCheck } from '@fortawesome/free-regular-svg-icons'
import { contactsApi, Contact, ListContactsRequest } from '../../services/api/contacts'
import { listsApi } from '../../services/api/list'
import { Workspace } from '../../services/api/types'
import dayjs from '../../lib/dayjs'

interface NewContactsTableProps {
  workspace: Workspace
}

export const NewContactsTable: React.FC<NewContactsTableProps> = ({ workspace }) => {
  const { t } = useLingui()
  const navigate = useNavigate()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch lists for the current workspace
  const { data: listsData } = useQuery({
    queryKey: ['lists', workspace.id],
    queryFn: () => listsApi.list({ workspace_id: workspace.id })
  })

  const buildParams = (): ListContactsRequest => ({
    workspace_id: workspace.id,
    limit: 5,
    with_contact_lists: true
  })

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = buildParams()
      const response = await contactsApi.list(params)
      setContacts(response.contacts)
    } catch (err) {
      console.error('Failed to fetch new contacts data:', err)
      setError(err instanceof Error ? err.message : t`Failed to fetch new contacts data`)
    } finally {
      setLoading(false)
    }
  }

  const handleViewMore = () => {
    navigate({
      to: '/console/workspace/$workspaceId/contacts',
      params: { workspaceId: workspace.id }
    })
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id])

  const columns = [
    {
      title: t`Email`,
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => (
        <div className="flex items-center">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center mr-2.5 shadow-md shadow-indigo-500/20">
            {(email || 'U').substring(0, 1).toUpperCase()}
          </div>
          <span className="text-xs font-semibold text-slate-200">{email}</span>
        </div>
      )
    },
    {
      title: t`Lists`,
      key: 'lists',
      render: (record: Contact) => (
        <Space direction="vertical" size={2}>
          {record.contact_lists.map(
            (list: { list_id: string; status?: string; created_at?: string }) => {
              let color = 'blue'
              let icon = null
              let statusText = ''

              // Match status to color and icon
              switch (list.status) {
                case 'active':
                  color = 'green'
                  icon = <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: '4px' }} />
                  statusText = t`Active subscriber`
                  break
                case 'pending':
                  color = 'blue'
                  icon = <FontAwesomeIcon icon={faHourglass} style={{ marginRight: '4px' }} />
                  statusText = t`Pending confirmation`
                  break
                case 'unsubscribed':
                  color = 'gray'
                  icon = <FontAwesomeIcon icon={faBan} style={{ marginRight: '4px' }} />
                  statusText = t`Unsubscribed from list`
                  break
                case 'bounced':
                  color = 'orange'
                  icon = (
                    <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: '4px' }} />
                  )
                  statusText = t`Email bounced`
                  break
                case 'complained':
                  color = 'red'
                  icon = <FontAwesomeIcon icon={faFaceFrown} style={{ marginRight: '4px' }} />
                  statusText = t`Marked as spam`
                  break
                default:
                  color = 'blue'
                  statusText = t`Status unknown`
                  break
              }

              // Find list name from listsData
              const listData = listsData?.lists?.find((l) => l.id === list.list_id)
              const listName = listData?.name || list.list_id

              // Format creation date if available using workspace timezone
              const creationDate = list.created_at
                ? dayjs(list.created_at).tz(workspace.settings.timezone).format('LL - HH:mm')
                : t`Unknown date`

              const tooltipTitle = (
                <>
                  <div>
                    <strong>{statusText}</strong>
                  </div>
                  <div>{t`Subscribed on`}: {creationDate}</div>
                  <div>
                    <small>{t`Timezone`}: {workspace.settings.timezone}</small>
                  </div>
                </>
              )

              return (
                <Tooltip key={list.list_id} title={tooltipTitle}>
                  <Tag
                    bordered={false}
                    color={color}
                    style={{ marginBottom: '2px' }}
                    className="text-xs rounded-md"
                  >
                    {icon}
                    {listName}
                  </Tag>
                </Tooltip>
              )
            }
          )}
        </Space>
      )
    },
    {
      title: t`Name`,
      key: 'name',
      render: (record: Contact) => {
        const name = [record.first_name, record.last_name].filter(Boolean).join(' ')
        return <span className="text-xs font-medium text-slate-300">{name || '-'}</span>
      }
    },
    {
      title: t`Language`,
      dataIndex: 'language',
      key: 'language',
      render: (language: string) => <span className="text-xs text-slate-400">{language || '-'}</span>
    },
    {
      title: t`Timezone`,
      dataIndex: 'timezone',
      key: 'timezone',
      render: (timezone: string) => <span className="text-xs text-slate-400">{timezone || '-'}</span>
    },
    {
      title: t`Country`,
      dataIndex: 'country',
      key: 'country',
      render: (country: string) => <span className="text-xs text-slate-400">{country || '-'}</span>
    },
    {
      title: t`Since`,
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => (
        <span
          className="text-xs font-medium text-slate-400"
          title={dayjs(date).tz(workspace.settings.timezone).format('lll')}
        >
          {dayjs(date).fromNow()}
        </span>
      )
    }
  ]

  return (
    <div className="mailstudio-card p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight m-0">{t`Recent New Contacts`}</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-0">{t`Latest subscribers and contacts joined`}</p>
        </div>
        <button
          onClick={handleViewMore}
          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
        >
          {t`View all contacts →`}
        </button>
      </div>

      {error ? (
        <div className="text-red-500 p-4 text-xs">
          <p>{t`Error`}: {error}</p>
        </div>
      ) : (
        <Table
          dataSource={contacts}
          columns={columns}
          rowKey="email"
          pagination={false}
          loading={loading}
          size="small"
          showHeader={true}
          scroll={{ x: 'max-content' }}
        />
      )}
    </div>
  )
}
