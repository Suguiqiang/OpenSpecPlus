# OpenSpec 文档

欢迎。这是 OpenSpec 的完整文档。

OpenSpec 帮助你与 AI 编程助手**在写任何代码之前就先就"要做什么"达成一致。**你来描述变更，AI 起草一份简短的规范和任务清单，你们一起审阅同一份计划，然后再开始实施。再也不用发现过程中 AI 建错了东西。

如果你只读两页，请读这两页：

1. [快速上手](getting-started.md)：安装、初始化并完成你的第一个变更。
2. [命令如何工作](how-commands-work.md)：你实际上在哪里输入 `/opsx:propose`（提示：在你的 AI 聊天框里，不是终端）。这几乎每个人都会困惑一次。

第二页比看起来更重要。OpenSpec 有两个部分：一个在终端运行的命令行工具，以及你给 AI 助手的斜杠命令。知道哪个是哪个能帮你避免最常见的困惑。

> **最值得养成的好习惯：当你不确定要做什么时，先从 `/opsx:explore` 开始。**它是一个零风险思考伙伴，能阅读你的代码、权衡选项、把一个模糊的想法变成具体的计划，这发生在任何产出物和代码产生之前。[探索优先](explore.md) 指南详细说明了这一点。

## 选择你的路径

**我是新手。**从 [快速上手](getting-started.md) 开始，然后浏览 [核心概念一览](overview.md)。当有东西让你困惑时，[FAQ](faq.md) 和 [术语表](glossary.md) 就在旁边。

**我有问题但还没有计划。**这是常见情况，有专门的答案：[探索优先](explore.md)。使用 `/opsx:explore` 在做出任何承诺前与 AI 一起理清思路。

**我有一个大的存量代码库。**你不需要记录所有内容。[在存量项目中使用 OpenSpec](existing-projects.md) 展示了如何在一堆真实旧代码上开始，不用全盘重写。

**我只想让它跑起来。**[安装](installation.md)，运行 `openspec init`，然后阅读 [命令如何工作](how-commands-work.md) 确保你的第一个斜杠命令输入到了正确的地方。

**我通过例子学习。**[示例与配方](examples.md) 页面带你从头到尾看真实的变更：一个小功能、一个 bug 修复、一个重构、一次探索。

**AI 刚起草了一份计划——现在怎么办？**读它。[审查变更](reviewing-changes.md) 展示了在代价还很小的时候抓住错误的二分钟审查法，而 [撰写好的规范](writing-specs.md) 则讲述了值得批准的计划的构成要素。

**我在团队中工作。**[团队中的 OpenSpec](team-workflow.md) 展示了如何将一个变更映射到分支和 PR，以及队友如何在代码之前审查计划。

**我来自旧的工作流。**[迁移指南](migration-guide.md) 解释了什么变了以及为什么，并保证你的现有工作安全。

**我想让它适配我团队的流程。**[自定义](customization.md) 涵盖项目配置、自定义 schema 和共享上下文。

**有东西坏了。**[故障排除](troubleshooting.md) 收集了人们实际遇到的失败及其修复方案。

## 完整地图

### 从这里开始

| 文档 | 内容 |
|-----|------|
| [快速上手](getting-started.md) | 安装、初始化并完成你的第一个变更 |
| [探索优先](explore.md) | 使用 `/opsx:explore` 在承诺前理清思路 |
| [命令如何工作](how-commands-work.md) | 斜杠命令在哪里运行，"交互模式"是什么，终端 vs 聊天 |
| [核心概念一览](overview.md) | 一页纸完整心智模型：规范、变更、增量、归档 |
| [安装](installation.md) | npm、pnpm、yarn、bun、Nix，以及如何验证安装成功 |

### 日常使用

| 文档 | 内容 |
|-----|------|
| [工作流](workflows.md) | 常见模式与何时使用每个命令 |
| [示例与配方](examples.md) | 真实变更的完整演练，可复制粘贴 |
| [撰写好的规范](writing-specs.md) | 好的需求和场景是什么样的，如何适当调整变更规模 |
| [审查变更](reviewing-changes.md) | 在写任何代码之前对草案计划的二分钟审查法 |
| [团队中的 OpenSpec](team-workflow.md) | 变更如何适配分支、PR 和审查 |
| [在存量项目中使用 OpenSpec](existing-projects.md) | 在大型存量代码库中采用 OpenSpec |
| [编辑与迭代变更](editing-changes.md) | 更新产出物、回退、协调手动编辑 |
| [命令](commands.md) | 每个 `/opsx:*` 斜杠命令的参考 |
| [CLI](cli.md) | 每个 `openspec` 终端命令的参考 |

### 深入理解

| 文档 | 内容 |
|-----|------|
| [概念](concepts.md) | 关于规范、变更、产出物、schema 和归档的长篇解释 |
| [OPSX 工作流](opsx.md) | 为什么工作流是流动的而非阶段锁定的，加上架构深度解析 |
| [术语表](glossary.md) | 每个术语的定义，按类分组 |

### 让它为你所用

| 文档 | 内容 |
|-----|------|
| [自定义](customization.md) | 项目配置、自定义 schema、共享上下文 |
| [多语言](multi-language.md) | 用非英语语言生成产出物 |
| [支持的工具](supported-tools.md) | OpenSpec 集成的 25+ 个 AI 工具及文件路径 |

### 需要帮助时

| 文档 | 内容 |
|-----|------|
| [FAQ](faq.md) | 人们最常问的问题的快速答案 |
| [故障排除](troubleshooting.md) | 具体故障的具体修复方案 |
| [迁移指南](migration-guide.md) | 从旧工作流迁移到 OPSX |

### 跨仓库协作（beta）

| 文档 | 内容 |
|-----|------|
| [Stores：用户指南](stores-beta/user-guide.md) | 当工作涉及多个仓库时，在独立仓库中进行规划 |
| [Agent 契约](agent-contract.md) | 供 AI 代理驱动的机器可读 CLI 接口 |

## 三十秒版本

```text
1. 安装          npm install -g @fission-ai/openspec@latest
2. 初始化         cd your-project && openspec init
3. 探索          （在你的 AI 聊天中）  /opsx:explore            ← 可选，但是个好习惯
4. 提案          （在你的 AI 聊天中）  /opsx:propose add-dark-mode
5. 构建          （在你的 AI 聊天中）  /opsx:apply
6. 归档          （在你的 AI 聊天中）  /opsx:archive
```

步骤 1 和 2 在终端中完成。其余在你的 AI 助手聊天中完成。这个区分是唯一值得记住的事，[命令如何工作](how-commands-work.md) 解释了确切原因。步骤 3 是可选的，但在不确定时从 `/opsx:explore` 开始是最值得养成的好习惯。

## 其他获取帮助的渠道

- **Discord：** [discord.gg/YctCnvvshC](https://discord.gg/YctCnvvshC) 提问、讨论想法和获取帮助。
- **GitHub Issues：** [github.com/Fission-AI/OpenSpec/issues](https://github.com/Fission-AI/OpenSpec/issues) 报告 bug 和功能请求。
- **`openspec feedback "你的消息"`** 直接从终端发送反馈（它会打开一个 GitHub issue）。

发现文档中有错误、过时或令人困惑的内容？那是一个 bug。提交 issue 或 PR。文档改进是你能做的最有价值的贡献之一。