# OpenSpec Agent 契约

`openspec` CLI 的机器可读接口，对照 `src/` 验证（capstone 审计，2026-06-11）。下面的每个形状都从发出代码文档化。

## 1. 通用约定

- **每次调用一个 JSON 文档。**在 `--json` 模式下，stdout 携带恰好一个 JSON 文档（2 空格美化打印）。人类文本、spinner 和 store 横幅去 stderr。
- **Store 横幅。**在人类模式下，store 选择的根打印 `Using OpenSpec root: <id> (<path>)` 到 stderr。JSON 模式绝不打印。
- **键大小写依赖于表面。**store/doctor/context 负载使用 `snake_case`；工作流负载（`status`、`instructions`、`new change`、`validate`、`list`）使用 `camelCase`，除了嵌入的 `root` 对象始终使用 `store_id`。
- **可选键被省略，不是 null**，在大多数负载中。例外使用显式 `null` 的按形状标注。

## 2. 诊断信封

一个信封形状被每个机器可读诊断共享（`StoreDiagnostic`）：

```json
{
  "severity": "error" | "warning" | "info",
  "code": "snake_case_string",
  "message": "human sentence",
  "target": "dotted.surface (optional)",
  "fix": "one actionable sentence/command (optional)"
}
```

## 3. 根选择和 `RootOutput`

所有根解析命令（`list`、`show`、`validate`、`status`、`instructions`、`instructions apply`、`new change`、`archive`、`doctor`、`context`）按一个优先级解析一个 OpenSpec 根：

1. `--store <id>` → 注册 store 的根（`source: "store"`）。
2. 否则，带 `openspec/` 的最近祖先：规划形状 → `source: "nearest"`；仅配置目录带有效 `store:` 指针 → 那个 store，`source: "declared"`。
3. 无最近根 + 全局 `defaultStore` 设置 → 那个 store，`source: "global_default"`。
4. 无最近根，无默认 + 注册的 stores 存在 → 错误 `no_root_with_registered_stores`。
5. 无根，无默认，无 stores：搭建命令将 cwd 视为 `source: "implicit"`；诊断命令（`doctor`、`context`）改为失败 `no_openspec_root`。

成功的 JSON 负载嵌入根：

```json
"root": { "path": "/abs/path", "source": "store" | "declared" | "global_default" | "nearest" | "implicit", "store_id": "id (仅当 store 选择时)" }
```

## 4. 命令 JSON 形状

### 4.1 `list --json`

`{ "changes": [ { "name", "completedTasks", "totalTasks", "lastModified", "status": "no-tasks"|"complete"|"in-progress" } ], "root": RootOutput }`

`--specs`：`{ "specs": [ { "id", "requirementCount" } ], "root" }`。

### 4.2 `show <item> --json`

变更：`{ "id", "title", "deltaCount", "deltas": [...], "root" }`。
规范：`{ "id", "title", "overview", "requirementCount", "requirements": [...], "root" }`。

### 4.3 `validate --json`

`{ "items": [ { "id", "type": "change"|"spec", "valid", "issues": [...], "durationMs" } ], "summary": { "totals": {items,passed,failed}, "byType": {...} }, "version": "1.0", "root" }`。

### 4.4 `status --json`

`{ "changeName", "schemaName", "planningHome"?: { "kind", "root", "changesDir", "defaultSchema" }, "changeRoot", "artifactPaths": { "<id>": {outputPath, resolvedOutputPath, existingOutputPaths} }, "nextSteps": ["..."], "actionContext": { "mode": "repo-local", ... }, "isComplete", "applyRequires", "artifacts": [ {id, outputPath, status: "done"|"skipped"|"ready"|"blocked", requires, missingDeps?} ], "root" }`。

### 4.5 `instructions <artifact> --json`

`{ "artifact", "changeName", "schemaName", "context": "project context", "rules": ["rule strings"], "template": "template body", "instruction": "schema guidance", "resolvedOutputPath": "path", "dependencies": [ { "artifact": "id", "outputPath": "path" } ], "skipped"?: "skip message", "warning"?: "warning message", "root" }`。

### 4.6 `instructions apply --json`

`{ "changeName", "schemaName", "actionContext": { ... }, "apply": { "instruction": "...", "tracks": "tasks.md", "completionStatus": { "totalTasks", "completedTasks", "pendingTasks": [...] } }, "root" }`。

### 4.7 `new change --json`

`{ "changeName", "changeRoot", "schemaName", "planningHome"?: {...}, "artifactPaths": { "<id>": {outputPath, resolvedOutputPath} }, "nextSteps": ["..."], "root" }`。

### 4.8 `archive --json`

`{ "success": true, "changeName", "archivePath": "path", "root" }`。

### 4.9 `doctor --json`

`{ "root": { "valid", "rootDir", "issues": [...] }, "stores": { "members": [ { "id", "path", "healthy", "issues": [...] } ] }, "references": { "members": [ { "id", "healthy", "resolvedPath"?, "issues": [...] } ] }, "root" }`。

### 4.10 `context --json`

`{ "root": { "path", "source", "store_id"? }, "referencedStores": [ { "storeId", "path", "fetchCommand"?, "unresolved"?: { "message", "fix" } } ], "root" }`。

## 5. 已知不一致

- 键大小写：store/doctor/context 使用 `snake_case`；工作流命令使用 `camelCase`。
- `root.store_id` 在 `camelCase` 负载中是 `snake_case`。
- `list` 使用 `"status"` 作为字符串枚举（`"no-tasks"`、`"complete"`、`"in-progress"`），而 `status` 使用 `"status"` 作为每个产出物的字符串枚举（`"done"`、`"ready"`、`"blocked"`、`"skipped"`）。
- 大多数负载省略可选键；`store doctor` 的 `git.remote` 和 `git.branch` 在使用 `null` 时是显式 `null`。