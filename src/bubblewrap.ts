import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import type { LoadedSandboxConfig } from './types'

// 这个最小复现只支持 Linux / WSL2，因为底层直接依赖 bubblewrap。
export function assertLinuxLikePlatform(): void {
  if (process.platform !== 'linux') {
    throw new Error('sandbox-mini only supports Linux/WSL2')
  }
}

// 在真正拼接 bwrap 参数前先检查可执行文件是否存在，报错会更直接。
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
  // cwd 始终转成绝对路径，避免 chdir 和 bind 路径混用相对路径造成歧义。
  const cwd = resolve(params.cwd ?? process.cwd())

  // 这里采用“先把根文件系统只读映射进来，再单独放开可写目录”的最小模型。
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

  // 最小复现里不做域名白名单，网络只分成“开”或“关”两种模式。
  if (!params.config.network.enabled) {
    args.push('--unshare-net')
  }

  // allowWrite 里的路径会被重新 bind 成可写挂载点，用来演示工作区放行。
  for (const allowWritePath of params.config.filesystem.allowWrite) {
    args.push('--bind', allowWritePath, allowWritePath)
  }

  // `--` 之后的参数全部原样交给用户命令。
  args.push('--')
  args.push(...params.commandArgs)

  return args
}
