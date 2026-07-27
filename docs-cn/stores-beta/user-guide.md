# Stores：在独立仓库中规划

> **Beta。**Stores、引用、工作上下文和工作集是新的。命令名称、标志、文件格式和 JSON 输出可能在版本间变化。

## 这解决什么问题

OpenSpec 通常在一个代码仓库中：一个 `openspec/` 文件夹紧挨着你的代码，为该仓库保存规范和变更。

当你的规划大于一个仓库时，这不再适用：

- 你的工作跨越多个仓库——一个功能涉及 API 服务器、web 应用和共享库。计划存在谁的 `openspec/` 文件夹中？
- 你的团队在代码存在之前就规划，或规划永远不会成为*这个*仓库中代码的东西。
- 需求由一个团队拥有，其他团队消费。Wiki 版本漂移，你的编程 agent 反正读不了。

**Store** 是答案：一个独立仓库，其全部工作就是规划。它有你已经知道的相同的 `openspec/` 形状——规范和变更——加上一个小的身份文件。你按名称在你的机器上注册它一次，然后任何正常的 OpenSpec 命令都可以从任何地方在其中工作。

## 形状

```
            team-plans  （一个 store：规划在自己的仓库中）
            ├── .openspec-store/store.yaml     身份："我是 team-plans"
            └── openspec/
                ├── specs/      什么是真的
                └── changes/    什么在运动中
                      ▲
                      │ 按名称在每台机器上注册；
                      │ 像任何仓库一样通过推送/克隆共享
        ┌─────────────┼─────────────┐
        │             │             │
    web-app       api-server     mobile-app
   （代码仓库）    （代码仓库）     （代码仓库）
```

两条规则保持简单：

1. **Store 只是一个 git 仓库。**你自己提交、推送、拉取和审查它。OpenSpec 从不自己克隆、同步或推送任何东西。
2. **声明，而非机制。**仓库可以*声明*它们如何关联到 stores。声明改变 OpenSpec 能告诉你什么——从不改变你的命令在哪里行动。

## 五分钟到第一个 store

两个命令带你从无到有到能工作的、store 范围的变更：

```bash
openspec store setup team-plans --path ~/openspec/team-plans
```

```bash
openspec new change add-login --store team-plans
```

## 故事：一个团队，一个规划仓库

团队将规范和变更保存在 `team-plans` 中，而不是分散在代码仓库中。

**第一天（设置者）：**

```bash
openspec store setup team-plans --path ~/openspec/team-plans \
  --remote git@github.com:acme/team-plans.git
git -C ~/openspec/team-plans push -u origin main
```

**每个队友（每台机器一次）：**

```bash
git clone git@github.com:acme/team-plans.git ~/openspec/team-plans
openspec store register ~/openspec/team-plans
```

## 故事：需求跨越团队界限

平台团队拥有需求。产品团队在自己的仓库中，用自己的设计构建它们。

```yaml
# 产品团队的 openspec/config.yaml
references:
  - platform-reqs
```

引用是只读上下文。仓库保持自己的 `openspec/` 根；工作留在那里。变化的是：`openspec instructions` 现在包含引用 store 的规范索引。

## 两个你总是可以问的问题

**"我的设置健康吗？"** — `openspec doctor`

**"我在用什么工作？"** — `openspec context`

## 工作集：重新打开你一起工作的文件夹

```bash
openspec workset create platform \
  --member ~/openspec/team-plans --member ~/src/api-server \
  --tool code
openspec workset list
openspec workset open platform
```

工作集是故意*不*共享的状态。它们存在于你的机器上，从不提交。

## 命令如何决定在哪里行动

根解析遵循明确的优先级：

1. 显式 `--store <id>`
2. 最近的祖先 `openspec/` 目录
3. 项目配置中的 `store:` 声明
4. 全局默认 store（`openspec config set defaultStore <id>`）
5. 如果没有以上，某些命令（`init`、`new change`）为当前目录创建隐式 `openspec/` 根

## 全局默认 Store

```bash
openspec config set defaultStore team-plans
openspec config unset defaultStore
```

现在任何没有本地根或显式 `--store` 的命令解析到 `team-plans`。