import { existsSync, statSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import type { LoadedSandboxConfig, SandboxConfig } from './types'

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
}

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

function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new Error(`${label} must be a string array`)
  }

  return value
}

function ensureDirectory(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new Error(`${label} does not exist: ${path}`)
  }

  if (!statSync(path).isDirectory()) {
    throw new Error(`${label} must be a directory: ${path}`)
  }
}

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
  const absolutePath = resolve(configPath)

  if (!existsSync(absolutePath)) {
    throw new Error(`config file does not exist: ${absolutePath}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await Bun.file(absolutePath).text())
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`config file is invalid JSON: ${detail}`)
  }

  return validateConfigObject(parsed, absolutePath)
}
