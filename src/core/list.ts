/**
 * List 命令（列表命令）
 *
 * 列出 OpenSpec 工作区中的 changes（变更）或 specs（规范）。
 *
 * 支持两种模式：
 *   - changes 模式（默认）：列出 openspec/changes/ 下所有活跃的变更，
 *     显示任务进度和最后修改时间
 *   - specs 模式：列出 openspec/specs/ 下所有规范文件，
 *     显示每个 spec 的需求（requirement）数量
 *
 * 支持两种输出格式：
 *   - 人类可读的表格（默认）
 *   - JSON 格式（--json，供 AI Agent 或脚本程序使用）
 *
 * 调用入口：CLI 子命令 `openspec list` / `openspec list --specs`
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getTaskProgressForChange, formatTaskStatus } from '../utils/task-progress.js';
import { readFileSync, type Dirent } from 'fs';
import { MarkdownParser } from './parsers/markdown-parser.js';
import type { RootOutput } from './root-selection.js';
import { discoverSpecFiles } from '../utils/spec-discovery.js';

/**
 * 单个变更的信息
 */
interface ChangeInfo {
  /** 变更名称（即 changes/ 下的目录名） */
  name: string;
  /** 已完成的任务数 */
  completedTasks: number;
  /** 总任务数 */
  totalTasks: number;
  /** 最后修改时间（取目录下所有文件的最晚 mtime） */
  lastModified: Date;
}

/**
 * list 命令的选项
 */
interface ListOptions {
  /** 排序方式：'recent'（按修改时间倒序，默认）或 'name'（按名称字典序） */
  sort?: 'recent' | 'name';
  /** 是否输出 JSON 格式（供程序化使用） */
  json?: boolean;
  /** 根目录输出对象（用于 JSON 模式下附加到响应里） */
  root?: RootOutput;
}

/**
 * 判断错误是否为"路径不存在"错误（ENOENT）
 *
 * @param error - 捕获到的错误
 * @returns true 表示是 ENOENT 错误（目录或文件不存在）
 */
function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

/**
 * 读取 changes 目录下的所有条目
 *
 * 如果目录不存在（ENOENT），返回空数组而不是抛错，
 * 这样调用方可以正常处理"还没有任何 change"的情况。
 *
 * @param changesDir - changes 目录的绝对路径
 * @returns 目录条目数组（Dirent 含类型信息）
 */
async function readChangeDirectoryEntries(changesDir: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(changesDir, { withFileTypes: true });
  } catch (error) {
    // 目录不存在时返回空数组，让上层逻辑自然走"无 change"分支
    if (isMissingPathError(error)) return [];
    throw error;
  }
}

/**
 * 获取目录下所有文件中最新的修改时间（递归遍历）
 *
 * 用于显示 change 的"最后活动时间"。
 * 如果目录是空的（没有文件），回退到目录本身的 mtime。
 *
 * @param dirPath - 要扫描的目录路径
 * @returns 目录下最新的文件修改时间
 */
async function getLastModified(dirPath: string): Promise<Date> {
  let latest: Date | null = null;

  /**
   * 递归遍历目录，更新 latest 为遇到的最晚 mtime
   * @param dir - 当前正在遍历的目录
   */
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // 递归进入子目录
        await walk(fullPath);
      } else {
        // 比较文件的 mtime
        const stat = await fs.stat(fullPath);
        if (latest === null || stat.mtime > latest) {
          latest = stat.mtime;
        }
      }
    }
  }

  await walk(dirPath);

  // 如果目录下没有任何文件，用目录自己的 mtime 作为兜底
  if (latest === null) {
    const dirStat = await fs.stat(dirPath);
    return dirStat.mtime;
  }

  return latest;
}

/**
 * 把日期格式化为相对时间字符串
 *
 * 例如："2 hours ago"、"3 days ago"、"just now"
 * 超过 30 天则返回具体日期（toLocaleDateString）
 *
 * @param date - 要格式化的日期
 * @returns 相对时间字符串
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    // 超过 30 天，显示具体日期
    return date.toLocaleDateString();
  } else if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMins > 0) {
    return `${diffMins}m ago`;
  } else {
    return 'just now';
  }
}

/**
 * ListCommand - 列表命令的实现类
 *
 * 负责：
 *   1. 列出 changes（默认）或 specs（--specs 模式）
 *   2. 收集每个 item 的元数据（任务进度、修改时间、需求数等）
 *   3. 按指定方式排序（recent 或 name）
 *   4. 输出人类可读或 JSON 格式
 */
