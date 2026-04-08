# sandbox-mini

A minimal executable reproduction of Claude Code's shell sandbox flow for `Linux / WSL2`, implemented as a standalone `TypeScript + Bun` CLI.

This project intentionally reproduces only the execution layer:

- load sandbox config
- decide whether a command should be sandboxed
- wrap sandboxed commands with `bubblewrap`
- run the command and report the result

It does not include:

- agent integration
- approval UI
- the full permission system
- domain-level network allowlists

## Requirements

- Linux or WSL2
- `bun`
- `bubblewrap` available as `bwrap`

Example install on Debian/Ubuntu:

```bash
sudo apt update
sudo apt install -y bubblewrap
curl -fsSL https://bun.sh/install | bash
```

## Quick Start

```bash
cd sandbox-mini
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- echo hello
```

## Config

`examples/sandbox.config.json`

```json
{
  "enabled": true,
  "allowUnsandboxedCommands": true,
  "excludedCommands": ["echo *"],
  "filesystem": {
    "allowWrite": ["./workspace"]
  },
  "network": {
    "enabled": false
  }
}
```

Rules:

- `enabled=false` means all commands run unsandboxed
- `excludedCommands` supports `*` glob matching against the full command text
- `--dangerously-disable-sandbox` only works when `allowUnsandboxedCommands=true`
- `filesystem.allowWrite` entries are resolved relative to the config file directory
- `network.enabled=false` maps to `bwrap --unshare-net`

## Demo Scenarios

### 1. Workspace write succeeds

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- touch ./examples/workspace/hello.txt
```

Expected:

- mode is `sandboxed`
- file creation succeeds

### 2. System-path write fails

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- sh -lc 'echo hi > /etc/sandbox-mini-test'
```

Expected:

- mode is `sandboxed`
- write fails because `/etc` is not writable inside the sandbox

### 3. Explicit bypass skips sandbox

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json --dangerously-disable-sandbox -- sh -lc 'echo hi > /tmp/sandbox-mini-out'
```

Expected:

- mode is `unsandboxed`
- reason is `dangerouslyDisableSandbox`

### 4. Excluded command skips sandbox

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- echo hello
```

Expected:

- mode is `unsandboxed`
- reason is `excludedCommand`

## CLI

```bash
bun run src/cli.ts -- --config <path> [--dangerously-disable-sandbox] [--verbose] -- <command> [args...]
```

Flags:

- `--config <path>`: path to JSON config
- `--dangerously-disable-sandbox`: request an unsandboxed run
- `--verbose`: print the full wrapped `bwrap` command

Everything after `--` is passed directly to the child process.

## How It Maps to the Original Project

This demo preserves the smallest useful slice of the original architecture:

- `shouldUseSandbox()` style decision logic
- `enabled`
- `excludedCommands`
- `dangerouslyDisableSandbox`
- write allowlist based sandboxing
- network on/off restriction
- `wrapWithSandbox()` style execution flow

It deliberately omits:

- `autoAllowBashIfSandboxed`
- permission prompts
- network permission callbacks
- runtime violation stores
- configuration hot reload

## Testing

Run the logic tests:

```bash
bun test
```

Manual verification:

1. Run the workspace write example and confirm the file appears in `examples/workspace`
2. Run the `/etc` write example and confirm it fails
3. Run the bypass example and confirm the summary says `unsandboxed`
