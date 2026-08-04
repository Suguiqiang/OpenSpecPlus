/**
 * Artifact 完成状态检测模块
 *
 * 本模块负责扫描文件系统，检测哪些 artifact 已经完成。
 *
 * 完成判定规则（Slice 1 简单实现）：
 *   artifact 的 generates 文件存在 = artifact 已完成
 *
 * 例如：
 *   - proposal 的 generates 是 "proposal.md"
 *     -> 检查 change 目录下是否有 proposal.md 文件
 *   - specs 的 generates 是 "specs/**//*.md"
 *     -> 检查 change 目录下是否有 specs/ 子目录里的 .md 文件
 *
 * 调用方：instruction-loader.ts 的 loadChangeContext()
 */

import * as fs from 'node:fs';
import type { CompletedSet } from './types.js';
import type { ArtifactGraph } from './graph.js';
import { artifactOutputExists } from './outputs.js';

/**
 * 检测哪些 artifact 已完成（通过文件存在性判断）
 *
 * 遍历图中的所有 artifact，检查每个 artifact 的 generates 文件是否存在。
 * 文件存在则视为已完成，加入返回的 Set。
 *
 * 容错处理：
 *   如果 change 目录不存在，返回空 Set（而不是抛错），
 *   这样上层逻辑可以自然处理"change 还没开始"的情况。
 *
 * @param graph - artifact 依赖图
 * @param changeDir - change 目录的绝对路径
 * @returns 已完成的 artifact ID 集合
 */
export function detectCompleted(graph: ArtifactGraph, changeDir: string): CompletedSet {
  const completed = new Set<string>();

  // 容错：change 目录不存在时直接返回空集合
  if (!fs.existsSync(changeDir)) {
    return completed;
  }

  // 遍历图中所有 artifact，检查文件存在性
  for (const artifact of graph.getAllArtifacts()) {
    if (isArtifactComplete(artifact.generates, changeDir)) {
      completed.add(artifact.id);
    }
  }

  return completed;
}

/**
 * 检查单个 artifact 是否完成
 *
 * 委托给 outputs.ts 的 artifactOutputExists，支持：
 *   - 简单路径（如 "proposal.md"）
 *   - glob 模式（如 "specs/**//*.md"）
 *
 * @param generates - artifact 的 generates 字段（路径或 glob）
 * @param changeDir - change 目录的绝对路径
 * @returns true 表示该 artifact 已完成（至少有 1 个匹配文件存在）
 */
function isArtifactComplete(generates: string, changeDir: string): boolean {
  return artifactOutputExists(changeDir, generates);
}
