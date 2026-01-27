import 'server-only'

import type { ClassicCatalog } from './types'
import { classics } from './classics'
import { loadMainTextChapters, loadTocIndex } from './cbetaMainText'

// 缓存暂时禁用
// const cache = new Map<string, Classic>()

const API_BASE = process.env.API_BASE || 'http://localhost:3001'

const getVersion = (meta: ClassicCatalog, versionId?: string) => {
  if (versionId) {
    return meta.versions.find((version) => version.id === versionId) ?? null
  }
  return (
    meta.versions.find((version) => version.id === meta.defaultVersionId) ??
    meta.versions[0] ??
    null
  )
}

const getTextIdFromSourcePath = (sourcePath: string) => {
  const filename = sourcePath.split('/').pop()
  return filename ? filename.replace(/\.json$/i, '') : null
}

const buildClassic = (id: string, versionId?: string) => {
  const meta = classics.find((item) => item.id === id)
  if (!meta) {
    return null
  }

  const version = getVersion(meta, versionId)
  if (!version) {
    return null
  }

  const chapters = loadMainTextChapters(version.sourcePath, '正文', 'auto')
  const juanChapters = loadMainTextChapters(version.sourcePath, '正文', 'juan')

  // 从 toc 加载品目录（作为导航索引，带 juanNumber）
  const tocIndex = loadTocIndex(version.sourcePath)

  // Determine if both modes produce different results
  const hasJuanMode = juanChapters.length > 1
  const hasTocIndex = tocIndex.length > 1
  // Show both modes if toc index has content
  const hasBothModes = hasJuanMode && hasTocIndex

  return {
    ...meta,
    chapters,
    juanChapters: hasBothModes ? juanChapters : undefined,
    pinChapters: hasBothModes ? tocIndex : undefined,
    currentVersionId: version.id,
  }
}

export const getClassic = (id: string, versionId?: string) => {
  // 缓存暂时禁用，直接构建
  return buildClassic(id, versionId)
}

export const getClassicRedirectTitle = async (id: string, versionId?: string) => {
  const meta = classics.find((item) => item.id === id)
  if (!meta) {
    return null
  }

  const version = getVersion(meta, versionId)
  if (!version) {
    return meta.title
  }

  const textId = getTextIdFromSourcePath(version.sourcePath)
  if (!textId) {
    return meta.title
  }

  try {
    const res = await fetch(`${API_BASE}/texts/${textId}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) {
      return meta.title
    }
    const data = await res.json()
    return data.title || meta.title
  } catch (error) {
    console.error('Failed to fetch classic title:', textId, error)
    return meta.title
  }
}

export const getClassicParams = () => classics.map((classic) => ({ id: classic.id }))

export const getClassicVersionParams = () =>
  classics.flatMap((classic) =>
    classic.versions.map((version) => ({ id: classic.id, version: version.id }))
  )
