/**
 * 设置存储测试（CR-012 T-002 / R-027）。
 *
 * 覆盖任务卡 Test requirements 的 settings 部分：
 * - 默认值：无数据 / localStorage 不可访问 / JSON 损坏 / 结构与字段类型异常 →
 *   全部回退 DEFAULT_API_SETTINGS（绝不抛错）；
 * - 往返：saveSettings → loadSettings 一致（baseURL/apiKey 去首尾空白）；
 * - 保存失败：setItem 抛错 → SettingsSaveError（可读中文消息）；
 * - 导出隔离：设置写入后，素材导出 JSON（io.ts）不含设置与 API Key（R-027：
 *   独立 key，不随素材导出；密钥不进导出文件）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyState } from '../../store/repository.ts'
import { serializeExport } from '../../store/io.ts'
import {
  DEFAULT_API_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SettingsSaveError,
  loadSettings,
  saveSettings,
} from './settingsStore.ts'

/** 内存版 localStorage（RepositorySaveError 风格的极简替身） */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    getLength: () => data.size,
    key: () => null,
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  } as unknown as Storage
}

describe('settingsStore（CR-012 T-002 / R-027）', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('无数据时返回默认设置（远程关闭、回退开启）', () => {
    expect(loadSettings(memoryStorage())).toEqual({
      baseURL: '',
      apiKey: '',
      enabled: false,
      fallbackToMock: true,
    })
    expect(DEFAULT_API_SETTINGS.enabled).toBe(false)
  })

  it('保存后读取往返一致（baseURL/apiKey 去首尾空白）', () => {
    const storage = memoryStorage()
    saveSettings(
      { baseURL: ' https://api.example.com/ ', apiKey: ' sk-test-123 ', enabled: true, fallbackToMock: false },
      storage,
    )
    expect(loadSettings(storage)).toEqual({
      baseURL: 'https://api.example.com/',
      apiKey: 'sk-test-123',
      enabled: true,
      fallbackToMock: false,
    })
  })

  it('JSON 损坏时回退默认设置（不抛错，密钥等字段不外泄）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const storage = memoryStorage({ [SETTINGS_STORAGE_KEY]: '{not-json' })
    expect(loadSettings(storage)).toEqual(DEFAULT_API_SETTINGS)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('结构与字段类型异常时逐字段回退默认值（不抛错）', () => {
    const storage = memoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        baseURL: 42,
        apiKey: ['nope'],
        enabled: 'yes',
        fallbackToMock: 'off',
      }),
    })
    expect(loadSettings(storage)).toEqual(DEFAULT_API_SETTINGS)
    // 数组整体也按损坏处理
    const arrayStorage = memoryStorage({ [SETTINGS_STORAGE_KEY]: '[]' })
    expect(loadSettings(arrayStorage)).toEqual(DEFAULT_API_SETTINGS)
  })

  it('localStorage 不可访问时回退默认设置（不抛错）', () => {
    const broken: Storage = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('blocked')
      },
    } as Storage
    expect(loadSettings(broken)).toEqual(DEFAULT_API_SETTINGS)
  })

  it('保存失败（写入抛错）时抛出可读的 SettingsSaveError', () => {
    const failing: Storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('quota exceeded')
      },
    } as Storage
    expect(() =>
      saveSettings({ ...DEFAULT_API_SETTINGS, enabled: true }, failing),
    ).toThrowError(SettingsSaveError)
    expect(() =>
      saveSettings({ ...DEFAULT_API_SETTINGS, enabled: true }, failing),
    ).toThrowError(/设置保存失败/)
  })

  it('设置不进入素材导出 JSON：导出内容不含设置 key 与 API Key（R-027）', () => {
    const storage = memoryStorage()
    const secret = 'sk-secret-must-not-leak'
    saveSettings(
      { baseURL: 'https://api.example.com', apiKey: secret, enabled: true, fallbackToMock: true },
      storage,
    )
    const exported = serializeExport(createEmptyState())
    expect(exported).not.toContain(secret)
    expect(exported).not.toContain(SETTINGS_STORAGE_KEY)
    expect(exported).not.toContain('baseURL')
  })
})
