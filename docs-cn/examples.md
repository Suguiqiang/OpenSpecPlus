# 示例与配方

真实变更，从头到尾。每个配方展示你输入的命令和你会看到的反馈，这样你可以把你的情况匹配到一个模式并复制它。这些使用默认的 **core** 命令（`propose`、`explore`、`apply`、`sync`、`archive`）；在扩展命令集有帮助的地方会注明。

在开始之前提醒：斜杠命令如 `/opsx:propose` 在你的 **AI 助手聊天** 中输入，`openspec` 命令在你的**终端**中输入。如果这对你是新的，先读 [命令如何工作](how-commands-work.md)。在下面的对话中，`你：` 和 `AI：` 是聊天，以 `$` 开头的行是终端。

> **还不确定构建什么？**大多数这些配方如果你从 `/opsx:explore` 开始会更好。[配方 3](#recipe-3-探索再做决定) 展示了它，[探索优先](explore.md) 指南做了完整论证。

## 配方 1：一个小功能，快速路径

**何时使用：**你知道你要什么，它是一个包含的工作。这是最常见的配方。

整个事情是三个命令。提案、构建、归档。

```text
你：/opsx:propose add-logout-button

AI：已创建 openspec/changes/add-logout-button/
     ✓ proposal.md — 为什么和是什么
     ✓ specs/      — 新需求和其场景
     ✓ design.md   — 技术方案
     ✓ tasks.md    — 实施检查清单
     准备就绪，可以实施。运行 /opsx:apply。
```

现在读计划。打开提案和增量规范。这是 OpenSpec 被构建的时刻：在一个段落中抓住一个错误假设，而不是 400 行代码。如果有什么不对直接编辑任何产出物，然后继续。

```text
你：/opsx:apply

AI：正在执行任务...
     ✓ 1.1 在标题添加登出按钮
     ✓ 1.2 点击时清除会话
     ✓ 1.3 添加确认对话框
     所有任务完成！

你：/opsx:archive

AI：正在归档 add-logout-button...
     ✓ 规范已合并到 openspec/specs/auth/spec.md
     ✓ 已移动到 openspec/changes/archive/2026-06-22-add-logout-button/
     完成。准备好下一个变更。
```

就这样。登出行为现在是你的规范的一部分，变更带有完整上下文归档。

## 配方 2：Bug 修复

**何时使用：**有东西坏了，你希望修复被记录为对行为的故意变更，而不是一个神秘提交。

Bug 修复完全像功能一样工作。区别在于你如何构建提案：描述*正确*的行为，不仅仅"修复 bug"。

```text
你：/opsx:propose fix-login-redirect-loop

AI：已创建 openspec/changes/fix-login-redirect-loop/
     提案记录了当前错误行为和预期行为。增量规范 MODIFIES
     重定向需求，使其现在精确且可测试。
     准备就绪，可以实施。
```

因为修复以 `MODIFIED` 需求和一个新场景落地，下一个人（或下一次 AI 会话）看到的不只是你修复了它，而是"正确"意味着什么。然后 `/opsx:apply` 和 `/opsx:archive` 照常。

提示：对于修复，一个好的场景是回归测试的文本形式。"GIVEN 一个登出的用户，WHEN 他们提交有效凭据，THEN 他们落地在仪表板并且不被再次重定向。"写那个，实施就有了清晰目标。

## 配方 3：探索再做决定

**何时使用：**你有一个问题但还没有计划。你不确定构建什么，或哪个方案正确。

从 `/opsx:explore` 开始。它是一个没有结构、不创建产出物的思考伙伴。它阅读你的代码库并帮助你决定。

```text
你：/opsx:explore

AI：你想探索什么？

你：页面加载感觉很慢但我不确定时间花在哪里。

AI：让我看看……我发现了三个可能的罪魁祸首：
     1. 产品列表上未优化的大图片
     2. 阻塞渲染的同步数据获取
     3. 上下文变化触发的重新渲染
     我们首先解决哪个？

你：数据获取那个。

你：/opsx:propose optimize-product-list-fetching

AI：创建了变更，提案基于我们刚发现的内容。准备就绪，可以实施。
```

探索在你花一个变更在上面之前澄清你的想法。当洞察结晶时，提案，AI 带着上下文继续。

## 配方 4：同时处理两个变更

**何时使用：**你在功能中途，一个紧急修复插队。

变更是独立的文件夹，所以并行工作不冲突。开始修复，发布它，然后准确回到你离开时的功能。

```text
你：我正在 add-dark-mode 中途，但我现在需要修复一个登录 bug。

你：/opsx:propose fix-login-redirect

AI：已创建 openspec/changes/fix-login-redirect/。准备就绪，可以实施。

你：/opsx:apply

AI：已实施修复。所有任务完成。

你：/opsx:archive

AI：✓ 已归档 fix-login-redirect。

你：回到暗色模式。

你：/opsx:apply add-dark-mode

AI：恢复 add-dark-mode。从任务 2.3 继续：更新 Header...
```

在 `/opsx:apply add-dark-mode` 中命名变更是当你多个活跃时你指向 AI 到特定变更的方式。因为任务在 `tasks.md` 中跟踪完成状态，AI 确切知道你在哪里停止。

## 配方 5：无行为变更的重构

**何时使用：**你在重构代码，外部可见行为应保持完全相同。

这是有趣的情况，因为纯重构*没有东西要添加到你的规范*。行为协议不变；只有实现变。所以工作存在于设计和任务中，增量规范为空或不存在。

```text
你：/opsx:propose refactor-payment-module

AI：创建了变更。提案陈述目标（拆分支付模块，无行为变更），设计记录新结构。
     没有规范变更，因为行为相同。准备就绪，可以实施。
```

通过在变更的 `.openspec.yaml` 中设置 `skip_specs: true` 显式声明空增量：

```yaml
schema: spec-driven
skip_specs: true
```

没有此标记，`openspec validate` 拒绝零增量变更；有它，验证通过且 `openspec status` 显示规范阶段为显式跳过而非待处理。如果重构最终改变了行为，从 `.openspec.yaml` 中删除 `skip_specs` 并写增量规范。

## 配方 6：逐步控制（扩展命令）

**何时使用：**复杂或高风险的变更，你想在继续之前审查每个产出物。

Core `/opsx:propose` 一次性起草所有。当你更想一步步来，开启扩展命令：

```bash
$ openspec config profile      # 选择扩展工作流
$ openspec update              # 应用到本项目
```

现在你可以逐步搭建和构建。

## 配方 7：动手学习完整循环

**何时使用：**你安装了 OpenSpec 并想*感受*工作流在你自己的代码上，不是玩具示例。

开启扩展命令，然后：

```text
你：/opsx:onboard

AI：欢迎来到 OpenSpec！我将使用你的实际代码库带你走完一个完整变更。
     让我扫描一个我们可以一起做的小的、安全的改进……
```

## 从终端检查你的工作

任何时候，从你的终端，你可以检查事物状态：

```bash
$ openspec list                      # 活跃变更
$ openspec show add-dark-mode        # 一个变更的详细信息
$ openspec validate add-dark-mode    # 检查结构
$ openspec view                      # 交互式仪表板
```

## 接下来去哪里

- [探索优先](explore.md)：当你不确定时推荐的开始方式
- [工作流](workflows.md)：上面的模式，带有何时使用每个的决策指导
- [命令](commands.md)：每个斜杠命令的详细信息
- [快速上手](getting-started.md)：规范的第一变更演练
- [概念](concepts.md)：为什么这些部分以它们的方式组合在一起