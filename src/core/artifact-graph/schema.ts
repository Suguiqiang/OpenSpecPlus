/**
 * Schema YAML 加载与校验模块
 *
 * 本模块负责读取 schema.yaml 文件，解析 YAML，并用 Zod 校验结构，
 * 同时执行 3 项额外的语义校验：
 *   1. 没有 duplicate artifact ID
 *   2. 所有 requires 引用都指向有效的 artifact ID
 *   3. 依赖关系无环（DAG）
 *
 * 校验失败时抛出 SchemaValidationError。
 *
 * 调用方：graph.ts（构建图前先校验）、resolver.ts（加载 schema 时）
 */

import * as fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { SchemaYamlSchema, type SchemaYaml, type Artifact } from './types.js';

/**
 * Schema 校验错误
 *
 * 当 schema YAML 文件格式不正确、字段缺失、有重复 ID、
 * 引用无效或存在循环依赖时抛出。
 */
export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

/**
 * 从文件路径加载并校验 artifact schema
 *
 * @param filePath - schema.yaml 文件的绝对路径
 * @returns 校验后的 SchemaYaml 对象
 * @throws SchemaValidationError 如果校验失败
 */
export function loadSchema(filePath: string): SchemaYaml {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseSchema(content);
}

/**
 * 从 YAML 字符串解析并校验 artifact schema
 *
 * 校验流程：
 *   1. 用 yaml 库解析 YAML 字符串
 *   2. 用 Zod schema 校验结构（字段类型、必填、长度等）
 *   3. 校验无重复 artifact ID
 *   4. 校验所有 requires 引用有效
 *   5. 校验依赖关系无环
 *
 * @param yamlContent - schema.yaml 的字符串内容
 * @returns 校验后的 SchemaYaml 对象
 * @throws SchemaValidationError 如果任一校验失败
 */
export function parseSchema(yamlContent: string): SchemaYaml {
  const parsed = parseYaml(yamlContent);

  // 1. 用 Zod 校验结构
  const result = SchemaYamlSchema.safeParse(parsed);
  if (!result.success) {
    // 收集所有错误信息并拼接
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new SchemaValidationError(`Invalid schema: ${errors}`);
  }

  const schema = result.data;

  // 2. 语义校验：无重复 ID
  validateNoDuplicateIds(schema.artifacts);
  // 3. 语义校验：requires 引用有效
  validateRequiresReferences(schema.artifacts);
  // 4. 语义校验：依赖关系无环
  validateNoCycles(schema.artifacts);

  return schema;
}

/**
 * 校验 artifacts 数组中没有重复的 ID
 *
 * @param artifacts - artifact 列表
 * @throws SchemaValidationError 如果发现重复 ID
 */
function validateNoDuplicateIds(artifacts: Artifact[]): void {
  const seen = new Set<string>();
  for (const artifact of artifacts) {
    if (seen.has(artifact.id)) {
      throw new SchemaValidationError(`Duplicate artifact ID: ${artifact.id}`);
    }
    seen.add(artifact.id);
  }
}

/**
 * 校验所有 `requires` 引用都指向有效的 artifact ID
 *
 * 例如：如果 artifact A 的 requires 是 ['B']，但 artifacts 列表里没有 B，则报错。
 *
 * @param artifacts - artifact 列表
 * @throws SchemaValidationError 如果发现无效引用
 */
function validateRequiresReferences(artifacts: Artifact[]): void {
  // 收集所有有效的 artifact ID
  const validIds = new Set(artifacts.map(a => a.id));

  for (const artifact of artifacts) {
    for (const req of artifact.requires) {
      if (!validIds.has(req)) {
        throw new SchemaValidationError(
          `Invalid dependency reference in artifact '${artifact.id}': '${req}' does not exist`
        );
      }
    }
  }
}

/**
 * 校验依赖关系无环（必须是 DAG - 有向无环图）
 *
 * 使用 DFS（深度优先搜索）检测环，如果发现环则报告完整的环路径。
 * 例如检测到 A → B → C → A，会抛出 "Cyclic dependency detected: A → B → C → A"。
 *
 * 算法：
 *   - visited：已经访问过的节点（避免重复访问）
 *   - inStack：当前 DFS 路径上的节点（用于检测环）
 *   - parent：记录每个节点的父节点（用于回溯重建环路径）
 *
 * @param artifacts - artifact 列表
 * @throws SchemaValidationError 如果发现循环依赖
 */
function validateNoCycles(artifacts: Artifact[]): void {
  // 构建 artifact ID -> artifact 的映射
  const artifactMap = new Map(artifacts.map(a => [a.id, a]));
  /** 已访问的节点（整个 DFS 过程中只访问一次） */
  const visited = new Set<string>();
  /** 当前 DFS 路径上的节点（用于检测环） */
  const inStack = new Set<string>();
  /** 记录每个节点的父节点，用于回溯重建环路径 */
  const parent = new Map<string, string>();

  /**
   * 从指定节点开始 DFS
   * @param id - 当前节点 ID
   * @returns 如果发现环，返回环路径字符串；否则返回 null
   */
  function dfs(id: string): string | null {
    visited.add(id);
    inStack.add(id);

    const artifact = artifactMap.get(id);
    if (!artifact) return null;

    // 遍历当前节点的所有依赖
    for (const dep of artifact.requires) {
      if (!visited.has(dep)) {
        // 未访问的节点：记录父关系，递归 DFS
        parent.set(dep, id);
        const cycle = dfs(dep);
        if (cycle) return cycle;
      } else if (inStack.has(dep)) {
        // 已在当前路径上：发现环，回溯重建环路径
        const cyclePath = [dep];
        let current = id;
        while (current !== dep) {
          cyclePath.unshift(current);
          current = parent.get(current)!;
        }
        cyclePath.unshift(dep);
        return cyclePath.join(' → ');
      }
    }

    // 当前节点 DFS 完成，从路径中移除
    inStack.delete(id);
    return null;
  }

  // 对每个未访问的节点启动 DFS
  for (const artifact of artifacts) {
    if (!visited.has(artifact.id)) {
      const cycle = dfs(artifact.id);
      if (cycle) {
        throw new SchemaValidationError(`Cyclic dependency detected: ${cycle}`);
      }
    }
  }
}
