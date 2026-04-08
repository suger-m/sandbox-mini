import { describe, expect, it } from 'bun:test'
import { validateConfigObject } from '../src/config'

describe('validateConfigObject', () => {
  it('resolves allowWrite paths relative to the config file', () => {
    // 验证 README 里的相对路径写法会被正确解析成配置文件所在目录下的绝对路径。
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
    // 配置错误应该在加载阶段就被拦下，而不是拖到真正执行 bwrap 时才暴露。
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
