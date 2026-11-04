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
  ca: caES
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

/** Admin Dashboard sky tokens — light theme only (matches IntelliVerse Admin Console). */
const theme: ThemeConfig = {
  algorithm: antTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#2457d6',
    colorLink: '#2457d6',
    colorInfo: '#2457d6',
    colorSuccess: '#1d9a6c',
    colorWarning: '#e2701f',
    colorError: '#c2410c',
    colorBgLayout: '#f7f9ff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorTextHeading: '#0b1433',
    colorText: '#0b1433',
    colorTextSecondary: '#5e6b8c',
    colorTextTertiary: '#8590ad',
    colorBorder: '#c7d2e8',
    colorBorderSecondary: '#e6ecf8',
    colorFillSecondary: '#f2f6ff',
    colorFillTertiary: '#f2f6ff',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 10,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 15,
    controlHeight: 40,
    boxShadow: '0 2px 8px rgba(11, 20, 51, 0.08)',
    boxShadowSecondary: '0 8px 24px rgba(11, 20, 51, 0.12)'
  },
  components: {
    Layout: {
      bodyBg: '#f7f9ff',
      lightSiderBg: '#ffffff',
      siderBg: '#ffffff',
      headerBg: '#ffffff',
      triggerBg: '#f2f6ff',
      triggerColor: '#5e6b8c'
    },
    Card: {
      headerFontSize: 15,
      borderRadius: 16,
      borderRadiusLG: 16,
      borderRadiusSM: 12,
      colorBorderSecondary: '#e6ecf8',
      colorBgContainer: '#ffffff'
    },
    Table: {
      headerBg: '#f2f6ff',
      fontSize: 13,
      colorTextHeading: '#5e6b8c',
      colorBgContainer: '#ffffff',
      rowHoverBg: '#f2f6ff',
      fixedHeaderBG: '#f2f6ff',
      borderColor: '#e6ecf8'
    },
    Menu: {
      colorBgContainer: 'transparent',
      subMenuItemBg: 'transparent',
      itemBg: 'transparent',
      itemColor: '#5e6b8c',
      itemHoverColor: '#0b1433',
      itemHoverBg: '#f2f6ff',
      itemSelectedColor: '#2457d6',
      itemSelectedBg: '#e8efff',
      itemActiveBg: '#e8efff'
    },
    Button: {
      borderRadius: 999,
      fontWeight: 600,
      primaryShadow: '0 6px 18px rgba(122, 91, 255, 0.32)',
      defaultBorderColor: '#c7d2e8',
      defaultColor: '#0b1433'
    },
    Segmented: {
      trackBg: '#f2f6ff',
      itemSelectedBg: '#ffffff',
      itemSelectedColor: '#0b1433',
      itemColor: '#5e6b8c',
      borderRadius: 999
    },
    Drawer: {
      colorBgElevated: '#ffffff'
    },
    Modal: {
      colorBgElevated: '#ffffff',
      borderRadiusLG: 20
    },
    Timeline: {
      dotBg: '#ffffff'
    },
    Input: {
      colorBgContainer: '#ffffff',
      colorBorder: '#c7d2e8',
      activeBorderColor: '#2457d6',
      hoverBorderColor: '#7a5bff',
      colorText: '#0b1433',
      colorTextPlaceholder: '#8590ad',
      borderRadius: 12,
      activeShadow: '0 0 0 3px rgba(36, 87, 214, 0.12)'
    },
    Select: {
      colorBgContainer: '#ffffff',
      colorBorder: '#c7d2e8',
      optionSelectedBg: '#e8efff',
      borderRadius: 12
    },
    Descriptions: {
      colorTextSecondary: '#5e6b8c',
      labelBg: 'transparent'
    },
    Tabs: {
      itemColor: '#5e6b8c',
      itemSelectedColor: '#2457d6',
      itemHoverColor: '#0b1433',
      inkBarColor: '#2457d6'
    },
    Tag: {
      borderRadiusSM: 999
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
