/**
 * 指令装配模块（Instruction Loader）
 *
 * 本模块是 artifact-graph 子系统中最上层的一层，负责把 schema、graph、
 * 完成状态、模板、项目配置等组装成 AI agent 可以直接消费的指令 JSON。
 *
 * 核心 API：
 *   1. loadTemplate() - 加载 schema 的模板文件内容
 *   2. loadChangeContext() - 加载 change 的完整上下文（graph + completed + metadata）
 *   3. generateInstructions() - 生成创建某个 artifact 的详细指令
 *   4. formatChangeStatus() - 格式化整个 change 的状态信息
 *
 * 这些 API 是 `openspec status`、`openspec instructions`、`openspec apply`
 * 等命令的核心实现。
 *
 * 指令 JSON 包含：
 *   - 模板内容（template）
 *   - 依赖信息（dependencies）
 *   - 解锁的 artifact（unlocks）
 *   - 项目上下文（context）
 *   - 规则（rules）
 *   - 引用（references）
 *   - 跳过标记（skipped + warning）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSchemaDir, resolveSchema, listSchemasWithInfo } from './resolver.js';
import { ArtifactGraph } from './graph.js';
import { detectCompleted } from './state.js';
import { resolveArtifactOutputs } from './outputs.js';
import { readChangeMetadata, resolveSchemaForChange } from '../../utils/change-metadata.js';
import { FileSystemUtils } from '../../utils/file-system.js';
import {
  buildActionContext,
  buildNextSteps,
  summarizePlanningHome,
  type ActionContext,
  type PlanningHomeSummary,
} from '../change-status-policy.js';
import { readProjectConfig, validateConfigRules, type ProjectConfig } from '../project-config.js';
import type { ReferenceIndexEntry } from '../references.js';
import type { PlanningHome } from '../planning-home.js';
import type { ChangeMetadata } from '../change-metadata/index.js';
import type { Artifact, CompletedSet } from './types.js';

/**
 * 会话级别的校验警告缓存
 *
 * 避免在同一次 CLI 调用中重复输出相同的警告。
 * 例如：项目配置里的 rules 引用了不存在的 artifact ID，
 * 只在第一次遇到时输出警告，后续不再重复。
 */
const shownWarnings = new Set<string>();

/**
 * 模板加载错误
 *
 * 当模板文件不存在或无法读取时抛出。
 */
export class TemplateLoadError extends Error {
  constructor(
    message: string,
    /** 模板文件路径（用于错误展示） */
    public readonly templatePath: string
  ) {
    super(message);
    this.name = 'TemplateLoadError';
  }
}

/**
 * Change 上下文
 *
 * 包含一个 change 的完整工作状态：
 *   - 依赖图（graph）
 *   - 已完成的 artifact 集合（completed）
 *   - 使用的 schema 名（schemaName）
 *   - change 的元数据（metadata，可选）
 *   - 被跳过的 artifact（skippedArtifacts，可选）
 */
export interface ChangeContext {
  /** artifact 依赖图 */
  graph: ArtifactGraph;
  /** 已完成的 artifact ID 集合 */
  completed: CompletedSet;
  /** 使用的 schema 名 */
  schemaName: string;
  /** change 名称 */
  changeName: string;
  /** change 目录的绝对路径 */
  changeDir: string;
  /** 项目根目录 */
  projectRoot: string;
  /** 该 change 的 planning home（可选） */
  planningHome?: PlanningHome;
  /** 解析后的 change 元数据（可选） */
  metadata?: ChangeMetadata;
  /**
   * 因 skip_specs 标记而被视为"完成"的 artifact ID 集合
   *
   * 这些 artifact 并没有实际生成文件，只是因为 change 声明了
   * skip_specs: true（无 spec 级别的行为变更）而被视为完成。
   * 单独保存以便状态展示时把它们渲染成"skipped"而不是"done"。
   */
  skippedArtifacts?: Set<string>;
}

/** loadChangeContext 的选项 */
export interface LoadChangeContextOptions {
  /** 显式指定的 change 目录路径（默认从 projectRoot 推导） */
  changeDir?: string;
  /** 显式指定的 planning home */
  planningHome?: PlanningHome;
}