export class ListCommand {
  /**
   * 执行 list 命令
   *
   * @param targetPath - 项目根目录路径（默认当前目录）
   * @param mode - 模式：'changes'（列变更，默认）或 'specs'（列规范）
   * @param options - 选项（排序、JSON、root）
   */
  async execute(targetPath: string = '.', mode: 'changes' | 'specs' = 'changes', options: ListOptions = {}): Promise<void> {
    const { sort = 'recent', json = false, root } = options;

    // ============== changes 模式 ==============
    if (mode === 'changes') {
      const changesDir = path.join(targetPath, 'openspec', 'changes');

      // 读取 changes 目录下所有条目（排除 archive 子目录）
      const entries = await readChangeDirectoryEntries(changesDir);
      const changeDirs = entries
        .filter(entry => entry.isDirectory() && entry.name !== 'archive')
        .map(entry => entry.name);

      // 没有 change 的处理
      if (changeDirs.length === 0) {
        if (json) {
          // JSON 模式：输出空数组（保留 root 字段以符合 Agent 契约）
          console.log(JSON.stringify({ changes: [], ...(root ? { root } : {}) }, null, 2));
        } else {
          // 人类模式：友好提示
          console.log('No active changes found.');
        }
        return;
      }

      // 收集每个 change 的信息
      const changes: ChangeInfo[] = [];

      for (const changeDir of changeDirs) {
        // 通过工具函数读取该 change 的任务进度（解析 tasks.md）
        const progress = await getTaskProgressForChange(changesDir, changeDir, targetPath);
        const changePath = path.join(changesDir, changeDir);
        // 递归获取目录下最新的文件修改时间
        const lastModified = await getLastModified(changePath);
        changes.push({
          name: changeDir,
          completedTasks: progress.completed,
          totalTasks: progress.total,
          lastModified
        });
      }

      // 按指定方式排序（默认：最近修改在前）
      if (sort === 'recent') {
        changes.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
      } else {
        // 按名称字典序
        changes.sort((a, b) => a.name.localeCompare(b.name));
      }

      // JSON 输出（供程序化使用）
      if (json) {
        const jsonOutput = changes.map(c => ({
          name: c.name,
          completedTasks: c.completedTasks,
          totalTasks: c.totalTasks,
          lastModified: c.lastModified.toISOString(),
          // 状态：无任务 / 已完成 / 进行中
          status: c.totalTasks === 0 ? 'no-tasks' : c.completedTasks === c.totalTasks ? 'complete' : 'in-progress'
        }));
        console.log(JSON.stringify({ changes: jsonOutput, ...(root ? { root } : {}) }, null, 2));
        return;
      }

      // 人类可读输出（表格形式）
      console.log('Changes:');
      const padding = '  ';
      // 计算最长名称，用于对齐
      const nameWidth = Math.max(...changes.map(c => c.name.length));
      for (const change of changes) {
        const paddedName = change.name.padEnd(nameWidth);
        const status = formatTaskStatus({ total: change.totalTasks, completed: change.completedTasks });
        const timeAgo = formatRelativeTime(change.lastModified);
        // 输出格式：<名称>     <状态>  <时间>
        console.log(`${padding}${paddedName}     ${status.padEnd(12)}  ${timeAgo}`);
      }
      return;
    }

    // ============== specs 模式 ==============
    const specsDir = path.join(targetPath, 'openspec', 'specs');
    try {
      await fs.access(specsDir);
    } catch {
      // specs 目录不存在
      if (json) {
        console.log(JSON.stringify({ specs: [], ...(root ? { root } : {}) }, null, 2));
      } else {
        console.log('No specs found.');
      }
      return;
    }

    // 发现所有 spec 文件（递归扫描）
    const discovered = await discoverSpecFiles(specsDir);
    if (discovered.length === 0) {
      if (json) {
        console.log(JSON.stringify({ specs: [], ...(root ? { root } : {}) }, null, 2));
      } else {
        console.log('No specs found.');
      }
      return;
    }

    /** 单个 spec 的信息 */
    type SpecInfo = { id: string; requirementCount: number };
    const specs: SpecInfo[] = [];
    for (const { id, specFile } of discovered) {
      try {
        // 读取 spec 文件并用 MarkdownParser 解析
        const content = readFileSync(specFile, 'utf-8');
        const parser = new MarkdownParser(content);
        const spec = parser.parseSpec(id);
        // 统计该 spec 的需求数量
        specs.push({ id, requirementCount: spec.requirements.length });
      } catch {
        // 解析失败时，仍然包含该 spec，但需求数记为 0
        specs.push({ id, requirementCount: 0 });
      }
    }

    // 按名称字典序排序
    specs.sort((a, b) => a.id.localeCompare(b.id));

    // JSON 输出
    if (json) {
      console.log(JSON.stringify({ specs, ...(root ? { root } : {}) }, null, 2));
      return;
    }

    // 人类可读输出
    console.log('Specs:');
    const padding = '  ';
    const nameWidth = Math.max(...specs.map(s => s.id.length));
    for (const spec of specs) {
      const padded = spec.id.padEnd(nameWidth);
      console.log(`${padding}${padded}     requirements ${spec.requirementCount}`);
    }
  }
}
