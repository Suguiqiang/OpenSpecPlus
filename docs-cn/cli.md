# CLI 参考

OpenSpec CLI（`openspec`）提供用于项目设置、验证、状态检查和管理终端命令。这些命令补充 [命令](commands.md) 中记录的 AI 斜杠命令（如 `/opsx:propose`）。

## 摘要

| 类别 | 命令 | 用途 |
|----------|----------|---------|
| **设置** | `init`、`update` | 在你的项目中初始化并更新 OpenSpec |
| **Stores** | `store setup`、`store register`、`store unregister`、`store remove`、`store list`、`store doctor` | 管理 stores——你注册的独立 OpenSpec 仓库 |
| **健康** | `doctor` | 报告已解析根的关系健康 |
| **工作上下文** | `context` | 组装工作集（根 + 引用的 stores） |
| **个人工作集** | `workset create`、`workset list`、`workset open`、`workset remove` | 在你的工具中保持和打开个人、本地工作视图 |
| **浏览** | `list`、`view`、`show` | 探索变更和规范 |
| **验证** | `validate` | 检查变更和规范的问题 |
| **生命周期** | `archive` | 完成已完成的变更 |
| **工作流** | `new change`、`status`、`instructions`、`templates`、`schemas` | 产出物驱动的工作流支持 |
| **Schema** | `schema init`、`schema fork`、`schema validate`、`schema which` | 创建和管理自定义工作流 |
| **配置** | `config` | 查看和修改设置 |
| **工具** | `feedback`、`completion` | 反馈和 shell 集成 |

## 人类 vs Agent 命令

大多数 CLI 命令设计为在终端中**人类使用**。一些命令也通过 JSON 输出支持 **agent/脚本使用**。

### 仅人类命令

这些命令是交互式的，设计为终端使用：

| 命令 | 用途 |
|---------|---------|
| `openspec init` | 初始化项目（交互式提示） |
| `openspec view` | 交互式仪表板 |
| `openspec workset open <name>` | 打开保存的工作集 |
| `openspec config edit` | 在编辑器中打开配置 |
| `openspec feedback` | 通过 GitHub 提交反馈 |
| `openspec completion install` | 安装 shell 补全 |

### Agent 兼容命令

这些命令支持 `--json` 输出供 AI agent 和脚本编程使用：

| 命令 | 人类使用 | Agent 使用 |
|---------|-----------|-----------|
| `openspec list` | 浏览变更/规范 | `--json` 获取结构化数据 |
| `openspec show <item>` | 阅读内容 | `--json` 用于解析 |
| `openspec validate` | 检查问题 | `--all --json` 用于批量验证 |
| `openspec status` | 查看产出物进度 | `--json` 获取结构化状态 |
| `openspec instructions` | 获取下一步 | `--json` 获取 agent 指令 |
| `openspec archive` | 完成变更 | `--json` 用于非交互式归档 |

## 全局选项

| 选项 | 描述 |
|--------|-------------|
| `--version`、`-V` | 显示版本号 |
| `--no-color` | 禁用彩色输出 |
| `--help`、`-h` | 显示命令帮助 |

## 设置命令

### `openspec init`

在你的项目中初始化 OpenSpec。创建文件夹结构并配置 AI 工具集成。

```
openspec init [path] [options]
```

**选项：**

| 选项 | 描述 |
|--------|-------------|
| `--tools <list>` | 非交互式配置 AI 工具。使用 `all`、`none` 或逗号分隔列表 |
| `--force` | 自动清理旧文件而不提示 |
| `--profile <profile>` | 为此 init 运行覆盖全局配置文件（`core` 或 `custom`） |

### `openspec update`

升级 CLI 后更新 OpenSpec 指令文件。重新生成 AI 工具配置文件。

```
openspec update [path] [options]
```

**选项：**

| 选项 | 描述 |
|--------|-------------|
| `--force` | 即使文件已是最新也强制更新 |

## 浏览命令

### `openspec list`

列出项目中的变更或规范。

```
openspec list [options]
```

**选项：**

| 选项 | 描述 |
|--------|-------------|
| `--specs` | 列出规范而非变更 |
| `--changes` | 显式列出变更（默认） |
| `--sort <order>` | 按 `recent`（默认）或 `name` 排序 |
| `--json` | 输出为 JSON |

### `openspec view`

显示交互式仪表板用于探索规范和变更。

### `openspec show`

显示变更或规范的详细信息。

```
openspec show [item-name] [options]
```

## 验证命令

### `openspec validate`

验证变更和规范的结构问题。

```
openspec validate [item-name] [options]
```

**选项：**

| 选项 | 描述 |
|--------|-------------|
| `--all` | 验证所有变更和规范 |
| `--changes` | 验证所有变更 |
| `--specs` | 验证所有规范 |
| `--strict` | 启用严格验证模式 |
| `--json` | 输出为 JSON |

## 工作流命令

### `openspec new change`

为变更创建搭建。

```bash
openspec new change <id> [--schema <name>] [--json] [--store <id>]
```

### `openspec status`

显示变更的产出物完成状态。

```bash
openspec status --change <name> [--json]
```

### `openspec instructions`

输出创建产出物或应用任务的丰富指令。

```bash
openspec instructions [artifact] --change <name> [--json]
```

## 配置命令

### `openspec config`

查看和修改配置设置。

```bash
openspec config path              # 显示配置文件路径
openspec config edit              # 在编辑器中打开
openspec config profile           # 切换工作流配置文件
openspec config set <key> <value> # 设置配置值
openspec config unset <key>       # 取消设置配置值
```

## Schema 命令

```bash
openspec schema init <name>       # 创建新 schema
openspec schema fork <from> <to>  # Fork 现有 schema
openspec schema validate <name>   # 验证 schema
openspec schema which <name>      # 查看 schema 解析位置
openspec schemas                  # 列出可用 schema
```

## Store 命令（Beta）

```bash
openspec store setup <id>         # 创建并注册本地 store
openspec store register <path>    # 注册现有 store
openspec store unregister <id>    # 忘记本地 store 注册
openspec store remove <id>        # 删除已注册的本地 store
openspec store list              # 列出本地注册的 stores
openspec store doctor [id]       # 检查本地 store 健康
```

## 工作集命令（Beta）

```bash
openspec workset create [name]    # 创建个人工作视图
openspec workset list             # 浏览保存的工作集
openspec workset open <name>      # 在工具中打开工作集
openspec workset remove <name>    # 删除保存的工作集
```

## 其他命令

```bash
openspec feedback <message>       # 提交反馈
openspec completion generate [shell]  # 生成补全脚本
openspec completion install [shell]   # 安装补全
openspec completion uninstall [shell] # 卸载补全
openspec doctor [--store <id>] [--json]  # 检查设置健康
openspec context [--store <id>] [--json]  # 组装工作集
```

## 参见

- [命令](commands.md) — AI 斜杠命令参考
- [快速上手](getting-started.md) — 首次设置
- [Stores 用户指南](stores-beta/user-guide.md) — 跨仓库规划