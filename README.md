# sandbox-mini

`sandbox-mini` 是一个独立的 `TypeScript + Bun` 命令行项目，用来最小复现 Claude Code 里“shell 命令进入沙箱执行”的核心链路。

它关注的是执行层，而不是完整产品层。也就是说，这个项目会真实完成下面几件事：

- 读取一份沙箱配置
- 判断一条命令是否应该进入沙箱
- 对需要进入沙箱的命令用 `bubblewrap` 包装
- 执行命令并输出结果
- 演示“工作区写入成功 / 系统路径写入失败 / 显式绕过沙箱”这几类行为差异

它**不包含**这些能力：

- agent 集成
- 权限弹窗或审批 UI
- 完整的权限系统
- 域名级网络白名单
- 运行时违规记录面板

如果你想理解“Claude Code 为什么既有权限系统又有 shell 沙箱”，这个项目适合作为一份足够小、但又能真实跑起来的参考样例。

## 适用环境

这个项目当前只支持：

- `Linux`
- `WSL2`

不支持：

- Windows 原生环境
- macOS

原因很简单：这个最小复现直接依赖 `bubblewrap`，而 `bubblewrap` 这一套是面向 Linux / WSL2 的。

## 目录结构

```text
sandbox-mini/
  README.md
  package.json
  bunfig.toml
  tsconfig.json
  src/
    cli.ts
    config.ts
    shouldUseSandbox.ts
    bubblewrap.ts
    exec.ts
    types.ts
  examples/
    sandbox.config.json
    workspace/
  tests/
    config.test.ts
    shouldUseSandbox.test.ts
```

每个文件的职责大致如下：

- `src/cli.ts`
  负责解析命令行参数、调度整条执行链、打印最终摘要
- `src/config.ts`
  负责加载并校验配置文件
- `src/shouldUseSandbox.ts`
  负责判断这条命令应不应该进入沙箱
- `src/bubblewrap.ts`
  负责把配置翻译成 `bwrap` 参数
- `src/exec.ts`
  负责真正执行子进程并收集输出
- `tests/*.test.ts`
  负责验证配置校验和判定逻辑

## 环境准备

### 1. 安装 `bubblewrap`

以 Debian / Ubuntu 为例：

```bash
sudo apt update
sudo apt install -y bubblewrap
```

安装完成后可以先检查：

```bash
command -v bwrap
```

如果能输出路径，说明 `bubblewrap` 已经可用。

### 2. 安装 `bun`

官方安装方式：

```bash
curl -fsSL https://bun.sh/install | bash
```

安装完成后检查：

```bash
bun --version
```

### 3. 进入项目目录

```bash
cd sandbox-mini
```

这个项目没有额外第三方依赖，所以不需要执行 `bun install`。

## 第一次使用：推荐流程

如果你是第一次接触这个项目，建议按下面顺序来跑。

### 第 1 步：先看默认配置

项目自带了一份演示配置：

`examples/sandbox.config.json`

内容如下：

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

这份配置表达的意思是：

- 沙箱总开关是开的
- 允许用 `--dangerously-disable-sandbox` 显式绕过沙箱
- `echo *` 这种命令会被视为排除命令，不进入沙箱
- 只有 `examples/workspace` 会被当作可写目录放进沙箱
- 沙箱内默认断网

### 第 2 步：跑一个最简单的命令

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- echo hello
```

这里要注意两个 `--`：

- 第一个 `--` 是给 Bun 的，表示后面的参数全部传给 `cli.ts`
- 第二个 `--` 是给 `sandbox-mini` 的，表示后面的内容是“要执行的目标命令”

这条命令会命中 `excludedCommands: ["echo *"]`，所以它**不会进入沙箱**。

你会看到类似这样的摘要输出：

```text
[sandbox-mini] config: ...
[sandbox-mini] mode: unsandboxed
[sandbox-mini] reason: excludedCommand
[sandbox-mini] command: echo hello
```

然后 stdout 会打印：

```text
hello
```

### 第 3 步：验证工作区内写文件可以成功

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- touch ./examples/workspace/hello.txt
```

