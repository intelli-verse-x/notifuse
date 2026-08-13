import { useQuery } from '@tanstack/react-query'
import {
  Card,
  Row,
  Col,
  Tag,
  Typography,
  Space,
  Tooltip,
  Descriptions,
  Button,
  Divider,
  Modal,
  Input,
  message
} from 'antd'
import { useParams } from '@tanstack/react-router'
import { listsApi } from '../services/api/list'
import { templatesApi } from '../services/api/template'
import type { List, TemplateReference, Workspace } from '../services/api/types'
import { CreateListDrawer } from '../components/lists/ListDrawer'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPenToSquare, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faRefresh } from '@fortawesome/free-solid-svg-icons'
import { Check, X } from 'lucide-react'
import TemplatePreviewDrawer from '../components/templates/TemplatePreviewDrawer'
import { CreateTemplateDrawer } from '../components/templates/CreateTemplateDrawer'
import { useAuth, useWorkspacePermissions } from '../contexts/AuthContext'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImportContactsToListButton } from '../components/lists/ImportContactsToListButton'
import { ListStats } from '../components/lists/ListStats'
import { useLingui } from '@lingui/react/macro'
import numbro from 'numbro'

const { Text } = Typography

// Component to fetch template data and render the preview popover
const TemplatePreviewButton = ({
  templateRef,
  workspace
}: {
  templateRef: TemplateReference
  workspace: Workspace
}) => {
  const { t } = useLingui()
  const { data, isLoading } = useQuery({
    queryKey: ['template', workspace.id, templateRef.id, templateRef.version],
    queryFn: async () => {
      const response = await templatesApi.get({
        workspace_id: workspace.id,
        id: templateRef.id,
        version: templateRef.version
      })
      return response.template
    },
    enabled: !!templateRef && !!workspace.id,
    // No need to refetch often - template won't change
    staleTime: 1000 * 60 * 5 // 5 minutes
  })

  if (isLoading || !data) {
    return (
      <Button type="link" size="small" loading={isLoading}>
        {t`preview`}
      </Button>
    )
  }

  return (
    <Space>
      <TemplatePreviewDrawer record={data} workspace={workspace}>
        <Button type="link" size="small">
          {t`preview`}
        </Button>
      </TemplatePreviewDrawer>
      {workspace && (
        <CreateTemplateDrawer
          template={data}
          workspace={workspace}
          buttonContent={t`edit`}
          buttonProps={{ type: 'link', size: 'small' }}
        />
      )}
    </Space>
  )
}

