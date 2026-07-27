/**
 * Artifact 依赖图（DAG）模块
 *
 * 本模块定义 ArtifactGraph 类，是 artifact-graph 子系统的核心数据结构。
 * 它把 schema 中的 artifacts 列表转换成一张有向无环图（DAG），
 * 提供 4 类核心查询：
 *   1. 拓扑排序（getBuildOrder）- 用 Kahn 算法计算 artifact 应该的构建顺序
 *   2. 就绪查询（getNextArtifacts）- 找出所有依赖已完成的 artifact
 *   3. 完成检查（isComplete）- 检查所有 artifact 是否都已完成
 *   4. 阻塞查询（getBlocked）- 找出被阻塞的 artifact 及其缺失的依赖
 *
 * 不负责：
 *   - 文件系统检测（那是 state.ts 的事）
 *   - 模板加载（那是 instruction-loader.ts 的事）
 */

import type { Artifact, SchemaYaml, CompletedSet, BlockedArtifacts } from './types.js';
import { loadSchema, parseSchema } from './schema.js';

/**
 * Artifact 依赖图
 *
 * 不可变数据结构：构造后只能查询，不能修改。
 * 提供 3 种构造方式：
 *   - fromYaml(filePath)：从 schema.yaml 文件加载
 *   - fromYamlContent(yamlContent)：从 YAML 字符串加载
 *   - fromSchema(schema)：从已校验的 SchemaYaml 对象构造
 */
export class ArtifactGraph {
  /** artifact ID -> artifact 的映射表 */
  private artifacts: Map<string, Artifact>;
  /** 原始的 schema 对象（用于获取 name / version 等） */
  private schema: SchemaYaml;

  /**
   * 私有构造函数，请通过静态工厂方法创建实例
   */
  private constructor(schema: SchemaYaml) {
    this.schema = schema;
    this.artifacts = new Map(schema.artifacts.map(a => [a.id, a]));
  }

  /**
   * 从 schema.yaml 文件创建 ArtifactGraph
   *
   * @param filePath - schema.yaml 的绝对路径
   */
  static fromYaml(filePath: string): ArtifactGraph {
    const schema = loadSchema(filePath);
    return new ArtifactGraph(schema);
  }

  /**
   * 从 YAML 字符串创建 ArtifactGraph
   *
   * @param yamlContent - schema.yaml 的字符串内容
   */
  static fromYamlContent(yamlContent: string): ArtifactGraph {
    const schema = parseSchema(yamlContent);
    return new ArtifactGraph(schema);
  }

  /**
   * 从已校验的 SchemaYaml 对象创建 ArtifactGraph
   *
   * 用于已经通过其他途径加载并校验过的 schema 对象。
   *
   * @param schema - 已校验的 SchemaYaml 对象
   */
  static fromSchema(schema: SchemaYaml): ArtifactGraph {
    return new ArtifactGraph(schema);
  }

  /**
   * 根据 ID 获取单个 artifact
   *
   * @param id - artifact ID
   * @returns artifact 对象，找不到返回 undefined
   */
  getArtifact(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  /**
   * 获取图中所有 artifact
   *
   * @returns artifact 数组（顺序与 schema 中定义一致）
   */
  getAllArtifacts(): Artifact[] {
    return Array.from(this.artifacts.values());
  }

  /**
   * 获取 schema 名称
   */
  getName(): string {
    return this.schema.name;
  }

  /**
   * 获取 schema 版本号
   */
  getVersion(): number {
    return this.schema.version;
  }

  /**
   * 计算拓扑排序（topological sort）
   *
   * 使用 Kahn 算法（BFS）：
   *   1. 计算每个节点的入度（in-degree = requires.length）
   *   2. 把入度为 0 的节点放入队列（这些是没有依赖的，可以立即构建）
   *   3. 每次从队列取出一个节点，加入结果，把它指向的节点入度 -1
   *   4. 如果某节点入度变成 0，加入队列
   *   5. 重复直到队列为空
   *
   * 同层节点按名称字典序排序，保证输出确定性
   * （同样的 schema 总是得到同样的 build order）。
   *
   * @returns artifact ID 数组，按应该构建的顺序排列
   */
  getBuildOrder(): string[] {
    /** 每个节点的入度（剩余未完成的依赖数） */
    const inDegree = new Map<string, number>();
    /** 反向邻接表：key 是被依赖的节点，value 是依赖它的节点列表 */
    const dependents = new Map<string, string[]>();

    // 初始化所有节点的入度和空的反向邻接表
    for (const artifact of this.artifacts.values()) {
      inDegree.set(artifact.id, artifact.requires.length);
      dependents.set(artifact.id, []);
    }

    // 构建反向邻接表：A requires B -> dependents[B].push(A)
    for (const artifact of this.artifacts.values()) {
      for (const req of artifact.requires) {
        dependents.get(req)!.push(artifact.id);
      }
    }

    // 找出所有入度为 0 的根节点，按名称排序保证确定性
    const queue = [...this.artifacts.keys()]
      .filter(id => inDegree.get(id) === 0)
      .sort();

    const result: string[] = [];

    // BFS 处理队列
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      // 把 current 指向的节点入度 -1，收集新就绪的节点
      const newlyReady: string[] = [];
      for (const dep of dependents.get(current)!) {
        const newDegree = inDegree.get(dep)! - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) {
          newlyReady.push(dep);
        }
      }
      // 同层节点排序后加入队列，保证确定性
      queue.push(...newlyReady.sort());
    }

    return result;
  }

  /**
   * 获取所有"就绪"的 artifact（依赖全部完成的、且自身未完成的）
   *
   * @param completed - 已完成的 artifact ID 集合
   * @returns 就绪的 artifact ID 数组（按名称排序）
   */
  getNextArtifacts(completed: CompletedSet): string[] {
    const ready: string[] = [];

    for (const artifact of this.artifacts.values()) {
      // 已完成的跳过
      if (completed.has(artifact.id)) {
        continue;
      }

      // 检查所有依赖是否都已完成
      const allDepsCompleted = artifact.requires.every(req => completed.has(req));
      if (allDepsCompleted) {
        ready.push(artifact.id);
      }
    }

    // 按名称排序保证确定性
    return ready.sort();
  }

  /**
   * 检查图中所有 artifact 是否都已完成
   *
   * @param completed - 已完成的 artifact ID 集合
   * @returns true 表示全部完成
   */
  isComplete(completed: CompletedSet): boolean {
    for (const artifact of this.artifacts.values()) {
      if (!completed.has(artifact.id)) {
        return false;
      }
    }
    return true;
  }

  /**
   * 获取所有被阻塞的 artifact 及其缺失的依赖
   *
   * 被阻塞 = 未完成 + 至少有一个依赖未完成
   *
   * @param completed - 已完成的 artifact ID 集合
   * @returns 映射表：{ artifactId: [缺失的依赖 ID 列表] }
   */
  getBlocked(completed: CompletedSet): BlockedArtifacts {
    const blocked: BlockedArtifacts = {};

    for (const artifact of this.artifacts.values()) {
      // 已完成的不算被阻塞
      if (completed.has(artifact.id)) {
        continue;
      }

      // 找出所有未完成的依赖
      const unmetDeps = artifact.requires.filter(req => !completed.has(req));
      if (unmetDeps.length > 0) {
        // 排序保证确定性
        blocked[artifact.id] = unmetDeps.sort();
      }
    }

    return blocked;
  }
}
