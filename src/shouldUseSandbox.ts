import type { LoadedSandboxConfig, SandboxDecision } from './types'

// 先转义普通字符，再把 * 展开成正则里的任意匹配，形成最小 glob 支持。
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split('*')
    .map(fragment => escapeRegex(fragment))
    .join('.*')

  return new RegExp(`^${escaped}$`)
}

// 这里把命令重新格式化成可展示、可匹配的文本形式，便于 excludedCommands 复用。
export function formatCommandText(commandArgs: string[]): string {
  return commandArgs
    .map(arg => (/\s/.test(arg) ? JSON.stringify(arg) : arg))
    .join(' ')
}

// 只要命中第一条规则就返回，保持“按声明顺序短路”的行为。
export function matchExcludedCommand(
  patterns: string[],
  commandText: string,
): string | undefined {
  return patterns.find(pattern => globToRegExp(pattern).test(commandText))
}

export function shouldUseSandbox(params: {
  commandArgs: string[]
  config: LoadedSandboxConfig
  dangerouslyDisableSandbox: boolean
}): SandboxDecision {
  // 决策顺序故意保持简单：全局关闭 -> 排除命令 -> 显式绕过 -> 默认进沙箱。
  const commandText = formatCommandText(params.commandArgs)

  if (!params.config.enabled) {
    return {
      useSandbox: false,
      reason: 'sandboxDisabled',
      commandText,
    }
  }

  const matchedPattern = matchExcludedCommand(
    params.config.excludedCommands,
    commandText,
  )
  if (matchedPattern) {
    return {
      useSandbox: false,
      reason: 'excludedCommand',
      matchedPattern,
      commandText,
    }
  }

  if (
    params.dangerouslyDisableSandbox &&
    params.config.allowUnsandboxedCommands
  ) {
    return {
      useSandbox: false,
      reason: 'dangerouslyDisableSandbox',
      commandText,
    }
  }

  // 没命中任何绕过条件时，默认把命令送进沙箱执行。
  return {
    useSandbox: true,
    reason: 'sandboxed',
    commandText,
  }
}
