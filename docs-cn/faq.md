# FAQ

人们最常问的问题的快速答案。如果你的问题是一个"有东西坏了"的问题，[故障排除](troubleshooting.md) 是更好的页面。如果你想定义术语，参见 [术语表](glossary.md)。

## 基础

### OpenSpec 是什么，一句话？

一个轻量层，让你和你的 AI 编程助手在写任何代码之前就以书面形式就先就"要构建什么"达成一致。

### 我为什么想要这个？

因为 AI 助手即使错了也自信。当需求只活在聊天线程中，AI 用猜测填补空白，你在代码存在之后才发现。OpenSpec 把协议提前，在错误修起来便宜的地方。参见 [核心概念一览](overview.md) 了解完整理由。

### 我必须对所有东西都用它吗？

不。在协议重要的地方用它，这是大多数非平凡工作。对于一个字符的错字修复，这个仪式可能不值得，那没关系。

### 我能在大型存量代码库上用它吗，还是只能新项目？

存量代码库是主战场。OpenSpec 是存量优先的：你不预先记录整个应用。你只为你每个变更触及的部分写规范，你的规范随时间围绕你实际做的工作填满。有专门的指南：[在存量项目中使用 OpenSpec](existing-projects.md)。

### 它绑定到某个 AI 工具吗？

不。OpenSpec 与 25+ 个助手一起工作，包括 Claude Code、Cursor、Windsurf、GitHub Copilot、Gemini CLI、Codex 等。完整列表和按工具细节在 [支持的工具](supported-tools.md)。

## 运行命令

### 我在哪里输入 `/opsx:propose`？

在你的 AI 助手聊天中，不是你的终端。这是最常见的混淆点，所以它有自己的一页：[命令如何工作](how-commands-work.md)。简短版：`openspec ...` 在终端中运行，`/opsx:...` 在聊天中运行。

### 如何"启动交互模式"？

没有单独的交互模式需要启动。你像往常一样打开你的 AI 助手，在它的聊天中输入一个斜杠命令。斜杠命令就是"进入" OpenSpec 的方式。（一个真正交互的终端功能是 `openspec view`，一个浏览规范和变更的仪表板。）完整解释在 [命令如何工作](how-commands-work.md)。

### 我输入了斜杠命令但什么都没发生。为什么？

