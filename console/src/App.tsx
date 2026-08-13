import { ConfigProvider, App as AntApp, ThemeConfig, theme as antTheme } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { I18nProvider } from '@lingui/react'
import { router } from './router'
import { AuthProvider } from './contexts/AuthContext'
import { LocaleProvider, useLocale, i18n } from './contexts/LocaleContext'
import { initializeAnalytics } from './utils/analytics-config'
import enUS from 'antd/locale/en_US'
import frFR from 'antd/locale/fr_FR'
import esES from 'antd/locale/es_ES'
import deDE from 'antd/locale/de_DE'
import caES from 'antd/locale/ca_ES'
import type { Locale as AntdLocale } from 'antd/es/locale'
import type { Locale } from './i18n'

const antdLocales: Record<Locale, AntdLocale> = {
  en: enUS,
  fr: frFR,
  es: esES,
  de: deDE,
  ca: caES,
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

const theme: ThemeConfig = {
  algorithm: antTheme.darkAlgorithm,
  token: {
    colorPrimary: '#6366F1',
    colorLink: '#818CF8',
    colorBgLayout: '#0B0F19',
    colorBgContainer: '#111827',
    colorBgElevated: '#1E293B',
    colorTextHeading: '#F8FAFC',
    colorText: '#CBD5E1',
    colorTextSecondary: '#94A3B8',
    colorBorder: 'rgba(255, 255, 255, 0.08)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  components: {
    Layout: {
      bodyBg: '#0B0F19',
      lightSiderBg: '#0F172A',
      siderBg: '#0F172A',
      headerBg: '#0F172A'
    },
    Card: {
      headerFontSize: 15,
      borderRadius: 12,
      borderRadiusLG: 12,
      borderRadiusSM: 10,
      colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
      colorBgContainer: '#111827'
    },
    Table: {
      headerBg: '#1E293B',
      fontSize: 13,
      colorTextHeading: '#94A3B8',
      colorBgContainer: '#111827',
      rowHoverBg: '#1E293B',
      fixedHeaderBG: '#1E293B'
    },
    Menu: {
      colorBgContainer: 'transparent',
      subMenuItemBg: 'transparent',
      itemBg: 'transparent',
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      itemColor: '#94A3B8',
      itemHoverColor: '#F8FAFC',
      itemSelectedColor: '#FFFFFF',
      itemSelectedBg: '#334155',
      darkItemSelectedBg: '#334155'
    },
    Button: {
      borderRadius: 8,
      fontWeight: 500
    },
    Segmented: {
      trackBg: '#1E293B',
      itemSelectedBg: '#334155',
      itemSelectedColor: '#F8FAFC',
      itemColor: '#94A3B8',
      borderRadius: 8
    },
    Drawer: {
      colorBgElevated: '#111827'
    },
    Modal: {
      colorBgElevated: '#111827'
    },
    Timeline: {
      dotBg: '#111827'
    }
  }
}

// Initialize analytics service
initializeAnalytics()

// Inner component that uses LocaleContext
function AppContent() {
  const { locale } = useLocale()

  return (
    // key={locale} forces I18nProvider and all children to remount when locale changes,
    // ensuring all components re-render with the new translations
    <I18nProvider i18n={i18n} key={locale}>
      <ConfigProvider theme={theme} locale={antdLocales[locale]}>
        <AntApp>
          <RouterProvider router={router} />
        </AntApp>
      </ConfigProvider>
    </I18nProvider>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocaleProvider>
          <AppContent />
        </LocaleProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
