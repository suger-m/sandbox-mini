import { existsSync, statSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import type { LoadedSandboxConfig, SandboxConfig } from './types'

// 先把最外层值收窄成对象，后面的字段校验才能有明确的错误信息。
function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
}

// 这个 helper 统一处理布尔字段的“必填 / 有默认值”两种情况。
function readBoolean(
  value: unknown,
  label: string,
  defaultValue?: boolean,
): boolean {
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`${label} must be a boolean`)
    }
    return defaultValue
  }

  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`)
  }

  return value
}

// 为了保持配置简单，数组字段目前只接受纯字符串数组。
function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new Error(`${label} must be a string array`)
  }

  return value
}

// allowWrite 只允许指向真实存在的目录，避免把无效路径带到 bwrap 阶段才报错。
function ensureDirectory(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`${label} does not exist: ${path}`)
  }

  if (!statSync(path).isDirectory()) {
    throw new Error(`${label} must be a directory: ${path}`)
  }
}

// 配置里的相对路径以配置文件所在目录为基准解析，和 README 里的用法保持一致。
function resolveAllowWritePaths(paths: string[], configDir: string): string[] {
  return paths.map(entry => {
    const absolutePath = isAbsolute(entry) ? entry : resolve(configDir, entry)
    ensureDirectory(absolutePath, 'filesystem.allowWrite entry')
    return absolutePath
  })
}

export function validateConfigObject(
  raw: unknown,
  configPath: string,
): LoadedSandboxConfig {
  // 这里把原始 JSON 逐步收敛成内部配置对象，尽量在加载阶段把错误报全。
  assertObject(raw, 'config')

  const configDir = dirname(configPath)
  const filesystemValue = raw.filesystem ?? {}
  const networkValue = raw.network ?? {}

  assertObject(filesystemValue, 'filesystem')
  assertObject(networkValue, 'network')

  const config: SandboxConfig = {
    enabled: readBoolean(raw.enabled, 'enabled'),
    allowUnsandboxedCommands: readBoolean(
      raw.allowUnsandboxedCommands,
      'allowUnsandboxedCommands',
      true,
    ),
    excludedCommands:
      raw.excludedCommands === undefined
        ? []
        : readStringArray(raw.excludedCommands, 'excludedCommands'),
    filesystem: {
      allowWrite: resolveAllowWritePaths(
        filesystemValue.allowWrite === undefined
          ? []
          : readStringArray(filesystemValue.allowWrite, 'filesystem.allowWrite'),
        configDir,
      ),
    },
    network: {
      enabled: readBoolean(networkValue.enabled, 'network.enabled', false),
    },
  }

  return {
    ...config,
    configDir,
    configPath,
  }
}

export async function loadConfig(configPath: string): Promise<LoadedSandboxConfig> {
  // 统一转绝对路径，后续打印、校验和相对路径解析都会更稳定。
  const absolutePath = resolve(configPath)

  if (!existsSync(absolutePath)) {
    throw new Error(`config file does not exist: ${absolutePath}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await Bun.file(absolutePath).text())
  } catch (error) {
    // 把 JSON 解析错误重新包装一下，方便 CLI 直接输出更可读的信息。
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`config file is invalid JSON: ${detail}`)
  }

  return validateConfigObject(parsed, absolutePath)
}
