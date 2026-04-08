#!/usr/bin/env bun

import { resolve } from 'node:path'
import { assertBubblewrapAvailable, assertLinuxLikePlatform, buildBubblewrapArgs } from './bubblewrap'
import { loadConfig } from './config'
import { runCommand } from './exec'
import { shouldUseSandbox } from './shouldUseSandbox'
import type { CliOptions } from './types'

function printUsage(): void {
  console.error(`Usage:
  bun run src/cli.ts -- --config <path> [--dangerously-disable-sandbox] [--verbose] -- <command> [args...]

Examples:
  bun run src/cli.ts -- --config ./examples/sandbox.config.json -- touch ./examples/workspace/hello.txt
  bun run src/cli.ts -- --config ./examples/sandbox.config.json -- sh -lc 'echo hi > /etc/test'
  bun run src/cli.ts -- --config ./examples/sandbox.config.json --dangerously-disable-sandbox -- sh -lc 'echo hi > /tmp/out'
`)
}

function parseCliArgs(argv: string[]): CliOptions {
  let configPath = ''
  let dangerouslyDisableSandbox = false
  let verbose = false
  let separatorIndex = -1

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--') {
      separatorIndex = index
      break
    }

    if (token === '--config') {
      configPath = argv[index + 1] ?? ''
      index += 1
      continue
    }

    if (token === '--dangerously-disable-sandbox') {
      dangerouslyDisableSandbox = true
      continue
    }

    if (token === '--verbose') {
      verbose = true
      continue
    }

    if (token === '--help' || token === '-h') {
      printUsage()
      process.exit(0)
    }

    throw new Error(`unknown argument: ${token}`)
  }

  if (!configPath) {
    throw new Error('--config is required')
  }

  if (separatorIndex === -1) {
    throw new Error('missing `--` before the command to execute')
  }

  const commandArgs = argv.slice(separatorIndex + 1)
  if (commandArgs.length === 0) {
    throw new Error('missing command after `--`')
  }

  return {
    configPath,
    dangerouslyDisableSandbox,
    verbose,
    commandArgs,
  }
}

function printSummary(summary: {
  configPath: string
  useSandbox: boolean
  reason: string
  matchedPattern?: string
  commandText: string
  wrappedCommand?: string
}): void {
  console.error(`[sandbox-mini] config: ${summary.configPath}`)
  console.error(
    `[sandbox-mini] mode: ${summary.useSandbox ? 'sandboxed' : 'unsandboxed'}`,
  )
  console.error(`[sandbox-mini] reason: ${summary.reason}`)
  if (summary.matchedPattern) {
    console.error(`[sandbox-mini] matched excluded pattern: ${summary.matchedPattern}`)
  }
  console.error(`[sandbox-mini] command: ${summary.commandText}`)
  if (summary.wrappedCommand) {
    console.error(`[sandbox-mini] wrapped: ${summary.wrappedCommand}`)
  }
}

async function main(): Promise<void> {
  try {
    const options = parseCliArgs(process.argv.slice(2))
    const config = await loadConfig(options.configPath)
    const decision = shouldUseSandbox({
      commandArgs: options.commandArgs,
      config,
      dangerouslyDisableSandbox: options.dangerouslyDisableSandbox,
    })

    let executable = options.commandArgs[0]
    let executableArgs = options.commandArgs.slice(1)

    if (decision.useSandbox) {
      assertLinuxLikePlatform()
      assertBubblewrapAvailable()
      executable = 'bwrap'
      executableArgs = buildBubblewrapArgs({
        config,
        commandArgs: options.commandArgs,
      })
    }

    printSummary({
      configPath: config.configPath,
      useSandbox: decision.useSandbox,
      reason: decision.reason,
      matchedPattern: decision.matchedPattern,
      commandText: decision.commandText,
      wrappedCommand: options.verbose
        ? [executable, ...executableArgs].join(' ')
        : undefined,
    })

    const result = await runCommand({
      command: executable,
      args: executableArgs,
      cwd: resolve(process.cwd()),
      env: process.env,
    })

    if (result.stdout) {
      process.stdout.write(result.stdout)
    }

    if (result.stderr) {
      process.stderr.write(result.stderr)
    }

    console.error(`[sandbox-mini] exit code: ${result.exitCode}`)
    if (result.signal) {
      console.error(`[sandbox-mini] signal: ${result.signal}`)
    }

    process.exit(result.exitCode)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error(`[sandbox-mini] error: ${detail}`)
    printUsage()
    process.exit(1)
  }
}

void main()
