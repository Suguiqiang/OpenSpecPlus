# 命令

这是 OpenSpec 斜杠命令的参考。这些命令在你的 AI 编程助手聊天界面中调用（如 Claude Code、Cursor、Windsurf）。

工作流模式以及何时使用每个命令参见 [工作流](workflows.md)。CLI 命令参见 [CLI](cli.md)。

## 快速参考

### 默认快速路径（`core` 配置文件）

| 命令 | 用途 |
|---------|---------|
| `/opsx:propose` | 创建变更并一步生成规划产出物 |
| `/opsx:explore` | 在承诺变更之前理清思路 |
| `/opsx:apply` | 从变更实施任务 |
| `/opsx:update` | 修订变更的规划产出物并保持它们一致 |
| `/opsx:sync` | 将增量规范合并到主规范 |
| `/opsx:archive` | 归档已完成的变更 |

### 扩展工作流命令（自定义工作流选择）

| 命令 | 用途 |
|---------|---------|
| `/opsx:new` | 开始新变更搭建 |
| `/opsx:continue` | 基于依赖创建下一个产出物 |
| `/opsx:ff` | 快进：一次性创建所有规划产出物 |
| `/opsx:verify` | 验证实施匹配产出物 |
| `/opsx:bulk-archive` | 一次性归档多个变更 |
| `/opsx:onboard` | 通过完整工作流的引导式教程 |

默认全局配置文件是 `core`。要启用扩展工作流命令，运行 `openspec config profile`，选择工作流，然后在项目中运行 `openspec update`。

## 命令参考

### `/opsx:propose`

创建新变更并一步生成规划产出物。这是 `core` 配置文件中的默认开始命令。

**语法：** `/opsx:propose [change-name-or-description]`

**它做什么：**
- 创建 `openspec/changes/<change-name>/`
- 生成实施前需要的产出物（对于 `spec-driven`：proposal、specs、design、tasks）
- 当变更准备好 `/opsx:apply` 时停止

### `/opsx:explore`

> **当你不确定时从这里开始。**Explore 是一个零风险思考伙伴：它阅读你的代码库，比较选项，在变更存在之前把模糊想法锐化成具体计划。它默认就有。

在承诺变更之前理清思路、调查问题、澄清需求。

**语法：** `/opsx:explore [topic]`

**它做什么：**
- 开启一个无结构要求的探索性对话
- 调查代码库回答问题
- 比较选项和方案
- 创建可视化图表澄清思路
- 当洞察结晶时可以过渡到 `/opsx:propose`

### `/opsx:new`

开始新变更搭建。创建变更文件夹并等待你用 `/opsx:continue` 或 `/opsx:ff` 生成产出物。

此命令是扩展工作流集的一部分。

**语法：** `/opsx:new [change-name] [--schema <schema-name>]`

### `/opsx:continue`

在依赖链中创建下一个产出物。一次创建一个产出物用于增量进展。

**语法：** `/opsx:continue [change-name]`

### `/opsx:ff`

快进通过产出物创建。一次性创建所有规划产出物。

**语法：** `/opsx:ff [change-name]`

### `/opsx:apply`

从变更实施任务。通过任务清单工作，写代码并检查项目。

**语法：** `/opsx:apply [change-name]`

### `/opsx:update`

修订变更的现有规划产出物并保持它们彼此一致。仅规划产出物——它从不编辑代码。

**语法：** `/opsx:update [change-name]`

### `/opsx:verify`

验证实施匹配你的变更产出物。检查完整性、正确性和一致性。

**语法：** `/opsx:verify [change-name]`

**验证维度：**

| 维度 | 它验证什么 |
|-----------|-------------------|
| **完整性** | 所有任务完成，所有需求实现，场景覆盖 |
| **正确性** | 实现匹配规范意图，边缘情况处理 |
| **一致性** | 设计决策反映在代码中，模式一致 |

### `/opsx:sync`

**可选命令。**将变更的增量规范合并到主规范。归档如果需要同步会提示，所以你通常不需要手动运行。

**语法：** `/opsx:sync [change-name]`

### `/opsx:archive`

归档已完成的变更。完成变更并将其移动到归档文件夹。

**语法：** `/opsx:archive [change-name]`

### `/opsx:bulk-archive`

一次性归档多个已完成的变更。处理变更之间的规范冲突。

**语法：** `/opsx:bulk-archive [change-names...]`

### `/opsx:onboard`

通过完整 OpenSpec 工作流的引导式入门。使用你实际代码库的交互式教程。

**语法：** `/opsx:onboard`

## 各 AI 工具的斜杠命令语法

不同 AI 工具使用略有不同的命令语法。使用匹配你工具的格式：

| 工具 | 语法示例 |
|------|----------------|
| Claude Code | `/opsx:propose`、`/opsx:apply` |
| Cursor | `/opsx-propose`、`/opsx-apply` |
| Windsurf | `/opsx-propose`、`/opsx-apply` |
| Copilot（IDE） | `/opsx-propose`、`/opsx-apply` |
| CodeArts | 基于技能的调用，如 `/openspec-propose` |
| Codex | 通过 `.codex/skills/openspec-*` 的基于技能调用 |
| Oh My Pi | `/opsx-propose`、`/opsx-apply` |
| Kimi Code | 基于技能的调用，如 `/skill:openspec-propose` |
| Trae | `/opsx-propose`、`/opsx-apply` |

意图在工具间相同，但命令如何展示可能因集成而不同。