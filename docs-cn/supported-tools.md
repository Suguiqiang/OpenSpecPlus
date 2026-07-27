# 支持的工具

OpenSpec 与许多 AI 编程助手一起工作。当你运行 `openspec init`，OpenSpec 使用你活跃的 profile/workflow 选择和交付模式配置所选工具。

## 工作原理

对于每个所选工具，OpenSpec 可以安装：

1. **技能**（如果交付包含 skills）：`.../skills/openspec-*/SKILL.md`
2. **命令**（如果交付包含 commands）：工具特定的 `opsx-*` 命令文件

Codex 仅技能：OpenSpec 为 Codex 安装 `.codex/skills/openspec-*/SKILL.md`，即使交付设置为 `commands`，也不生成 Codex 自定义提示文件。

默认情况下，OpenSpec 使用 `core` 配置文件，包含：
- `propose`
- `explore`
- `apply`
- `sync`
- `archive`

你可以通过 `openspec config profile` 启用扩展工作流（`new`、`continue`、`ff`、`verify`、`bulk-archive`、`onboard`），然后运行 `openspec update`。

## 工具目录参考

| 工具（ID） | 技能路径模式 | 命令路径模式 |
|-----------|---------------------|----------------------|
| Amazon Q Developer (`amazon-q`) | `.amazonq/skills/openspec-*/SKILL.md` | `.amazonq/prompts/opsx-<id>.md` |
| Antigravity (`antigravity`) | `.agent/skills/openspec-*/SKILL.md` | `.agent/workflows/opsx-<id>.md` |
| Auggie (`auggie`) | `.augment/skills/openspec-*/SKILL.md` | `.augment/commands/opsx-<id>.md` |
| IBM Bob Shell (`bob`) | `.bob/skills/openspec-*/SKILL.md` | `.bob/commands/opsx-<id>.md` |
| Claude Code (`claude`) | `.claude/skills/openspec-*/SKILL.md` | `.claude/commands/opsx/<id>.md` |
| Cline (`cline`) | `.cline/skills/openspec-*/SKILL.md` | `.clinerules/workflows/opsx-<id>.md` |
| CodeArts (`codeartsagent`) | `.codeartsdoer/skills/openspec-*/SKILL.md` | 不生成（无命令适配器；使用基于技能的 `/openspec-*` 调用） |
| CodeBuddy (`codebuddy`) | `.codebuddy/skills/openspec-*/SKILL.md` | `.codebuddy/commands/opsx/<id>.md` |
| Codex (`codex`) | `.codex/skills/openspec-*/SKILL.md` | 不生成（仅技能；使用 `.codex/skills/openspec-*`） |
| ForgeCode (`forgecode`) | `.forge/skills/openspec-*/SKILL.md` | 不生成（无命令适配器；使用基于技能的 `/openspec-*` 调用） |
| Continue (`continue`) | `.continue/skills/openspec-*/SKILL.md` | `.continue/prompts/opsx-<id>.prompt` |
| CoStrict (`costrict`) | `.cospec/skills/openspec-*/SKILL.md` | `.cospec/openspec/commands/opsx-<id>.md` |
| Crush (`crush`) | `.crush/skills/openspec-*/SKILL.md` | `.crush/commands/opsx/<id>.md` |
| Cursor (`cursor`) | `.cursor/skills/openspec-*/SKILL.md` | `.cursor/commands/opsx-<id>.md` |
| Factory Droid (`factory`) | `.factory/skills/openspec-*/SKILL.md` | `.factory/commands/opsx-<id>.md` |
| Gemini CLI (`gemini`) | `.gemini/skills/openspec-*/SKILL.md` | `.gemini/commands/opsx/<id>.toml` |
| GitHub Copilot (`github-copilot`) | `.github/skills/openspec-*/SKILL.md` | `.github/prompts/opsx-<id>.prompt.md` |
| Hermes Agent (`hermes`) | `.hermes/skills/openspec-*/SKILL.md` | 不生成（无命令适配器；使用基于技能的 `/openspec-*` 调用） |
| iFlow (`iflow`) | `.iflow/skills/openspec-*/SKILL.md` | `.iflow/commands/opsx-<id>.md` |
| Junie (`junie`) | `.junie/skills/openspec-*/SKILL.md` | `.junie/commands/opsx-<id>.md` |
| Kilo Code (`kilocode`) | `.kilocode/skills/openspec-*/SKILL.md` | `.kilocode/workflows/opsx-<id>.md` |
| Kimi Code (`kimi`) | `.kimi-code/skills/openspec-*/SKILL.md` | 不生成（无命令适配器；使用基于技能的 `/skill:openspec-*` 调用） |
| Kiro (`kiro`) | `.kiro/skills/openspec-*/SKILL.md` | `.kiro/prompts/opsx-<id>.prompt.md` |
| Lingma (`lingma`) | `.lingma/skills/openspec-*/SKILL.md` | `.lingma/commands/opsx/<id>.md` |
| Mistral Vibe (`vibe`) | `.vibe/skills/openspec-*/SKILL.md` | 不生成（无命令适配器；使用基于技能的 `/openspec-*` 调用） |
| Oh My Pi (`oh-my-pi`) | `.omp/skills/openspec-*/SKILL.md` | `.omp/commands/opsx-<id>.md` |
| OpenCode (`opencode`) | `.opencode/skills/openspec-*/SKILL.md` | `.opencode/commands/opsx-<id>.md` |
| Pi (`pi`) | `.pi/skills/openspec-*/SKILL.md` | `.pi/prompts/opsx-<id>.md` |
| Qoder (`qoder`) | `.qoder/skills/openspec-*/SKILL.md` | `.qoder/commands/opsx/<id>.md` |
| Qwen Code (`qwen`) | `.qwen/skills/openspec-*/SKILL.md` | `.qwen/commands/opsx-<id>.md` |
| Zoo Code (`roocode`) | `.roo/skills/openspec-*/SKILL.md` | `.roo/commands/opsx-<id>.md` |
| Trae (`trae`) | `.trae/skills/openspec-*/SKILL.md` | `.trae/commands/opsx-<id>.md` |
| Windsurf (`windsurf`) | `.windsurf/skills/openspec-*/SKILL.md` | `.windsurf/workflows/opsx-<id>.md` |
| ZCode (`zcode`) | `.zcode/skills/openspec-*/SKILL.md` | `.zcode/commands/opsx/<id>.md` |

