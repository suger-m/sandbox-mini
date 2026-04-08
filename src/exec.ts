import { spawn } from 'node:child_process'
import type { CommandResult } from './types'

export async function runCommand(params: {
  command: string
  args: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
}): Promise<CommandResult> {
  return await new Promise((resolvePromise, reject) => {
    // stdio 选择成“继承 stdin + 捕获 stdout/stderr”，方便 CLI 做统一摘要输出。
    const child = spawn(params.command, params.args, {
      cwd: params.cwd,
      env: params.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    // 先把输出完整收集起来，再由上层按需要打印和透传退出码。
    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    child.on('error', error => {
      reject(error)
    })

    // 这里把 close 事件统一转换成结构化结果，避免上层直接和 child process 事件打交道。
    child.on('close', (code, signal) => {
      resolvePromise({
        exitCode: code ?? 1,
        stdout,
        stderr,
        signal,
      })
    })
  })
}
