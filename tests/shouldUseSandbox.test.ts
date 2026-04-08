import { describe, expect, it } from 'bun:test'
import { shouldUseSandbox } from '../src/shouldUseSandbox'
import type { LoadedSandboxConfig } from '../src/types'

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
    const decision = shouldUseSandbox({
      commandArgs: ['touch', './examples/workspace/file.txt'],
      config: baseConfig,
      dangerouslyDisableSandbox: false,
    })

    expect(decision.useSandbox).toBe(true)
    expect(decision.reason).toBe('sandboxed')
  })

  it('skips sandbox for excluded commands', () => {
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
    const decision = shouldUseSandbox({
      commandArgs: ['sh', '-lc', 'echo hi > /tmp/out'],
      config: baseConfig,
      dangerouslyDisableSandbox: true,
    })

    expect(decision.useSandbox).toBe(false)
    expect(decision.reason).toBe('dangerouslyDisableSandbox')
  })

  it('ignores explicit bypass when policy disallows it', () => {
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
