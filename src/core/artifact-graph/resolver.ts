/**
 * Schema 解析器模块
 *
 * 本模块负责把 schema 名称（如 "spec-driven"）解析成 SchemaYaml 对象，
 * 支持 3 层 schema 来源（按优先级从高到低）：
 *   1. 项目级 schema：<projectRoot>/openspec/schemas/<name>/schema.yaml
 *   2. 用户级 schema：${XDG_DATA_HOME}/openspec/schemas/<name>/schema.yaml
 *   3. 包级 schema：<package>/schemas/<name>/schema.yaml（OpenSpec 内置）
 *
 * 这种分层设计允许：
 *   - 项目用自己定制的 schema 覆盖内置 schema
 *   - 用户在多个项目间共享自定义 schema
 *   - 内置 schema 作为兜底
 *
 * 调用方：instruction-loader.ts、commands/workflow/*、utils/change-metadata.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGlobalDataDir } from '../global-config.js';
import { parseSchema, SchemaValidationError } from './schema.js';
import type { SchemaYaml } from './types.js';

/**
 * Schema 加载错误
 *
 * 当 schema 文件不存在、无法读取、或解析校验失败时抛出。
 * 携带 schemaPath 和原始 cause 用于调试。
 */
export class SchemaLoadError extends Error {
  constructor(
    message: string,
    /** 出错的 schema.yaml 文件路径 */
    public readonly schemaPath: string,
    /** 原始错误（IO 错误或 SchemaValidationError） */
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SchemaLoadError';
  }
}

/**
 * 获取 OpenSpec 包内置的 schemas 目录路径
 *
 * 使用 import.meta.url 定位当前模块，然后回溯到包根目录的 schemas/。
 * 路径计算：dist/core/artifact-graph/resolver.js -> ../../../schemas/
 *
 * @returns 包内置 schemas 目录的绝对路径
 */
export function getPackageSchemasDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  // 从 dist/core/artifact-graph/ 回溯到包根目录，再进入 schemas/
  return path.join(path.dirname(currentFile), '..', '..', '..', 'schemas');
}

/**
 * 获取用户级 schema 覆盖目录路径
 *
 * 位于全局数据目录下（XDG_DATA_HOME 或平台等价目录）。
 * 用户可以在这里放自定义 schema，在多个项目间共享。
 *
 * @returns 用户级 schemas 目录的绝对路径
 */
export function getUserSchemasDir(): string {
  return path.join(getGlobalDataDir(), 'schemas');
}

/**
 * 获取项目级 schemas 目录路径
 *
 * 位于项目根目录的 openspec/schemas/ 下，
 * 项目可以用它覆盖用户级和包级 schema。
 *
 * @param projectRoot - 项目根目录
 * @returns 项目级 schemas 目录的绝对路径
 */
export function getProjectSchemasDir(projectRoot: string): string {
  return path.join(projectRoot, 'openspec', 'schemas');
}

/**
 * 判断目录条目是否是一个 schema 目录候选
 *
 * 返回 true 的条件（满足任一）：
 *   1. 是真实目录（entry.isDirectory() === true）
 *   2. 是符号链接，且链接目标是一个目录
 *
 * 为什么要处理符号链接？
 *   fs.Dirent.isDirectory() 报告的是原始条目类型，
 *   符号链接（即使指向目录）的 isDirectory() 是 false。
 *   我们用 statSync 跟随链接，让符号链接的 schema 目录也能被识别，
 *   但仍然拒绝指向文件的符号链接和断链（dangling symlink）。
 *
 * @param parentDir - 包含该条目的父目录
 * @param entry - 从 readdirSync({ withFileTypes: true }) 获取的目录条目
 * @returns true 表示是 schema 目录候选
 */
export function isSchemaDir(parentDir: string, entry: fs.Dirent): boolean {
  // 情况 1：真实目录
  if (entry.isDirectory()) {
    return true;
  }
  // 情况 2：符号链接，跟随链接检查目标类型
  if (entry.isSymbolicLink()) {
    try {
      // statSync 会跟随符号链接，isDirectory() 反映目标类型
      return fs.statSync(path.join(parentDir, entry.name)).isDirectory();
    } catch {
      // 断链（目标不存在）statSync 会抛错，视为非目录
      return false;
    }
  }
  // 其他类型（文件等）都不是 schema 目录
  return false;
}

/**
 * 根据 schema 名解析出 schema 目录路径
 *
 * 解析顺序（projectRoot 提供时）：
 *   1. 项目级：<projectRoot>/openspec/schemas/<name>/schema.yaml
 *   2. 用户级：${XDG_DATA_HOME}/openspec/schemas/<name>/schema.yaml
 *   3. 包级：<package>/schemas/<name>/schema.yaml
 *
 * projectRoot 未提供时，只检查用户级和包级（向后兼容）。
 *
 * @param name - schema 名称（如 "spec-driven"）
 * @param projectRoot - 可选的项目根目录
 * @returns schema 目录的绝对路径，找不到返回 null
 */
