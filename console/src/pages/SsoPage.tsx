import { Card, Spin, App } from 'antd'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { MainLayout } from '../layouts/MainLayout'
import { useLingui } from '@lingui/react/macro'

/**
 * Portal SSO landing: Admin Management mints a JWT via user.portalSignin and
 * redirects here with ?token=. We store it and enter the console — no magic code.
 * Opening /console/signin outside the portal still requires the email code.
 */
export function SsoPage() {
  const { t } = useLingui()
  const { signin } = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ from: '/console/sso' })
  const { message } = App.useApp()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const token = typeof search.token === 'string' ? search.token.trim() : ''
  const workspaceId =
    typeof search.workspaceId === 'string' ? search.workspaceId.trim() : ''
  const template =
    typeof search.template === 'string' ? search.template.trim() : ''

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (!token) {
      setError(t`Missing sign-in token`)
      return
    }

    const run = async () => {
      try {
        await signin(token)
        message.success(t`Signed in`)
        setTimeout(() => {
          if (workspaceId && template) {
            navigate({
              to: '/console/workspace/$workspaceId/templates',
              params: { workspaceId },
              search: { id: template }
            })
            return
          }
          if (workspaceId) {
            navigate({
              to: '/console/workspace/$workspaceId',
              params: { workspaceId }
            })
            return
          }
          navigate({ to: '/console' })
        }, 50)
      } catch (err) {
        const msg = err instanceof Error ? err.message : t`Sign-in failed`
        setError(msg)
        message.error(msg)
      }
    }

    void run()
  }, [token, workspaceId, template, signin, navigate, message, t])

  return (
    <MainLayout>
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <Card style={{ width: 420, textAlign: 'center' }}>
          {error ? (
            <>
              <p style={{ marginBottom: 16 }}>{error}</p>
              <a href="/console/signin">{t`Go to sign in`}</a>
            </>
          ) : (
            <>
              <Spin size="large" />
              <p style={{ marginTop: 16, color: '#5e6b8c' }}>{t`Signing you in…`}</p>
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  )
}
