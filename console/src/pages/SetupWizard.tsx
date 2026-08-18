import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Input, Form, InputNumber, App, Divider, Row, Col, Collapse, Switch } from 'antd'
import { ApiOutlined, CheckOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { setupApi } from '../services/api/setup'
import type { SetupConfig } from '../types/setup'
import { getBrowserTimezone } from '../lib/timezoneNormalizer'
import { useLingui } from '@lingui/react/macro'
import { MainLayout } from '../layouts/MainLayout'

const setupCardClass =
  'w-full max-w-3xl p-8 rounded-2xl bg-slate-900/80 backdrop-blur-2xl border border-slate-800/90 shadow-2xl shadow-indigo-950/40'
const setupLabelClass = 'text-slate-300 font-medium text-xs'
const setupLinkClass = 'text-indigo-400 hover:text-indigo-300 hover:underline'

export default function SetupWizard() {
  const { t } = useLingui()
  const navigate = useNavigate()

  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)
  const [setupComplete, setSetupComplete] = useState(false)
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [configStatus, setConfigStatus] = useState<{
    smtp_configured: boolean
    api_endpoint_configured: boolean
    root_email_configured: boolean
    smtp_bridge_configured: boolean
  }>({
    smtp_configured: false,
    api_endpoint_configured: false,
    root_email_configured: false,
    smtp_bridge_configured: false
  })
  const { message } = App.useApp()

  useEffect(() => {
    // Get API endpoint from window object
    const endpoint = (window as unknown as Record<string, unknown>).API_ENDPOINT
    setApiEndpoint(typeof endpoint === 'string' ? endpoint : '')

    // Fetch setup status
    const fetchStatus = async () => {
      try {
        const status = await setupApi.getStatus()
        // console.log('status', status)
        if (status.is_installed) {
          navigate({ to: '/console/signin' })
          return
        }
        setConfigStatus({
          smtp_configured: status.smtp_configured,
          api_endpoint_configured: status.api_endpoint_configured,
          root_email_configured: status.root_email_configured,
          smtp_bridge_configured: status.smtp_bridge_configured
        })
      } catch {
        message.error(t`Failed to fetch setup status`)
      } finally {
        setStatusLoading(false)
      }
    }
    fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTestConnection = async () => {
    try {
      await form.validateFields(['smtp_host', 'smtp_port'])
      setTesting(true)

      const values = form.getFieldsValue()
      const testConfig = {
        smtp_host: values.smtp_host,
        smtp_port: values.smtp_port,
        smtp_username: values.smtp_username || '',
        smtp_password: values.smtp_password || '',
        smtp_use_tls: values.smtp_use_tls ?? true,
        smtp_ehlo_hostname: values.smtp_ehlo_hostname || undefined
      }

      const result = await setupApi.testSmtp(testConfig)
      setTesting(false)
      message.success(result.message || t`SMTP connection successful!`)
    } catch (error) {
      setTesting(false)
      message.error(error instanceof Error ? error.message : t`Failed to test SMTP connection`)
    }
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true)

    // console.log('values', values)
    try {
      // Only include fields that are not configured via environment variables
      const setupConfig: SetupConfig = {}

      // Root email (only if not configured via env)
      if (!configStatus.root_email_configured) {
        setupConfig.root_email = typeof values.root_email === 'string' ? values.root_email : undefined
      }

      // API endpoint (only if not configured via env)
      if (!configStatus.api_endpoint_configured) {
        setupConfig.api_endpoint = typeof values.api_endpoint === 'string' ? values.api_endpoint : undefined
      }

      // SMTP configuration (only if not configured via env)
      if (!configStatus.smtp_configured) {
        setupConfig.smtp_host = typeof values.smtp_host === 'string' ? values.smtp_host : undefined
        setupConfig.smtp_port = typeof values.smtp_port === 'number' ? values.smtp_port : undefined
        setupConfig.smtp_username = typeof values.smtp_username === 'string' ? values.smtp_username : ''
        setupConfig.smtp_password = typeof values.smtp_password === 'string' ? values.smtp_password : ''
        setupConfig.smtp_from_email = typeof values.smtp_from_email === 'string' ? values.smtp_from_email : undefined
        setupConfig.smtp_from_name = typeof values.smtp_from_name === 'string' ? values.smtp_from_name : 'Mail Studio'
        setupConfig.smtp_use_tls = typeof values.smtp_use_tls === 'boolean' ? values.smtp_use_tls : true
      }

      // SMTP Bridge configuration (only if not configured via env)
      if (!configStatus.smtp_bridge_configured) {
        setupConfig.smtp_bridge_enabled = typeof values.smtp_bridge_enabled === 'boolean' ? values.smtp_bridge_enabled : false
        if (values.smtp_bridge_enabled) {
          setupConfig.smtp_bridge_domain = typeof values.smtp_bridge_domain === 'string' ? values.smtp_bridge_domain : undefined
          setupConfig.smtp_bridge_port = typeof values.smtp_bridge_port === 'number' ? values.smtp_bridge_port : 587
          setupConfig.smtp_bridge_tls_cert_base64 = typeof values.smtp_bridge_tls_cert_base64 === 'string' ? values.smtp_bridge_tls_cert_base64 : undefined
          setupConfig.smtp_bridge_tls_key_base64 = typeof values.smtp_bridge_tls_key_base64 === 'string' ? values.smtp_bridge_tls_key_base64 : undefined
        }
      }

      // Telemetry and check for updates settings
      setupConfig.telemetry_enabled = typeof values.telemetry_enabled === 'boolean' ? values.telemetry_enabled : false
      setupConfig.check_for_updates = typeof values.check_for_updates === 'boolean' ? values.check_for_updates : false

      await setupApi.initialize(setupConfig)

      // Subscribe to newsletter if checked (fail silently)
      if (values.subscribe_newsletter && values.root_email) {
        try {
          const contact: Record<string, unknown> = {
            email: values.root_email
          }

          // Add timezone from browser (normalized to canonical IANA name)
          try {
            const timezone = getBrowserTimezone()
            if (timezone) {
              contact.timezone = timezone
            }
          } catch {
            // Fail silently if timezone detection fails
          }

          // Only include custom fields if values are available
          const endpoint = values.api_endpoint || apiEndpoint
          if (endpoint) {
            contact.custom_string_1 = endpoint
          }

          if (values.check_for_updates !== undefined) {
            contact.custom_string_2 = values.check_for_updates ? 'true' : 'false'
          }

          if (values.telemetry_enabled !== undefined) {
            contact.custom_string_3 = values.telemetry_enabled ? 'true' : 'false'
          }

          await fetch('https://email.notifuse.com/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              workspace_id: 'notifuse',
              contact,
              list_ids: ['newsletter']
            })
          })
        } catch {
          // Fail silently - don't block setup if newsletter subscription fails
        }
      }

      // Show setup complete screen
      setSetupComplete(true)

      // Keep loading state active while server restarts
      // Show loading message for server restart
      const hideRestartMessage = message.loading({
        content: t`Server is restarting with new configuration...`,
        duration: 0, // Don't auto-dismiss
        key: 'server-restart'
      })

      // Wait for server to restart
      // Use the API endpoint from the form values or the already configured endpoint
      const endpointToCheck = typeof values.api_endpoint === 'string' ? values.api_endpoint : (apiEndpoint || window.location.origin)

      try {
        await waitForServerRestart(endpointToCheck)

        // Success - server is back up
        message.success({
          content: t`Server restarted successfully! You can now sign in.`,
          key: 'server-restart',
          duration: 3
        })

        // Don't redirect automatically - let user click the button
        setLoading(false)
      } catch {
        hideRestartMessage()
        message.error({
          content: t`Server restart timeout. Please refresh the page manually.`,
          key: 'server-restart',
          duration: 0
        })
        setLoading(false)
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : t`Failed to complete setup`)
      setLoading(false)
    }
  }

  /**
   * Wait for the server to restart after setup completion
   * Polls the health endpoint until server is back online
   */
  const waitForServerRestart = async (configuredEndpoint: string): Promise<void> => {
    const maxAttempts = 60 // 60 seconds max wait
    const delayMs = 1000 // Check every second

    // Determine the API endpoint URL - use same logic as api client
    const apiEndpointUrl = configuredEndpoint

    // Wait for server to start shutting down
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Poll setup status endpoint to check if server has restarted
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Simple GET request without custom headers to avoid CORS preflight issues
        // Add timestamp to prevent caching
        const response = await fetch(`${apiEndpointUrl}/api/setup.status?t=${Date.now()}`, {
          method: 'GET'
        })

        if (response.ok) {
          // Server is back!
          console.log(`Server restarted successfully after ${i + 1} attempts`)
          return
        }
      } catch {
        // Expected during restart - server is down
        console.log(`Waiting for server... attempt ${i + 1}/${maxAttempts}`)
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }

    throw new Error('Server restart timeout')
  }

  const handleDone = () => {
    // Force a full page reload to fetch fresh config from /config.js
    // This ensures window.IS_INSTALLED is properly set from the backend
    window.location.href = '/console/signin'
  }

  if (statusLoading) {
    return (
      <App>
        <MainLayout>
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" />
              <p className="mt-4 text-slate-400">{t`Loading setup...`}</p>
            </div>
          </div>
        </MainLayout>
      </App>
    )
  }

  return (
    <App>
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] py-10">
          <div className={setupCardClass}>
            {setupComplete ? (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-2xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(99,102,241,0.5)] mb-4">
                    Mail Studio<span className="text-indigo-500">.</span>
                  </div>
                  <CheckOutlined
                    style={{ fontSize: '48px', color: '#34d399', marginBottom: '16px' }}
                  />
                  <h2 className="text-3xl font-bold text-white mb-2">{t`Setup Complete!`}</h2>
                  <p className="text-slate-400">
                    {t`Your Mail Studio instance has been successfully configured.`}
                  </p>
                </div>

                <div className="mt-8 text-center">
                  <Button
                    type="primary"
                    size="large"
                    block
                    onClick={handleDone}
                    loading={loading}
                    icon={!loading && <ArrowRightOutlined />}
                    iconPosition="end"
                    disabled={loading}
                  >
                    {loading ? t`Waiting for server restart...` : t`Go to Sign In`}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-2xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(99,102,241,0.5)] mb-2">
                    Mail Studio<span className="text-indigo-500">.</span>
                  </div>
                  <h2 className="text-sm font-semibold text-slate-200 tracking-tight">{t`Setup`}</h2>
                </div>

                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                  initialValues={{
                    smtp_port: 587,
                    smtp_use_tls: true,
                    smtp_from_name: 'Mail Studio',
                    subscribe_newsletter: true,
                    telemetry_enabled: true,
                    check_for_updates: true
                  }}
                >
                  {(!configStatus.root_email_configured ||
                    !configStatus.api_endpoint_configured) && (
                    <div className="mt-12">
                      {!configStatus.root_email_configured && (
                        <Form.Item
                          label={<span className={setupLabelClass}>{t`Root Email`}</span>}
                          name="root_email"
                          rules={[
                            { required: true, message: t`Admin email is required` },
                            { type: 'email', message: t`Invalid email format` }
                          ]}
                          tooltip={t`This email will be used for the root administrator account`}
                        >
                          <Input placeholder="admin@example.com" />
                        </Form.Item>
                      )}
                      {!configStatus.api_endpoint_configured && (
                        <Form.Item
                          label={<span className={setupLabelClass}>{t`API Endpoint`}</span>}
                          name="api_endpoint"
                          rules={[
                            { required: true, message: t`API endpoint is required` },
                            { type: 'url', message: t`Invalid URL format` }
                          ]}
                          tooltip={t`Public URL where this Mail Studio instance is accessible`}
                        >
                          <Input placeholder="https://mail-studio.example.com" />
                        </Form.Item>
                      )}
                    </div>
                  )}

                  {/* Newsletter Subscription */}
                  <Form.Item
                    name="subscribe_newsletter"
                    valuePropName="checked"
                    label={
                      <span className={setupLabelClass}>
                        {t`Subscribe to the newsletter (new features...)`}
                      </span>
                    }
                    style={{ marginTop: 24 }}
                  >
                    <Switch />
                  </Form.Item>

                  {/* SMTP Configuration Section */}
                  {!configStatus.smtp_configured && (
                    <>
                      <Divider orientation="center" style={{ marginTop: 32, marginBottom: 24 }}>
                        {t`SMTP Configuration`}
                      </Divider>

                      <div className="text-center mb-4">
                        <p className="text-sm text-slate-400">
                          {t`See docs for:`}
                          <a
                            href="https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${setupLinkClass} pl-2`}
                          >
                            Amazon SES
                          </a>
                          {' • '}
                          <a
                            href="https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-smtp"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={setupLinkClass}
                          >
                            Mailgun
                          </a>
                          {' • '}
                          <a
                            href="https://developers.sparkpost.com/api/smtp/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={setupLinkClass}
                          >
                            SparkPost
                          </a>
                          {' • '}
                          <a
                            href="https://postmarkapp.com/developer/user-guide/send-email-with-smtp"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={setupLinkClass}
                          >
                            Postmark
                          </a>
                        </p>
                      </div>

                      <Row gutter={16}>
                        <Col span={10}>
                          <Form.Item
                            label={<span className={setupLabelClass}>{t`SMTP Host`}</span>}
                            name="smtp_host"
                            rules={[{ required: true, message: t`SMTP host is required` }]}
                          >
                            <Input placeholder="smtp.example.com" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item
                            label={<span className={setupLabelClass}>{t`SMTP Port`}</span>}
                            name="smtp_port"
                            rules={[{ required: true, message: t`SMTP port is required` }]}
                            tooltip={t`Common ports: 587 (TLS), 465 (SSL), 25 (unencrypted)`}
                          >
                            <InputNumber
                              min={1}
                              max={65535}
                              placeholder="587"
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item
                            name="smtp_use_tls"
                            valuePropName="checked"
                            label={<span className={setupLabelClass}>{t`Use TLS`}</span>}
                            tooltip={t`Enable TLS encryption for SMTP connection`}
                          >
                            <Switch defaultChecked />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label={<span className={setupLabelClass}>{t`SMTP Username`}</span>}
                            name="smtp_username"
                          >
                            <Input placeholder="user@example.com" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label={<span className={setupLabelClass}>{t`SMTP Password`}</span>}
                            name="smtp_password"
                          >
                            <Input.Password placeholder="••••••••" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label={<span className={setupLabelClass}>{t`From Email`}</span>}
                            name="smtp_from_email"
                            rules={[
                              { required: true, message: t`From email is required` },
                              { type: 'email', message: t`Invalid email format` }
                            ]}
                          >
                            <Input placeholder="notifications@example.com" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label={<span className={setupLabelClass}>{t`From Name`}</span>}
                            name="smtp_from_name"
                          >
                            <Input placeholder="Mail Studio" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        name="smtp_ehlo_hostname"
                        label={<span className={setupLabelClass}>{t`EHLO Hostname`}</span>}
                        tooltip={t`The hostname your server identifies itself as when connecting to the SMTP server. Defaults to the SMTP host value if empty.`}
                      >
                        <Input placeholder={t`Defaults to SMTP host`} />
                      </Form.Item>

                      <div className="text-right">
                        <Button
                          onClick={handleTestConnection}
                          loading={testing}
                          icon={<ApiOutlined />}
                        >
                          {t`Test Connection`}
                        </Button>
                      </div>
                    </>
                  )}

                  {/* Advanced Settings Collapse */}
                  <Collapse
                    ghost
                    style={{ marginTop: 32 }}
                    items={[
                      {
                        key: 'advanced',
                        label: (
                          <span className="text-slate-300 font-medium">{t`Advanced Settings`}</span>
                        ),
                        children: (
                          <>
                            <Row gutter={16}>
                              <Col span={12}>
                                <Form.Item
                                  name="telemetry_enabled"
                                  valuePropName="checked"
                                  label={
                                    <span className={setupLabelClass}>
                                      {t`Enable Anonymous Telemetry`}
                                    </span>
                                  }
                                  tooltip={t`Help us improve Mail Studio by sending anonymous usage statistics. No personal data or message content is collected.`}
                                >
                                  <Switch />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item
                                  name="check_for_updates"
                                  valuePropName="checked"
                                  label={
                                    <span className={setupLabelClass}>{t`Check for Updates`}</span>
                                  }
                                  tooltip={t`Periodically check for new Mail Studio versions and security updates. A popup will list new versions available.`}
                                >
                                  <Switch />
                                </Form.Item>
                              </Col>
                            </Row>

                            {/* SMTP Bridge Configuration - Hidden if configured via env */}
                            {!configStatus.smtp_bridge_configured && (
                              <>
                                <Divider style={{ marginTop: 24, marginBottom: 24 }} />

                                <Form.Item
                                  name="smtp_bridge_enabled"
                                  valuePropName="checked"
                                  label={
                                    <span className={setupLabelClass}>
                                      {t`Enable SMTP Bridge Server`}
                                    </span>
                                  }
                                  tooltip={t`Allow receiving emails to trigger transactional notifications. Requires TLS certificates.`}
                                >
                                  <Switch />
                                </Form.Item>

                                <Form.Item
                                  noStyle
                                  shouldUpdate={(prevValues, currentValues) =>
                                    prevValues.smtp_bridge_enabled !==
                                    currentValues.smtp_bridge_enabled
                                  }
                                >
                                  {({ getFieldValue }) =>
                                    getFieldValue('smtp_bridge_enabled') ? (
                                      <div
                                        style={{
                                          marginTop: 16,
                                          paddingLeft: 24,
                                          borderLeft: '3px solid #1890ff'
                                        }}
                                      >
                                        <Form.Item
                                          label={<span className={setupLabelClass}>{t`Domain`}</span>}
                                          name="smtp_bridge_domain"
                                          rules={[
                                            {
                                              required: true,
                                              message: t`SMTP bridge domain is required`
                                            }
                                          ]}
                                          tooltip={t`Domain for the SMTP bridge server (e.g., smtp.yourcompany.com)`}
                                        >
                                          <Input placeholder="smtp.yourcompany.com" />
                                        </Form.Item>

                                        <Form.Item
                                          label={<span className={setupLabelClass}>{t`Port`}</span>}
                                          name="smtp_bridge_port"
                                          initialValue={587}
                                          rules={[
                                            {
                                              required: true,
                                              message: t`SMTP bridge port is required`
                                            }
                                          ]}
                                          tooltip={t`Port for the SMTP bridge server (default: 587)`}
                                        >
                                          <InputNumber
                                            min={1}
                                            max={65535}
                                            style={{ width: '100%' }}
                                          />
                                        </Form.Item>

                                        <Form.Item
                                          label={
                                            <span className={setupLabelClass}>
                                              {t`TLS Certificate (Base64)`}
                                            </span>
                                          }
                                          name="smtp_bridge_tls_cert_base64"
                                          rules={[
                                            {
                                              required: true,
                                              message: t`TLS certificate is required`
                                            }
                                          ]}
                                          tooltip={t`Base64 encoded TLS certificate. Run: cat fullchain.pem | base64 -w 0`}
                                        >
                                          <Input.TextArea
                                            rows={4}
                                            placeholder="LS0tLS1CRUdJTi..."
                                            style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                          />
                                        </Form.Item>

                                        <Form.Item
                                          label={
                                            <span className={setupLabelClass}>
                                              {t`TLS Private Key (Base64)`}
                                            </span>
                                          }
                                          name="smtp_bridge_tls_key_base64"
                                          rules={[
                                            {
                                              required: true,
                                              message: t`TLS private key is required`
                                            }
                                          ]}
                                          tooltip={t`Base64 encoded TLS private key. Run: cat privkey.pem | base64 -w 0`}
                                        >
                                          <Input.TextArea
                                            rows={4}
                                            placeholder="LS0tLS1CRUdJTi..."
                                            style={{ fontFamily: 'monospace', fontSize: '12px' }}
                                          />
                                        </Form.Item>
                                      </div>
                                    ) : null
                                  }
                                </Form.Item>
                              </>
                            )}
                          </>
                        )
                      }
                    ]}
                  />

                  {/* Submit Button */}
                  <Divider style={{ marginTop: 32, marginBottom: 24 }} />

                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    size="large"
                    icon={<CheckOutlined />}
                    iconPosition="end"
                    block
                  >
                    {loading ? t`Setting up...` : t`Complete Setup`}
                  </Button>
                </Form>
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    </App>
  )
}
