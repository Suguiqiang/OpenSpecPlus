# 迁移到 OPSX

本指南帮助你从旧 OpenSpec 工作流过渡到 OPSX。迁移被设计为平滑的——你的现有工作被保留，新系统提供更多灵活性。

## 什么在变？

OPSX 用流动的、基于动作的方法替换旧的阶段锁定工作流。关键转变：

| 方面 | 旧版 | OPSX |
|--------|--------|------|
| **命令** | `/openspec:proposal`、`/openspec:apply`、`/openspec:archive` | 默认：`/opsx:propose`、`/opsx:apply`、`/opsx:sync`、`/opsx:archive` |
| **工作流** | 一次性创建所有产出物 | 增量创建或一次性——你的选择 |
| **回去** | 尴尬的阶段关卡 | 自然——随时更新任何产出物 |
| **自定义** | 固定结构 | Schema 驱动，完全可定制 |
| **配置** | `CLAUDE.md` 带标记 + `project.md` | 干净的配置在 `openspec/config.yaml` |

## 开始之前

### 你的现有工作是安全的

迁移过程以保留为设计理念：

- **`openspec/changes/` 中的活跃变更** — 完全保留。你可以用 OPSX 命令继续它们。
- **归档的变更** — 未触及。你的历史保持完整。
- **`openspec/specs/` 中的主规范** — 未触及。这些是你的真理之源。
- **CLAUDE.md、AGENTS.md 等中你的内容** — 保留。仅 OpenSpec 标记块被移除；你写的所有东西保留。

## 运行迁移

`openspec init` 和 `openspec update` 都检测旧文件并引导你通过相同的清理过程。

### 使用 `openspec init`

```bash
openspec init
```

init 命令检测旧文件并引导你通过清理。

### 使用 `openspec update`

```bash
openspec update
```

update 命令也检测和清理旧产出物，然后刷新生成的技能/命令以匹配你当前的配置文件和交付设置。

### 非交互式 / CI 环境

```bash
openspec init --force --tools claude
```

`--force` 标志跳过提示并自动接受清理。

## 将 project.md 迁移到 config.yaml

### 之前（project.md）

```markdown
# 项目上下文
这是一个使用 React 和 Node.js 的 TypeScript 单一仓库。
我们使用 Jest 测试并遵循严格的 ESLint 规则。
```

### 之后（config.yaml）

```yaml
schema: spec-driven

context: |
  Tech stack: TypeScript, React, Node.js
  Testing: Jest with React Testing Library
  API: RESTful, documented in docs/api.md
  We maintain backwards compatibility for all public APIs

rules:
  proposal:
    - Include rollback plan for risky changes
  specs:
    - Use Given/When/Then format for scenarios
```

### 迁移步骤

1. **创建 config.yaml**（如果 init 还没创建）
2. **添加你的上下文**（精简——这会被注入到每个请求）
3. **添加按产出物规则**（可选）
4. **删除 project.md** 一旦你移动了所有有用的东西

## 新命令

命令可用性取决于配置文件：

**默认（`core` 配置文件）：**

| 命令 | 用途 |
|---------|---------|
| `/opsx:propose` | 创建变更并一步生成规划产出物 |
| `/opsx:explore` | 无结构地理清思路 |
| `/opsx:apply` | 从 tasks.md 实施任务 |
| `/opsx:archive` | 完成并归档变更 |

**扩展工作流（自定义选择）：**

| 命令 | 用途 |
|---------|---------|
| `/opsx:new` | 开始新变更搭建 |
| `/opsx:continue` | 创建下一个产出物（一次一个） |
| `/opsx:ff` | 快进——一次性创建规划产出物 |
| `/opsx:verify` | 验证实施匹配规范 |
| `/opsx:sync` | 合并增量规范到主规范 |
| `/opsx:bulk-archive` | 一次性归档多个变更 |
| `/opsx:onboard` | 引导式端到端入门工作流 |

### 从旧命令映射

| 旧版 | OPSX 等效 |
|--------|-----------------|
| `/openspec:proposal` | `/opsx:propose`（默认）或 `/opsx:new` 然后 `/opsx:ff`（扩展） |
| `/openspec:apply` | `/opsx:apply` |
| `/openspec:archive` | `/opsx:archive` |

## 从阶段锁定到流动

旧工作流强制线性进展。OPSX 使用动作，而非阶段——你可以按任意顺序创建、实施、更新、归档。

## 故障排除

### "Legacy files detected in non-interactive mode"

```bash
openspec init --force
```

### 迁移后命令不出现

重启你的 IDE。技能在启动时检测。

### 我的旧 project.md 没被迁移

那是故意的。OpenSpec 从不自动删除 `project.md`，因为它可能包含你写的上下文。把有用部分移到 `config.yaml` 的 `context:` 章节，然后自己删除它。

## 获取帮助

- **Discord：** [discord.gg/YctCnvvshC](https://discord.gg/YctCnvvshC)
- **GitHub Issues：** [github.com/Fission-AI/OpenSpec/issues](https://github.com/Fission-AI/OpenSpec/issues)
- **文档：** [docs/opsx.md](opsx.md) 获取完整 OPSX 参考