/**
 * Init 命令（初始化命令）
 *
 * 用 Agent Skills（智能体技能）和 /opsx:* 斜杠命令来初始化 OpenSpec。
 * 这是一个统一的安装命令，替代了旧的 init 和 experimental 命令。
 *
 * 核心职责：
 *   1. 在项目中创建 openspec/ 目录结构（specs/、changes/、changes/archive/）
 *   2. 为用户选定的 AI 工具生成对应的 skill 文件和 slash command 文件
 *   3. 处理老版本遗留文件的清理和迁移
 *   4. 写入 openspec/config.yaml 配置文件
 *
 * 调用入口：CLI 子命令 `openspec init` -> src/commands/init.ts -> 本类的 execute()
 */

// ============== Node 标准库 ==============
import path from 'path';                          // 路径处理
import chalk from 'chalk';                        // 终端彩色输出
import ora from 'ora';                            // 终端 spinner 加载动画
import * as fs from 'fs';                         // 文件系统操作
import { createRequire } from 'module';           // 在 ESM 中模拟 CommonJS 的 require

// ============== 项目内：工具函数 ==============
import { FileSystemUtils } from '../utils/file-system.js';
import { classifyOpenSpecDir, storePointerProblem } from './project-config.js';
import { findRepoPlanningRootSync } from './planning-home.js';
import { getSkillReferenceTransformer, getTransformerForTool, transformToSkillReferences } from '../utils/command-references.js';

// ============== 项目内：核心配置 ==============
import {
  AI_TOOLS,                  // 全部支持的 AI 工具列表（25+ 种）
  OPENSPEC_DIR_NAME,         // "openspec" 目录名常量
  AIToolOption,              // AI 工具选项类型
} from './config.js';
import { PALETTE } from './styles/palette.js';     // 终端配色方案
import { isInteractive } from '../utils/interactive.js';
import { serializeConfig } from './config-prompts.js';

// ============== 项目内：命令生成（25+ AI 工具适配器） ==============
import {
  generateCommands,          // 根据适配器生成 slash command 文件
  CommandAdapterRegistry,    // 工具适配器注册表
} from './command-generation/index.js';

// ============== 项目内：老版本遗留文件清理 ==============
import {
  detectLegacyArtifacts,                 // 检测老版本遗留产物
  cleanupLegacyArtifacts,                // 清理老版本遗留产物
  formatCleanupSummary,                  // 格式化清理摘要
  formatDeferredGlobalPromptSummary,     // 格式化"延迟清理"的全局 prompt 摘要
  formatDetectionSummary,                // 格式化检测结果摘要
  getLegacyGlobalPromptMatches,          // 获取老版本全局 Codex prompt 匹配
  omitGlobalLegacyPromptFiles,           // 从检测结果中排除全局 prompt 文件（留给延迟清理）
  pickGlobalLegacyPromptFiles,           // 从检测结果中挑选指定的全局 prompt 文件
  type LegacyDetectionResult,            // 遗留产物检测结果类型
} from './legacy-cleanup.js';

// ============== 项目内：共享的 skill/command 工具 ==============
import {
  SKILL_NAMES,                // 所有 skill 名称列表
  getToolsWithSkillsDir,      // 获取支持 skillsDir 的工具
  getToolSkillStatus,         // 获取单个工具的 skill 状态
  getToolStates,              // 获取所有工具的状态映射
  getSkillTemplates,          // 获取 skill 模板（按 profile 过滤）
  getCommandContents,         // 获取 command 内容（按 profile 过滤）
  generateSkillContent,       // 生成 SKILL.md 内容（含 YAML frontmatter）
  type ToolSkillStatus,       // 工具 skill 状态类型
} from './shared/index.js';

// ============== 项目内：全局配置 & Profile ==============
import { getGlobalConfig, type Delivery, type Profile } from './global-config.js';
import { getProfileWorkflows, CORE_WORKFLOWS, ALL_WORKFLOWS } from './profiles.js';
import { getAvailableTools } from './available-tools.js';
import { migrateIfNeeded, migrateLegacySkillDirs, scanInstalledWorkflows as scanInstalledWorkflowsShared } from './migration.js';

// ============== 项目内：命令面（command-surface）能力判定 ==============
import {
  resolveCommandSurfaceCapability,      // 解析工具的命令面能力
  shouldGenerateCommandsForTool,        // 判定是否需要为该工具生成 commands
  shouldGenerateSkillsForTool,          // 判定是否需要为该工具生成 skills
  shouldReconcileCommandFilesForTool,   // 判定是否需要清理该工具的旧 command 文件
  shouldRemoveSkillsForTool,            // 判定是否需要移除该工具的 skill 目录
} from './command-surface.js';

// 在 ESM 环境下用 createRequire 读取 package.json，拿到当前 OpenSpec 版本号
const require = createRequire(import.meta.url);
const { version: OPENSPEC_VERSION } = require('../../package.json');

// -----------------------------------------------------------------------------
// 常量定义
// -----------------------------------------------------------------------------

/** 默认使用的 schema 名称（对应 schemas/spec-driven/schema.yaml） */
const DEFAULT_SCHEMA = 'spec-driven';

/** 进度条 spinner 动画配置（每 80ms 切换一帧） */
const PROGRESS_SPINNER = {
  interval: 80,
  frames: ['░░░', '▒░░', '▒▒░', '▒▒▒', '▓▒▒', '▓▓▒', '▓▓▓', '▒▓▓', '░▒▓'],
};

/**
 * workflow ID -> skill 目录名的映射表
 * 例如 workflow "explore" 对应生成 "openspec-explore" 目录下的 SKILL.md
 */
const WORKFLOW_TO_SKILL_DIR: Record<string, string> = {
  'explore': 'openspec-explore',
  'new': 'openspec-new-change',
  'continue': 'openspec-continue-change',
  'apply': 'openspec-apply-change',
  'update': 'openspec-update-change',
  'ff': 'openspec-ff-change',
  'sync': 'openspec-sync-specs',
  'archive': 'openspec-archive-change',
  'bulk-archive': 'openspec-bulk-archive-change',
  'verify': 'openspec-verify-change',
  'onboard': 'openspec-onboard',
  'propose': 'openspec-propose',
};

// -----------------------------------------------------------------------------
// 类型定义
// -----------------------------------------------------------------------------

/** Init 命令支持的选项参数 */
type InitCommandOptions = {
  tools?: string;        // --tools 参数：逗号分隔的工具 ID 列表，或 "all"/"none"
  force?: boolean;       // --force：跳过所有确认提示
  interactive?: boolean; // --interactive / --no-interactive：是否交互式
  profile?: string;      // --profile：覆盖全局 profile（"core" 或 "custom"）
};

