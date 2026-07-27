# 故障排除

具体问题的具体修复方案。每个条目命名症状，用一句话解释可能的原因，给你修复方案。如果你在这里没看到你的问题，[FAQ](faq.md) 可能有帮助，[Discord](https://discord.gg/YctCnvvshC) 肯定有。

## 安装和设置

### `openspec: command not found`

CLI 没安装，或你的 shell 找不到它。全局安装并检查：

```bash
npm install -g @fission-ai/openspec@latest
openspec --version
```

如果安装了但仍然找不到，你的全局 npm bin 目录可能不在 `PATH` 上。运行 `npm bin -g` 查看全局二进制文件在哪里，确保该路径在你的 shell profile 中。

### "Requires Node.js 20.19.0 or higher"

OpenSpec 在 Node 20.19.0+ 上运行。检查版本并在需要时升级：

```bash
node --version
```

如果你用 bun 安装 OpenSpec，注意 OpenSpec 仍然*运行*在 Node 上，所以无论怎样你都需要 Node 20.19.0+ 在 `PATH` 上可用。参见 [安装](installation.md)。

### `openspec init` 没有配置我的 AI 工具

Init 询问设置哪些工具。如果你跳过了你的工具或想添加另一个，只需再运行一次，或使用非交互形式：

```bash
openspec init --tools claude,cursor
```

完整工具 ID 列表在 [支持的工具](supported-tools.md)。使用 `--tools all` 配置所有，`--tools none` 跳过工具设置。

## 命令不出现

如果 `/opsx:propose`（或你工具的等效）不出现或什么都不做，按这个列表排查。它们按最快检查的顺序排列。

1. **你可能在错误的地方。**斜杠命令在你的 AI 助手聊天中输入，不是你的终端。如果你在 shell 中输入了 `/opsx:propose`，那就是问题。参见 [命令如何工作](how-commands-work.md)。

2. **重新生成文件。**从你的项目根目录：

   ```bash
   openspec update
   ```

   这为你配置的每个工具重写技能和命令文件。

3. **重启你的助手。**大多数工具在启动时扫描技能和命令。一个新窗口通常就行。

4. **确认文件存在。**对于 Claude Code，检查 `.claude/skills/` 是否包含 `openspec-*` 文件夹。其他工具使用自己的目录，全部列在 [支持的工具](supported-tools.md)。

5. **检查你是否初始化了这个项目。**技能是按项目写入的。如果你克隆了仓库或切换了文件夹，在那里运行 `openspec init`（或 `openspec update`）。

6. **确认你的工具支持命令文件。**Codex 和一些其他工具（CodeArts、Kimi CLI、ForgeCode、Mistral Vibe）不生成 `opsx-*` 命令文件；它们使用基于技能的调用。对于 Codex，检查 `.codex/skills/openspec-*`。不同工具的形式不同：参见 [支持的工具](supported-tools.md) 和 [命令如何工作](how-commands-work.md#slash-command-syntax-by-tool)。

## 使用变更

### "Change not found"

命令无法判断你指的是哪个变更。明确命名它，或检查存在什么：

```bash
openspec list                    # 查看活跃变更
/opsx:apply add-dark-mode        # 在聊天中命名变更
```

同样确认你在正确的项目目录中。

### "No artifacts ready"

每个产出物要么已经创建，要么被阻塞等待依赖。查看什么在阻塞：

```bash
openspec status --change <name>
```

然后先创建缺失的依赖。记住顺序：proposal 启用 specs 和 design；specs 和 design 一起启用 tasks。

### `openspec validate` 报告警告或错误

验证检查你的规范和变更是否有结构问题。读消息：它命名文件和问题。

```bash
openspec validate <name>           # 验证一个项目
openspec validate --all            # 验证所有
openspec validate --all --strict   # 更严格的检查，适合 CI
```

常见原因是缺少必需的章节（如一个没有场景的规范）或格式错误的增量标题。修复文件并重新运行。[CLI 参考](cli.md#openspec-validate) 记录了输出格式。

### AI 创建了不完整或错误的产出物

AI 没有足够的上下文。几个杠杆有帮助：

- 在 `openspec/config.yaml` 中添加项目上下文，以便你的技术栈和约定被注入到每个请求。参见 [自定义](customization.md#project-configuration)。
- 为仅适用于规范等特定产出物的指导添加按产出物 `rules:`。
- 当提案时给出更详细的描述。
- 使用扩展的 `/opsx:continue` 逐个创建产出物并审查每个，而不是 `/opsx:ff` 一次性全做。

### 归档不完成，或警告未完成任务

归档不会*阻塞*未完成任务，但它警告你，因为归档通常意味着工作完成了。如果任务故意保留（你在归档部分变更），继续。否则先完成任务。归档也会提议将你的增量规范同步到主规范如果你还没同步；说 yes 除非你有理由不。

## 配置

### 我的 `config.yaml` 没有被应用

三个常见疑点：

1. **错误的文件名。**必须是 `openspec/config.yaml`，不是 `.yml`。
2. **无效的 YAML。**用任何 YAML 验证器检查；CLI 也报告语法错误带行号。
3. **你期望重启。**你不需要。配置更改立即生效。

### "Unknown artifact ID in rules: X"

`rules:` 下的键不匹配你 schema 中的任何产出物。对于默认 `spec-driven` schema，有效 ID 是 `proposal`、`specs`、`design`、`tasks`。查看任何 schema 的 ID：

```bash
openspec schemas --json
```

### "Context too large"

`context:` 字段限制在 50KB，这是故意的，因为它被注入到每个请求中。总结它，或链接到更长的文档而不是粘贴它们。精简的上下文也产生更好、更快的结果。

### "Schema not found"

你引用的 schema 名称不存在。列出现有可用的并检查拼写：

```bash
openspec schemas                    # 列出可用 schema
openspec schema which <name>        # 查看 schema 从哪里解析
openspec schema init <name>         # 创建一个自定义的
```

参见 [自定义](customization.md#custom-schemas)。

## 从旧工作流迁移

### "Legacy files detected in non-interactive mode"

你在 CI 或非交互式 shell 中，OpenSpec 发现了要清理的旧文件但无法提示你。自动批准：

```bash
openspec init --force
```

对于 Codex，OpenSpec 可能检测到 `$CODEX_HOME/prompts` 或 `~/.codex/prompts` 中的旧管理提示文件。该清理仅限于 OpenSpec 白名单的旧 Codex 提示文件名，且非交互式 `openspec init` 仅删除那些替换的 `.codex/skills/openspec-*` 技能存在的文件。非交互式 `openspec update` 不碰所有旧清理除非你传 `--force`。

### 迁移后命令没出现

重启你的 IDE。技能在启动时检测。如果它们仍然不出现，运行 `openspec update` 并检查 [支持的工具](supported-tools.md) 中的文件位置。

### 我的旧 `project.md` 没有被迁移

那是故意的。OpenSpec 从不自动删除 `project.md`，因为它可能包含你写的上下文。把有用的部分移到 `config.yaml` 的 `context:` 章节，然后自己删除它。[迁移指南](migration-guide.md#migrating-projectmd-to-configyaml) 带你走完这个，包括一个你可以交给 AI 做提炼的 prompt。

## 仍然卡住？

- **Discord：** [discord.gg/YctCnvvshC](https://discord.gg/YctCnvvshC)
- **GitHub Issues：** [github.com/Fission-AI/OpenSpec/issues](https://github.com/Fission-AI/OpenSpec/issues)
- **从你的终端：** `openspec feedback "出了什么问题"` 为你打开一个 issue。

当你报告问题时，包含你的 OpenSpec 版本（`openspec --version`）、你的 Node 版本（`node --version`）、你的 AI 工具，以及确切的命令和输出。这会让帮助快得多。