/**
 * Artifact Graph 类型定义模块
 *
 * 本模块定义了 artifact-graph 子系统的所有核心类型，包括：
 *   1. Schema YAML 的 Zod 校验 schema（ArtifactSchema / ApplyPhaseSchema / SchemaYamlSchema）
 *   2. 从 Zod 推导出的 TypeScript 类型（Artifact / ApplyPhase / SchemaYaml）
 *   3. 运行时状态类型（CompletedSet / BlockedArtifacts）
 *
 * 这些类型是整个 artifact-graph 子系统的"契约"，其他模块
 * （schema.ts / graph.ts / state.ts / resolver.ts / instruction-loader.ts）
 * 都依赖这些类型。
 *
 * 核心概念：
 *   - Artifact（产出物）：工作流中的一个步骤，如 proposal、specs、design、tasks
 *   - Schema（schema）：定义一组 artifact 的依赖关系（DAG）
 *   - Apply Phase（应用阶段）：tasks 完成后的代码实施阶段
 */

import { z } from 'zod';

/**
 * 单个 Artifact 的定义 schema（用 Zod 校验）
 *
 * 每个 artifact 是工作流中的一个步骤，例如：
 *   - proposal（提案）
 *   - specs（规范）
 *   - design（设计）
 *   - tasks（任务清单）
 */
export const ArtifactSchema = z.object({
  /** Artifact 的唯一 ID（如 "proposal"、"specs"），不能为空 */
  id: z.string().min(1, { error: 'Artifact ID is required' }),
  /**
   * 该 artifact 生成的文件路径或 glob（如 "proposal.md"、"specs/**//*.md"）
   * 用于检测 artifact 是否已完成（文件存在即视为完成）
   */
  generates: z.string().min(1, { error: 'generates field is required' }),
  /** 该 artifact 的人类可读描述 */
  description: z.string(),
  /** 模板文件路径（相对于 schema 的 templates/ 目录，如 "proposal.md"） */
  template: z.string().min(1, { error: 'template field is required' }),
  /** 创建该 artifact 时给 AI 的指导说明（可选） */
  instruction: z.string().optional(),
  /**
   * 该 artifact 依赖的其他 artifact ID 列表
   * 例如：tasks 依赖 [specs, design]，必须先完成 specs 和 design 才能创建 tasks
   * 默认为空数组（无依赖）
   */
  requires: z.array(z.string()).default([]),
});

/**
 * Apply 阶段（应用阶段）的配置 schema
 *
 * Apply 阶段是 tasks 完成后的代码实施阶段，由 schema 显式配置。
 * 不是所有 schema 都有 apply 阶段，但默认的 spec-driven 有。
 */
export const ApplyPhaseSchema = z.object({
  /**
   * Apply 阶段开始前必须已完成的 artifact ID 列表
   * 通常至少包含 'tasks'（任务清单必须先存在）
   */
  requires: z.array(z.string()).min(1, { error: 'At least one required artifact' }),
  /**
   * 被追踪的 tasks 文件路径（相对于 change 目录）
   * 用于统计 apply 进度（解析文件中的 checkbox）
   * null 表示不追踪进度
   */
  tracks: z.string().nullable().optional(),
  /** Apply 阶段的自定义指导说明（可选） */
  instruction: z.string().optional(),
});

/**
 * 完整的 Schema YAML 文件结构
 *
 * 对应 schemas/<schema-name>/schema.yaml 文件的格式，
 * 例如 schemas/spec-driven/schema.yaml。
 */
export const SchemaYamlSchema = z.object({
  /** Schema 名称（如 "spec-driven"），不能为空 */
  name: z.string().min(1, { error: 'Schema name is required' }),
  /** Schema 版本号（正整数） */
  version: z.number().int().positive({ error: 'Version must be a positive integer' }),
  /** Schema 的人类可读描述（可选） */
  description: z.string().optional(),
  /** 该 schema 定义的所有 artifact 列表（至少 1 个） */
  artifacts: z.array(ArtifactSchema).min(1, { error: 'At least one artifact required' }),
  /** Apply 阶段配置（可选，用于 schema-aware 的 apply 指令） */
  apply: ApplyPhaseSchema.optional(),
});

// ============== 从 Zod schema 推导出的 TypeScript 类型 ==============

/** 单个 artifact 的类型 */
export type Artifact = z.infer<typeof ArtifactSchema>;
/** Apply 阶段配置的类型 */
export type ApplyPhase = z.infer<typeof ApplyPhaseSchema>;
/** 完整 schema 的类型 */
export type SchemaYaml = z.infer<typeof SchemaYamlSchema>;

// ============== 运行时状态类型（非 Zod，仅内部使用） ==============

/**
 * 已完成的 artifact ID 集合
 *
 * Slice 1 实现：通过文件系统简单检测完成状态
 * （artifact 的 generates 文件存在 = 完成）
 */
export type CompletedSet = Set<string>;

/**
 * 被阻塞的 artifact 映射表
 *
 * key 是被阻塞的 artifact ID，value 是它缺失的依赖 ID 数组
 * 例如：{ "tasks": ["specs", "design"] } 表示 tasks 因为缺少 specs 和 design 而被阻塞
 */
export interface BlockedArtifacts {
  [artifactId: string]: string[];
}