/**
 * 延迟清理任务的上下文数据。
 *
 * 用于保存"全局 Codex prompt 匹配项"，这些匹配项必须等到对应的替换 skill
 * 生成完成后，才能安全地清理掉旧文件。
 */
type DeferredLegacyCleanup = {
  detection: LegacyDetectionResult;
};

// -----------------------------------------------------------------------------
// InitCommand 类（init 命令的核心实现）
// -----------------------------------------------------------------------------

/**
 * InitCommand - OpenSpec 初始化命令的实现类
 *
 * 负责：
 *   1. 在指定项目路径下创建 openspec/ 目录结构
 *   2. 检测并清理老版本遗留产物
 *   3. 检测项目里已安装的 AI 工具
 *   4. 通过交互式多选让用户选择要配置的工具
 *   5. 为选定的工具生成 SKILL.md 文件和 slash command 文件
 *   6. 写入 openspec/config.yaml
 *   7. 输出成功提示与后续使用说明
 */
export class InitCommand {
  /** --tools 参数原值（未解析），undefined 表示未传 */
  private readonly toolsArg?: string;
  /** 是否强制执行（跳过所有确认提示） */
  private readonly force: boolean;
  /** --interactive / --no-interactive 原值 */
  private readonly interactiveOption?: boolean;
  /** --profile 覆盖值（"core" / "custom"） */
  private readonly profileOverride?: string;

  /**
   * 构造函数：从 CLI 选项构造 InitCommand 实例
   * @param options - 来自 CLI 的选项对象
   */
  constructor(options: InitCommandOptions = {}) {
    this.toolsArg = options.tools;
    this.force = options.force ?? false;
    this.interactiveOption = options.interactive;
    this.profileOverride = options.profile;
  }

  /**
   * 执行 init 命令的主入口（核心流程编排）
   *
   * 执行顺序很重要：
   *   1. 校验路径与权限
   *   2. 拦截 store 指针型仓库（外部化规划仓库）
   *   3. 检测并清理遗留文件（部分延迟到生成后清理）
   *   4. 迁移被重命名工具目录下的 skill
   *   5. 检测可用工具
   *   6. 校验 --profile 覆盖值（在欢迎屏之前，避免无效值让用户白白按回车）
   *   7. 显示动画欢迎屏（仅交互模式）
   *   8. 让用户选择工具
   *   9. 创建 openspec/ 目录
   *   10. 为每个工具生成 skill / command 文件
   *   11. 完成延迟清理（现在替换 skill 已生成）
   *   12. 写入 config.yaml
   *   13. 显示成功提示
   *
   * @param targetPath - 用户指定的目标项目路径（相对或绝对均可）
   */
  async execute(targetPath: string): Promise<void> {
    // 解析为绝对路径
    const projectPath = path.resolve(targetPath);
    const openspecDir = OPENSPEC_DIR_NAME;
    const openspecPath = path.join(projectPath, openspecDir);

    // 1. 校验：检查目录是否已存在（决定是否进入 extend 模式）和写权限
    // extendMode = true 表示 openspec/ 已存在，本次是"扩展/更新"而非首次创建
    const extendMode = await this.validate(projectPath, openspecPath);

    // 2. Store 指针守卫（slice 3.2）：
    //    一个仅有 config 目录、带 store: 声明的 openspec/ 表示"外部化规划"，
    //    不是可以被扩展的根；这种仓库的子目录也不能悄悄长出一个嵌套根。
    //    必须在 legacy 清理、迁移、提示用户之前拒绝，避免污染外部 store。
    //    - extend 模式下：查找起点是 projectPath 本身
    //    - 非 extend 模式：查找最近的祖先根（这样指针仓库的子目录正好在
    //      普通命令会解析指针的位置拒绝）
    const guardRoot = findRepoPlanningRootSync(projectPath);
    if (guardRoot) {
      const { hasPlanningShape, pointer } = classifyOpenSpecDir(guardRoot);
      if (!hasPlanningShape) {
        // 配置目录存在但不是规划形状，且 store 指针声明有问题
        if (pointer.malformed) {
          throw new Error(
            `The store declaration in ${pointer.filePath} is invalid (` +
              storePointerProblem(pointer.malformed) +
              `). Fix or remove the store: line before running openspec init.`
          );
        }
        // store 指针声明有效，但用户尝试在指针仓库里本地初始化
        if (pointer.value !== undefined) {
          throw new Error(
            `This repo's planning is externalized to store '${pointer.value}' (${pointer.filePath}). ` +
              `Remove the store: line first to convert this repo to a local OpenSpec root.`
          );
        }
      }
    }

    // 3. 检测老版本遗留产物，立即清理本地部分，全局 Codex prompt 延迟清理
    const deferredLegacyCleanup = await this.handleLegacyCleanup(projectPath, extendMode);

    // 4. 迁移被重命名工具目录下 OpenSpec 管理的 skills
    //    （例如 .kimi 被改名为 .kimi-code），在工具检测前进行，保证它们仍能被识别
    migrateLegacySkillDirs(projectPath);

    // 5. 检测项目里当前可用的 AI 工具（任务 7.1）
    const detectedTools = getAvailableTools(projectPath);

    // 6. 如果是 extend 模式，把旧项目迁移到 profile 系统（任务 7.3）
    if (extendMode) {
      migrateIfNeeded(projectPath, detectedTools);
    }

    // 7. 提前校验 --profile 覆盖值，让无效值在工具设置前就报错。
    //    解析结果会在后面生成阶段读取 effective config 时被消费。
    //    在欢迎屏之前跑，是为了避免用户按了回车之后才看到错误。
    this.resolveProfileOverride();

    // 8. 显示动画欢迎屏（仅交互模式）
    const canPrompt = this.canPromptInteractively();
    if (canPrompt) {
      const { showWelcomeScreen } = await import('../ui/welcome-screen.js');
      await showWelcomeScreen(this.getActiveWorkflows());
    }

    // 9. 获取所有工具的当前状态（已配置 / 未配置）
    const toolStates = getToolStates(projectPath);

    // 10. 获取用户选定的工具列表（传入已检测工具用于预选）
    const selectedToolIds = await this.getSelectedTools(toolStates, extendMode, detectedTools, projectPath);

    // 11. 校验选定的工具（过滤无效工具，附加元数据）
    const validatedTools = this.validateTools(selectedToolIds, toolStates);

    // 12. 创建 openspec/ 目录结构（specs/、changes/、changes/archive/）
    await this.createDirectoryStructure(openspecPath, extendMode);

    // 13. 为每个工具生成 skill 文件和 slash command 文件
    const results = await this.generateSkillsAndCommands(projectPath, validatedTools);

    // 14. 延迟清理的收尾：替换 skill 已经生成，现在可以安全移除全局旧 prompt
    if (deferredLegacyCleanup) {
      await this.finalizeDeferredLegacyCleanup(projectPath, deferredLegacyCleanup);
    }

    // 15. 写入 openspec/config.yaml（如果不存在）
    const configStatus = await this.createConfig(openspecPath, extendMode);

    // 16. 打印成功提示和后续使用说明
    this.displaySuccessMessage(projectPath, validatedTools, results, configStatus);
  }

