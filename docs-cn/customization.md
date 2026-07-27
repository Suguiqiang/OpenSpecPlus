# 自定义

OpenSpec 提供三个级别的自定义：

| 级别 | 它做什么 | 最适合 |
|-------|--------------|----------|
| **项目配置** | 设置默认值，注入上下文/规则 | 大多数团队 |
| **自定义 Schema** | 定义你自己的工作流产出的技能/命令文件 | 有独特流程的团队 |
| **全局覆盖** | 跨所有项目共享 schema | 高级用户 |

---

## 项目配置

`openspec/config.yaml` 文件是为你团队自定义 OpenSpec 的最简单方式。它让你：

- **设置默认 schema** - 跳过每个命令的 `--schema`
- **注入项目上下文** - AI 看到你的技术栈、约定等
- **添加按产出物规则** - 特定产出物的自定义规则

### 快速设置

```bash
openspec init
```

这交互式地引导你创建配置。或手动创建一个：

```yaml
# openspec/config.yaml
schema: spec-driven

context: |
  Tech stack: TypeScript, React, Node.js, PostgreSQL
  API style: RESTful, documented in docs/api.md
  Testing: Jest + React Testing Library
  We value backwards compatibility for all public APIs

rules:
  proposal:
    - Include rollback plan
    - Identify affected teams
  specs:
    - Use Given/When/Then format
    - Reference existing patterns before inventing new ones
```

### 工作原理

**默认 schema：**

```bash
# 没有配置
openspec new change my-feature --schema spec-driven

# 有配置 - schema 自动
openspec new change my-feature
```

**上下文和规则注入：**

生成任何产出物时，你的上下文和规则被注入到 AI prompt 中：

```xml
<context>
Tech stack: TypeScript, React, Node.js, PostgreSQL
...
</context>

<rules>
- Include rollback plan
- Identify affected teams
</rules>

<template>
[Schema 的内置模板]
</template>
```

- **上下文** 出现在所有产出物中
- **规则** 仅出现在匹配的产出物中

### Schema 解析顺序

当 OpenSpec 需要 schema 时，按此顺序检查：

1. CLI 标志：`--schema <name>`
2. 变更元数据（变更文件夹中的 `.openspec.yaml`）
3. 项目配置（`openspec/config.yaml`）
4. 默认（`spec-driven`）

---

## 自定义 Schema

当项目配置不够时，创建你自己的 schema 带有完全自定义的工作流。自定义 schema 存在于你项目的 `openspec/schemas/` 目录中，并与你的代码一起版本控制。

```text
your-project/
├── openspec/
│   ├── config.yaml        # 项目配置
│   ├── schemas/           # 自定义 schema 在这里
│   │   └── my-workflow/
│   │       ├── schema.yaml
│   │       └── templates/
│   └── changes/           # 你的变更
└── src/
```

### Fork 现有 Schema

自定义的最快方式是 fork 一个内置 schema：

```bash
openspec schema fork spec-driven my-workflow
```

这复制整个 `spec-driven` schema 到 `openspec/schemas/my-workflow/`，你可以自由编辑。

**你得到什么：**

```text
openspec/schemas/my-workflow/
├── schema.yaml           # 工作流定义
└── templates/
    ├── proposal.md       # 提案产出物模板
    ├── spec.md           # 规范模板
    ├── design.md         # 设计模板
    └── tasks.md          # 任务模板
```

现在编辑 `schema.yaml` 改变工作流，或编辑模板改变 AI 生成什么。

### 从头创建 Schema

对于全新工作流：

```bash
# 交互式
openspec schema init research-first

# 非交互式
openspec schema init rapid \
  --description "Rapid iteration workflow" \
  --artifacts "proposal,tasks" \
  --default
```

### Schema 结构

一个 schema 定义工作流中的产出物以及它们如何依赖：

```yaml
# openspec/schemas/my-workflow/schema.yaml
name: my-workflow
version: 1
description: My team's custom workflow

artifacts:
  - id: proposal
    generates: proposal.md
    description: Initial proposal document
    template: proposal.md
    instruction: |
      Create a proposal that explains WHY this change is needed.
      Focus on the problem, not the solution.
    requires: []

  - id: design
    generates: design.md
    description: Technical design
    template: design.md
    instruction: |
      Create a design document explaining HOW to implement.
    requires:
      - proposal

  - id: tasks
    generates: tasks.md
    description: Implementation checklist
    template: tasks.md
    requires:
      - design

apply:
  requires: [tasks]
  tracks: tasks.md
```

**关键字段：**

| 字段 | 用途 |
|-------|---------|
| `id` | 唯一标识符，用于命令和规则 |
| `generates` | 输出文件名（支持 globs 如 `specs/**/*.md`） |
| `template` | `templates/` 目录中的模板文件 |
| `instruction` | 创建此产出物的 AI 指令 |
| `requires` | 依赖 - 哪些产出物必须先存在 |

### 模板

模板是引导 AI 的 Markdown 文件。它们在创建该产出物时被注入到 prompt 中。

```markdown
<!-- templates/proposal.md -->
## 为什么

<!-- 解释此变更的动机。它解决什么问题？ -->

## 什么变化

<!-- 描述什么会变。对新的能力或修改要具体。 -->

## 影响

<!-- 受影响的代码、API、依赖、系统 -->
```

### 验证你的 Schema

在使用自定义 schema 之前验证它：

```bash
openspec schema validate my-workflow
```

这检查：
- `schema.yaml` 语法正确
- 所有引用的模板存在
- 没有循环依赖
- 产出物 ID 有效

### 使用你的自定义 Schema

创建后，使用你的 schema：

```bash
# 在命令上指定
openspec new change feature --schema my-workflow

# 或在 config.yaml 中设为默认
schema: my-workflow
```

### 调试 Schema 解析

不确定正在使用哪个 schema？检查：

```bash
# 查看特定 schema 从哪里解析
openspec schema which my-workflow

# 列出所有可用 schema
openspec schema which --all
```

输出显示它是来自你的项目、用户目录还是包：

```text
Schema: my-workflow
Source: project
Path: /path/to/project/openspec/schemas/my-workflow
```

---

## 社区 Schema

OpenSpec 还支持通过独立仓库分发的社区维护 schema。这些提供将 OpenSpec 与其他工具或系统集成的有主见的工作流。

| Schema | 维护者 | 仓库 | 描述 |
|--------|-----------|-----------|-------------|
| `superpowers-bridge` | @JiangWay | [JiangWay/openspec-schemas](https://github.com/JiangWay/openspec-schemas/tree/main/superpowers-bridge) | 将 OpenSpec 的产出物治理与 [obra/superpowers](https://github.com/obra/superpowers) 执行技能（头脑风暴、编写计划、通过子代理的 TDD、代码审查、完成）集成。 |
| `nanopm` | @nmrtn | [nmrtn/nanopm](https://github.com/nmrtn/nanopm/tree/main/openspec-schema) | PM 优先工作流。在实施之前运行 [nanopm](https://github.com/nmrtn/nanopm) 的规划管道。 |
| `e2e-runbooks` | @Lukk17 | [Lukk17/openspec-schemas](https://github.com/Lukk17/openspec-schemas/tree/master/openspec/schemas/e2e-runbooks) | 能力级别端到端测试手册。 |

> 想要贡献社区 schema？提交 issue 附带你的仓库链接，或提交 PR 添加一行到此表格。

---

## 参见

- [CLI 参考：Schema 命令](cli.md#schema-commands) - 完整命令文档