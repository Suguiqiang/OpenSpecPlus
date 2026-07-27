# 工作流

本指南涵盖 OpenSpec 的常见工作流模式以及何时使用每个。基本设置参见 [快速上手](getting-started.md)。命令参考参见 [命令](commands.md)。

## 哲学：动作，而非阶段

传统工作流强迫你通过阶段：规划，然后实施，然后完成。但真实工作不适合整齐地放入盒子。

OPSX 采用不同的方法：

```text
传统（阶段锁定）：

  PLANNING ────────► IMPLEMENTING ────────► DONE
      │                    │
      │   "不能回去"         │
      └────────────────────┘

OPSX（流动动作）：

  proposal ──► specs ──► design ──► tasks ──► 实施
```

**关键原则：**

- **动作，而非阶段** - 命令是你能做的事，不是你被困在的阶段
- **依赖是赋能者** - 它们展示什么是可能的，不是什么是必需的下一步

## 两种模式

### 默认快速路径（`core` 配置文件）

新安装默认为 `core`，提供：
- `/opsx:explore`
- `/opsx:propose`
- `/opsx:apply`
- `/opsx:sync`
- `/opsx:archive`

典型流程：

```text
/opsx:explore ──► /opsx:propose ──► /opsx:apply ──► /opsx:sync ──► /opsx:archive
  （可选）
```

### 扩展/完整工作流（自定义选择）

如果你想要显式的搭建和构建命令（`/opsx:new`、`/opsx:continue`、`/opsx:ff`、`/opsx:verify`、`/opsx:bulk-archive`、`/opsx:onboard`），通过以下启用：

```bash
openspec config profile
openspec update
```

## 工作流模式（扩展模式）

### 快速功能

当你知道你要构建什么，只需要执行：

```text
/opsx:new ──► /opsx:ff ──► /opsx:apply ──► /opsx:verify ──► /opsx:archive
```

**最适合：**小到中等功能、bug 修复、直接变更。

### 探索式

当需求不清楚或你需要先调查：

```text
/opsx:explore ──► /opsx:new ──► /opsx:continue ──► ... ──► /opsx:apply
```

**最适合：**性能优化、调试、架构决策、不清楚的需求。

### 并行变更

同时处理多个变更：

```text
变更 A: /opsx:new ──► /opsx:ff ──► /opsx:apply （进行中）
                                         │
                                    上下文切换
                                         │
变更 B: /opsx:new ──► /opsx:ff ──────► /opsx:apply
```

当你有多个完成的变更，使用 `/opsx:bulk-archive`。

### 完成变更

推荐的完成流程：

```text
/opsx:apply ──► /opsx:verify ──► /opsx:archive
```

#### 验证：检查你的工作

`/opsx:verify` 跨三个维度验证实施：

| 维度 | 它验证什么 |
|-----------|------------------|
| 完整性 | 所有任务完成，所有需求实现，场景覆盖 |
| 正确性 | 实现匹配规范意图，边缘情况处理 |
| 一致性 | 设计决策在代码中反映，模式一致 |

## 何时用什么

### `/opsx:ff` vs `/opsx:continue`

| 情况 | 使用 |
|-----------|-----|
| 清晰需求，准备好构建 | `/opsx:ff` |
| 探索中，想审查每一步 | `/opsx:continue` |
| 想在规范之前迭代提案 | `/opsx:continue` |
| 时间压力，需要快速 | `/opsx:ff` |
| 复杂变更，想要控制 | `/opsx:continue` |

### 何时更新 vs 开始新变更

**更新现有变更当：**

- 相同意图，细化执行
- 范围缩小（先 MVP，其余之后）
- 学习驱动的修正（代码库不是你预期的）
- 基于实施发现的设计调整

**开始新变更当：**

- 意图根本改变
- 范围爆炸到完全不同的工作
- 原始变更可以单独标记"完成"
- 补丁会比澄清更令人困惑

```text
                     ┌─────────────────────────────────────┐
                     │     这是同一件工作吗？               │
                     └──────────────┬──────────────────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
          相同意图？           >50% 重叠？        原始可以
          相同问题？           相同范围？          "完成"而不需要
                 │                  │             这些变更？
                 │                  │                  │
       ┌────────┴────────┐  ┌──────┴──────┐   ┌───────┴───────┐
       │                 │  │             │   │               │
      YES               NO YES           NO  NO              YES
       │                 │  │             │   │               │
       ▼                 ▼  ▼             ▼   ▼               ▼
    更新              新变更 更新         新变更 更新         新变更
```

## 最佳实践

### 保持变更聚焦

每个变更一个逻辑工作单元。如果你在做"添加功能 X 并且也重构 Y"，考虑两个单独变更。

### 对不清楚的需求使用 `/opsx:explore`

在承诺变更之前，探索问题空间。

### 归档前验证

使用 `/opsx:verify` 检查实施是否匹配产出物。

### 清晰命名变更

好的名字让 `openspec list` 有用：

```text
好：                          避免：
add-dark-mode                  feature-1
fix-login-redirect             update
optimize-product-query         changes
implement-2fa                  wip
```

## 命令快速参考

| 命令 | 用途 | 何时使用 |
|---------|---------|-------------|
| `/opsx:propose` | 创建变更 + 规划产出物 | 快速默认路径（`core` 配置文件） |
| `/opsx:explore` | 与 AI 一起理清思路 | 不确定时从这里开始 |
| `/opsx:new` | 开始变更搭建 | 扩展模式，显式产出物控制 |
| `/opsx:continue` | 创建下一个产出物 | 扩展模式，逐步创建产出物 |
| `/opsx:ff` | 创建所有规划产出物 | 扩展模式，清晰范围 |
| `/opsx:apply` | 实施任务 | 准备好写代码 |
| `/opsx:verify` | 验证实施 | 扩展模式，归档前 |
| `/opsx:sync` | 合并增量规范 | 扩展模式，可选 |
| `/opsx:archive` | 完成变更 | 所有工作完成 |
| `/opsx:bulk-archive` | 归档多个变更 | 扩展模式，并行工作 |

## 下一步

- [撰写好的规范](writing-specs.md) - 好的需求和场景是什么样的，以及如何适当调整变更规模
- [审查变更](reviewing-changes.md) - 在任何代码之前对起草计划的二分钟审查法
- [团队中的 OpenSpec](team-workflow.md) - 变更如何适配分支和 PR
- [命令](commands.md) - 带选项的完整命令参考
- [概念](concepts.md) - 深入规范、产出物和 schema
- [自定义](customization.md) - 创建自定义工作流