/**
 * 给 AI 的丰富指令（创建单个 artifact 所需的全部信息）
 *
 * 这是 `openspec instructions <artifact>` 命令的输出格式。
 */
export interface ArtifactInstructions {
  /** change 名称 */
  changeName: string;
  /** artifact ID */
  artifactId: string;
  /** schema 名称 */
  schemaName: string;
  /** change 目录的绝对路径 */
  changeDir: string;
  /** 该 change 的 planning home 摘要 */
  planningHome?: PlanningHomeSummary;
  /** 输出路径模式（如 "proposal.md"） */
  outputPath: string;
  /** 在 change 目录下解析出的绝对输出路径或 glob */
  resolvedOutputPath: string;
  /** 该 artifact 已存在的输出文件列表 */
  existingOutputPaths: string[];
  /** artifact 描述 */
  description: string;
  /** 创建该 artifact 的指导说明（来自 schema 的 instruction 字段） */
  instruction: string | undefined;
  /** 项目级 context（来自 config，AI 的背景信息，不写入输出） */
  context: string | undefined;
  /** artifact 专属 rules（来自 config，AI 的约束，不写入输出） */
  rules: string[] | undefined;
  /** 引用 store 的索引条目（只读的上游 context，无引用时省略） */
  references?: ReferenceIndexEntry[];
  /** 模板内容（这就是输出格式，要严格遵循） */
  template: string;
  /** 依赖信息（含完成状态和路径） */
  dependencies: DependencyInfo[];
  /** 完成该 artifact 后解锁的 artifact ID 列表 */
  unlocks: string[];
  /** true 表示该 change 声明了 skip_specs，此 artifact 被跳过 */
  skipped?: boolean;
  /** 当 skipped=true 时存在，告诉消费者不要创建该 artifact */
  warning?: string;
}

/**
 * skip_specs 模式下的指令警告
 *
 * 这个警告会同时出现在 JSON payload 和文本输出中，
 * 保证用 --json 驱动 CLI 的 agent 和人类用户都能看到"不要创建"的信号。
 */
export const SKIP_SPECS_INSTRUCTIONS_WARNING =
  'This change declares skip_specs: true in .openspec.yaml (no spec-level behavior changes), so this artifact is skipped.\n' +
  'Do not create spec files - they will conflict with that marker. If requirements now change, remove skip_specs from .openspec.yaml and rerun this command.';

/**
 * 单个依赖的信息
 */
export interface DependencyInfo {
  /** 依赖的 artifact ID */
  id: string;
  /** 该依赖是否已完成 */
  done: boolean;
  /** 依赖的输出路径（相对路径，如 "proposal.md"） */
  path: string;
  /** 依赖的描述 */
  description: string;
  /** true 表示该依赖通过 skip_specs 满足（无实际文件可读） */
  skipped?: boolean;
}

/**
 * 单个 artifact 在工作流中的状态
 */
export interface ArtifactStatus {
  /** artifact ID */
  id: string;
  /** 输出路径模式 */
  outputPath: string;
  /**
   * 状态：
   *   - done：已完成（文件存在）
   *   - skipped：被跳过（因 skip_specs）
   *   - ready：就绪（所有依赖已完成）
   *   - blocked：被阻塞（有依赖未完成）
   */
  status: 'done' | 'skipped' | 'ready' | 'blocked';
  /**
   * 该 artifact 直接依赖的 artifact ID 列表（requires 边）
   *
   * 所有状态都包含此字段，这样调用方可以在 artifact 已 done 的情况下
   * 也计算传递依赖（文件存在不代表依赖也存在）。
   */
  requires: string[];
  /** 缺失的依赖列表（仅 blocked 状态有） */
  missingDeps?: string[];
}

/**
 * 格式化后的 change 状态（`openspec status` 命令的输出格式）
 */