export function getSchemaDir(
  name: string,
  projectRoot?: string
): string | null {
  // 1. 检查项目级 schema 目录
  if (projectRoot) {
    const projectDir = path.join(getProjectSchemasDir(projectRoot), name);
    const projectSchemaPath = path.join(projectDir, 'schema.yaml');
    if (fs.existsSync(projectSchemaPath)) {
      return projectDir;
    }
  }

  // 2. 检查用户级 schema 目录
  const userDir = path.join(getUserSchemasDir(), name);
  const userSchemaPath = path.join(userDir, 'schema.yaml');
  if (fs.existsSync(userSchemaPath)) {
    return userDir;
  }

  // 3. 检查包内置 schema 目录
  const packageDir = path.join(getPackageSchemasDir(), name);
  const packageSchemaPath = path.join(packageDir, 'schema.yaml');
  if (fs.existsSync(packageSchemaPath)) {
    return packageDir;
  }

  // 三层都找不到
  return null;
}

/**
 * 根据 schema 名解析出 SchemaYaml 对象
 *
 * 解析顺序同 getSchemaDir（项目级 > 用户级 > 包级）。
 * 找到 schema.yaml 后读取内容，用 parseSchema 校验并返回。
 *
 * 错误处理：
 *   - schema 不存在：抛普通 Error（含可用 schema 列表）
 *   - 文件读取失败：抛 SchemaLoadError（含路径和 cause）
 *   - 解析校验失败：抛 SchemaLoadError（含路径和 SchemaValidationError）
 *
 * @param name - schema 名称（如 "spec-driven"，可带 .yaml 后缀）
 * @param projectRoot - 可选的项目根目录
 * @returns 解析后的 SchemaYaml 对象
 * @throws Error 如果 schema 不存在
 * @throws SchemaLoadError 如果读取或解析失败
 */
export function resolveSchema(name: string, projectRoot?: string): SchemaYaml {
  // 规范化名称：去掉 .yaml / .yml 后缀（用户可能误传）
  const normalizedName = name.replace(/\.ya?ml$/, '');

  const schemaDir = getSchemaDir(normalizedName, projectRoot);
  if (!schemaDir) {
    // 列出所有可用 schema 帮助用户排查
    const availableSchemas = listSchemas(projectRoot);
    throw new Error(
      `Schema '${normalizedName}' not found. Available schemas: ${availableSchemas.join(', ')}`
    );
  }

  const schemaPath = path.join(schemaDir, 'schema.yaml');

  // 读取 schema.yaml 文件内容
  let content: string;
  try {
    content = fs.readFileSync(schemaPath, 'utf-8');
  } catch (err) {
    const ioError = err instanceof Error ? err : new Error(String(err));
    throw new SchemaLoadError(
      `Failed to read schema at '${schemaPath}': ${ioError.message}`,
      schemaPath,
      ioError
    );
  }

  // 解析并校验 schema
  try {
    return parseSchema(content);
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      // 校验失败：包装成 SchemaLoadError
      throw new SchemaLoadError(
        `Invalid schema at '${schemaPath}': ${err.message}`,
        schemaPath,
        err
      );
    }
    // 其他解析错误
    const parseError = err instanceof Error ? err : new Error(String(err));
    throw new SchemaLoadError(
      `Failed to parse schema at '${schemaPath}': ${parseError.message}`,
      schemaPath,
      parseError
    );
  }
}

/**
 * 列出所有可用的 schema 名称
 *
 * 合并项目级、用户级、包级 schema，去重后按字典序排序。
 *
 * @param projectRoot - 可选的项目根目录
 * @returns schema 名称数组（已排序）
 */
export function listSchemas(projectRoot?: string): string[] {
  const schemas = new Set<string>();

  // 收集包级 schema
  const packageDir = getPackageSchemasDir();
  if (fs.existsSync(packageDir)) {
    for (const entry of fs.readdirSync(packageDir, { withFileTypes: true })) {
      if (isSchemaDir(packageDir, entry)) {
        const schemaPath = path.join(packageDir, entry.name, 'schema.yaml');
        // 只收录有 schema.yaml 文件的目录
        if (fs.existsSync(schemaPath)) {
          schemas.add(entry.name);
        }
      }
    }
  }

  // 收集用户级 schema（可能覆盖包级）
  const userDir = getUserSchemasDir();
  if (fs.existsSync(userDir)) {
    for (const entry of fs.readdirSync(userDir, { withFileTypes: true })) {
      if (isSchemaDir(userDir, entry)) {
        const schemaPath = path.join(userDir, entry.name, 'schema.yaml');
        if (fs.existsSync(schemaPath)) {
          schemas.add(entry.name);
        }
      }
    }
  }

  // 收集项目级 schema（如果提供了 projectRoot）
  if (projectRoot) {
    const projectDir = getProjectSchemasDir(projectRoot);
    if (fs.existsSync(projectDir)) {
      for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
        if (isSchemaDir(projectDir, entry)) {
          const schemaPath = path.join(projectDir, entry.name, 'schema.yaml');
          if (fs.existsSync(schemaPath)) {
            schemas.add(entry.name);
          }
        }
      }
    }
  }

  return Array.from(schemas).sort();
}

