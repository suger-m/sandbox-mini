import type { LoadedSandboxConfig, SandboxDecision } from './types'

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

export function formatCommandText(commandArgs: string[]): string {
  return commandArgs
    .map(arg => (/\s/.test(arg) ? JSON.stringify(arg) : arg))
    .join(' ')
}

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

  return {
    useSandbox: true,
    reason: 'sandboxed',
    commandText,
  }
}
