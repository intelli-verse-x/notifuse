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
        backgroundColor: '#f7f9ff'
      }}
      className="relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-[#f7f9ff]/70 backdrop-blur-[2px]" />
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
    <div className="fixed right-0 top-0 bottom-0 w-[420px] max-w-full p-6 backdrop-blur-2xl bg-white border-l border-[#e6ecf8] text-[#0b1433] overflow-y-auto shadow-[0_8px_24px_rgba(11,20,51,0.12)] z-20">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}
      >
        <h3 className="text-xl font-bold text-[#0b1433] tracking-tight m-0">{title}</h3>
        {extra}
      </div>
      {children}
    </div>
  )
}