  // ═══════════════════════════════════════════════════════════
  // 校验与设置（VALIDATION & SETUP）
  // ═══════════════════════════════════════════════════════════

  /**
   * 校验目标项目路径是否可用，并判断是否为扩展模式
   *
   * @param projectPath - 项目绝对路径
   * @param openspecPath - 预期的 openspec/ 子目录绝对路径
   * @returns true 表示 openspec/ 已存在（扩展模式），false 表示首次创建
   * @throws 如果没有写权限
   */
  private async validate(
    projectPath: string,
    openspecPath: string
  ): Promise<boolean> {
    // 检查 openspec/ 目录是否已存在 -> 决定是否进入 extend 模式
    const extendMode = await FileSystemUtils.directoryExists(openspecPath);

    // 检查对项目根目录是否有写权限
    if (!(await FileSystemUtils.ensureWritePermissions(projectPath))) {
      throw new Error(`Insufficient permissions to write to ${projectPath}`);
    }
    return extendMode;
  }

  /**
   * 判断当前是否可以与用户交互（显示提示、欢迎屏等）
   *
   * 不能交互的情况：
   *   - 显式传了 --no-interactive
   *   - 传了 --tools 参数（非交互式选择工具）
   *   - 终端环境本身不支持交互
   */
  private canPromptInteractively(): boolean {
    if (this.interactiveOption === false) return false;
    if (this.toolsArg !== undefined) return false;
    return isInteractive({ interactive: this.interactiveOption });
  }

  /**
   * 解析 --profile 覆盖值
   *
   * @returns 有效的 profile 值（"core" 或 "custom"），未传 --profile 时返回 undefined
   * @throws 如果 --profile 值不是 "core" 或 "custom"
   */
  private resolveProfileOverride(): Profile | undefined {
    if (this.profileOverride === undefined) {
      return undefined;
    }

    if (this.profileOverride === 'core' || this.profileOverride === 'custom') {
      return this.profileOverride;
    }

    throw new Error(`Invalid profile "${this.profileOverride}". Available profiles: core, custom`);
  }

  /**
   * 解析当前生效 profile 会安装哪些 workflow
   *
   * 用途：onboarding 输出只提及实际会存在的命令，避免提示用户使用不存在的命令。
   *
   * @returns workflow ID 列表（如 ['explore', 'propose', 'apply', 'archive']）
   */
  private getActiveWorkflows(): string[] {
    const globalCfg = getGlobalConfig();
    // profile 优先级：--profile 参数 > 全局配置 > 默认 'core'
    const activeProfile: Profile = this.resolveProfileOverride() ?? globalCfg.profile ?? 'core';
    return [...getProfileWorkflows(activeProfile, globalCfg.workflows)];
  }

  // ═══════════════════════════════════════════════════════════
  // 老版本遗留文件清理（LEGACY CLEANUP）
  // ═══════════════════════════════════════════════════════════

  /**
   * 处理老版本遗留产物的清理
   *
   * 策略：
   *   - 仓库本地的遗留产物（如老版 slash command 文件）-> 立即清理
   *   - 全局 Codex prompt 文件 -> 延迟清理，等到对应的替换 skill 生成后再删
   *
   * @param projectPath - 项目绝对路径
   * @param extendMode - 是否为扩展模式
   * @returns 延迟清理上下文（如果存在需要延迟清理的全局 prompt），否则 null
   */
  private async handleLegacyCleanup(projectPath: string, extendMode: boolean): Promise<DeferredLegacyCleanup | null> {
    // 检测项目里所有的老版本遗留产物
    const detection = await detectLegacyArtifacts(projectPath);

    if (!detection.hasLegacyArtifacts) {
      return null; // 没有发现遗留产物，直接返回
    }

    // 从检测结果中分离出"可以立即清理"的部分（排除全局 prompt 文件）
    const immediateDetection = omitGlobalLegacyPromptFiles(detection);

    // 打印立即清理部分的检测摘要
    const immediateSummary = formatDetectionSummary(immediateDetection);
    if (immediateSummary) {
      console.log();
      console.log(immediateSummary);
      console.log();
    }

    // 打印"延迟清理"部分的全局 prompt 摘要
    // 这些文件只有在替换 skill 生成后才会被删除
    const deferredSummary = formatDeferredGlobalPromptSummary(detection);
    if (deferredSummary) {
      console.log(deferredSummary);
      console.log();
    }

    const canPrompt = this.canPromptInteractively();

    if (this.force || !canPrompt) {
      // --force 模式或非交互模式：自动执行清理，无需用户确认
      // 安全性：老版 slash command 100% 由 OpenSpec 管理，
      // config 文件清理只删除标记（从不删除用户文件），所以自动清理是安全的
      await this.performImmediateLegacyCleanup(projectPath, detection);
      // 如果存在延迟清理的全局 prompt 文件，返回上下文
      return detection.globalSlashCommandFiles.length > 0 ? { detection } : null;
    }

    // 交互模式：询问用户是否确认清理
    const { confirm } = await import('@inquirer/prompts');
    const shouldCleanup = await confirm({
      message: 'Upgrade and clean up legacy files?',
      default: true,
    });

    if (!shouldCleanup) {
      // 用户拒绝清理，直接退出
      console.log(chalk.dim('Initialization cancelled.'));
      console.log(chalk.dim('Run with --force to skip this prompt, or manually remove legacy files.'));
      process.exit(0);
    }

    await this.performImmediateLegacyCleanup(projectPath, detection);
    return detection.globalSlashCommandFiles.length > 0 ? { detection } : null;
  }

  /**
   * 执行"可以立即清理"的部分（不依赖新生成 Codex skill 的部分）
   *
   * @param projectPath - 项目绝对路径
   * @param detection - 完整的检测结果
   */
  private async performImmediateLegacyCleanup(
    projectPath: string,
    detection: LegacyDetectionResult
  ): Promise<void> {
    // 排除全局 prompt 文件，只保留可以立即清理的部分
    const immediateDetection = omitGlobalLegacyPromptFiles(detection);
    if (!immediateDetection.hasLegacyArtifacts) {
      return;
    }

    await this.performLegacyCleanup(projectPath, immediateDetection);
  }

