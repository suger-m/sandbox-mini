// 沙箱决策的最小原因集合，保持和 demo 的行为分支一一对应。
export type SandboxDecisionReason =
  | 'sandboxDisabled'
  | 'excludedCommand'
  | 'dangerouslyDisableSandbox'
  | 'sandboxed'

// 这是最小复现里真正会用到的配置模型，只保留核心开关。
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

// 加载后的配置会额外携带配置文件本身的位置，便于做相对路径解析。
export interface LoadedSandboxConfig extends SandboxConfig {
  configPath: string
  configDir: string
}

// 决策结果同时给出布尔值和原因，方便 CLI 在输出里解释“为什么进/不进沙箱”。
export interface SandboxDecision {
  useSandbox: boolean
  reason: SandboxDecisionReason
  matchedPattern?: string
  commandText: string
}

// CLI 只解析这几个最小参数，不引入更复杂的子命令体系。
export interface CliOptions {
  configPath: string
  dangerouslyDisableSandbox: boolean
  verbose: boolean
  commandArgs: string[]
}

// 统一描述一次子进程执行结果，供 CLI 最后打印和透传退出码。
export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
  signal: NodeJS.Signals | null
}
