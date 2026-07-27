# 命令如何工作

**需要知道的一件事：OpenSpec 有两种命令，它们在两个不同的地方运行。**

- `openspec ...` 命令在**终端**中运行。（例如：`openspec init`。）
- `/opsx:...` 命令在**你的 AI 助手聊天框**中运行。（例如：`/opsx:propose`。）

如果你曾经在终端中输入 `/opsx:propose` 而没有任何反应，这就是原因。你在和 OpenSpec 的错误一半说话。斜杠命令不是终端命令。它们是你在聊天框中给 AI 编程助手的指令，就是你平时输入"添加一个登录表单"的同一个框。

这个单一区分是新用户最常见的绊脚石，所以让我们把它彻底搞清楚。

## 两个部分

OpenSpec 是一个项目戴两顶帽子。

**CLI（终端部分）。**一个名为 `openspec` 的程序，你安装并在 shell 中运行。它设置你的项目，列出和验证变更，展示仪表板，归档完成的工作。你在 iTerm、VS Code 终端、PowerShell 等任何你运行 `git` 或 `npm` 的地方输入它们。

```bash
openspec init        # 在此项目中设置 OpenSpec
openspec list        # 查看活跃变更
openspec view        # 打开交互式仪表板
```

**斜杠命令（聊天部分）。**短命令如 `/opsx:propose` 和 `/opsx:apply`，你在 AI 助手中输入。这些告诉 AI 遵循 OpenSpec 工作流：起草提案、写规范、按任务清单构建、完成时归档。你在 Claude Code、Cursor、Windsurf、Copilot 或你使用的任何助手中输入它们。

```text
/opsx:propose add-dark-mode    （在你的 AI 聊天中输入）
/opsx:apply                    （在你的 AI 聊天中输入）
/opsx:archive                  （在你的 AI 聊天中输入）
```

这就是一张图的心智模型：

```text
        你的终端                           你的 AI 助手聊天
   ┌──────────────────────┐               ┌──────────────────────────────┐
   │  $ openspec init     │   安装命令    │  /opsx:propose add-dark-mode  │
   │  $ openspec list     │  ──────────►  │  /opsx:apply                  │
   │  $ openspec view     │   和技能      │  /opsx:archive                │
   └──────────────────────┘               └──────────────────────────────┘
        在这里运行 openspec                    在这里运行 /opsx:*
```

注意箭头。在终端中运行 `openspec init` 是*安装*斜杠命令到你的 AI 工具中的操作。终端部分设置聊天部分。之后，日常操作主要在聊天中进行。

## "如何启动交互模式？"

**没有单独的交互模式需要启动。**这个问题经常被问到，所以值得一个明确的回答。

你不进入特殊的 OpenSpec 模式。你只需像往常一样打开你的 AI 编程助手，在聊天中输入一个斜杠命令。斜杠命令*就是*你"进入"OpenSpec 的方式。你的助手识别它，加载匹配的 OpenSpec 技能，并开始遵循工作流。

所以真正的指令是：

1. 在你的项目中打开你的 AI 编程助手（Claude Code、Cursor、Windsurf 等）。
2. 在它的聊天中输入 `/opsx:propose`，和你输入任何其他请求一样。
3. 观察自动补全：如果 OpenSpec 已安装，你会看到 `/opsx:propose`、`/opsx:apply` 等在你输入斜杠时出现。

就这样。没有模式需要切换，没有守护进程需要启动，没有单独的窗口。

一个真正交互的东西在终端中：`openspec view`。它打开一个仪表板用于浏览你的规范和变更。但那是查看器，不是你用来提案和构建的东西。构建通过聊天中的斜杠命令进行。

## 为什么存在这种分离

这值得理解，因为它解释了为什么 OpenSpec 能用于 25+ 种不同的 AI 工具。

CLI 是**引擎**。它知道规则：变更文件夹长什么样，哪些产出物依赖哪些，如何将增量规范合并到你的真理之源。它在所有地方都一样。

