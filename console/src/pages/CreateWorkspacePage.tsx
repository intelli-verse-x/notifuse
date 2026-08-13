import { useState } from 'react'
import { Form, Input, Button, Tooltip, App } from 'antd'
import { useNavigate } from '@tanstack/react-router'
import { InfoCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { workspaceService } from '../services/api/workspace'
import { ApiError } from '../services/api/client'
import { useAuth } from '../contexts/AuthContext'
import { MainLayout, MainLayoutSidebar } from '../layouts/MainLayout'
import { getBrowserTimezone } from '../lib/timezoneNormalizer'
import { getBrowserLanguage } from '../lib/languages'
import { useLingui } from '@lingui/react/macro'

export function CreateWorkspacePage() {
  const { t } = useLingui()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const { refreshWorkspaces } = useAuth()
  const { message } = App.useApp()

  // Generate workspace ID from name (alphanumeric only, max 20 chars)
  const generateWorkspaceId = (name: string) => {
    if (!name) return ''
    // remove spaces and remove non-alphanumeric characters
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20)
  }

  // Update generated ID when name changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    const id = generateWorkspaceId(name)
    form.setFieldsValue({ id })
  }

  const onFinish = async (values: { name: string; id: string; website_url?: string }) => {
    try {
      setLoading(true)
      let logoUrl = null
      let coverUrl = null

      // If website URL is provided, detect favicon and cover image
      if (values.website_url) {
        try {
          const faviconResponse = await workspaceService.detectFavicon(values.website_url)
          logoUrl = faviconResponse.iconUrl
          coverUrl = faviconResponse.coverUrl || null
        } catch (error) {
          console.error('Error detecting website assets:', error)
          // Don't fail the whole process if detection fails
        }
      }

      // Get user's timezone (normalized to canonical IANA name)
      const timezone = getBrowserTimezone()
      const detectedLang = getBrowserLanguage()

      // Create workspace with API
      await workspaceService.create({
        id: generateWorkspaceId(values.id),
        name: values.name,
        settings: {
          website_url: values.website_url || '',
          logo_url: logoUrl,
          cover_url: coverUrl,
          timezone: timezone,
          email_tracking_enabled: true,
          default_language: detectedLang,
          languages: [detectedLang]
        }
      })

      await refreshWorkspaces()

      // Navigate to the new workspace
      message.success(t`Workspace "${values.name}" created successfully!`)
      // wait for the refreshWorkspaces to propagate the new workspaces list to the root layout
      window.setTimeout(() => {
        navigate({
          to: '/console/workspace/$workspaceId',
          params: { workspaceId: values.id }
        })
      }, 100)
    } catch (error) {
      console.error('Error creating workspace:', error)
      if (error instanceof ApiError && error.status === 403 && error.message.includes('workspace limit')) {
        message.error(t`Workspace limit reached. Please upgrade your plan to create more workspaces.`)
      } else {
        message.error(error instanceof Error ? error.message : t`Failed to create workspace`)
      }
      setLoading(false)
    }
  }

  const handleBackToDashboard = () => {
    navigate({ to: '/console' })
  }

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4 sm:p-6">
        <div className="w-full max-w-lg p-6 sm:p-8 rounded-2xl bg-slate-900/85 backdrop-blur-2xl border border-slate-800/90 shadow-2xl shadow-indigo-950/40">
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <Button
                type="text"
                icon={<ArrowLeftOutlined className="text-slate-400" />}
                onClick={handleBackToDashboard}
                className="hover:bg-slate-800 text-slate-300"
              />
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight leading-tight m-0">{t`New Workspace`}</h2>
                <p className="text-xs text-slate-400 m-0">{t`Set up a new workspace for your team`}</p>
              </div>
            </div>
          </div>

          <Form
            name="create-workspace"
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            form={form}
            initialValues={{ id: '' }}
            size="large"
          >
            <Form.Item
              label={<span className="text-slate-300 font-medium text-xs">{t`Workspace Name`}</span>}
              name="name"
              rules={[
                { required: true, message: t`Please enter a workspace name` },
                { min: 3, message: t`Workspace name must be at least 3 characters long` }
              ]}
            >
              <Input placeholder={t`Enter a name for your workspace`} onChange={handleNameChange} className="rounded-lg" />
            </Form.Item>

            <Form.Item
              label={
                <span className="text-slate-300 font-medium text-xs">
                  {t`Workspace ID`}&nbsp;
                  <Tooltip title={t`This ID will be used in URLs and API requests. It can only contain lowercase letters and numbers.`}>
                    <InfoCircleOutlined className="text-slate-400" />
                  </Tooltip>
                </span>
              }
              name="id"
              rules={[
                { required: true, message: t`Workspace ID is required` },
                {
                  pattern: /^[a-z0-9]+$/,
                  message: t`ID can only contain lowercase letters and numbers`
                }
              ]}
            >
              <Input
                placeholder="workspaceid"
                className="rounded-lg"
                suffix={
                  <Tooltip title={t`ID is automatically generated but can be modified if needed`}>
                    <InfoCircleOutlined style={{ color: 'rgba(255,255,255,.45)' }} />
                  </Tooltip>
                }
              />
            </Form.Item>

            <Form.Item
              label={<span className="text-slate-300 font-medium text-xs">{t`Website URL`}</span>}
              name="website_url"
              rules={[
                {
                  pattern: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
                  message: t`Please enter a valid URL`,
                  validateTrigger: 'onBlur'
                }
              ]}
              extra={<span className="text-xs text-slate-400">{t`We'll automatically detect and use your website's favicon`}</span>}
            >
              <Input placeholder="https://example.com" className="rounded-lg" />
            </Form.Item>

            <Form.Item className="mb-0 mt-6">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                className="font-semibold shadow-lg shadow-indigo-500/20"
              >
                {t`Create Workspace`}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </MainLayout>
  )
}
