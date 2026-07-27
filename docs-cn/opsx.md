# OPSX 工作流

> 反馈欢迎在 [Discord](https://discord.gg/YctCnvvshC) 上提供。

## 它是什么？

OPSX 现在是 OpenSpec 的标准工作流。

它是一个**流动的、迭代的工作流**用于 OpenSpec 变更。不再有刚性阶段——只有你可以随时采取的动作。

## 为什么存在

旧 OpenSpec 工作流工作，但它是**锁定的**：

- **指令是硬编码的**——埋在 TypeScript 中，你不能改变它们
- **全有或全无**——一个大命令创建一切，不能测试单个部分
- **固定结构**——所有人相同的工作流，没有自定义
- **黑盒**——当 AI 输出不好时，你不能调整 prompt

**OPSX 打开了它。**现在任何人都可以：

1. **实验指令**——编辑模板，看 AI 是否做得更好
2. **粒度测试**——独立验证每个产出物的指令
3. **自定义工作流**——定义你自己的产出物和依赖
4. **快速迭代**——改变模板，立即测试，无需重新构建

## 用户体验

**线性工作流的问题：**你在"规划阶段"，然后"实施阶段"，然后"完成"。但真实工作不是那样。你实施一些东西，意识到你的设计是错的，需要更新规范，继续实施。线性阶段与工作实际发生的方式对抗。

**OPSX 方法：**
- **动作，而非阶段**——创建、实施、更新、归档——任何时候做任何
- **依赖是赋能者**——它们展示什么是可能的，不是什么是必需的下一步

## 设置

```bash
openspec init
```

这创建 `.claude/skills/`（或等效）中的技能，AI 编程助手自动检测。

默认情况下，OpenSpec 使用 `core` 工作流配置文件。如果你想要扩展工作流命令，通过 `openspec config profile` 配置，然后用 `openspec update` 应用。

## 项目配置

项目配置让你设置默认值并注入项目特定上下文到所有产出物。

```yaml
# openspec/config.yaml
schema: spec-driven

context: |
  Tech stack: TypeScript, React, Node.js
  API conventions: RESTful, JSON responses
  Testing: Vitest for unit tests, Playwright for e2e

rules:
  proposal:
    - Include rollback plan
  specs:
    - Use Given/When/Then format for scenarios
```

## 命令

| 命令 | 做什么 |
|---------|--------------|
| `/opsx:propose` | 创建变更并一步生成规划产出物 |
| `/opsx:explore` | 理清思路、调查问题、澄清需求 |
| `/opsx:new` | 开始新变更搭建（扩展工作流） |
| `/opsx:continue` | 创建下一个产出物（扩展工作流） |
| `/opsx:ff` | 快进规划产出物（扩展工作流） |
| `/opsx:apply` | 实施任务，根据需要更新产出物 |
| `/opsx:update` | 修订变更的规划产出物并保持它们一致 |
| `/opsx:verify` | 验证实施是否匹配产出物（扩展工作流） |
| `/opsx:sync` | 同步增量规范到主规范（默认工作流，可选） |
| `/opsx:archive` | 完成后归档 |
| `/opsx:bulk-archive` | 归档多个已完成的变更（扩展工作流） |
| `/opsx:onboard` | 端到端变更的引导式演练（扩展工作流） |

## 何时更新 vs 开始新变更

提案定义三件事：**意图**、**范围**、**方案**。

### 更新现有变更当：

- 相同意图，细化执行
- 范围缩小（先发 MVP，其余之后）
- 学习驱动的修正

### 开始新变更当：

- 意图根本改变
- 范围爆炸到不同工作
- 原始变更可以单独"完成"

## 架构深度解析

### 哲学：阶段 vs 动作

```
旧工作流（阶段锁定）：           OPSX（流动动作）：
┌──────────────┐                 ┌──────────────────────────┐
│   PLANNING   │                 │  ACTIONS（不是阶段）      │
│    ↓         │                 │  new ◄► continue ◄►     │
│ IMPLEMENTING │                 │  apply ◄► archive       │
│    ↓         │                 │  任何顺序                │
│   ARCHIVING  │                 └──────────────────────────┘
└──────────────┘
```

### 组件架构

旧工作流使用 TypeScript 中的硬编码模板。OPSX 使用外部 schema 和依赖图引擎。

## 有什么不同？

| | 旧版（`/openspec:proposal`） | OPSX（`/opsx:*`） |
|---|---|---|
| **结构** | 一个大提案文档 | 有依赖的离散产出物 |
| **工作流** | 线性阶段 | 流动动作——任何时候做任何事 |
| **迭代** | 回去很尴尬 | 边学边更新产出物 |
| **自定义** | 固定结构 | Schema 驱动（定义你自己的产出物） |

**关键洞察：**工作不是线性的。OPSX 停止假装它是。