斜杠命令是**方向盘**，每个 AI 工具的方式略有不同。Claude Code 叫它们 commands。Cursor 和 Windsurf 有它们自己的格式。有些工具叫它们 skills。当你运行 `openspec init`，OpenSpec 为你选择的每个工具生成正确类型的文件，所以相同的 `/opsx:propose` 意图无论你使用哪个助手都能工作。

这个设计的优势：你学一次工作流，跨工具携带。代价：命令的确切语法在不同工具间可能略有差异。

## 各工具的斜杠命令语法

意图在所有地方都一样。标点符号不同。使用匹配你助手的方式。

| 工具 | 你的输入方式 |
|------|---------------|
| Claude Code | `/opsx:propose`、`/opsx:apply` |
| Cursor | `/opsx-propose`、`/opsx-apply` |
| Windsurf | `/opsx-propose`、`/opsx-apply` |
| GitHub Copilot（IDE） | `/opsx-propose`、`/opsx-apply` |
| CodeArts | 技能风格，如 `/openspec-propose` |
| Codex | 技能风格，通过 `.codex/skills/openspec-*` |
| Oh My Pi | `/opsx-propose`、`/opsx-apply` |
| Kimi CLI | 技能风格，如 `/skill:openspec-propose` |
| Trae | `/opsx-propose`、`/opsx-apply` |

大多数工具使用冒号形式（`/opsx:propose`）或横线形式（`/opsx-propose`）。一些工具将 OpenSpec 展示为命名技能而非斜杠命令；对这些你需要按名称调用技能。完整的按工具列表，包括每个工具确切写入哪些文件，在 [支持的工具](supported-tools.md) 中。

不确定时，在你的 AI 聊天中输入一个斜杠并查看自动补全。你的工具会显示它期望的格式。

## 命令是如何到达的：技能和命令

当你运行 `openspec init`（或 `openspec update`），OpenSpec 在你的项目中写入小文件，以便你的 AI 工具能找到工作流。根据你的工具和设置，这些是**技能**、**命令**，或两者都有。

- **技能**位于 `.claude/skills/openspec-*/SKILL.md` 等位置。它们是新兴的跨工具标准：一个你的助手自动检测的指令文件夹。
- **命令**位于 `.claude/commands/opsx/<id>.md` 等位置。它们是较老的按工具斜杠命令文件。Codex 不生成命令文件；使用 `.codex/skills/openspec-*`。

你不需要关心你的工具使用哪种。你只需输入斜杠命令，它就能工作。但知道这些文件存在有助于在出问题时排查：如果你的命令消失了，通常意味着这些文件缺失或过时，`openspec update` 重新生成它们。

## 确认它已安装

快速检查，最快优先：

1. **在你的 AI 聊天中输入一个斜杠。**开始输入 `/opsx` 并观察自动补全建议。如果它们出现，你就设置好了。
2. **查找文件。**对于 Claude Code，检查 `.claude/skills/` 是否包含 `openspec-*` 文件夹。其他工具使用自己的目录（[支持的工具](supported-tools.md) 列出了它们）。
3. **重新运行设置。**从你的项目根目录运行 `openspec update`。这为你配置的任何工具重新生成技能和命令文件。
4. **重启你的助手。**许多工具在启动时扫描技能和命令，所以一个新窗口可能是缺失的步骤。

## 我到底有哪些命令？

默认情况下，OpenSpec 安装**核心**斜杠命令集：

- `/opsx:explore`：在承诺变更之前与 AI 一起理清思路（不确定时的绝佳第一步）
- `/opsx:propose`：创建变更并一次性起草所有规划产出物
- `/opsx:apply`：通过清单方式构建变更
- `/opsx:sync`：将变更的规范更新合并到你的主规范中（通常自动）
- `/opsx:archive`：完成变更并归档

如果你想要扩展工作流（`/opsx:new`、`/opsx:continue`、`/opsx:ff`、`/opsx:verify`、`/opsx:bulk-archive`、`/opsx:onboard`），通过 `openspec config profile` 选择，然后用 `openspec update` 应用。