这次预期行为是：

- 命令会进入沙箱
- 因为 `examples/workspace` 在 `allowWrite` 白名单里
- 所以写文件应该成功

你可以再检查一下文件是否真的创建出来了：

```bash
ls -l ./examples/workspace
```

### 第 4 步：验证系统路径写入会失败

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- sh -lc 'echo hi > /etc/sandbox-mini-test'
```

这次预期行为是：

- 命令会进入沙箱
- `/etc` 不在可写白名单里
- 写入会失败

这一步很关键，因为它正好演示了“沙箱的价值不是帮你改系统路径，而是把命令能力收缩到安全边界内”。

### 第 5 步：验证显式绕过沙箱

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json --dangerously-disable-sandbox -- sh -lc 'echo hi > /tmp/sandbox-mini-out'
```

这次预期行为是：

- 命令不会进入沙箱
- 摘要里会显示：
  - `mode: unsandboxed`
  - `reason: dangerouslyDisableSandbox`

这个例子主要用来演示“策略允许时，调用者可以显式要求不进沙箱”。

## 配置文件详解

配置文件当前只支持最小字段集合。

### `enabled`

类型：`boolean`

作用：沙箱总开关。

- `true`：允许进入沙箱
- `false`：所有命令都不进入沙箱

### `allowUnsandboxedCommands`

类型：`boolean`

作用：是否允许 `--dangerously-disable-sandbox` 生效。

- `true`：显式绕过标记有效
- `false`：即使传了 `--dangerously-disable-sandbox`，命令仍然按正常规则走

### `excludedCommands`

类型：`string[]`

作用：定义哪些命令应该直接跳过沙箱。

当前支持最小的 `*` 通配，例如：

```json
["echo *", "git status", "python *"]
```

匹配逻辑是基于“格式化后的整条命令文本”做的。

### `filesystem.allowWrite`

类型：`string[]`

作用：定义哪些目录在沙箱里是可写的。

注意点：

- 可以写相对路径，也可以写绝对路径
- 相对路径是**相对于配置文件所在目录**解析的
- 路径必须真实存在，而且必须是目录

例如这份配置：

```json
{
  "filesystem": {
    "allowWrite": ["./workspace"]
  }
}
```

实际解析的是：

```text
examples/workspace
```

### `network.enabled`

类型：`boolean`

作用：控制沙箱内是否允许联网。

- `true`：不额外断网
- `false`：在 `bwrap` 参数里加上 `--unshare-net`

这个最小复现只支持“开 / 关网络”，**不支持域名级白名单**。

## 命令行用法

完整格式：

```bash
bun run src/cli.ts -- --config <path> [--dangerously-disable-sandbox] [--verbose] -- <command> [args...]
```

### 参数说明

#### `--config <path>`

必填。

指定配置文件路径，例如：

```bash
--config ./examples/sandbox.config.json
```

#### `--dangerously-disable-sandbox`

可选。

显式请求这条命令不要进入沙箱。只有当配置里 `allowUnsandboxedCommands=true` 时才会真正生效。

#### `--verbose`

可选。

开启后会额外打印最终包装出来的 `bwrap` 命令，方便你调试参数拼接过程。

#### `--`

很重要。

它后面的内容会被当作“目标命令”原样透传给子进程。例如：

```bash
-- sh -lc 'echo hi > /etc/test'
```

## 从内部看：它的执行流程是什么

从内部实现角度看，一次命令大致走下面这条链：

```text
CLI 参数
  -> 读取配置
  -> 校验配置
  -> shouldUseSandbox()
  -> 如果不进沙箱：直接执行命令
  -> 如果进沙箱：构造 bwrap 参数
  -> 执行子进程
  -> 打印摘要和退出码
```

更具体一点：

### 1. 解析参数

`src/cli.ts` 会先解析：

- 配置文件路径
- 是否显式禁用沙箱
- 是否开启 verbose
- 最终用户命令

### 2. 加载配置

`src/config.ts` 会：

- 读取 JSON
- 检查字段类型
- 解析相对路径
- 验证 `allowWrite` 路径是否真实存在

