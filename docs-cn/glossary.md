# 术语表

每个 OpenSpec 术语在一个地方，用通俗语言定义。浏览一遍，剩下的文档读起来更快。

术语按主题分组，每组内按字母排序。

## 核心名词

**规范（Spec）。**描述你系统某部分如何行为的文档。规范位于 `openspec/specs/`，按领域组织，由需求和场景组成。规范是"这个软件做什么"的公认答案。参见 [概念](concepts.md#specs)。

**真理之源（Source of truth）。**`openspec/specs/` 目录的整体。它保存你系统当前的、公认的行为。变更提议编辑它；归档应用这些编辑。

**变更（Change）。**一个工作单元，打包为 `openspec/changes/<name>/` 下的一个文件夹。一个变更包含关于该工作的所有内容：其提案、设计、任务和它引入的规范编辑。一个变更，一个功能或修复。

**产出物（Artifact）。**变更内的一个文档。标准产出物是提案、增量规范、设计和任务。它们按依赖顺序创建，互相喂给。

**增量规范（Delta spec）。**变更内的一个规范，仅描述变化，使用 `ADDED`、`MODIFIED` 和 `REMOVED` 章节，而不是重述整个规范。这是让 OpenSpec 干净地编辑现有系统的关键。参见 [概念](concepts.md#delta-specs)。

**领域（Domain）。**规范的一个逻辑分组，如 `auth/`、`payments/` 或 `ui/`。你选择的领域匹配你如何思考你的系统。

## 规范内部

**需求（Requirement）。**系统必须具有的一个行为，通常用 RFC 2119 关键词书写："系统 SHALL 在 30 分钟后使会话过期。"需求陈述*什么*，而非*如何*。

**场景（Scenario）。**需求在行动中的一个具体的、可测试的示例，通常是 Given/When/Then 形式。场景使需求可验证：你可以从中写一个自动化测试。

**RFC 2119 关键词。**MUST、SHALL、SHOULD 和 MAY 这些词，它们携带关于需求严格程度的标准化含义。MUST 和 SHALL 是绝对的。SHOULD 是推荐但有例外空间。MAY 是可选的。名字来自定义它们的互联网标准文档。

## 产出物

**提案（proposal.md）。**变更的*为什么*和*是什么*：其意图、范围和高级方案。你创建的第一个产出物。

**设计（design.md）。**变更的*怎么做*：技术方案、架构决策和你预期触碰的文件。对于简单变更可选。

**任务（tasks.md）。**实施检查清单，带复选框。AI 在 `/opsx:apply` 期间按清单工作，逐项检查。

## 生命周期

**归档（Archive）。**完成变更的动作。其增量规范合并到主规范，变更文件夹移到 `openspec/changes/archive/YYYY-MM-DD-<name>/`。归档后，你的规范描述新的现实。参见 [概念](concepts.md#archive)。

**同步（Sync）。**将变更的增量规范合并到主规范中*而不*归档变更。通常是自动的（归档会提议做），但作为 `/opsx:sync` 独立可用，适用于长期运行的变更。参见 [命令](commands.md#opsxsync)。

## 工作流和命令

**OPSX。**当前标准 OpenSpec 工作流，围绕流动动作而非刚性阶段构建。其斜杠命令都以 `/opsx:` 开头。参见 [OPSX 工作流](opsx.md)。

**斜杠命令（Slash command）。**你在 AI 助手聊天中输入的命令，如 `/opsx:propose`。斜杠命令驱动工作流。它们不是终端命令。参见 [命令如何工作](how-commands-work.md)。

**探索（Explore，`/opsx:explore`）。**思考伙伴命令。它阅读你的代码库，比较选项，澄清模糊想法为具体计划，不创建产出物也不写代码。当你有一个问题但还没有计划时的推荐起点。参见 [探索优先](explore.md)。

**CLI。**你在终端中运行的 `openspec` 程序。它设置项目、列出和验证变更、打开仪表板并归档。OpenSpec 的终端部分。参见 [CLI](cli.md)。

**技能（Skill）。**一个指令文件夹（`.../skills/openspec-*/SKILL.md`），你的 AI 助手自动检测并遵循。技能是向你的助手交付 OpenSpec 工作流的新兴跨工具标准。

**命令文件（Command file）。**一个按工具斜杠命令文件（`.../commands/opsx-*`）。较老的交付机制，仍然与技能一起支持。你很少直接碰这些。

**配置文件（Profile）。**安装在你项目中的斜杠命令集。**Core**（默认）是 `propose`、`explore`、`apply`、`sync`、`archive`。**扩展**集添加 `new`、`continue`、`ff`、`verify`、`bulk-archive`、`onboard`。通过 `openspec config profile` 更改。

**交付（Delivery）。**OpenSpec 是否安装技能、命令文件，或两者都安装。全局配置，通过 `openspec update` 应用。

## 自定义

**Schema。**定义工作流有哪些产出物以及它们如何依赖的定义。内置默认是 `spec-driven`（proposal → specs → design → tasks）。你可以 fork 它或自己写。参见 [自定义](customization.md#custom-schemas)。

**模板（Template）。**schema 内的一个 Markdown 文件，塑造 AI 为给定产出物生成什么。编辑模板立即改变 AI 输出，无需重新构建。

**项目配置（openspec/config.yaml）。**每个项目的设置：默认 schema、注入到每个规划请求的 `context:`，以及按产出物的 `rules:`。教 OpenSpec 了解你的技术栈和约定的最简单方式。参见 [自定义](customization.md#project-configuration)。

**上下文注入（Context injection）。**将项目背景放在 `config.yaml` 的 `context:` 字段中，使其自动添加到 AI 生成的每个产出物中。比指望 AI 读取单独文件更可靠。

**依赖图（Dependency graph）。**由产出物 `requires:` 关系形成的有向图。它是一个 DAG（有向无环图：箭头只指向前方，从不循环），OpenSpec 用它知道你能创建什么。

**赋能者，而非守门员（Enablers, not gates）。**产出物依赖展示什么变得*可能*，而非什么*必须*做。你可以随时重新审视和编辑任何产出物。参见 [核心概念一览](overview.md#enablers-not-gates)。

## 跨仓库协作（beta）

以下术语仅适用于你的规划涉及多个仓库的情况。它们处于 beta 阶段。大多数用户可以忽略它们。参见 [Stores 用户指南](stores-beta/user-guide.md)。

**Store（存储仓库）。**一个独立仓库，其全部工作就是规划。它有你已经知道的相同的 `openspec/` 形状（规范和变更）加上一个小的身份文件。你按名称在你的机器上注册它一次，然后任何 OpenSpec 命令都可以从任何地方在其中工作。

**引用（Reference）。**在代码仓库的 `openspec/config.yaml` 中声明该仓库引用的一个 store。引用是只读的：仓库保持自己的根，`openspec instructions` 获得一个引用 store 的规范索引，每个都有获取它的确切命令。

**工作上下文（Working context）。**`openspec context` 为当前仓库组装的内容：其 OpenSpec 根加上它引用的每个 store，每个都有如何获取它。回答"我在用什么工作？"

**工作集（Workset）。**你机器本地的一组你一起打开的文件夹（一个 store 加上你工作的代码仓库）。通过 `openspec workset create` 显式创建；这些本地路径不会提交到共享规划仓库。

## 参见

- [核心概念一览](overview.md)：五个思想，一页纸
- [概念](concepts.md)：长篇解释
- [命令如何工作](how-commands-work.md)：斜杠命令 vs CLI