最可能你在终端中输入了而不是你的 AI 聊天，或者命令还没安装。在你的项目中运行 `openspec update`，重启你的助手，然后在聊天中尝试输入 `/opsx` 并观察自动补全。[故障排除](troubleshooting.md#commands-dont-show-up) 有完整检查清单。

### 为什么语法在一个工具是 `/opsx:propose` 而在另一个是 `/opsx-propose`？

每个 AI 工具展示自定义命令的方式略有不同。意图是相同的；只有标点符号变化。在你的聊天中输入一个斜杠，自动补全显示你的工具期望的格式。按工具表格在 [命令如何工作](how-commands-work.md#slash-command-syntax-by-tool)。

### 技能和命令有什么区别？

两者都是 OpenSpec 写的文件，以便你的助手能运行工作流。技能（`.../skills/openspec-*/SKILL.md`）是较新的跨工具标准；命令（`.../commands/opsx-*`）是较老的按工具斜杠文件。你不需要选择。你只需输入斜杠命令，OpenSpec 安装你的工具使用的任何类型。

## 工作流

### 如果我不确定构建什么，从哪里开始？

用 `/opsx:explore`。它是一个零风险思考伙伴，阅读你的代码库，列出选项，把模糊问题变成具体计划，全部在任何变更或代码存在之前。它在默认配置文件中，所以总是可用。当计划清晰时，它移交到 `/opsx:propose`。这是形成的最好的习惯，因为它阻止一个急切的 AI 自信地构建错误的东西。参见 [探索优先](explore.md)。

### 最简单的流程是什么？

```text
/opsx:explore （可选）  然后   /opsx:propose <你要什么>   然后   /opsx:apply   然后   /opsx:archive
```

探索理清思路，提案起草计划，应用构建，归档归档。当你已经确切知道你要什么时跳过探索。

### `/opsx:propose` 和 `/opsx:new` 有什么区别？

`/opsx:propose` 是默认的一步命令：它创建变更并一次性起草所有规划产出物。`/opsx:new` 是扩展命令集的一部分，仅搭建空变更，留给你用 `/opsx:continue` 逐个创建产出物（或用 `/opsx:ff` 一次性创建全部）。使用 propose，除非你想要逐步控制。参见 [命令](commands.md)。

### 什么是 core 和扩展配置文件？

配置文件决定安装哪些斜杠命令。**Core**（默认）给你 `propose`、`explore`、`apply`、`sync`、`archive`。**扩展**集添加 `new`、`continue`、`ff`、`verify`、`bulk-archive` 和 `onboard` 用于更精细控制。用 `openspec config profile` 切换，然后 `openspec update` 应用。

### 我需要运行 `/opsx:sync` 吗？

通常不。Sync 将变更的增量规范合并到你的主规范，`/opsx:archive` 会提议为你做。仅当你希望在归档之前合并规范时手动运行 sync，例如对一个长期运行的变更。参见 [命令](commands.md#opsxsync)。

### 我如何在开始后编辑提案、规范或任务？

直接编辑文件。每个产出物是 `openspec/changes/<name>/` 下的纯 Markdown，没有锁定的阶段或特殊编辑模式。手动改，或让 AI 修订它（"更新设计使用队列"），然后继续。AI 总是从当前文件内容工作。完整指南：[编辑与迭代变更](editing-changes.md)。

### 我能在实施了一些之后回去改变计划吗？

是的，任何时候。工作流是流动的，所以审查和编辑不是你被锁在外的阶段。编辑产出物，然后继续。如果你想要一个结构化检查代码是否仍然匹配计划，运行 `/opsx:verify`。参见 [编辑与迭代变更](editing-changes.md#how-do-i-go-back-to-review-after-implementing)。

### 我手动编辑了代码。如何与规范协调？

在归档前把它们带回同步，因为归档让你的规范成为真理记录。如果代码现在是正确的，更新增量规范以匹配你交付的；如果规范是正确的，继续构建直到代码同意。`/opsx:verify` 展示不匹配。参见 [编辑与迭代变更](editing-changes.md#i-edited-the-code-by-hand-how-do-i-reconcile-that-with-openspec)。

### 何时更新现有变更 vs 开始新变更？

当它是同一件工作细化时更新。当意图根本改变或范围爆炸成不同工作时重新开始。有一个决策流程图和示例在 [工作流](workflows.md#when-to-update-vs-start-fresh)。

### 如果我会话上下文用完了，或需求在实施中变了怎么办？

这是规范发挥价值的地方。因为计划存在于文件中（不仅仅是聊天历史），你可以清除上下文，开始一个新的 AI 会话，用 `/opsx:apply` 继续；它读取产出物并从第一个未检查的任务继续。如果需求变了，编辑产出物以匹配新现实然后继续。保持干净的上下文窗口也产生更好的结果；在实施前清除它。

### 我应该将 `openspec/` 文件夹提交到 git 吗？

是的。你的规范、活跃变更和归档是你项目历史的一部分。像任何其他源码一样提交它们。归档尤其成为你的系统为什么以它现在方式工作的持久记录。

## 规范和变更

### 什么进入规范 vs 设计？

规范描述可观察的行为：系统做什么，其输入、输出和错误条件。设计描述你将如何构建它：技术方案、架构决策、文件变更。如果实现可以改变而不改变外部可见行为，它属于设计，而非规范。参见 [概念](concepts.md#what-a-spec-is-and-is-not)。

### 什么是增量规范？

一个仅描述变化的规范，使用 `ADDED`、`MODIFIED` 和 `REMOVED` 章节，而不是重述整个规范。它是 OpenSpec 干净地处理对现有系统的编辑的方式。参见 [概念](concepts.md#delta-specs)。

### 归档的变更去哪里了？

到 `openspec/changes/archive/YYYY-MM-DD-<name>/`，所有产出物保留。没有东西被删除；变更只是从你的活跃列表中移出。

## 配置和自定义

### 如何告诉 AI 我的技术栈？

把它放在 `openspec/config.yaml` 的 `context:` 下。那段文本被注入到每个规划请求，所以 AI 总是知道你的技术栈和约定。参见 [自定义](customization.md#project-configuration)。

### 我能用非英语语言生成规范吗？

可以。在你的配置的 `context:` 中添加语言指令。[多语言](multi-language.md) 有几种语言的可复制粘贴片段。

### 我能改变工作流本身吗？

可以，用自定义 schema。一个 schema 定义存在哪些产出物以及它们如何依赖。用 `openspec schema fork spec-driven my-workflow` fork 默认，然后编辑它。参见 [自定义](customization.md#custom-schemas)。

## 模型、隐私和升级

### 我应该用哪个 AI 模型？

OpenSpec 在高推理能力模型上工作最好。README 推荐 Codex 5.5 和 Opus 4.7 等模型用于规划和实施。同样保持你的上下文窗口干净：在实施前清除它以获得最佳结果。

### OpenSpec 收集数据吗？

它收集匿名使用统计：仅命令名称和版本。没有参数、路径、内容或个人数据，在 CI 中自动关闭。用 `export OPENSPEC_TELEMETRY=0` 或 `export DO_NOT_TRACK=1` 退出。

### 如何升级？

两步。升级包（`npm install -g @fission-ai/openspec@latest`），然后在每个项目中运行 `openspec update` 刷新生成的技能和命令。

### 如何卸载 OpenSpec？

没有 uninstall 命令，因为它只是一个全局包加上你项目中的文件。删除包（`npm uninstall -g @fission-ai/openspec`），可选地删除 `openspec/` 目录和生成的工具文件。逐步说明，包括什么可以安全保留，在 [安装：卸载](installation.md#uninstalling)。

## 获取帮助

### 在哪里提问或报告 bug？

- **Discord：** [discord.gg/YctCnvvshC](https://discord.gg/YctCnvvshC)
- **GitHub Issues：** [github.com/Fission-AI/OpenSpec/issues](https://github.com/Fission-AI/OpenSpec/issues)
- **从你的终端：** `openspec feedback "你的消息"` 为你打开一个 GitHub issue。

### 这些文档错了或令人困惑。我该做什么？

告诉我们，或修复它。文档 PR 是受欢迎和受重视的。提交 issue 或发送 pull request。