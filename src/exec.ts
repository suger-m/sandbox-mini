import { spawn } from 'node:child_process'
import type { CommandResult } from './types'

export async function runCommand(params: {
  command: string
  args: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
}): Promise<CommandResult> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(params.command, params.args, {
      cwd: params.cwd,
      env: params.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    child.on('error', error => {
      reject(error)
    })

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