### 3. 决定是否进沙箱

`src/shouldUseSandbox.ts` 的决策顺序是：

1. 如果 `enabled=false`，直接不进沙箱
2. 如果命中 `excludedCommands`，直接不进沙箱
3. 如果传了 `--dangerously-disable-sandbox` 且配置允许，直接不进沙箱
4. 其他情况默认进入沙箱

### 4. 如果需要，包装成 `bubblewrap`

`src/bubblewrap.ts` 会：

- 检查当前是不是 Linux / WSL2
- 检查 `bwrap` 是否存在
- 生成最终的 `bwrap` 参数
- 把根文件系统只读映射进去
- 把 `allowWrite` 中的目录重新 bind 成可写目录
- 根据配置决定是否 `--unshare-net`

### 5. 执行命令

`src/exec.ts` 会启动子进程，并收集：

- `stdout`
- `stderr`
- `exitCode`
- `signal`

最后由 `src/cli.ts` 统一打印摘要。

## 常见演示场景

### 场景 1：命中排除规则，不进沙箱

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- echo hello
```

看点：

- `mode: unsandboxed`
- `reason: excludedCommand`

### 场景 2：工作区内写入成功

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- touch ./examples/workspace/demo.txt
```

看点：

- `mode: sandboxed`
- 文件成功创建

### 场景 3：系统路径写入失败

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- sh -lc 'echo hi > /etc/demo'
```

看点：

- `mode: sandboxed`
- 写入失败

### 场景 4：显式绕过沙箱

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json --dangerously-disable-sandbox -- sh -lc 'echo hi > /tmp/demo'
```

看点：

- `mode: unsandboxed`
- `reason: dangerouslyDisableSandbox`

## 与原项目的对应关系

这个 demo 保留的是原项目里最小但最有代表性的部分：

- `shouldUseSandbox()` 风格的判定链
- `enabled`
- `excludedCommands`
- `dangerouslyDisableSandbox`
- 基于目录白名单的写权限限制
- 基于 `bubblewrap` 的真实执行包装
- `wrapWithSandbox()` 风格的执行流程

它故意省略了这些更上层的能力：

- `autoAllowBashIfSandboxed`
- `allow / ask / deny` 审批链
- 网络越界授权回调
- 运行时违规存储
- 配置热更新
- agent 编排和工具调用协议

所以你可以把它理解成：

> 这是 Claude Code 沙箱系统里的“命令执行层最小复现”，而不是“整套安全系统最小复现”。

## 测试与验证

### 运行单元测试

```bash
bun test
```

当前测试覆盖：

- 配置校验
- `allowWrite` 路径解析
- `shouldUseSandbox()` 的主要分支

### 手动验证建议

推荐按下面顺序手动验证：

1. 跑 `echo hello`，确认命中 `excludedCommand`
2. 跑工作区写文件命令，确认文件能创建
3. 跑 `/etc/...` 写入命令，确认失败
4. 跑 `--dangerously-disable-sandbox` 命令，确认显示 `unsandboxed`

## 常见报错

### `sandbox-mini only supports Linux/WSL2`

说明你当前不是 Linux / WSL2 环境。

### `bubblewrap is required but was not found on PATH`

说明没有安装 `bwrap`，或者它不在 PATH 里。

先检查：

```bash
command -v bwrap
```

### `config file is invalid JSON: ...`

说明配置文件 JSON 格式有问题，先修正 JSON 语法。

### `filesystem.allowWrite entry does not exist: ...`

说明配置里声明了一个不存在的目录。先创建目录，或改成正确路径。

### `missing \`--\` before the command to execute`

说明你忘了在 CLI 参数和目标命令之间写第二个 `--`。

正确示例：

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- echo hello
```

## 一句话总结

如果你只想快速记住这个项目怎么用，可以记这一句：

```bash
bun run src/cli.ts -- --config ./examples/sandbox.config.json -- <你的命令>
```

它会先判断你的命令该不该进沙箱，再决定是直接执行，还是用 `bubblewrap` 包起来执行。