## 非交互式设置

对于 CI/CD 或脚本化设置，使用 `--tools`（和可选的 `--profile`）：

```bash
# 配置特定工具
openspec init --tools claude,cursor

# 配置所有支持的工具
openspec init --tools all

# 跳过工具配置
openspec init --tools none

# 为此 init 运行覆盖 profile
openspec init --profile core
```

**可用工具 ID（`--tools`）：** `amazon-q`、`antigravity`、`auggie`、`bob`、`claude`、`cline`、`codeartsagent`、`codex`、`forgecode`、`codebuddy`、`continue`、`costrict`、`crush`、`cursor`、`factory`、`gemini`、`github-copilot`、`hermes`、`iflow`、`junie`、`kilocode`、`kimi`、`kiro`、`lingma`、`vibe`、`oh-my-pi`、`opencode`、`pi`、`qoder`、`qwen`、`roocode`、`trae`、`windsurf`、`zcode`

## 工作流依赖的安装

OpenSpec 根据所选工作流安装工作流产出的技能/命令文件：

- **Core 配置文件（默认）：** `propose`、`explore`、`apply`、`sync`、`archive`
- **自定义选择：** 所有工作流 ID 的任意子集

## 生成的技能名称

当被 profile/workflow 配置选择时，OpenSpec 生成这些技能：

- `openspec-propose`
- `openspec-explore`
- `openspec-new-change`
- `openspec-continue-change`
- `openspec-apply-change`
- `openspec-update-change`
- `openspec-ff-change`
- `openspec-sync-specs`
- `openspec-archive-change`
- `openspec-bulk-archive-change`
- `openspec-verify-change`
- `openspec-onboard`

参见 [命令](commands.md) 了解命令行为，[CLI](cli.md) 了解 `init`/`update` 选项。

## 相关

- [CLI 参考](cli.md) — 终端命令
- [命令](commands.md) — 斜杠命令和技能
- [快速上手](getting-started.md) — 首次设置