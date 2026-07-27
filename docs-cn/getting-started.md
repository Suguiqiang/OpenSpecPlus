# 快速上手

本指南讲解 OpenSpec 在安装和初始化之后如何工作。安装说明请参考 [主 README](../README.md#quick-start) 或 [安装指南](installation.md)。刚接触整个文档体系？[文档首页](README.md) 提供了完整导航。

> **这些命令在哪里输入？**两个地方，搞混是最常见的早期绊脚石。
>
> - `openspec ...` 命令（如 `openspec init`）在**终端**中运行。
> - `/opsx:...` 命令（如 `/opsx:propose`）在**你的 AI 助手聊天框**中运行，就是你平时让它写代码的那个框。
>
> 没有单独的"交互模式"需要启动。你只需要在聊天中输入斜杠命令，你的助手就会接管。完整解释：[命令如何工作](how-commands-work.md)。

## 你的前五分钟

整个循环，每个步骤标注了在哪里执行：

```text
终端      $ npm install -g @fission-ai/openspec@latest
终端      $ cd your-project && openspec init
AI 聊天     /opsx:explore                    （可选：先想清楚）
AI 聊天     /opsx:propose add-dark-mode      （AI 起草计划；你审阅）
AI 聊天     /opsx:apply                      （AI 实施）
AI 聊天     /opsx:archive                    （规范更新，变更归档）
```

两个终端步骤来设置，然后你就在聊天中生活。本指南的其余部分展开每个步骤做什么以及你会看到什么。

> **还不确定要构建什么？从 `/opsx:explore` 开始。**它是一个零风险思考伙伴，能阅读你的代码库、权衡选项、把模糊想法变成具体计划，这发生在任何产出物和代码产生之前。当画面清晰后，它会转交给 `/opsx:propose`。这是使用 AI 最好的习惯，否则 AI 会自信地构建错误的东西。参见 [探索指南](explore.md)。

## 工作原理

OpenSpec 帮助你和你的 AI 编程助手在任何代码编写之前就先就"要做什么"达成一致。

**默认快速路径（core 配置文件）：**

```text
/opsx:explore ──► /opsx:propose ──► /opsx:apply ──► /opsx:sync ──► /opsx:archive
   （可选）
```

当你在考虑要做什么时从 `/opsx:explore` 开始，或者当你知道要做什么时直接跳到 `/opsx:propose`。Explore 在默认配置文件中，所以需要时随时可用。

**扩展路径（自定义工作流选择）：**

```text
/opsx:new ──► /opsx:ff 或 /opsx:continue ──► /opsx:apply ──► /opsx:verify ──► /opsx:archive
```

默认全局配置文件是 `core`，包含 `propose`、`explore`、`apply`、`sync` 和 `archive`。你可以通过 `openspec config profile` 和 `openspec update` 来启用扩展工作流命令。

## OpenSpec 创建了什么

运行 `openspec init` 后，你的项目有了以下结构：

```
openspec/
├── specs/              # 真理之源（你的系统行为）
│   └── <domain>/
│       └── spec.md
├── changes/            # 提案的修改（每个变更一个文件夹）
│   └── <change-name>/
│       ├── proposal.md
│       ├── design.md
│       ├── tasks.md
│       └── specs/      # 增量规范（什么在变）
│           └── <domain>/
│               └── spec.md
└── config.yaml         # 项目配置（可选）
```

**两个关键目录：**

- **`specs/`** - 真理之源。这些规范描述你的系统当前如何行为。按领域组织（如 `specs/auth/`、`specs/payments/`）。

- **`changes/`** - 提案的修改。每个变更有自己的文件夹，包含所有相关产出物。当变更完成后，其规范合并到主 `specs/` 目录中。

## 理解产出物

每个变更文件夹包含引导工作的产出物：

| 产出物 | 用途 |
|----------|------|
| `proposal.md` | "为什么"和"是什么"——记录意图、范围和方案 |
| `specs/` | 增量规范，展示 ADDED/MODIFIED/REMOVED 的需求 |
| `design.md` | "怎么做"——技术方案和架构决策 |
| `tasks.md` | 实施检查清单，带复选框 |

**产出物互相依赖：**

```
proposal ──► specs ──► design ──► tasks ──► 实施
   ▲           ▲          ▲                    │
   └───────────┴──────────┴────────────────────┘
            实施过程中随时回头完善
```

你总是可以在实施过程中回头完善之前的产出物。

## 增量规范如何工作

增量规范是 OpenSpec 中的核心概念。它们展示相对于你当前规范发生了什么变化。

### 格式

增量规范使用章节来指示变更类型：

```markdown
# Auth 的增量

## ADDED Requirements

### Requirement: 双因素认证
系统 MUST 在登录时要求第二因素。

#### Scenario: 需要 OTP
- GIVEN 一个启用了 2FA 的用户
- WHEN 用户提交有效凭据
- THEN 系统展示 OTP 挑战

## MODIFIED Requirements

### Requirement: 会话超时
系统 SHALL 在 30 分钟不活跃后使会话过期。
（之前：60 分钟）

#### Scenario: 空闲超时
- GIVEN 一个已认证的会话
- WHEN 30 分钟不活跃
- THEN 会话失效

## REMOVED Requirements

### Requirement: 记住我
（因 2FA 而废弃）
```

### 归档时会发生什么

当你归档一个变更时：

1. **ADDED** 需求被追加到主规范
2. **MODIFIED** 需求替换现有版本
3. **REMOVED** 需求从主规范中删除

变更文件夹移动到 `openspec/changes/archive/` 用于审计历史。

## 示例：你的第一个变更

让我们演练为应用添加暗色模式。

### 1. 开始变更（默认）

```text
你：/opsx:propose add-dark-mode

AI：已创建 openspec/changes/add-dark-mode/
     ✓ proposal.md — 为什么做这个，会改变什么
     ✓ specs/       — 需求和场景
     ✓ design.md    — 技术方案
     ✓ tasks.md     — 实施检查清单
     准备就绪，可以实施！
```

如果你启用了扩展工作流配置文件，你也可以分两步做：`/opsx:new` 然后 `/opsx:ff`（或逐步用 `/opsx:continue`）。

### 2. 创建了什么

**proposal.md** - 记录了意图：

```markdown
# 提案：添加暗色模式

## 意图
用户请求暗色模式选项以减少夜间使用时的眼睛疲劳。

## 范围
- 在设置中添加主题切换
- 支持系统偏好检测
- 在 localStorage 中持久化偏好

## 方案
使用 CSS 自定义属性进行主题设置，配合 React context 进行状态管理。
```

**specs/ui/spec.md** - 展示新需求的增量：

```markdown
# UI 增量

## ADDED Requirements

### Requirement: 主题选择
系统 SHALL 允许用户在浅色和暗色主题之间选择。

#### Scenario: 手动切换
- GIVEN 一个在任意页面的用户
- WHEN 用户点击主题切换按钮
- THEN 主题立即切换
- AND 偏好跨会话持久化

#### Scenario: 系统偏好
- GIVEN 一个没有保存偏好的用户
- WHEN 应用加载
- THEN 使用系统的首选颜色方案
```

**tasks.md** - 实施检查清单：

```markdown
# 任务

## 1. 主题基础设施
- [ ] 1.1 创建带有 light/dark 状态的 ThemeContext
- [ ] 1.2 为颜色添加 CSS 自定义属性
- [ ] 1.3 实现 localStorage 持久化

## 2. UI 组件
- [ ] 2.1 创建 ThemeToggle 组件
- [ ] 2.2 在设置页添加切换
- [ ] 2.3 更新 Header 包含快捷切换

## 3. 样式
- [ ] 3.1 定义暗色主题颜色调色板
- [ ] 3.2 更新组件使用 CSS 变量
```

### 3. 实施

```
你：/opsx:apply

AI：正在执行任务...
     ✓ 1.1 创建了带有 light/dark 状态的 ThemeContext
     ✓ 1.2 在 globals.css 中添加了 CSS 自定义属性
     ✓ 1.3 实现了 localStorage 持久化
     ✓ 2.1 创建了 ThemeToggle 组件
     ...
     所有任务完成！
```

实施过程中，如果你发现设计需要调整，只需更新产出物然后继续。

### 4. 归档

```
你：/opsx:archive

AI：正在归档 add-dark-mode...
     ✓ 规范已合并到 openspec/specs/ui/spec.md
     ✓ 已移动到 openspec/changes/archive/2025-01-24-add-dark-mode/
     完成！准备好下一个功能了。
```

你的增量规范现在成为主规范的一部分，记录了你的系统如何工作。

## 验证与审查

使用 CLI 检查你的变更：

```bash
# 列出活跃变更
openspec list

# 查看变更详情
openspec show add-dark-mode

# 验证规范格式
openspec validate add-dark-mode

# 交互式仪表板
openspec view
```

## 下一步

- [探索优先](explore.md) - 使用 `/opsx:explore` 在承诺之前理清思路
- [审查变更](reviewing-changes.md) - 在 AI 起草的计划中检查什么，在写代码之前
- [撰写好的规范](writing-specs.md) - 好的需求和场景是什么样的
- [在存量项目中使用 OpenSpec](existing-projects.md) - 在大型存量代码库上开始
- [编辑与迭代变更](editing-changes.md) - 更新产出物、回退、协调手动编辑
- [核心概念一览](overview.md) - 一页纸完整心智模型
- [示例与配方](examples.md) - 真实变更，从头到尾
- [工作流](workflows.md) - 常见模式与何时使用每个命令
- [命令](commands.md) - 所有斜杠命令的完整参考
- [概念](concepts.md) - 更深入地理解规范、变更和 schema
- [自定义](customization.md) - 让 OpenSpec 按你的方式工作
- [Stores](stores-beta/user-guide.md) - 涉及多个仓库的规划？放在独立仓库中（beta）
- [FAQ](faq.md) 和 [故障排除](troubleshooting.md) - 遇到困难时