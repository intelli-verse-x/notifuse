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
        <div className="w-full max-w-lg p-6 sm:p-8 rounded-2xl bg-white/95 backdrop-blur-2xl border border-[#e6ecf8] shadow-[0_8px_24px_rgba(11,20,51,0.12)]">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#e6ecf8]">
            <div className="text-xl font-black tracking-tight text-[#0b1433]">
              Mail Studio<span className="text-[#2457d6]">.</span>
            </div>

            {isRootUser(user?.email) && (
              <div className="flex items-center gap-2">
                <SystemSettingsDrawer />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateWorkspace}
                  className="font-medium"
                >
                  {t`New`}
                </Button>
              </div>
            )}
          </div>

          {/* Section Sub-header */}
          <div className="mb-5">
            <h2 className="text-base font-bold text-[#0b1433] tracking-tight leading-snug m-0">{t`Select workspace`}</h2>
            <p className="text-xs text-[#5e6b8c] mt-1 mb-0">{t`Choose a workspace to access Mail Studio`}</p>
          </div>

          {/* Workspace List */}
          {workspaces.length === 0 ? (
            <div className="py-8 text-center">
              <Empty description={<span className="text-[#8590ad]">{t`No workspaces found`}</span>} />
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
                  className="group mailstudio-card p-4 cursor-pointer flex items-center justify-between gap-4 transition-all duration-200 hover:border-[#2457d6]/40 hover:bg-[#f2f6ff]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 flex items-center justify-center bg-[#e8efff] border border-[#c7d2e8] rounded-xl overflow-hidden shrink-0 group-hover:border-[#2457d6]/50 transition-colors">
                      {workspace.settings.logo_url ? (
                        <img
                          alt={workspace.name}
                          src={workspace.settings.logo_url}
                          className="max-w-full max-h-full object-contain p-1"
                        />
                      ) : (
                        <span className="text-[#2457d6] font-bold text-sm">
                          {workspace.name.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0b1433] text-sm truncate group-hover:text-[#2457d6] transition-colors">
                        {workspace.name}
                      </div>
                      <div className="text-xs text-[#8590ad] truncate mt-0.5">
                        {t`ID:`} {workspace.id}
                      </div>
                    </div>
                  </div>

                  <RightOutlined className="text-[#8590ad] group-hover:text-[#2457d6] text-xs transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