/**
 * 带元数据的 schema 信息
 *
 * 用于 listSchemasWithInfo，给 AI agent 展示可选 schema 时使用。
 */
export interface SchemaInfo {
  /** schema 名称 */
  name: string;
  /** schema 描述（来自 YAML 的 description 字段） */
  description: string;
  /** 该 schema 包含的所有 artifact ID 列表 */
  artifacts: string[];
  /** schema 来源：project（项目级）/ user（用户级）/ package（包级） */
  source: 'project' | 'user' | 'package';
}

/**
 * 列出所有可用 schema 的完整信息（名称、描述、artifact 列表、来源）
 *
 * 与 listSchemas 不同：
 *   - 返回 SchemaInfo 对象数组，不只是名称字符串
 *   - 按"项目级 > 用户级 > 包级"优先级去重（高优先级覆盖低优先级）
 *   - 会读取并解析每个 schema.yaml 获取 description 和 artifacts
 *   - 解析失败的 schema 会被跳过（不影响其他 schema）
 *
 * 用途：给 AI agent skills 展示 schema 选择菜单
 *
 * @param projectRoot - 可选的项目根目录
 * @returns SchemaInfo 数组（按名称字典序排序）
 */
export function listSchemasWithInfo(projectRoot?: string): SchemaInfo[] {
  const schemas: SchemaInfo[] = [];
  /** 已处理的 schema 名称（用于跨层级去重） */
  const seenNames = new Set<string>();

  // 1. 优先收集项目级 schema（最高优先级）
  if (projectRoot) {
    const projectDir = getProjectSchemasDir(projectRoot);
    if (fs.existsSync(projectDir)) {
      for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
        if (isSchemaDir(projectDir, entry)) {
          const schemaPath = path.join(projectDir, entry.name, 'schema.yaml');
          if (fs.existsSync(schemaPath)) {
            try {
              const schema = parseSchema(fs.readFileSync(schemaPath, 'utf-8'));
              schemas.push({
                name: entry.name,
                description: schema.description || '',
                artifacts: schema.artifacts.map((a) => a.id),
                source: 'project',
              });
              seenNames.add(entry.name);
            } catch {
              // 解析失败的 schema 跳过，不影响其他
            }
          }
        }
      }
    }
  }

  // 2. 收集用户级 schema（如果没被项目级覆盖）
  const userDir = getUserSchemasDir();
  if (fs.existsSync(userDir)) {
    for (const entry of fs.readdirSync(userDir, { withFileTypes: true })) {
      if (isSchemaDir(userDir, entry) && !seenNames.has(entry.name)) {
        const schemaPath = path.join(userDir, entry.name, 'schema.yaml');
        if (fs.existsSync(schemaPath)) {
          try {
            const schema = parseSchema(fs.readFileSync(schemaPath, 'utf-8'));
            schemas.push({
              name: entry.name,
              description: schema.description || '',
              artifacts: schema.artifacts.map((a) => a.id),
              source: 'user',
            });
            seenNames.add(entry.name);
          } catch {
            // 解析失败的 schema 跳过
          }
        }
      }
    }
  }

  // 3. 收集包级 schema（如果没被项目级或用户级覆盖）
  const packageDir = getPackageSchemasDir();
  if (fs.existsSync(packageDir)) {
    for (const entry of fs.readdirSync(packageDir, { withFileTypes: true })) {
      if (isSchemaDir(packageDir, entry) && !seenNames.has(entry.name)) {
        const schemaPath = path.join(packageDir, entry.name, 'schema.yaml');
        if (fs.existsSync(schemaPath)) {
          try {
            const schema = parseSchema(fs.readFileSync(schemaPath, 'utf-8'));
            schemas.push({
              name: entry.name,
              description: schema.description || '',
              artifacts: schema.artifacts.map((a) => a.id),
              source: 'package',
            });
          } catch {
            // 解析失败的 schema 跳过
          }
        }
      }
    }
  }

  // 按名称字典序排序
  return schemas.sort((a, b) => a.name.localeCompare(b.name));
}