export interface ChangeStatus {
  /** change 名称 */
  changeName: string;
  /** schema 名称 */
  schemaName: string;
  /**
   * Planning home 摘要
   * 生成的 skills 会从 planningHome.changesDir 推导归档目录
   * （这是一个公开的 agent 契约）。
   */
  planningHome?: PlanningHomeSummary;
  /** change 根目录的绝对路径 */
  changeRoot: string;
  /** 按 artifact ID 索引的路径详情 */
  artifactPaths: Record<string, ArtifactPathSummary>;
  /** 给用户和 agent 的下一步建议（自然语言） */
  nextSteps: string[];
  /** 给 agent 的机器可读动作约束 */
  actionContext: ActionContext;
  /** 是否所有 artifact 都已完成 */
  isComplete: boolean;
  /** apply 阶段要求的 artifact ID 列表（来自 schema 的 apply.requires） */
  applyRequires: string[];
  /** 每个 artifact 的状态 */
  artifacts: ArtifactStatus[];
}

/** artifact 路径详情 */
export interface ArtifactPathSummary {
  /** 输出路径模式 */
  outputPath: string;
  /** 解析后的绝对路径 */
  resolvedOutputPath: string;
  /** 已存在的输出文件列表 */
  existingOutputPaths: string[];
}

/**
 * 加载 schema 的模板文件
 *
 * 模板文件位于 schema 目录的 templates/ 子目录下。
 * 例如：spec-driven schema 的 proposal 模板在
 *   schemas/spec-driven/templates/proposal.md
 *
 * @param schemaName - schema 名称（如 "spec-driven"）
 * @param templatePath - 模板文件相对路径（如 "proposal.md"）
 * @param projectRoot - 可选的项目根目录（用于项目级 schema 解析）
 * @returns 模板文件内容
 * @throws TemplateLoadError 如果 schema 不存在或模板文件无法读取
 */
export function loadTemplate(
  schemaName: string,
  templatePath: string,
  projectRoot?: string
): string {
  // 先找到 schema 目录
  const schemaDir = getSchemaDir(schemaName, projectRoot);
  if (!schemaDir) {
    throw new TemplateLoadError(
      `Schema '${schemaName}' not found`,
      templatePath
    );
  }

  // 拼接模板文件的完整路径
  const templatePathOnDisk = path.join(schemaDir, 'templates', templatePath);

  // 检查文件存在性
  if (!fs.existsSync(templatePathOnDisk)) {
    throw new TemplateLoadError(
      `Template not found: ${templatePathOnDisk}`,
      templatePathOnDisk
    );
  }

  // 规范化路径（处理符号链接、大小写等）
  const fullPath = FileSystemUtils.canonicalizeExistingPath(templatePathOnDisk);

  // 读取文件内容
  try {
    return fs.readFileSync(fullPath, 'utf-8');
  } catch (err) {
    const ioError = err instanceof Error ? err : new Error(String(err));
    throw new TemplateLoadError(
      `Failed to read template: ${ioError.message}`,
      fullPath
    );
  }
}

/**
 * 加载 change 的完整上下文
 *
 * 这是 `openspec status` / `openspec instructions` 等命令的核心入口。
 *
 * 流程：
 *   1. 解析 change 目录路径
 *   2. 读取 change 的元数据（.openspec.yaml）
 *   3. 解析 schema 名（按优先级：参数 > 元数据 > 默认 'spec-driven'）
 *   4. 加载 schema 并构建 ArtifactGraph
 *   5. 检测已完成的 artifact（detectCompleted）
 *   6. 处理 skip_specs 标记（把 specs/* artifact 标记为 skipped 完成）
 *
 * Schema 解析顺序：
 *   1. 显式传入的 schemaName 参数（最高优先级）
 *   2. change 元数据里的 schema（.openspec.yaml 的 schema 字段）
 *   3. 默认 'spec-driven'
 *
 * @param projectRoot - 项目根目录
 * @param changeName - change 名称
 * @param schemaName - 可选的 schema 名覆盖
 * @param options - 可选的加载选项
 * @returns ChangeContext 对象
 */
