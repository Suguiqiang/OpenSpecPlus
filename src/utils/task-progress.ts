/**
 * 任务进度（Task Progress）工具模块
 *
 * 本模块负责解析 OpenSpec 变更（change）中的 tasks.md 文件，
 * 统计任务总数和已完成任务数，用于 `openspec list` 命令展示进度。
 *
 * 核心功能：
 *   1. 从 Markdown 内容中识别任务行（`- [ ]` 或 `- [x]`）
 *   2. 根据 schema 解析"被追踪的 tasks artifact"的输出 glob
 *   3. 支持 glob 匹配多个 tasks 文件（例如嵌套子目录里的 tasks.md）
 *   4. 在 schema 无法解析时回退到顶层 tasks.md
 *
 * 调用方：src/core/list.ts 的 ListCommand.execute()
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { Artifact, SchemaYaml } from '../core/artifact-graph/index.js';
import { resolveArtifactOutputs, resolveSchema } from '../core/artifact-graph/index.js';
import { resolveSchemaForChange } from './change-metadata.js';

/**
 * 任务行的匹配模式：
 *   - 行首是 `-` 或 `*`
 *   - 后跟空格
 *   - 再跟 `[ ]`、`[x]` 或 `[X]`（方括号内是空格或 x）
 *
 * 匹配示例：
 *   "- [ ] 这是一个未完成任务"   ✓ 匹配
 *   "- [x] 这是一个已完成任务"   ✓ 匹配
 *   "* [ ] 用星号也可以"          ✓ 匹配
 */
const TASK_PATTERN = /^[-*]\s+\[[\sx]\]/i;

/**
 * 已完成任务行的匹配模式：
 *   - 行首是 `-` 或 `*`
 *   - 后跟空格
 *   - 再跟 `[x]` 或 `[X]`（方括号内是 x，表示已完成）
 */
const COMPLETED_TASK_PATTERN = /^[-*]\s+\[x\]/i;

/**
 * 任务进度统计结果
 */
export interface TaskProgress {
  /** 任务总数 */
  total: number;
  /** 已完成任务数 */
  completed: number;
}

/**
 * 从 Markdown 内容中统计任务进度
 *
 * 解析每一行，匹配任务模式（`- [ ]` / `- [x]`），
 * 并分别统计总数和已完成数。
 *
 * @param content - Markdown 文件内容
 * @returns 任务进度对象 { total, completed }
 */
export function countTasksFromContent(content: string): TaskProgress {
  const lines = content.split('\n');
  let total = 0;
  let completed = 0;
  for (const line of lines) {
    if (line.match(TASK_PATTERN)) {
      total++;
      if (line.match(COMPLETED_TASK_PATTERN)) {
        completed++;
      }
    }
  }
  return { total, completed };
}

/**
 * 从 schema 中找到"被追踪的 tasks artifact"
 *
 * 查找规则：
 *   1. 优先：如果 schema 的 `apply.tracks` 字段存在，
 *      找到 `generates` 等于该 tracks 值的 artifact
 *   2. 回退：如果没有 `apply.tracks`，找 id 为 `tasks` 的 artifact
 *
 * 说明：
 *   `apply.tracks` 是一个文件名，用于"选择"哪个 artifact 是被追踪的任务清单；
 *   而该 artifact 的 `generates` 字段（一个 glob）才是真正用来匹配文件的。
 *
 * @param schema - 已解析的 SchemaYaml 对象
 * @returns 被追踪的 tasks artifact，如果找不到返回 undefined
 */
function findTrackedTasksArtifact(schema: SchemaYaml): Artifact | undefined {
  const tracks = schema.apply?.tracks;
  if (tracks != null) {
    // 优先用 apply.tracks 指定的文件名匹配 artifact 的 generates
    return schema.artifacts.find((a) => a.generates === tracks);
  }
  // 回退：找 id 为 'tasks' 的 artifact
  return schema.artifacts.find((a) => a.id === 'tasks');
}

/**
 * 解析指定 change 的"被追踪 tasks artifact"的输出 glob
 *
 * 流程：
 *   1. 从 change 的 .openspec.yaml 读取 schema 名（回退到默认 schema）
 *   2. 用 schema 名解析出完整的 SchemaYaml 对象
 *   3. 从 schema 中找到被追踪的 tasks artifact
 *   4. 返回该 artifact 的 generates glob
 *
 * 错误处理：
 *   `resolveSchema` 在 schema 无法解析或名字错误时会抛错；
 *   这里吞掉错误返回 undefined，让调用方回退到顶层 tasks.md，保证永不崩溃。
 *
 * @param changeDir - change 目录的绝对路径
 * @param projectRoot - 项目根目录路径
 * @returns generates glob 字符串，或 undefined（无法解析时）
 */
