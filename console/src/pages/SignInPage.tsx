import { Form, Input, Button, Card, App, Space } from 'antd'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { authService } from '../services/api/auth'
import { SignInRequest, VerifyCodeRequest } from '../services/api/types'
import { MainLayout } from '../layouts/MainLayout'
import { useLingui } from '@lingui/react/macro'

export function SignInPage() {
  const { t } = useLingui()
  const { signin } = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ from: '/console/signin' })
  const [email, setEmail] = useState('')
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const hasAutoSubmitted = useRef(false)

  const handleCodeSubmit = useCallback(
    async (values: { code: string }, emailToUse?: string) => {
      try {
        setLoading(true)
        const data: VerifyCodeRequest = {
          email: emailToUse || email,
          code: values.code
        }

        const response = await authService.verifyCode(data)
        const { token } = response
        // Use the existing signin function for now
        // This might need to be updated in AuthContext
        await signin(token)
        message.success(t`Successfully signed in`)

        // Add a small delay to ensure auth state is updated before navigation
        setTimeout(() => {
          navigate({ to: '/console' })
        }, 100)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t`Failed to verify code`
        message.error(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    [email, signin, message, navigate, t]
  )

  const handleEmailSubmit = useCallback(
    async (values: SignInRequest) => {
      try {
        setLoading(true)
        const response = await authService.signIn(values)

        // Log code if present (for development)
        if (response.code && response.code !== '') {
          console.log('Magic code for development:', response.code)

          // Auto-submit the code in development
          setEmail(values.email)
          await handleCodeSubmit({ code: response.code }, values.email)
          return
        }

        setEmail(values.email)
        setShowCodeInput(true)
        message.success(t`Magic code sent to your email`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : t`Failed to send magic code`
        message.error(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    [handleCodeSubmit, message, t]
  )

  // Initialize email from URL parameter or demo mode
  useEffect(() => {
    // Prevent multiple auto-submissions
    if (hasAutoSubmitted.current) return

    let emailToUse = ''

    if (search.email) {
      // URL parameter takes priority
      emailToUse = search.email
    } else if ((window as unknown as Record<string, unknown>).demo === true) {
      // Demo mode fallback
      emailToUse = 'demo@mailstudio.local'
    }

    if (emailToUse) {
      hasAutoSubmitted.current = true
      setEmail(emailToUse)
      form.setFieldsValue({ email: emailToUse })
      // Automatically submit the form if email is determined
      handleEmailSubmit({ email: emailToUse })
    }
  }, [search.email, form, handleEmailSubmit])

  const handleResendCode = async () => {
    try {
      setResendLoading(true)
      const response = await authService.signIn({ email })

      // Log code if present (for development)
      if (response.code) {
        console.log('⚡ Magic code for development:', response.code)

        // Auto-submit the code in development
        await handleCodeSubmit({ code: response.code }, email)
        return
      }

      message.success(t`New magic code sent to your email`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t`Failed to resend magic code`
      message.error(errorMessage)
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-md p-8 rounded-2xl bg-slate-900/80 backdrop-blur-2xl border border-slate-800/90 shadow-2xl shadow-indigo-950/40">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="text-2xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(99,102,241,0.5)] mb-2">
              Mail Studio<span className="text-indigo-500">.</span>
            </div>
            <h2 className="text-sm font-semibold text-slate-200 tracking-tight">{t`Sign In`}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t`Welcome back to Mail Studio`}</p>
          </div>

          {!showCodeInput ? (
            <Form
              form={form}
              name="email"
              onFinish={handleEmailSubmit}
              layout="vertical"
              initialValues={{ email }}
              size="large"
            >
              <Form.Item
                label={<span className="text-slate-300 font-medium text-xs">{t`Email Address`}</span>}
                name="email"
                rules={[
                  { required: true, message: t`Please input your email!` },
                  { type: 'email', message: t`Please enter a valid email!` }
                ]}
              >
                <Input placeholder={t`name@company.com`} type="email" className="rounded-lg" />
              </Form.Item>

              <Form.Item className="mb-2">
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  size="large"
                  className="font-semibold shadow-lg shadow-indigo-500/20"
                >
                  {t`Send Magic Code`}
                </Button>
              </Form.Item>
            </Form>
          ) : (
            <>
              <p className="text-sm text-slate-300 mb-6 text-center">
                {t`Enter the 6-digit code sent to`}{' '}
                <span className="font-semibold text-indigo-400">{email}</span>
              </p>
              <Form name="code" onFinish={handleCodeSubmit} layout="vertical" size="large">
                <Form.Item
                  name="code"
                  rules={[
                    { required: true, message: t`Please input the magic code!` },
                    {
                      pattern: /^\d{6}$/,
                      message: t`Please enter a valid 6-digit code!`
                    }
                  ]}
                >
                  <Input
                    placeholder="000000"
                    maxLength={6}
                    style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '18px' }}
                  />
                </Form.Item>

                <Form.Item className="mb-4">
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={loading}
                    size="large"
                    className="font-semibold shadow-lg shadow-indigo-500/20"
                  >
                    {t`Verify Code`}
                  </Button>
                </Form.Item>

                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Button
                    type="link"
                    onClick={() => setShowCodeInput(false)}
                    style={{ padding: 0 }}
                    className="text-xs text-slate-400 hover:text-indigo-300"
                  >
                    {t`Use a different email`}
                  </Button>
                  <Button
                    type="link"
                    onClick={handleResendCode}
                    loading={resendLoading}
                    style={{ padding: 0 }}
                    className="text-xs text-slate-400 hover:text-indigo-300"
                  >
                    {t`Resend code`}
                  </Button>
                </Space>
              </Form>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
