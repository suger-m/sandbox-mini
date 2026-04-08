import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import type { LoadedSandboxConfig } from './types'

export function assertLinuxLikePlatform(): void {
  if (process.platform !== 'linux') {
    throw new Error('sandbox-mini only supports Linux/WSL2')
  }
}

export function assertBubblewrapAvailable(): void {
  const result = spawnSync('sh', ['-lc', 'command -v bwrap >/dev/null 2>&1'], {
    stdio: 'ignore',
  })

  if (result.status !== 0) {
    throw new Error('bubblewrap is required but was not found on PATH')
  }
}

export function buildBubblewrapArgs(params: {
  config: LoadedSandboxConfig
  commandArgs: string[]
  cwd?: string
}): string[] {
  const cwd = resolve(params.cwd ?? process.cwd())

  const args = [
    '--die-with-parent',
    '--new-session',
    '--unshare-pid',
    '--proc',
    '/proc',
    '--dev',
    '/dev',
    '--ro-bind',
    '/',
    '/',
    '--chdir',
    cwd,
  ]

  if (!params.config.network.enabled) {
    args.push('--unshare-net')
  }

  for (const allowWritePath of params.config.filesystem.allowWrite) {
    args.push('--bind', allowWritePath, allowWritePath)
  }

  args.push('--')
  args.push(...params.commandArgs)

  return args
}
