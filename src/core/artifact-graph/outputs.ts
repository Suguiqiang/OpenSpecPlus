/**
 * Artifact 输出文件解析模块
 *
 * 本模块负责把 artifact 的 generates 字段（可能是路径或 glob）
 * 解析成实际存在的文件列表。
 *
 * 支持两种格式：
 *   1. 简单路径：如 "proposal.md"、"tasks.md"
 *      -> 直接检查文件是否存在
 *   2. glob 模式：如 "specs/**/*.md"、"specs/*.md"
 *      -> 用 fast-glob 库展开匹配
 *
 * 调用方：
 *   - state.ts（检测 artifact 是否完成）
 *   - instruction-loader.ts（找出 artifact 的现有输出文件）
 *   - utils/task-progress.ts（统计 tasks 文件的任务进度）
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import { FileSystemUtils } from '../../utils/file-system.js';

/**
 * 判断字符串是否包含 glob 特殊字符
 *
 * glob 特殊字符：*（任意字符）、?（单个字符）、[...]（字符集合）
 *
 * @param pattern - 要检查的字符串
 * @returns true 表示是 glob 模式，false 表示是简单路径
 */
export function isGlobPattern(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('[');
}

/**
 * 解析 artifact 的 generates 字段为实际存在的文件列表
 *
 * 处理流程：
 *   1. 如果 generates 不是 glob（不含 * ? [）：
 *      - 直接拼接路径并 statSync
 *      - 文件存在则返回 [canonicalPath]，不存在返回 []
 *   2. 如果 generates 是 glob：
 *      - 用 fast-glob 在 changeDir 下匹配
 *      - 收集所有匹配的文件路径
 *      - 去重并按字典序排序（保证确定性输出）
 *
 * @param changeDir - change 目录的绝对路径
 * @param generates - artifact 的 generates 字段（路径或 glob）
 * @returns 实际存在的文件绝对路径数组（已排序、已去重）
 */
export function resolveArtifactOutputs(changeDir: string, generates: string): string[] {
  // 分支 1：简单路径
  if (!isGlobPattern(generates)) {
    const fullPath = path.join(changeDir, generates);
    try {
      // 用 statSync 检查文件存在性，且必须是文件（不是目录）
      return fs.statSync(fullPath).isFile()
        ? [FileSystemUtils.canonicalizeExistingPath(fullPath)]
        : [];
    } catch {
      // 文件不存在或无法访问
      return [];
    }
  }

  // 分支 2：glob 模式
  // 把路径转成 POSIX 格式（fast-glob 要求 POSIX 风格）
  const normalizedPattern = FileSystemUtils.toPosixPath(generates);
  const matches = fg
    .sync(normalizedPattern, {
      cwd: changeDir,
      onlyFiles: true,    // 只匹配文件，不匹配目录
      absolute: true,     // 返回绝对路径
    })
    .map((match) => FileSystemUtils.canonicalizeExistingPath(path.normalize(match)));

  // 去重（glob 可能匹配到同一个文件的多个路径表示）并排序保证确定性
  return Array.from(new Set(matches)).sort();
}

/**
 * 检查 artifact 是否至少有一个输出文件存在
 *
 * 这是 resolveArtifactOutputs 的简化版，只关心存在性，
 * 不需要具体的文件列表。
 *
 * @param changeDir - change 目录的绝对路径
 * @param generates - artifact 的 generates 字段
 * @returns true 表示至少有 1 个文件匹配
 */
export function artifactOutputExists(changeDir: string, generates: string): boolean {
  return resolveArtifactOutputs(changeDir, generates).length > 0;
}