  /**
   * 完成延迟清理的收尾工作
   *
   * 在 skill/command 生成完成后调用。只移除那些 workflow 已经有替换 skill 的
   * 全局 Codex prompt 文件，避免删除还在使用中的 prompt。
   *
   * @param projectPath - 项目绝对路径
   * @param deferredCleanup - 延迟清理的上下文（包含检测结果）
   */
  private async finalizeDeferredLegacyCleanup(
    projectPath: string,
    deferredCleanup: DeferredLegacyCleanup
  ): Promise<void> {
    // 获取 Codex 工具当前已安装的所有 workflow ID
    const availableCodexWorkflows = await this.getInstalledWorkflowsForTool(projectPath, 'codex');
    // 找出所有 workflow 都已经有替换 skill 的全局 prompt（这些可以安全移除）
    const removableMatches = getLegacyGlobalPromptMatches(deferredCleanup.detection)
      .filter((prompt) => prompt.workflowIds.every((workflowId) => availableCodexWorkflows.has(workflowId)));

    if (removableMatches.length > 0) {
      // 执行清理
      await this.performLegacyCleanup(
        projectPath,
        pickGlobalLegacyPromptFiles(
          deferredCleanup.detection,
          removableMatches.map((prompt) => prompt.path)
        )
      );
    }

    // 找出被保留的（没有完整替换 skill 的）prompt，给用户提示
    const blockedMatches = getLegacyGlobalPromptMatches(deferredCleanup.detection)
      .filter((prompt) => !removableMatches.some((match) => match.path === prompt.path));

    if (blockedMatches.length > 0) {
      console.log(chalk.yellow('Preserved deferred global prompts without replacement skills:'));
      for (const prompt of blockedMatches) {
        console.log(chalk.dim(`  - ${prompt.toolId}: ${prompt.path}`));
      }
      console.log();
    }
  }

  /**
   * 从磁盘上读取指定工具当前已安装的 workflow ID 集合
   *
   * 通过扫描生成的 skill 目录布局来判断哪些 workflow 已安装。
   *
   * @param projectPath - 项目绝对路径
   * @param toolId - 工具 ID（如 "codex"）
   * @returns 已安装的 workflow ID 集合
   */
  private async getInstalledWorkflowsForTool(projectPath: string, toolId: string): Promise<Set<string>> {
    const tool = AI_TOOLS.find((candidate) => candidate.value === toolId);
    if (!tool) {
      return new Set<string>();
    }

    return new Set(scanInstalledWorkflowsShared(projectPath, [tool]));
  }

  /**
   * 实际执行清理操作的辅助方法（带 spinner 提示）
   *
   * @param projectPath - 项目绝对路径
   * @param detection - 要清理的检测结果子集
   */
  private async performLegacyCleanup(projectPath: string, detection: LegacyDetectionResult): Promise<void> {
    const spinner = ora('Cleaning up legacy files...').start();

    const result = await cleanupLegacyArtifacts(projectPath, detection);

    spinner.succeed('Legacy files cleaned up');

    // 打印清理结果摘要
    const summary = formatCleanupSummary(result);
    if (summary) {
      console.log();
      console.log(summary);
    }

    console.log();
  }

  // ═══════════════════════════════════════════════════════════
  // 工具选择（TOOL SELECTION）
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取用户选定的工具列表
   *
   * 三种路径：
   *   1. 如果传了 --tools 参数：直接解析该参数（非交互）
   *   2. 非交互模式且未传 --tools：用检测到的工具作为兜底（任务 7.8）
   *   3. 交互模式：显示可搜索的多选界面让用户选
   *
   * @param toolStates - 所有工具的状态映射
   * @param extendMode - 是否为扩展模式
   * @param detectedTools - 检测到的工具列表
   * @param projectPath - 项目绝对路径
   * @returns 选定的工具 ID 列表
   */
  private async getSelectedTools(
    toolStates: Map<string, ToolSkillStatus>,
    extendMode: boolean,
    detectedTools: AIToolOption[],
    projectPath: string
  ): Promise<string[]> {
    // 路径 1：优先检查 --tools 参数
    const nonInteractiveSelection = this.resolveToolsArg();
    if (nonInteractiveSelection !== null) {
      return nonInteractiveSelection;
    }

    // 收集信息：支持 skill 的工具、检测到的工具、已配置的工具
    const validTools = getToolsWithSkillsDir();
    const detectedToolIds = new Set(detectedTools.map((t) => t.value));
    const configuredToolIds = new Set(
      [...toolStates.entries()]
        .filter(([, status]) => status.configured)
        .map(([toolId]) => toolId)
    );
    // 首次设置（非 extend 且无已配置工具）时，自动预选检测到的工具
    const shouldPreselectDetected = !extendMode && configuredToolIds.size === 0;
    const canPrompt = this.canPromptInteractively();

    // 路径 2：非交互模式，用检测到的工具作为兜底
    if (!canPrompt) {
      if (detectedToolIds.size > 0) {
        return [...detectedToolIds];
      }
      // 没检测到任何工具，且未传 --tools，报错
      throw new Error(
        `No tools detected and no --tools flag provided. Valid tools:\n  ${validTools.join('\n  ')}\n\nUse --tools all, --tools none, or --tools claude,cursor,...`
      );
    }

    // 路径 3：交互模式
    if (validTools.length === 0) {
      throw new Error(
        `No tools available for skill generation.`
      );
    }

    // 动态导入可搜索的多选 prompt 组件
    const { searchableMultiSelect } = await import('../prompts/searchable-multi-select.js');

    // 构建选项列表：
    //   - 已配置的工具 -> 预选
    //   - 检测到但未配置的工具 -> 可见但不预选（除非首次设置）
    const sortedChoices = validTools
      .map((toolId) => {
        const tool = AI_TOOLS.find((t) => t.value === toolId);
        const status = toolStates.get(toolId);
        const configured = status?.configured ?? false;
        const detected = detectedToolIds.has(toolId);

        return {
          name: tool?.name || toolId,
          value: toolId,
          configured,
          detected: detected && !configured,
          preSelected: configured || (shouldPreselectDetected && detected && !configured),
        };
      })
      .sort((a, b) => {
        // 排序：已配置 > 检测到（未配置）> 其他
        if (a.configured && !b.configured) return -1;
        if (!a.configured && b.configured) return 1;
        if (a.detected && !b.detected) return -1;
        if (!a.detected && b.detected) return 1;
        return 0;
      });

    // 打印已配置工具的提示
    const configuredNames = validTools
      .filter((toolId) => configuredToolIds.has(toolId))
      .map((toolId) => AI_TOOLS.find((t) => t.value === toolId)?.name || toolId);

    if (configuredNames.length > 0) {
      console.log(`OpenSpec configured: ${configuredNames.join(', ')} (pre-selected)`);
    }

    // 打印检测到工具的提示
    const detectedOnlyNames = detectedTools
      .filter((tool) => !configuredToolIds.has(tool.value))
      .map((tool) => tool.name);

    if (detectedOnlyNames.length > 0) {
      const detectionLabel = shouldPreselectDetected
        ? 'pre-selected for first-time setup'
        : 'not pre-selected';
      console.log(`Detected tool directories: ${detectedOnlyNames.join(', ')} (${detectionLabel})`);
    }

    // 显示可搜索的多选界面
    const selectedTools = await searchableMultiSelect({
      message: `Select tools to set up (${validTools.length} available)`,
      pageSize: 15,
      choices: sortedChoices,
      validate: (selected: string[]) => selected.length > 0 || 'Select at least one tool',
    });

    if (selectedTools.length === 0) {
      throw new Error('At least one tool must be selected');
    }

    return selectedTools;
  }

