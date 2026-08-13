import { Button, Empty } from 'antd'
import { PlusOutlined, RightOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from '@tanstack/react-router'
import { MainLayout } from '../layouts/MainLayout'
import { isRootUser } from '../services/api/auth'
import { useLingui } from '@lingui/react/macro'
import { SystemSettingsDrawer } from '../components/settings/SystemSettingsDrawer'

export function DashboardPage() {
  const { t } = useLingui()
  const { workspaces, user } = useAuth()
  const navigate = useNavigate()

  const handleWorkspaceClick = (workspaceId: string) => {
    navigate({
      to: '/console/workspace/$workspaceId',
      params: { workspaceId }
    })
  }

  const handleCreateWorkspace = () => {
    navigate({ to: '/console/workspace/create' })
  }

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-4 sm:p-6">
        <div className="w-full max-w-lg p-6 sm:p-8 rounded-2xl bg-slate-900/85 backdrop-blur-2xl border border-slate-800/90 shadow-2xl shadow-indigo-950/40">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800/80">
            <div className="text-xl font-black tracking-tight text-white drop-shadow-[0_0_12px_rgba(99,102,241,0.4)]">
              Mail Studio<span className="text-indigo-500">.</span>
            </div>

            {isRootUser(user?.email) && (
              <div className="flex items-center gap-2">
                <SystemSettingsDrawer />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateWorkspace}
                  className="font-medium shadow-md shadow-indigo-500/20"
                >
                  {t`New`}
                </Button>
              </div>
            )}
          </div>

          {/* Section Sub-header */}
          <div className="mb-5">
            <h2 className="text-base font-bold text-white tracking-tight leading-snug m-0">{t`Select workspace`}</h2>
            <p className="text-xs text-slate-400 mt-1 mb-0">{t`Choose a workspace to access Mail Studio`}</p>
          </div>

          {/* Workspace List */}
          {workspaces.length === 0 ? (
            <div className="py-8 text-center">
              <Empty description={<span className="text-slate-400">{t`No workspaces found`}</span>} />
              {isRootUser(user?.email) && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateWorkspace}
                  className="mt-4 font-semibold"
                >
                  {t`Create Workspace`}
                </Button>
              )}
            </div>
          ) : (
            <div
              className={`flex flex-col gap-3${
                workspaces.length > 5 ? ' max-h-[420px] overflow-y-auto pr-1' : ''
              }`}
            >
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  onClick={() => handleWorkspaceClick(workspace.id)}
                  className="group mailstudio-card p-4 cursor-pointer flex items-center justify-between gap-4 transition-all duration-200 hover:border-indigo-500/60 hover:bg-slate-800/90"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 flex items-center justify-center bg-indigo-950/70 border border-indigo-500/30 rounded-xl overflow-hidden shrink-0 group-hover:border-indigo-400/60 transition-colors">
                      {workspace.settings.logo_url ? (
                        <img
                          alt={workspace.name}
                          src={workspace.settings.logo_url}
                          className="max-w-full max-h-full object-contain p-1"
                        />
                      ) : (
                        <span className="text-indigo-400 font-bold text-sm">
                          {workspace.name.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-sm truncate group-hover:text-indigo-200 transition-colors">
                        {workspace.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {t`ID:`} {workspace.id}
                      </div>
                    </div>
                  </div>

                  <RightOutlined className="text-slate-500 group-hover:text-indigo-400 text-xs transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