export function loadChangeContext(
  projectRoot: string,
  changeName: string,
  schemaName?: string,
  options: LoadChangeContextOptions = {}
): ChangeContext {
  // 1. 解析 change 目录路径（优先用 options.changeDir，否则从 projectRoot 推导）
  const changeDir = FileSystemUtils.canonicalizeExistingPath(
    options.changeDir ?? path.join(projectRoot, 'openspec', 'changes', changeName)
  );

  // 2. 读取 change 元数据（可能不存在，此时为 undefined）
  const metadata = readChangeMetadata(changeDir, projectRoot) ?? undefined;

  // 3. 解析 schema 名（参数 > 元数据 > 默认）
  const resolvedSchemaName = resolveSchemaForChange(changeDir, schemaName, projectRoot, {
    metadata: metadata ?? null,
  });

  // 4. 加载 schema 并构建图
  const schema = resolveSchema(resolvedSchemaName, projectRoot);
  const graph = ArtifactGraph.fromSchema(schema);

  // 5. 检测已完成 artifact
  const completed = detectCompleted(graph, changeDir);

  // 6. 处理 skip_specs 标记
  // 声明了 skip_specs 的 change 不会有 spec 增量文件，但为了不让图阻塞
  // 后续 artifact（如 tasks），把生成 specs/ 文件的 artifact 视为完成。
  // 单独保存到 skippedArtifacts，让状态展示把它们渲染成 skipped 而非 done。
  const skippedArtifacts = new Set<string>();
  if (metadata?.skip_specs) {
    for (const artifact of graph.getAllArtifacts()) {
      // generates 可能是 './specs/...' 形式，去掉 ./ 前缀后统一判断
      // （否则 skip 集合会漏掉这种写法，导致指令让 agent 去创建
      //   冲突 gate 阻止的文件）
      const generates = artifact.generates.replace(/^(?:\.\/)+/, '');
      if (generates.startsWith('specs/') && !completed.has(artifact.id)) {
        completed.add(artifact.id);
        skippedArtifacts.add(artifact.id);
      }
    }
  }

  // 返回完整的上下文对象（条件字段只在有值时才包含）
  return {
    graph,
    completed,
    schemaName: resolvedSchemaName,
    changeName,
    changeDir,
    projectRoot,
    ...(options.planningHome ? { planningHome: options.planningHome } : {}),
    ...(metadata ? { metadata } : {}),
    ...(skippedArtifacts.size > 0 ? { skippedArtifacts } : {}),
  };
}

/**
 * 生成创建某个 artifact 的丰富指令
 *
 * 这是 `openspec instructions <artifact>` 命令的核心。
 *
 * 装配流程：
 *   1. 从 context.graph 获取 artifact 定义
 *   2. 加载 artifact 的模板文件
 *   3. 计算依赖信息（每个依赖的完成状态和路径）
 *   4. 计算完成该 artifact 后解锁的 artifact
 *   5. 读取项目配置（config.yaml）获取 context 和 rules
 *   6. 校验 rules 引用的 artifact ID（每个 session 只警告一次）
 *   7. 如果是 skipped artifact，附加 warning
 *
 * @param context - change 上下文（来自 loadChangeContext）
 * @param artifactId - 要生成指令的 artifact ID
 * @param projectRoot - 项目根目录（用于读取配置，可选，默认用 context.projectRoot）
 * @param options - 可选参数（预读的配置、引用索引）
 * @returns ArtifactInstructions 对象
 * @throws Error 如果 artifact 不存在
 */
export interface GenerateInstructionsOptions {
  /** 预读的项目配置；提供则不再重复读取 */
  projectConfig?: ProjectConfig | null;
  /** 在命令边界装配好的引用 store 索引 */
  references?: ReferenceIndexEntry[];
}

