export type SandboxDecisionReason =
  | 'sandboxDisabled'
  | 'excludedCommand'
  | 'dangerouslyDisableSandbox'
  | 'sandboxed'

export interface SandboxConfig {
  enabled: boolean
  allowUnsandboxedCommands: boolean
  excludedCommands: string[]
  filesystem: {
    allowWrite: string[]
  }
  network: {
    enabled: boolean
  }
}

export interface LoadedSandboxConfig extends SandboxConfig {
  configPath: string
  configDir: string
}

export interface SandboxDecision {
  useSandbox: boolean
  reason: SandboxDecisionReason
  matchedPattern?: string
  commandText: string
}

export interface CliOptions {
  configPath: string
  dangerouslyDisableSandbox: boolean
  verbose: boolean
  commandArgs: string[]
}

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
  signal: NodeJS.Signals | null
}
