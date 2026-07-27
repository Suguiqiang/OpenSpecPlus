/**
 * Artifact Graph 子系统入口（barrel 文件）
 *
 * 本文件是 artifact-graph 子系统的统一导出口，把所有内部模块的公开 API
 * 汇总到这里，外部代码只需 `import { ... } from '../artifact-graph/index.js'`。
 *
 * 子系统职责：
 *   1. 加载和校验 schema YAML 文件（schema.ts）
 *   2. 构建 artifact 依赖图（graph.ts）
 *   3. 检测 artifact 完成状态（state.ts）
 *   4. 解析 artifact 输出路径（outputs.ts）
 *   5. 解析 schema 路径（项目级 / 用户级 / 包级，resolver.ts）
 *   6. 装配给 AI 的指令 JSON（instruction-loader.ts）
 *
 * 调用方：
 *   - src/commands/workflow/*（status / instructions / apply 等命令）
 *   - src/utils/task-progress.ts（统计任务进度）
 *   - src/core/archive.ts（归档时检查完成状态）
 */

// ============== 类型导出 ==============
export {
  ArtifactSchema,
  SchemaYamlSchema,
  type Artifact,
  type SchemaYaml,
  type CompletedSet,
  type BlockedArtifacts,
} from './types.js';

// ============== Schema 加载与校验 ==============
export { loadSchema, parseSchema, SchemaValidationError } from './schema.js';

// ============== 依赖图操作 ==============
export { ArtifactGraph } from './graph.js';

// ============== 状态检测 ==============
export { detectCompleted } from './state.js';
export { artifactOutputExists, isGlobPattern, resolveArtifactOutputs } from './outputs.js';

// ============== Schema 解析（项目级 / 用户级 / 包级） ==============
export {
  resolveSchema,
  listSchemas,
  listSchemasWithInfo,
  getSchemaDir,
  getPackageSchemasDir,
  getUserSchemasDir,
  SchemaLoadError,
  type SchemaInfo,
} from './resolver.js';

// ============== 指令装配 ==============
export {
  loadTemplate,
  loadChangeContext,
  generateInstructions,
  formatChangeStatus,
  TemplateLoadError,
  type ChangeContext,
  type LoadChangeContextOptions,
  type ArtifactInstructions,
  type DependencyInfo,
  type ArtifactStatus,
  type ChangeStatus,
  type ArtifactPathSummary,
} from './instruction-loader.js';

// ============== 从 change-status-policy 重新导出的类型 ==============
export type {
  PlanningHomeSummary,
  ActionContext,
} from '../change-status-policy.js';