export function generateInstructions(
  context: ChangeContext,
  artifactId: string,
  projectRoot?: string,
  options: GenerateInstructionsOptions = {}
): ArtifactInstructions {
  // 1. 获取 artifact 定义
  const artifact = context.graph.getArtifact(artifactId);
  if (!artifact) {
    throw new Error(`Artifact '${artifactId}' not found in schema '${context.schemaName}'`);
  }

  // 2. 加载模板内容
  const templateContent = loadTemplate(context.schemaName, artifact.template, context.projectRoot);
  // 3. 计算依赖信息
  const dependencies = getDependencyInfo(artifact, context.graph, context.completed, context.skippedArtifacts);
  // 4. 计算解锁的 artifact
  const unlocks = getUnlockedArtifacts(context.graph, artifactId);

  // 5. 读取项目配置（优先用预读的，否则现读）
  const effectiveProjectRoot = projectRoot ?? context.projectRoot;
  let projectConfig = options.projectConfig ?? null;
  if (options.projectConfig === undefined && effectiveProjectRoot) {
    try {
      projectConfig = readProjectConfig(effectiveProjectRoot);
    } catch {
      // 配置读取失败时静默继续（无配置也能工作）
    }
  }

  // 6. 校验 rules 的 artifact ID（仅当配置里有 rules 时）
  // rules 是全局的，而每个 change 可能用不同 schema，所以只有当
  // 某个 key 在所有可用 schema 中都不存在时才算"unknown"
  if (projectConfig?.rules) {
    const validArtifactIds = new Set(
      listSchemasWithInfo(effectiveProjectRoot ?? undefined).flatMap((s) => s.artifacts)
    );
    const warnings = validateConfigRules(projectConfig.rules, validArtifactIds);

    // 每条警告只输出一次（会话级别去重）
    for (const warning of warnings) {
      if (!shownWarnings.has(warning)) {
        console.warn(warning);
        shownWarnings.add(warning);
      }
    }
  }

  // 7. 提取 context 和 rules（作为独立字段，不拼接到模板前）
  const configContext = projectConfig?.context?.trim() || undefined;
  const rulesForArtifact = projectConfig?.rules?.[artifactId];
  const configRules = rulesForArtifact && rulesForArtifact.length > 0 ? rulesForArtifact : undefined;

  // 返回装配好的指令对象
  return {
    changeName: context.changeName,
    artifactId: artifact.id,
    schemaName: context.schemaName,
    changeDir: context.changeDir,
    planningHome: summarizePlanningHome(context.planningHome),
    outputPath: artifact.generates,
    resolvedOutputPath: path.join(context.changeDir, artifact.generates),
    existingOutputPaths: resolveArtifactOutputs(context.changeDir, artifact.generates),
    description: artifact.description,
    instruction: artifact.instruction,
    context: configContext,
    rules: configRules,
    ...(options.references !== undefined ? { references: options.references } : {}),
    // 如果是 skipped artifact，附加 warning
    ...(context.skippedArtifacts?.has(artifact.id)
      ? { skipped: true, warning: SKIP_SPECS_INSTRUCTIONS_WARNING }
      : {}),
    template: templateContent,
    dependencies,
    unlocks,
  };
}

/**
 * 获取 artifact 的依赖信息（含完成状态和路径）
 *
 * @param artifact - 当前 artifact
 * @param graph - 依赖图
 * @param completed - 已完成集合
 * @param skippedArtifacts - 被 skip_specs 跳过的集合（可选）
 * @returns 依赖信息数组
 */
function getDependencyInfo(
  artifact: Artifact,
  graph: ArtifactGraph,
  completed: CompletedSet,
  skippedArtifacts?: Set<string>
): DependencyInfo[] {
  return artifact.requires.map(id => {
    const depArtifact = graph.getArtifact(id);
    return {
      id,
      done: completed.has(id),
      path: depArtifact?.generates ?? id,
      description: depArtifact?.description ?? '',
      // 如果该依赖是被 skip_specs 跳过的，标记为 skipped
      ...(skippedArtifacts?.has(id) ? { skipped: true } : {}),
    };
  });
}

/**
 * 获取完成指定 artifact 后解锁的 artifact 列表
 *
 * 遍历图中所有 artifact，找出 requires 包含 artifactId 的。
 *
 * @param graph - 依赖图
 * @param artifactId - 刚完成的 artifact ID
 * @returns 被解锁的 artifact ID 数组（按名称排序）
 */
