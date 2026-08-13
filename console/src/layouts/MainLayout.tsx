import { Layout } from 'antd'
import { useLingui } from '@lingui/react/macro'
import { ReactNode } from 'react'

const { Content } = Layout

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <Layout
      style={{
        minHeight: '100vh',
        backgroundImage: 'url(/console/splash.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#0b0f19'
      }}
      className="relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" />
      <Content className="relative z-10 p-6">{children}</Content>
    </Layout>
  )
}

interface MainLayoutSidebarProps {
  children: ReactNode
  title: string
  extra: ReactNode
}

export function MainLayoutSidebar({ children, title, extra }: MainLayoutSidebarProps) {
  return (
    <div className="fixed right-0 top-0 bottom-0 w-[420px] max-w-full p-6 backdrop-blur-2xl bg-slate-900/90 border-l border-slate-800/80 text-slate-100 overflow-y-auto shadow-2xl z-20">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}
      >
        <h3 className="text-xl font-bold text-white tracking-tight m-0">{title}</h3>
        {extra}
      </div>
      {children}
    </div>
  )
}
