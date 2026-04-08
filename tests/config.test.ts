import { describe, expect, it } from 'bun:test'
import { validateConfigObject } from '../src/config'

describe('validateConfigObject', () => {
  it('resolves allowWrite paths relative to the config file', () => {
    const config = validateConfigObject(
      {
        enabled: true,
        allowUnsandboxedCommands: true,
        excludedCommands: ['echo *'],
        filesystem: {
          allowWrite: ['./workspace'],
        },
        network: {
          enabled: false,
        },
      },
      'd:/vibe/sandbox-mini/examples/sandbox.config.json',
    )

    expect(config.filesystem.allowWrite[0]).toBe(
      'd:\\vibe\\sandbox-mini\\examples\\workspace',
    )
  })

  it('rejects invalid allowWrite entries', () => {
    expect(() =>
      validateConfigObject(
        {
          enabled: true,
          filesystem: {
            allowWrite: [123],
          },
          network: {
            enabled: false,
          },
        },
        'd:/vibe/sandbox-mini/examples/sandbox.config.json',
      ),
    ).toThrow('filesystem.allowWrite must be a string array')
  })
})