export function ListsPage() {
  const { t } = useLingui()
  const { workspaceId } = useParams({ from: '/console/workspace/$workspaceId/lists' })
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [listToDelete, setListToDelete] = useState<List | null>(null)
  const [confirmationInput, setConfirmationInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const queryClient = useQueryClient()
  const { workspaces } = useAuth()
  const { permissions } = useWorkspacePermissions(workspaceId)
  const workspace = workspaces.find((w) => w.id === workspaceId)

  const { data, isLoading } = useQuery({
    queryKey: ['lists', workspaceId],
    queryFn: () => {
      return listsApi.list({ workspace_id: workspaceId })
    }
  })

  const handleDelete = async () => {
    if (!listToDelete) return

    setIsDeleting(true)
    try {
      await listsApi.delete({
        workspace_id: workspaceId,
        id: listToDelete.id
      })

      message.success(t`List "${listToDelete.name}" deleted successfully`)
      queryClient.invalidateQueries({ queryKey: ['lists', workspaceId] })
      setDeleteModalVisible(false)
      setListToDelete(null)
      setConfirmationInput('')
    } catch (error) {
      message.error(t`Failed to delete list`)
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  const openDeleteModal = (list: List) => {
    setListToDelete(list)
    setDeleteModalVisible(true)
  }

  const closeDeleteModal = () => {
    setDeleteModalVisible(false)
    setListToDelete(null)
    setConfirmationInput('')
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['lists', workspaceId] })
    message.success(t`Lists refreshed`)
  }

  const hasLists = !isLoading && data?.lists && data.lists.length > 0
  const listCount = data?.lists?.length ?? 0

  if (!workspace) {
    return <div>{t`Loading...`}</div>
  }

  return (
    <div className="p-6 space-y-4">
      {/* Recipient lists header strip */}
      <div className="mailstudio-card px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-slate-100 m-0 tracking-tight">
                {t`Recipient lists`}
              </h1>
              {!isLoading && (
                <span className="inline-flex items-center rounded-md border border-indigo-400/30 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-200">
                  {numbro(listCount).format({ thousandSeparated: true, mantissa: 0 })}
                </span>
              )}
            </div>
            <p className="mt-1 mb-0 text-sm text-slate-400">
              {t`Reusable groups for broadcasts and imports`}
            </p>
          </div>
          <Space wrap size="middle">
            <Tooltip title={t`Refresh`}>
              <Button
                icon={<FontAwesomeIcon icon={faRefresh} />}
                onClick={handleRefresh}
              >
                {t`Refresh`}
              </Button>
            </Tooltip>
            <Tooltip
              title={
                !permissions?.lists?.write ? t`You don't have write permission for lists` : undefined
              }
            >
              <div>
                <CreateListDrawer
                  workspaceId={workspaceId}
                  buttonProps={{
                    type: 'primary',
                    disabled: !permissions?.lists?.write,
                    buttonContent: t`Create list`
                  }}
                />
              </div>
            </Tooltip>
          </Space>
        </div>
      </div>

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
      ) : hasLists ? (
        <div className="flex flex-col gap-4">
          {data.lists.map((list: List) => (
            <div key={list.id} className="mailstudio-card overflow-hidden">
              <Card
                variant="borderless"
                styles={{
                  header: {
                    background: 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    padding: '12px 16px'
                  },
                  body: {
                    background: 'transparent',
                    padding: '16px'
                  }
                }}
                title={
                  <div className="flex items-center gap-2 min-w-0">
                    <Text strong className="!text-slate-100 truncate">
                      {list.name}
                    </Text>
                    {list.is_public ? (
                      <Tag bordered={false} color="green" className="!m-0">
                        {t`Public`}
                      </Tag>
                    ) : (
                      <Tag bordered={false} color="default" className="!m-0">
                        {t`Private`}
                      </Tag>
                    )}
                  </div>
                }
                extra={
                  <Space>
                    <Tooltip
                      title={
                        !permissions?.lists?.write
                          ? t`You don't have write permission for lists`
                          : t`Delete List`
                      }
                    >
                      <Button
                        type="text"
                        size="small"
                        onClick={() => openDeleteModal(list)}
                        disabled={!permissions?.lists?.write}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <FontAwesomeIcon icon={faTrashCan} style={{ opacity: 0.85 }} />
                      </Button>
                    </Tooltip>
                    <Tooltip
                      title={
                        !permissions?.lists?.write
                          ? t`You don't have write permission for lists`
                          : t`Edit List`
                      }
                    >
                      <div>
                        <CreateListDrawer
                          workspaceId={workspaceId}
                          list={list}
                          buttonProps={{
                            type: 'text',
                            size: 'small',
                            buttonContent: (
                              <FontAwesomeIcon icon={faPenToSquare} style={{ opacity: 0.85 }} />
                            ),
                            disabled: !permissions?.lists?.write
                          }}
                        />
                      </div>
                    </Tooltip>
                    <Tooltip
                      title={
                        !permissions?.lists?.write
                          ? t`You don't have write permission for lists`
                          : undefined
                      }
                    >
                      <div>
                        <ImportContactsToListButton
                          list={list}
                          workspaceId={workspaceId}
                          lists={data.lists}
                          disabled={!permissions?.lists?.write}
                        />
                      </div>
                    </Tooltip>
                  </Space>
                }
              >
                <ListStats workspaceId={workspaceId} listId={list.id} />

                <Divider className="!border-white/10 !my-4" />

                <Descriptions
                  size="small"
                  column={{ xs: 1, sm: 2 }}
                  className="mailstudio-list-meta"
                  labelStyle={{ color: '#94a3b8' }}
                  contentStyle={{ color: '#e2e8f0' }}
                >
                  <Descriptions.Item label={t`ID`}>{list.id}</Descriptions.Item>

                  <Descriptions.Item label={t`Description`}>
                    {list.description || <span className="text-slate-500">—</span>}
                  </Descriptions.Item>

                  {/* Double Opt-in Template */}
                  <Descriptions.Item label={t`Double Opt-in Template`}>
                    {list.double_optin_template ? (
                      <Space>
                        <Check size={16} className="text-green-500 mt-1" />
                        <TemplatePreviewButton
                          templateRef={list.double_optin_template}
                          workspace={workspace}
                        />
                      </Space>
                    ) : (
                      <X size={16} className="text-slate-500 mt-1" />
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <div className="mailstudio-card px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-slate-100 m-0">{t`No recipient lists yet`}</h2>
          <p className="mt-2 mb-6 text-sm text-slate-400">
            {t`Create a list to group people for broadcasts and imports.`}
          </p>
          <CreateListDrawer
            workspaceId={workspaceId}
            buttonProps={{
              type: 'primary',
              size: 'large',
              buttonContent: t`Create list`,
              disabled: !permissions?.lists?.write
            }}
          />
        </div>
      )}

      <Modal
        title={t`Delete List`}
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
            disabled={confirmationInput !== (listToDelete?.id || '')}
            onClick={handleDelete}
          >
            {t`Delete`}
          </Button>
        ]}
      >
        {listToDelete && (
          <>
            <p>{t`Are you sure you want to delete the list "${listToDelete.name}"?`}</p>
            <p>
              {t`This action cannot be undone. To confirm, please enter the list ID:`}{' '}
              <Text code>{listToDelete.id}</Text>
            </p>
            <Input
              placeholder={t`Enter list ID to confirm`}
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              status={confirmationInput && confirmationInput !== listToDelete.id ? 'error' : ''}
            />
            {confirmationInput && confirmationInput !== listToDelete.id && (
              <p className="text-red-500 mt-2">{t`ID doesn't match`}</p>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