  /**
   * 解析 --tools 参数
   *
   * 支持的格式：
   *   - "all"  -> 所有支持 skill 的工具
   *   - "none" -> 空数组（不生成任何 skill）
   *   - "claude,cursor,..." -> 逗号分隔的工具 ID 列表
   *
   * @returns 解析后的工具 ID 列表；若未传 --tools 则返回 null
   * @throws 如果参数值为空、混合使用 "all"/"none" 与具体 ID、或包含无效 ID
   */
  private resolveToolsArg(): string[] | null {
    if (typeof this.toolsArg === 'undefined') {
      return null;
    }

    const raw = this.toolsArg.trim();
    if (raw.length === 0) {
      throw new Error(
        'The --tools option requires a value. Use "all", "none", or a comma-separated list of tool IDs.'
      );
    }

    const availableTools = getToolsWithSkillsDir();
    const availableSet = new Set(availableTools);
    const availableList = ['all', 'none', ...availableTools].join(', ');

    const lowerRaw = raw.toLowerCase();
    if (lowerRaw === 'all') {
      return availableTools;
    }

    if (lowerRaw === 'none') {
      return [];
    }

    // 解析逗号分隔的列表
    const tokens = raw
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    if (tokens.length === 0) {
      throw new Error(
        'The --tools option requires at least one tool ID when not using "all" or "none".'
      );
    }

    const normalizedTokens = tokens.map((token) => token.toLowerCase());

    // 不允许 "all"/"none" 与具体 ID 混用
    if (normalizedTokens.some((token) => token === 'all' || token === 'none')) {
      throw new Error('Cannot combine reserved values "all" or "none" with specific tool IDs.');
    }

    // 校验每个 ID 是否有效
    const invalidTokens = tokens.filter(
      (_token, index) => !availableSet.has(normalizedTokens[index])
    );

    if (invalidTokens.length > 0) {
      throw new Error(
        `Invalid tool(s): ${invalidTokens.join(', ')}. Available values: ${availableList}`
      );
    }

    // 去重，但保留顺序
    const deduped: string[] = [];
    for (const token of normalizedTokens) {
      if (!deduped.includes(token)) {
        deduped.push(token);
      }
    }

    return deduped;
  }

  /**
   * 校验选定的工具列表，并附加元数据
   *
   * @param toolIds - 用户选定的工具 ID 列表
   * @param toolStates - 工具状态映射
   * @returns 校验后的工具对象数组（包含 value/name/skillsDir/wasConfigured）
   * @throws 如果遇到未知工具或不支持 skill 生成的工具
   */
  private validateTools(
    toolIds: string[],
    toolStates: Map<string, ToolSkillStatus>
  ): Array<{ value: string; name: string; skillsDir: string; wasConfigured: boolean }> {
    const validatedTools: Array<{ value: string; name: string; skillsDir: string; wasConfigured: boolean }> = [];

    for (const toolId of toolIds) {
      const tool = AI_TOOLS.find((t) => t.value === toolId);
      if (!tool) {
        const validToolIds = getToolsWithSkillsDir();
        throw new Error(
          `Unknown tool '${toolId}'. Valid tools:\n  ${validToolIds.join('\n  ')}`
        );
      }

      // 某些工具不支持 skill 生成（没有 skillsDir）
      if (!tool.skillsDir) {
        const validToolsWithSkills = getToolsWithSkillsDir();
        throw new Error(
          `Tool '${toolId}' does not support skill generation.\nTools with skill generation support:\n  ${validToolsWithSkills.join('\n  ')}`
        );
      }

      // 记录该工具之前是否已配置（用于区分 created vs refreshed）
      const preState = toolStates.get(tool.value);
      validatedTools.push({
        value: tool.value,
        name: tool.name,
        skillsDir: tool.skillsDir,
        wasConfigured: preState?.configured ?? false,
      });
    }

    return validatedTools;
  }

  // ═══════════════════════════════════════════════════════════
  // 目录结构创建（DIRECTORY STRUCTURE）
  // ═══════════════════════════════════════════════════════════

