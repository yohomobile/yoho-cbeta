'use client'

import { useCallback, useEffect, useState } from 'react'

export type ReaderSettings = {
  showTextNotes: boolean
  showVariants: boolean
  showMarkers: boolean
  showDocNumber: boolean
  showForeign: boolean
  skipPreface: boolean
}

const SETTINGS_KEY = 'cbeta-reader-settings'

export const defaultSettings: ReaderSettings = {
  showTextNotes: false,
  showVariants: false,
  showMarkers: false,
  showDocNumber: false,
  showForeign: false,
  skipPreface: true,
}

export const settingItems: Array<{
  key: keyof ReaderSettings
  title: string
  description: string
  accent: string
  bg: string
  mobileHidden?: boolean
}> = [
  {
    key: 'showTextNotes',
    title: '文本注释',
    description: '脚注与编者说明',
    accent: '#0f766e',
    bg: '#e6f5f3',
  },
  {
    key: 'skipPreface',
    title: '跳过卷首序文',
    description: '默认从正文开始，可在目录切换',
    accent: '#0f766e',
    bg: '#e6f5f3',
  },
  {
    key: 'showVariants',
    title: '异文校勘',
    description: '不同版本对读',
    accent: '#b45309',
    bg: '#fdf1e1',
  },
  {
    key: 'showMarkers',
    title: '行页码',
    description: '引用定位标记',
    accent: '#be123c',
    bg: '#fdecef',
    mobileHidden: true,
  },
  {
    key: 'showDocNumber',
    title: '编号信息',
    description: '藏经编号',
    accent: '#0f766e',
    bg: '#e6f5f3',
  },
  {
    key: 'showForeign',
    title: '梵文转写',
    description: '显示外语音译',
    accent: '#6d28d9',
    bg: '#efe7ff',
  },
]

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ReaderSettings>
        setSettings((prev) => ({
          ...prev,
          ...parsed,
        }))
      }
    } catch {
      // Ignore invalid settings payload.
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!loaded) {
      return
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [loaded, settings])

  const updateSetting = useCallback(<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const toggleSetting = useCallback((key: keyof ReaderSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings)
  }, [])

  return {
    settings,
    loaded,
    updateSetting,
    toggleSetting,
    resetSettings,
  }
}
