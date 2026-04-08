import { describe, expect, it } from 'bun:test'
import { shouldUseSandbox } from '../src/shouldUseSandbox'
import type { LoadedSandboxConfig } from '../src/types'

// 共享一份最小基准配置，方便每个测试只关注自己要验证的分支。
const baseConfig: LoadedSandboxConfig = {
  configDir: '/tmp/sandbox-mini/examples',
  configPath: '/tmp/sandbox-mini/examples/sandbox.config.json',
  enabled: true,
  allowUnsandboxedCommands: true,
  excludedCommands: [],
  filesystem: {
    allowWrite: ['/tmp/sandbox-mini/examples/workspace'],
  },
  network: {
    enabled: false,
  },
}

describe('shouldUseSandbox', () => {
  it('sandboxes commands when enabled', () => {
    // 默认路径：只要没命中任何绕过条件，就应该进入沙箱。
    const decision = shouldUseSandbox({
      commandArgs: ['touch', './examples/workspace/file.txt'],
      config: baseConfig,
      dangerouslyDisableSandbox: false,
    })

    expect(decision.useSandbox).toBe(true)
    expect(decision.reason).toBe('sandboxed')
  })

  it('skips sandbox for excluded commands', () => {
    // excludedCommands 的优先级要高于默认进沙箱。
    const decision = shouldUseSandbox({
      commandArgs: ['echo', 'hello'],
      config: {
        ...baseConfig,
        excludedCommands: ['echo *'],
      },
      dangerouslyDisableSandbox: false,
    })

    expect(decision.useSandbox).toBe(false)
    expect(decision.reason).toBe('excludedCommand')
    expect(decision.matchedPattern).toBe('echo *')
  })

  it('honors explicit sandbox bypass when allowed', () => {
    // 当策略允许时，显式绕过标记应该把命令留在沙箱外执行。
    const decision = shouldUseSandbox({
      commandArgs: ['sh', '-lc', 'echo hi > /tmp/out'],
      config: baseConfig,
      dangerouslyDisableSandbox: true,
    })

    expect(decision.useSandbox).toBe(false)
    expect(decision.reason).toBe('dangerouslyDisableSandbox')
  })

  it('ignores explicit bypass when policy disallows it', () => {
    // 如果配置禁用了无沙箱命令，显式绕过也必须失效。
    const decision = shouldUseSandbox({
      commandArgs: ['sh', '-lc', 'echo hi > /tmp/out'],
      config: {
        ...baseConfig,
        allowUnsandboxedCommands: false,
      },
      dangerouslyDisableSandbox: true,
    })

    expect(decision.useSandbox).toBe(true)
    expect(decision.reason).toBe('sandboxed')
  })

  it('skips sandbox when globally disabled', () => {
    // 全局关闭开关是最外层短路条件。
    const decision = shouldUseSandbox({
      commandArgs: ['touch', './examples/workspace/file.txt'],
      config: {
        ...baseConfig,
        enabled: false,
      },
      dangerouslyDisableSandbox: false,
    })

    expect(decision.useSandbox).toBe(false)
    expect(decision.reason).toBe('sandboxDisabled')
  })
})