function getUnlockedArtifacts(graph: ArtifactGraph, artifactId: string): string[] {
  const unlocks: string[] = [];

  for (const artifact of graph.getAllArtifacts()) {
    if (artifact.requires.includes(artifactId)) {
      unlocks.push(artifact.id);
    }
  }

  return unlocks.sort();
}

/**
 * 格式化整个 change 的状态信息
 *
 * 这是 `openspec status` 命令的核心实现。
 *
 * 流程：
 *   1. 加载 schema 获取 apply 阶段配置
 *   2. 计算每个 artifact 的状态（done / skipped / ready / blocked）
 *   3. 按 build order 排序 artifact 状态
 *   4. 构建 nextSteps（自然语言）和 actionContext（机器可读）
 *
 * @param context - change 上下文
 * @param options - 可选参数（storeId）
 * @returns ChangeStatus 对象
 */
export function formatChangeStatus(
  context: ChangeContext,
  options: { storeId?: string } = {}
): ChangeStatus {
  // 1. 加载 schema 获取 apply 阶段配置
  const schema = resolveSchema(context.schemaName, context.projectRoot);
  // apply 阶段要求的 artifact：显式配置优先，否则默认全部 artifact
  const applyRequires = schema.apply?.requires ?? schema.artifacts.map(a => a.id);

  // 2. 计算每个 artifact 的状态
  const artifacts = context.graph.getAllArtifacts();
  const ready = new Set(context.graph.getNextArtifacts(context.completed));
  const blocked = context.graph.getBlocked(context.completed);

  // 收集每个 artifact 的路径详情和状态
  const artifactPaths: Record<string, ArtifactPathSummary> = {};
  const artifactStatuses: ArtifactStatus[] = artifacts.map(artifact => {
    // 路径详情
    artifactPaths[artifact.id] = {
      outputPath: artifact.generates,
      resolvedOutputPath: path.join(context.changeDir, artifact.generates),
      existingOutputPaths: resolveArtifactOutputs(context.changeDir, artifact.generates),
    };

    // 状态判定（优先级：skipped > done > ready > blocked）
    if (context.skippedArtifacts?.has(artifact.id)) {
      return {
        id: artifact.id,
        outputPath: artifact.generates,
        status: 'skipped' as const,
        requires: artifact.requires,
      };
    }

    if (context.completed.has(artifact.id)) {
      return {
        id: artifact.id,
        outputPath: artifact.generates,
        status: 'done' as const,
        requires: artifact.requires,
      };
    }

    if (ready.has(artifact.id)) {
      return {
        id: artifact.id,
        outputPath: artifact.generates,
        status: 'ready' as const,
        requires: artifact.requires,
      };
    }

    // 默认是 blocked，附带缺失的依赖列表
    return {
      id: artifact.id,
      outputPath: artifact.generates,
      status: 'blocked' as const,
      requires: artifact.requires,
      missingDeps: blocked[artifact.id] ?? [],
    };
  });

  // 3. 按 build order 排序，保证输出顺序一致
  const buildOrder = context.graph.getBuildOrder();
  const orderMap = new Map(buildOrder.map((id, idx) => [id, idx]));
  artifactStatuses.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

  // 检查是否全部完成
  const isComplete = context.graph.isComplete(context.completed);
  const artifactIds = artifactStatuses.map((artifact) => artifact.id);

  // 4. 返回完整的 ChangeStatus 对象
  return {
    changeName: context.changeName,
    schemaName: context.schemaName,
    planningHome: summarizePlanningHome(context.planningHome),
    changeRoot: context.changeDir,
    artifactPaths,
    isComplete,
    applyRequires,
    // 构建下一步建议（自然语言）
    nextSteps: buildNextSteps({
      changeName: context.changeName,
      artifactStatuses,
      allArtifactsComplete: isComplete,
      ...(options.storeId ? { storeId: options.storeId } : {}),
    }),
    // 构建动作上下文（机器可读约束）
    actionContext: buildActionContext({
      projectRoot: context.projectRoot,
      artifactIds,
    }),
    artifacts: artifactStatuses,
  };
}