  /**
   * 创建 openspec/ 目录结构
   *
   * 创建的目录：
   *   openspec/
   *   ├── specs/            # 主规范（真理之源）
   *   └── changes/
   *       └── archive/      # 已归档的变更
   *
   * @param openspecPath - openspec/ 目录的绝对路径
   * @param extendMode - 是否为扩展模式（已存在则不显示 spinner）
   */
  private async createDirectoryStructure(openspecPath: string, extendMode: boolean): Promise<void> {
    if (extendMode) {
      // 扩展模式：静默地确保目录存在，不显示 spinner
      const directories = [
        openspecPath,
        path.join(openspecPath, 'specs'),
        path.join(openspecPath, 'changes'),
        path.join(openspecPath, 'changes', 'archive'),
      ];

      for (const dir of directories) {
        await FileSystemUtils.createDirectory(dir);
      }
      return;
    }

    // 首次创建模式：显示 spinner
    const spinner = this.startSpinner('Creating OpenSpec structure...');

    const directories = [
      openspecPath,
      path.join(openspecPath, 'specs'),
      path.join(openspecPath, 'changes'),
      path.join(openspecPath, 'changes', 'archive'),
    ];

    for (const dir of directories) {
      await FileSystemUtils.createDirectory(dir);
    }

    spinner.stopAndPersist({
      symbol: PALETTE.white('▌'),
      text: PALETTE.white('OpenSpec structure created'),
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Skill 与 Command 生成（SKILL & COMMAND GENERATION）
  // ═══════════════════════════════════════════════════════════

  /**
   * 为每个选定的工具生成 skill 文件和 slash command 文件
   *
   * 根据配置的 delivery 模式决定生成什么：
   *   - "skills"  : 只生成 SKILL.md 文件
   *   - "commands": 只生成 slash command 文件
   *   - "both"    : 两者都生成（默认）
   *
   * @param projectPath - 项目根目录绝对路径
   * @param tools - 选定的工具列表（含 skillsDir 等元数据）
   * @returns 生成结果统计（created/refreshed/failed 工具列表，跳过和移除的文件数）
   */
  private async generateSkillsAndCommands(
    projectPath: string,
    tools: Array<{ value: string; name: string; skillsDir: string; wasConfigured: boolean }>
  ): Promise<{
    createdTools: typeof tools;
    refreshedTools: typeof tools;
    failedTools: Array<{ name: string; error: Error }>;
    commandsSkipped: string[];
    skillsInvocableCommandSkips: string[];
    removedCommandCount: number;
    removedSkillCount: number;
  }> {
    // 结果统计容器
    const createdTools: typeof tools = [];        // 本次新创建的工具
    const refreshedTools: typeof tools = [];     // 之前已配置、本次刷新的工具
    const failedTools: Array<{ name: string; error: Error }> = [];  // 失败的工具
    const commandsSkipped: string[] = [];         // 被跳过的 command（无适配器）
    const skillsInvocableCommandSkips: string[] = [];  // 通过 skill 调用的 command 跳过
    let removedCommandCount = 0;                  // 移除的 command 文件数
    let removedSkillCount = 0;                    // 移除的 skill 目录数

    // 读取全局配置：profile 和 delivery（如果传了 --profile 则用覆盖值）
    const globalConfig = getGlobalConfig();
    const profile: Profile = this.resolveProfileOverride() ?? globalConfig.profile ?? 'core';
    const delivery: Delivery = globalConfig.delivery ?? 'both';
    const workflows = getProfileWorkflows(profile, globalConfig.workflows);

    // 根据 profile 的 workflow 过滤，获取要用的 skill 模板和 command 内容
    const deliveryIncludesCommands = delivery !== 'skills';
    const skillTemplates = getSkillTemplates(workflows);
    const commandContents = getCommandContents(workflows);

    // 逐个工具处理
    for (const tool of tools) {
      const spinner = ora(`Setting up ${tool.name}...`).start();

      try {
        // 判定该工具在当前 delivery 下应该生成什么
        const shouldGenerateSkills = shouldGenerateSkillsForTool(tool.value, delivery);
        const shouldGenerateCommands = shouldGenerateCommandsForTool(tool.value, delivery);

        // 生成 skill 文件（如果 delivery 和工具能力都允许）
        if (shouldGenerateSkills) {
          // 工具特定的 skills 目录，例如 .claude/skills/
          const skillsDir = path.join(projectPath, tool.skillsDir, 'skills');

          // 为每个 workflow 创建对应的 skill 目录和 SKILL.md 文件
          for (const { template, dirName } of skillTemplates) {
            const skillDir = path.join(skillsDir, dirName);
            const skillFile = path.join(skillDir, 'SKILL.md');

            // 生成 SKILL.md 内容（含 YAML frontmatter，标注 generatedBy 版本）
            const transformer = getTransformerForTool(tool.value, delivery, resolveCommandSurfaceCapability(tool.value));
            const skillContent = generateSkillContent(template, OPENSPEC_VERSION, transformer);

            // 写入磁盘
            await FileSystemUtils.writeFile(skillFile, skillContent);
          }
        }
        // 如果该工具在当前 delivery 下不应该有 skill，则移除已存在的 skill 目录
        if (shouldRemoveSkillsForTool(tool.value, delivery)) {
          const skillsDir = path.join(projectPath, tool.skillsDir, 'skills');
          removedSkillCount += await this.removeSkillDirs(skillsDir);
        }

        // 生成 command 文件（如果 delivery 包含 commands）
        if (shouldGenerateCommands) {
          // 获取该工具的适配器
          const adapter = CommandAdapterRegistry.get(tool.value);
          if (adapter) {
            // 用适配器把 command 内容转换成该工具格式的文件
            const generatedCommands = generateCommands(commandContents, adapter);

            for (const cmd of generatedCommands) {
              // cmd.path 可能是绝对路径或相对路径
              const commandFile = path.isAbsolute(cmd.path) ? cmd.path : path.join(projectPath, cmd.path);
              await FileSystemUtils.writeFile(commandFile, cmd.fileContent);
            }
          }
        } else if (deliveryIncludesCommands) {
          // delivery 包含 commands，但该工具不支持 / 不需要 command
          if (resolveCommandSurfaceCapability(tool.value) === 'skills-invocable') {
            // 该工具通过 skill 调用，不需要单独的 command 文件
            skillsInvocableCommandSkips.push(tool.value);
          } else {
            // 该工具没有适配器
            commandsSkipped.push(tool.value);
          }
        }
        // 如果该工具在当前 delivery 下不应该有 command，则清理旧的 command 文件
        if (shouldReconcileCommandFilesForTool(tool.value, delivery)) {
          removedCommandCount += await this.removeCommandFiles(projectPath, tool.value);
        }

        spinner.succeed(`Setup complete for ${tool.name}`);

        // 根据之前是否已配置，分类到 created 或 refreshed
        if (tool.wasConfigured) {
          refreshedTools.push(tool);
        } else {
          createdTools.push(tool);
        }
      } catch (error) {
        // 单个工具失败不影响其他工具
        spinner.fail(`Failed for ${tool.name}`);
        failedTools.push({ name: tool.name, error: error as Error });
      }
    }

    return {
      createdTools,
      refreshedTools,
      failedTools,
      commandsSkipped,
      skillsInvocableCommandSkips,
      removedCommandCount,
      removedSkillCount,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 配置文件（CONFIG FILE）
  // ═══════════════════════════════════════════════════════════

  /**
   * 创建 openspec/config.yaml 配置文件（如果不存在）
   *
   * 同时支持 .yaml 和 .yml 两种扩展名，任一存在都视为已配置。
   *
   * @param openspecPath - openspec/ 目录的绝对路径
   * @param extendMode - 是否为扩展模式（未使用，但保留参数兼容性）
   * @returns 'created' 表示本次创建，'exists' 表示已存在，'skipped' 表示创建失败
   */
  private async createConfig(openspecPath: string, extendMode: boolean): Promise<'created' | 'exists' | 'skipped'> {
    const configPath = path.join(openspecPath, 'config.yaml');
    const configYmlPath = path.join(openspecPath, 'config.yml');
    const configYamlExists = fs.existsSync(configPath);
    const configYmlExists = fs.existsSync(configYmlPath);

    // .yaml 或 .yml 任一存在都视为已配置，不覆盖
    if (configYamlExists || configYmlExists) {
      return 'exists';
    }


    try {
      // 序列化配置（写入默认 schema: spec-driven）
      const yamlContent = serializeConfig({ schema: DEFAULT_SCHEMA });
      await FileSystemUtils.writeFile(configPath, yamlContent);
      return 'created';
    } catch {
      // 写入失败（例如权限问题），返回 skipped
      return 'skipped';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // UI 与输出（UI & OUTPUT）
  // ═══════════════════════════════════════════════════════════

  /**
   * 显示成功提示信息（init 完成后的最终输出）
   *
   * 输出内容包括：
   *   - 创建/刷新的工具列表
   *   - 生成的 skill 和 command 数量
   *   - 失败的工具列表（如果有）
   *   - 跳过/移除的文件数（如果有）
   *   - 需要手动设置的工具提示
   *   - config.yaml 状态
   *   - 后续使用提示（如何启动 /opsx:* 命令）
   *
   * @param projectPath - 项目根目录绝对路径
   * @param tools - 选定的工具列表
   * @param results - 生成结果统计
   * @param configStatus - 配置文件状态
   */
  private displaySuccessMessage(
    projectPath: string,
    tools: Array<{ value: string; name: string; skillsDir: string; wasConfigured: boolean }>,
    results: {
      createdTools: typeof tools;
      refreshedTools: typeof tools;
      failedTools: Array<{ name: string; error: Error }>;
      commandsSkipped: string[];
      skillsInvocableCommandSkips: string[];
      removedCommandCount: number;
      removedSkillCount: number;
    },
    configStatus: 'created' | 'exists' | 'skipped'
  ): void {
    console.log();
    console.log(chalk.bold('OpenSpec Setup Complete'));
    console.log();

    // 显示本次新建的工具
    if (results.createdTools.length > 0) {
      console.log(`Created: ${results.createdTools.map((t) => t.name).join(', ')}`);
    }
    // 显示本次刷新的工具
    if (results.refreshedTools.length > 0) {
      console.log(`Refreshed: ${results.refreshedTools.map((t) => t.name).join(', ')}`);
    }

    // 显示生成的 skill 和 command 数量（按 profile 过滤后的数量）
    const successfulTools = [...results.createdTools, ...results.refreshedTools];
    if (successfulTools.length > 0) {
      const globalConfig = getGlobalConfig();
      const profile: Profile = (this.profileOverride as Profile) ?? globalConfig.profile ?? 'core';
      const delivery: Delivery = globalConfig.delivery ?? 'both';
      const workflows = getProfileWorkflows(profile, globalConfig.workflows);
      const toolDirs = [...new Set(successfulTools.map((t) => t.skillsDir))].join(', ');
      // 如果任意一个工具要生成 skill，按 profile workflow 数计算 skill 数
      const skillCount = successfulTools.some((tool) => shouldGenerateSkillsForTool(tool.value, delivery))
        ? getSkillTemplates(workflows).length
        : 0;
      // 同理计算 command 数
      const commandCount = successfulTools.some((tool) => shouldGenerateCommandsForTool(tool.value, delivery))
        ? getCommandContents(workflows).length
        : 0;
      if (skillCount > 0 && commandCount > 0) {
        console.log(`${skillCount} skills and ${commandCount} commands in ${toolDirs}/`);
      } else if (skillCount > 0) {
        console.log(`${skillCount} skills in ${toolDirs}/`);
      } else if (commandCount > 0) {
        console.log(`${commandCount} commands in ${toolDirs}/`);
      }
    }

    // 显示失败的工具
    if (results.failedTools.length > 0) {
      console.log(chalk.red(`Failed: ${results.failedTools.map((f) => `${f.name} (${f.error.message})`).join(', ')}`));
    }

    // 显示跳过的 command（无适配器的工具）
    if (results.commandsSkipped.length > 0) {
      console.log(chalk.dim(`Commands skipped for: ${results.commandsSkipped.join(', ')} (no adapter)`));
    }
    // 显示跳过的 command（通过 skill 调用的工具）
    if (results.skillsInvocableCommandSkips.length > 0) {
      console.log(chalk.dim(`Commands skipped for: ${results.skillsInvocableCommandSkips.join(', ')} (uses skills)`));
    }
    // 显示移除的 command 文件数
    if (results.removedCommandCount > 0) {
      console.log(chalk.dim(`Removed: ${results.removedCommandCount} command files (delivery: skills)`));
    }
    // 显示移除的 skill 目录数
    if (results.removedSkillCount > 0) {
      console.log(chalk.dim(`Removed: ${results.removedSkillCount} skill directories (delivery: commands)`));
    }

    // 显示需要手动额外配置的工具提示
    for (const tool of successfulTools) {
      const setupNote = AI_TOOLS.find((t) => t.value === tool.value)?.setupNote;
      if (setupNote) {
        console.log(chalk.yellow(`Setup required for ${tool.name}: ${setupNote}`));
      }
    }

    // 显示 config.yaml 状态
    if (configStatus === 'created') {
      console.log(`Config: openspec/config.yaml (schema: ${DEFAULT_SCHEMA})`);
    } else if (configStatus === 'exists') {
      // 显示实际文件名（config.yaml 或 config.yml）
      const configYaml = path.join(projectPath, OPENSPEC_DIR_NAME, 'config.yaml');
      const configYml = path.join(projectPath, OPENSPEC_DIR_NAME, 'config.yml');
      const configName = fs.existsSync(configYaml) ? 'config.yaml' : fs.existsSync(configYml) ? 'config.yml' : 'config.yaml';
      console.log(`Config: openspec/${configName} (exists)`);
    } else {
      console.log(chalk.dim(`Config: skipped (non-interactive mode)`));
    }

    // 显示后续使用提示（任务 7.6：如果 profile 含 propose 则显示）
    const activeWorkflows = this.getActiveWorkflows();
    // 如果没有工具生成 /opsx:* 命令，则指向 skill 而不是不存在的命令
    const activeDelivery: Delivery = getGlobalConfig().delivery ?? 'both';
    const commandsGenerated = successfulTools.some((tool) => shouldGenerateCommandsForTool(tool.value, activeDelivery));
    const skillsGenerated = successfulTools.some((tool) => shouldGenerateSkillsForTool(tool.value, activeDelivery));
    // 每条提示行必须是该工具能实际使用的指令：
    //   - 生成了 command 的工具 -> 提示 /opsx:* 命令
    //   - 只生成了 skill 的工具 -> 提示其文档化的 skill 调用方式
    //     （Kimi Code: /skill:openspec-*；skills-invocable codex 没有斜杠命令面，
    //      所以提示中直接命名 skill；其他工具: /openspec-*）
    //   - 没生成任何产物的工具 -> 通过下面的"配置纠正"提示来处理
    // 当不同工具有不同提示时，按提示分组，每行标注适用的工具名。
    const startHintLines = (command: string): string[] => {
      // 把 /opsx:propose 转成 skill 引用名（去掉前缀 /）
      const skillName = transformToSkillReferences(command).slice(1);
      const hintToTools = new Map<string, string[]>();
      for (const tool of successfulTools) {
        let hint: string;
        if (shouldGenerateCommandsForTool(tool.value, activeDelivery)) {
          // 生成了 command：直接用 /opsx:* 命令
          hint = `Start your first change: ${command} "your idea"`;
        } else if (shouldGenerateSkillsForTool(tool.value, activeDelivery)) {
          // 只生成了 skill：根据工具的调用方式给出对应提示
          hint =
            resolveCommandSurfaceCapability(tool.value) === 'skills-invocable'
              ? `Start your first change with the ${skillName} skill`
              : `Start your first change: ${getSkillReferenceTransformer(tool.value)(command)} "your idea"`;
        } else {
          // 没生成任何东西：跳过，下面会单独提示
          continue;
        }
        // 按提示分组累积工具名
        hintToTools.set(hint, [...(hintToTools.get(hint) ?? []), tool.name]);
      }
      if (hintToTools.size === 0) {
        // 没有成功的工具：保留通用 command 提示
        return [`Start your first change: ${command} "your idea"`];
      }
      if (hintToTools.size === 1) {
        // 所有工具提示一致：只输出一行
        return [[...hintToTools.keys()][0]];
      }
      // 提示不一致：每个提示一行，标注适用的工具
      return [...hintToTools.entries()].map(([hint, toolNames]) => `${hint} (${toolNames.join(', ')})`);
    };
    const printStartHints = (command: string): void => {
      console.log(chalk.bold('Getting started:'));
      for (const line of startHintLines(command)) {
        console.log(`  ${line}`);
      }
    };
    console.log();
    // 配置纠正提示：delivery=commands 但工具只支持 skills 的情况
    // 这些工具不会生成任何产物，所以打印每个工具的配置纠正建议，
    // 而不是留下一个无效（或缺失）的指令
    const zeroArtifactTools = successfulTools.filter(
      (tool) =>
        !shouldGenerateSkillsForTool(tool.value, activeDelivery) &&
        !shouldGenerateCommandsForTool(tool.value, activeDelivery)
    );
    if (zeroArtifactTools.length > 0) {
      const names = zeroArtifactTools.map((tool) => tool.name).join(', ');
      console.log(
        chalk.yellow(
          `No skills or commands were generated for ${names}: delivery is set to 'commands' but ` +
            `${zeroArtifactTools.length === 1 ? 'it supports' : 'they support'} only skills. ` +
            `Run 'openspec config set delivery both' to generate skills.`
        )
      );
    }
    if (successfulTools.length > 0 && !commandsGenerated && !skillsGenerated) {
      // 所有工具都没生成任何东西：上面的纠正提示已经说清楚了，
      // 不再宣传一个不存在的调用方式
    } else if (activeWorkflows.includes('propose')) {
      // profile 含 propose：提示 /opsx:propose
      printStartHints('/opsx:propose');
    } else if (activeWorkflows.includes('new')) {
      // profile 含 new：提示 /opsx:new
      printStartHints('/opsx:new');
    } else {
      // 其他情况：提示用 config profile 配置 workflows
      console.log("Done. Run 'openspec config profile' to configure your workflows.");
    }

    // 相关链接
    console.log();
    console.log(`Learn more: ${chalk.cyan('https://github.com/Fission-AI/OpenSpec')}`);
    console.log(`Feedback:   ${chalk.cyan('https://github.com/Fission-AI/OpenSpec/issues')}`);

    // 重启 IDE 提示：只在确实有工具被配置且生成了产物时才显示
    // （没生成任何东西时，重启也读不到新文件）
    // 只有实际生成了 slash command 时才提示 slash command
    if ((results.createdTools.length > 0 || results.refreshedTools.length > 0) && (commandsGenerated || skillsGenerated)) {
      console.log();
      console.log(
        chalk.white(
          commandsGenerated
            ? 'Restart your IDE for slash commands to take effect.'
            : 'Restart your IDE for the new skills to take effect.'
        )
      );
    }

    console.log();
  }

  /**
   * 启动一个 spinner（带自定义动画）
   * @param text - spinner 文本
   */
  private startSpinner(text: string) {
    return ora({
      text,
      stream: process.stdout,
      color: 'gray',
      spinner: PROGRESS_SPINNER,
    }).start();
  }

  /**
   * 移除指定 skillsDir 下所有 workflow 对应的 skill 目录
   *
   * 用于 delivery 切换为 "commands" 时，清理掉不再需要的 skill 目录。
   *
   * @param skillsDir - skills 目录绝对路径（如 .claude/skills/）
   * @returns 实际移除的目录数
   */
  private async removeSkillDirs(skillsDir: string): Promise<number> {
    let removed = 0;

    for (const workflow of ALL_WORKFLOWS) {
      const dirName = WORKFLOW_TO_SKILL_DIR[workflow];
      if (!dirName) continue;

      const skillDir = path.join(skillsDir, dirName);
      try {
        if (fs.existsSync(skillDir)) {
          await fs.promises.rm(skillDir, { recursive: true, force: true });
          removed++;
        }
      } catch {
        // 忽略错误（比如权限问题），继续清理其他目录
      }
    }

    return removed;
  }

  /**
   * 移除指定工具的所有 slash command 文件
   *
   * 用于 delivery 切换为 "skills" 时，清理掉不再需要的 command 文件。
   *
   * @param projectPath - 项目根目录绝对路径
   * @param toolId - 工具 ID
   * @returns 实际移除的文件数
   */
  private async removeCommandFiles(projectPath: string, toolId: string): Promise<number> {
    let removed = 0;
    const adapter = CommandAdapterRegistry.get(toolId);
    if (!adapter) return 0;

    for (const workflow of ALL_WORKFLOWS) {
      // 通过适配器获取该 workflow 对应的 command 文件路径
      const cmdPath = adapter.getFilePath(workflow);
      const fullPath = path.isAbsolute(cmdPath) ? cmdPath : path.join(projectPath, cmdPath);

      try {
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
          removed++;
        }
      } catch {
        // 忽略错误，继续清理其他文件
      }
    }

    return removed;
  }
}