function resolveTrackedTasksGlob(changeDir: string, projectRoot: string): string | undefined {
  try {
    // 1. 解析该 change 使用的 schema 名（从 .openspec.yaml 读取，或回退到默认）
    const schemaName = resolveSchemaForChange(changeDir, undefined, projectRoot);
    // 2. 加载完整的 schema（含 artifacts 和 apply 配置）
    const schema = resolveSchema(schemaName, projectRoot);
    // 3. 找到被追踪的 tasks artifact，返回它的 generates glob
    return findTrackedTasksArtifact(schema)?.generates;
  } catch {
    // 任何错误都返回 undefined，让上层走回退逻辑
    return undefined;
  }
}

/**
 * 回退方案：只统计 change 目录下顶层的单个 tasks.md 文件
 *
 * 当 schema 无法解析、找不到 tasks artifact、或 glob 匹配不到任何文件时使用。
 * 这是最早期的行为，保持向后兼容。
 *
 * @param changeDir - change 目录的绝对路径
 * @returns 任务进度（文件不存在时返回 { total: 0, completed: 0 }）
 */
async function countSingleTopLevelTasksFile(changeDir: string): Promise<TaskProgress> {
  const tasksPath = path.join(changeDir, 'tasks.md');
  try {
    const content = await fs.readFile(tasksPath, 'utf-8');
    return countTasksFromContent(content);
  } catch {
    // 文件不存在或读取失败，返回 0 进度
    return { total: 0, completed: 0 };
  }
}

/**
 * 计算指定 change 的任务进度（核心 API）
 *
 * 完整流程：
 *   1. 解析该 change 的 tracked-tasks artifact 的 generates glob
 *   2. 用 `resolveArtifactOutputs` 把 glob 展开成实际文件列表
 *      （这与 `openspec status` 检测 tasks artifact 用的同一套文件解析逻辑，
 *        保证进度统计与状态展示一致）
 *   3. 遍历所有匹配到的文件，累加任务数和已完成数
 *   4. 如果 glob 匹配到多个文件（例如嵌套子目录的 tasks.md），
 *      也会全部统计（修复了 #1202 的盲区问题）
 *
 * 回退逻辑（任意一步失败时）：
 *   - schema 无法解析 -> 回退
 *   - 没有 tracked-tasks artifact -> 回退
 *   - glob 匹配不到任何文件 -> 回退
 *   回退时调用 `countSingleTopLevelTasksFile`，只看顶层 tasks.md
 *
 * 重要：本函数永不抛错，调用方可以放心使用。
 *
 * @param changesDir - changes 目录的绝对路径
 * @param changeName - change 名称（changes/ 下的子目录名）
 * @param projectRoot - 项目根目录路径
 * @returns 任务进度对象 { total, completed }
 */
export async function getTaskProgressForChange(
  changesDir: string,
  changeName: string,
  projectRoot: string
): Promise<TaskProgress> {
  const changeDir = path.join(changesDir, changeName);

  // 1. 解析被追踪 tasks artifact 的 generates glob
  const generates = resolveTrackedTasksGlob(changeDir, projectRoot);
  if (generates) {
    // 2. 把 glob 展开成实际文件列表
    const files = resolveArtifactOutputs(changeDir, generates);
    if (files.length > 0) {
      // 3. 遍历所有匹配到的文件，累加进度
      let total = 0;
      let completed = 0;
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const progress = countTasksFromContent(content);
          total += progress.total;
          completed += progress.completed;
        } catch {
          // 吞掉错误：如果文件在 glob 匹配后、读取前被删除了，
          // 跳过它继续处理其他文件（保持与之前一致的容错行为）
        }
      }
      return { total, completed };
    }
  }

  // 4. 回退：只统计顶层 tasks.md
  return countSingleTopLevelTasksFile(changeDir);
}

/**
 * 把任务进度格式化为人类可读的状态字符串
 *
 * 三种状态：
 *   - 无任务（total === 0）        -> "No tasks"
 *   - 已完成（completed === total）-> "✓ Complete"
 *   - 进行中                       -> "2/5 tasks"
 *
 * @param progress - 任务进度对象
 * @returns 格式化后的状态字符串
 */
export function formatTaskStatus(progress: TaskProgress): string {
  if (progress.total === 0) return 'No tasks';
  if (progress.completed === progress.total) return '✓ Complete';
  return `${progress.completed}/${progress.total} tasks`;
}


