/**
 * OpenSpec CLI 入口文件
 *
 * 本文件是 `openspec` 命令行工具的统一入口，负责：
 *   1. 用 Commander.js 注册所有子命令（init / update / list / view / archive / ...）
 *   2. 配置全局选项（--no-color）和钩子（preAction/postAction 用于遥测）
 *   3. 把每个子命令路由到对应的 Command 类或 register 函数
 *   4. 统一错误处理（支持 --json 模式输出机器可读错误）
 *
 * 调用链：
 *   bin/openspec.js (5 行 shebang)
 *     -> dist/cli/index.js (本文件编译产物)
 *       -> 各 Command 类的 execute() 方法（在 src/core/ 下）
 */

import { asStatus } from '../commands/shared-output.js';
import { Command, Option } from 'commander';
import { createRequire } from 'module';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { AI_TOOLS } from '../core/config.js';
import { UpdateCommand } from '../core/update.js';
import { ListCommand } from '../core/list.js';
import { ArchiveCommand, type ArchiveOptions } from '../core/archive.js';
import { ViewCommand } from '../core/view.js';
import { resolveRootForCommand, toRootOutput } from '../core/root-selection.js';
import { registerSpecCommand } from '../commands/spec.js';
import { ChangeCommand } from '../commands/change.js';
import { ValidateCommand } from '../commands/validate.js';
import { ShowCommand } from '../commands/show.js';
import { CompletionCommand } from '../commands/completion.js';
import { FeedbackCommand } from '../commands/feedback.js';
import { registerConfigCommand } from '../commands/config.js';
import { registerSchemaCommand } from '../commands/schema.js';
import { registerStoreCommand } from '../commands/store.js';
import { registerDoctorCommand } from '../commands/doctor.js';
import { registerContextCommand } from '../commands/context.js';
import { registerWorksetCommand } from '../commands/workset.js';
import {
  statusCommand,
  instructionsCommand,
  applyInstructionsCommand,
  templatesCommand,
  schemasCommand,
  newChangeCommand,
  DEFAULT_SCHEMA,
  type StatusOptions,
  type InstructionsOptions,
  type TemplatesOptions,
  type SchemasOptions,
  type NewChangeOptions,
} from '../commands/workflow/index.js';
import { maybeShowTelemetryNotice, trackCommand, shutdown } from '../telemetry/index.js';
import { COMMON_FLAGS } from '../core/completions/shared-flags.js';

/** --store 选项的描述文本（从共享 flags 配置中读取，保证与 shell 补全一致） */
const STORE_OPTION_DESCRIPTION = COMMON_FLAGS.store.description;

/**
 * 创建一个隐藏的 --store-path 选项（用于故意拒绝该参数）
 *
 * 设计意图：
 *   --store-path 仍然注册（但隐藏不显示在帮助里），这样当用户传 --store-path 时，
 *   解析器能给出明确的错误提示（"用 openspec store register <path> 注册路径"），
 *   而不是让 Commander 报一个通用的"未知选项"错误，
 *   或者在 `show` 命令里因为 allowUnknownOption 而被静默忽略。
 */
function hiddenStorePathOption(): Option {
  return new Option(
    '--store-path <path>',
    'Not supported; register the path with "openspec store register <path>" and use --store <id>'
  ).hideHelp();
}

/**
 * 统一的错误处理函数
 *
 * 根据 Agent 契约：
 *   - 在 --json 模式下，失败的命令必须在 stdout 输出恰好一个 JSON 文档
 *     （命令的 null-shape 加上 status 数组）
 *   - 在人类模式下，用 ora spinner 显示错误，并附上可粘贴的修复建议（如果有）
 *
 * @param error - 捕获到的错误对象
 * @param json - 可选的 JSON 模式上下文（enabled 是否启用 JSON 模式，payload 失败时的空 shape，fallbackCode 错误码）
 */
function failWithError(
  error: unknown,
  json?: { enabled: boolean | undefined; payload?: Record<string, unknown>; fallbackCode?: string }
): void {
  // JSON 模式：输出机器可读的错误
  if (json?.enabled) {
    console.log(
      JSON.stringify(
        { ...(json.payload ?? {}), status: [asStatus(error, json.fallbackCode ?? 'command_error')] },
        null,
        2
      )
    );
    process.exitCode = 1;
    return;
  }
  // 人类模式：用 ora 显示错误信息
  ora().fail(`Error: ${(error as Error).message}`);
  // 根解析和 store 错误会附带可粘贴的修复建议 - 永远不要丢掉它
  const fix = (error as { diagnostic?: { fix?: string } }).diagnostic?.fix;
  if (fix) {
    console.error(`Fix: ${fix}`);
  }
  process.exitCode = process.exitCode ?? 1;
}

// ============== Commander 程序实例 ==============
const program = new Command();
// 在 ESM 中读取 package.json 拿版本号
const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

/**
 * 获取嵌套子命令的完整路径（用于遥测上报）
 *
 * 例如：'change show' -> 'change:show'
 *
 * @param command - Commander 的 Command 对象
 * @returns 用冒号连接的命令路径，根命令返回 'openspec'
 */
export function getCommandPath(command: Command): string {
  const names: string[] = [];
  let current: Command | null = command;

  // 从当前命令向上遍历到根命令
  while (current) {
    const name = current.name();
    // 跳过根命令 'openspec'
    if (name && name !== 'openspec') {
      names.unshift(name);
    }
    current = current.parent;
  }

  return names.join(':') || 'openspec';
}

// ============== 配置根命令 ==============
program
  .name('openspec')
  .description('AI-native system for spec-driven development')
  .version(version);

// 全局选项：禁用彩色输出
program.option('--no-color', 'Disable color output');

// ============== 全局钩子：preAction（命令执行前） ==============
// 应用全局 flags 和遥测，在任何子命令执行前运行
// 注意：preAction 接收两个参数：
//   - thisCommand：添加 hook 的命令（这里是根 program）
//   - actionCommand：实际正在执行的子命令
program.hook('preAction', async (thisCommand, actionCommand) => {
  const opts = thisCommand.opts();
  // 处理 --no-color：设置 NO_COLOR 环境变量
  if (opts.color === false) {
    process.env.NO_COLOR = '1';
  }

  // 首次运行时显示遥测通知（如果还没看过）
  await maybeShowTelemetryNotice();

  // 上报命令执行（用 actionCommand 拿到实际的子命令路径）
  const commandPath = getCommandPath(actionCommand);
  await trackCommand(commandPath, version);
});

// ============== 全局钩子：postAction（命令执行后） ==============
// 命令完成后关闭遥测
program.hook('postAction', async () => {
  await shutdown();
});

// ============== init 命令的 --tools 选项描述 ==============
// 列出所有支持 skillsDir 的工具 ID，用于 --tools 参数的帮助文本
const availableToolIds = AI_TOOLS.filter((tool) => tool.skillsDir).map((tool) => tool.value);
const toolsOptionDescription = `Configure AI tools non-interactively. Use "all", "none", or a comma-separated list of: ${availableToolIds.join(', ')}`;

// ============== init 命令 ==============
// 在指定项目路径下初始化 OpenSpec
program
  .command('init [path]')
  .description('Initialize OpenSpec in your project')
  .option('--tools <tools>', toolsOptionDescription)
  .option('--force', 'Auto-cleanup legacy files without prompting')
  .option('--profile <profile>', 'Override global config profile (core or custom)')
  .action(async (targetPath = '.', options?: { tools?: string; force?: boolean; profile?: string }) => {
    try {
      // 校验目标路径是否为有效目录
      const resolvedPath = path.resolve(targetPath);

      try {
        const stats = await fs.stat(resolvedPath);
        if (!stats.isDirectory()) {
          throw new Error(`Path "${targetPath}" is not a directory`);
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // 目录不存在，但可以创建
          console.log(`Directory "${targetPath}" doesn't exist, it will be created.`);
        } else if (error.message && error.message.includes('not a directory')) {
          throw error;
        } else {
          throw new Error(`Cannot access path "${targetPath}": ${error.message}`);
        }
      }

      // 动态导入 InitCommand（避免增加启动时间）
      const { InitCommand } = await import('../core/init.js');
      const initCommand = new InitCommand({
        tools: options?.tools,
        force: options?.force,
        profile: options?.profile,
      });
      await initCommand.execute(targetPath);
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// ============== experimental 命令（隐藏，向后兼容） ==============
// 隐藏别名：'experimental' -> 'init'，用于向后兼容
program
  .command('experimental', { hidden: true })
  .description('Alias for init (deprecated)')
  .option('--tool <tool-id>', 'Target AI tool (maps to --tools)')
  .option('--no-interactive', 'Disable interactive prompts')
  .action(async (options?: { tool?: string; noInteractive?: boolean }) => {
    try {
      console.log('Note: "openspec experimental" is deprecated. Use "openspec init" instead.');
      const { InitCommand } = await import('../core/init.js');
      const initCommand = new InitCommand({
        tools: options?.tool,
        interactive: options?.noInteractive === true ? false : undefined,
      });
      await initCommand.execute('.');
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// ============== update 命令 ==============
// 更新 OpenSpec 指令文件（skill / command 文件）
program
  .command('update [path]')
  .description('Update OpenSpec instruction files')
  .option('--force', 'Force update even when tools are up to date')
  .action(async (targetPath = '.', options?: { force?: boolean }) => {
    try {
      const updateCommand = new UpdateCommand({ force: options?.force });
      await updateCommand.execute(targetPath);
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// ============== list 命令 ==============
// 列出 changes（默认）或 specs
program
  .command('list')
  .description('List items (changes by default). Use --specs to list specs.')
  .option('--specs', 'List specs instead of changes')
  .option('--changes', 'List changes explicitly (default)')
  .option('--sort <order>', 'Sort order: "recent" (default) or "name"', 'recent')
  .option('--json', 'Output as JSON (for programmatic use)')
  .option('--store <id>', STORE_OPTION_DESCRIPTION)
  .addOption(hiddenStorePathOption())
  .action(async (options?: { specs?: boolean; changes?: boolean; sort?: string; json?: boolean; store?: string; storePath?: string }) => {
    try {
      // 解析 OpenSpec 根目录（支持 --store 或自动查找）
      const root = await resolveRootForCommand(options ?? {}, {
        json: options?.json,
        failurePayload: options?.specs ? { specs: [], root: null } : { changes: [], root: null },
      });
      if (!root) {
        return;
      }
      const listCommand = new ListCommand();
      const mode: 'changes' | 'specs' = options?.specs ? 'specs' : 'changes';
      const sort = options?.sort === 'name' ? 'name' : 'recent';
      await listCommand.execute(root.path, mode, {
        sort,
        json: options?.json,
        ...(options?.json ? { root: toRootOutput(root) } : {}),
      });
    } catch (error) {
      failWithError(error, {
        enabled: options?.json,
        payload: options?.specs ? { specs: [], root: null } : { changes: [], root: null },
        fallbackCode: 'list_error',
      });
      process.exit(1);
    }
  });

// ============== view 命令 ==============
// 显示交互式仪表板（浏览 specs 和 changes）
program
  .command('view')
  .description('Display an interactive dashboard of specs and changes')
  .action(async () => {
    try {
      const viewCommand = new ViewCommand();
      await viewCommand.execute('.');
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// ============== change 命令组（含子命令，已弃用） ==============
// 这是旧的"名词优先"命令组，现在推荐用"动词优先"的顶层命令
const changeCmd = program
  .command('change')
  .description('Manage OpenSpec change proposals');

// 弃用提示：所有 change 子命令执行前都会打印这个警告
changeCmd.hook('preAction', () => {
  console.error('Warning: The "openspec change ..." commands are deprecated. Prefer verb-first commands (e.g., "openspec list", "openspec validate --changes").');
});

// change show：显示一个 change 提案
changeCmd
  .command('show [change-name]')
  .description('Show a change proposal in JSON or markdown format')
  .option('--json', 'Output as JSON')
  .option('--deltas-only', 'Show only deltas (JSON only)')
  .option('--requirements-only', 'Alias for --deltas-only (deprecated)')
  .option('--no-interactive', 'Disable interactive prompts')
  .action(async (changeName?: string, options?: { json?: boolean; requirementsOnly?: boolean; deltasOnly?: boolean; noInteractive?: boolean }) => {
    try {
      const changeCommand = new ChangeCommand();
      await changeCommand.show(changeName, options);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exitCode = 1;
    }
  });

// change list：列出所有活跃的 change（已弃用，推荐用 openspec list）
changeCmd
  .command('list')
  .description('List all active changes (DEPRECATED: use "openspec list" instead)')
  .option('--json', 'Output as JSON')
  .option('--long', 'Show id and title with counts')
  .action(async (options?: { json?: boolean; long?: boolean }) => {
    try {
      console.error('Warning: "openspec change list" is deprecated. Use "openspec list".');
      const changeCommand = new ChangeCommand();
      await changeCommand.list(options);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exitCode = 1;
    }
  });

// change validate：校验一个 change 提案
changeCmd
  .command('validate [change-name]')
  .description('Validate a change proposal')
  .option('--strict', 'Enable strict validation mode')
  .option('--json', 'Output validation report as JSON')
  .option('--no-interactive', 'Disable interactive prompts')
  .action(async (changeName?: string, options?: { strict?: boolean; json?: boolean; noInteractive?: boolean }) => {
    try {
      const changeCommand = new ChangeCommand();
      await changeCommand.validate(changeName, options);
      if (typeof process.exitCode === 'number' && process.exitCode !== 0) {
        process.exit(process.exitCode);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exitCode = 1;
    }
  });

// ============== archive 命令 ==============
// 归档已完成的 change，并把 delta specs 合并到主 specs
program
  .command('archive [change-name]')
  .description('Archive a completed change and update main specs')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('--skip-specs', 'Skip spec update operations (useful for infrastructure, tooling, or doc-only changes)')
  .option('--no-validate', 'Skip validation (not recommended, requires confirmation)')
  .option('--json', 'Output as JSON (non-interactive)')
  .option('--store <id>', STORE_OPTION_DESCRIPTION)
  .addOption(hiddenStorePathOption())
  .action(async (changeName?: string, options?: ArchiveOptions) => {
    try {
      const archiveCommand = new ArchiveCommand();
      await archiveCommand.execute(changeName, options);
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// ============== 通过 register 函数注册的命令组 ==============
// 这些命令组比较复杂，各自有专门的注册函数
registerSpecCommand(program);     // openspec spec ...
registerConfigCommand(program);   // openspec config ...
registerSchemaCommand(program);   // openspec schema ...
registerStoreCommand(program);    // openspec store ...
registerDoctorCommand(program);   // openspec doctor ...
registerContextCommand(program);  // openspec context ...
registerWorksetCommand(program);  // openspec workset ...

// ============== 顶层 validate 命令 ==============
// 校验 changes 和 specs（动词优先，替代 change validate）
program
  .command('validate [item-name]')
  .description('Validate changes and specs')
  .option('--all', 'Validate all changes and specs')
  .option('--changes', 'Validate all changes')
  .option('--specs', 'Validate all specs')
  .option('--type <type>', 'Specify item type when ambiguous: change|spec')
  .option('--strict', 'Enable strict validation mode')
  .option('--json', 'Output validation results as JSON')
  .option('--concurrency <n>', 'Max concurrent validations (defaults to env OPENSPEC_CONCURRENCY or 6)')
  .option('--no-interactive', 'Disable interactive prompts')
  .option('--store <id>', STORE_OPTION_DESCRIPTION)
  .addOption(hiddenStorePathOption())
  .action(async (itemName?: string, options?: { all?: boolean; changes?: boolean; specs?: boolean; type?: string; strict?: boolean; json?: boolean; noInteractive?: boolean; concurrency?: string; store?: string; storePath?: string }) => {
    try {
      const validateCommand = new ValidateCommand();
      await validateCommand.execute(itemName, options);
    } catch (error) {
      failWithError(error, { enabled: options?.json, fallbackCode: 'validate_error' });
      process.exit(1);
    }
  });

// ============== 顶层 show 命令 ==============
// 显示一个 change 或 spec（动词优先，替代 change show）
program
  .command('show [item-name]')
  .description('Show a change or spec')
  .option('--json', 'Output as JSON')
  .option('--type <type>', 'Specify item type when ambiguous: change|spec')
  .option('--no-interactive', 'Disable interactive prompts')
  // change 专属 flags
  .option('--deltas-only', 'Show only deltas (JSON only, change)')
  .option('--requirements-only', 'Alias for --deltas-only (deprecated, change)')
  // spec 专属 flags
  .option('--requirements', 'JSON only: Show only requirements (exclude scenarios)')
  .option('--no-scenarios', 'JSON only: Exclude scenario content')
  .option('-r, --requirement <id>', 'JSON only: Show specific requirement by ID (1-based)')
  .option('--store <id>', STORE_OPTION_DESCRIPTION)
  // 必须显式注册：否则 allowUnknownOption 会静默吞掉 --store-path，
  // 而不是按预期拒绝它
  .addOption(hiddenStorePathOption())
  // 允许未知选项透传给底层命令实现
  .allowUnknownOption(true)
  .action(async (itemName?: string, options?: { json?: boolean; type?: string; noInteractive?: boolean; [k: string]: any }) => {
    try {
      const showCommand = new ShowCommand();
      await showCommand.execute(itemName, options ?? {});
    } catch (error) {
      failWithError(error, { enabled: options?.json, fallbackCode: 'show_error' });
      process.exit(1);
    }
  });

// ============== feedback 命令 ==============
// 提交关于 OpenSpec 的反馈
program
  .command('feedback <message>')
  .description('Submit feedback about OpenSpec')
  .option('--body <text>', 'Detailed description for the feedback')
  .action(async (message: string, options?: { body?: string }) => {
    try {
      const feedbackCommand = new FeedbackCommand();
      await feedbackCommand.execute(message, options);
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// ============== completion 命令组（shell 自动补全） ==============
// 管理 OpenSpec CLI 的 shell 自动补全
const completionCmd = program
  .command('completion')
  .description('Manage shell completions for OpenSpec CLI');

// completion generate：生成补全脚本（输出到 stdout）
completionCmd
  .command('generate [shell]')
  .description('Generate completion script for a shell (outputs to stdout)')
  .action(async (shell?: string) => {
    try {
      const completionCommand = new CompletionCommand();
      await completionCommand.generate({ shell });
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// completion install：安装补全脚本到 shell 配置
completionCmd
  .command('install [shell]')
  .description('Install completion script for a shell')
  .option('--verbose', 'Show detailed installation output')
  .action(async (shell?: string, options?: { verbose?: boolean }) => {
    try {
      const completionCommand = new CompletionCommand();
      await completionCommand.install({ shell, verbose: options?.verbose });
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// completion uninstall：卸载补全脚本
completionCmd
  .command('uninstall [shell]')
  .description('Uninstall completion script for a shell')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (shell?: string, options?: { yes?: boolean }) => {
    try {
      const completionCommand = new CompletionCommand();
      await completionCommand.uninstall({ shell, yes: options?.yes });
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// ============== __complete 命令（隐藏，内部使用） ==============
// 输出机器可读的补全数据，供 shell 补全脚本调用
program
  .command('__complete <type>', { hidden: true })
  .description('Output completion data in machine-readable format (internal use)')
  .action(async (type: string) => {
    try {
      const completionCommand = new CompletionCommand();
      await completionCommand.complete({ type });
    } catch (error) {
      // 静默失败：保证 shell 补全体验的流畅性（出错也不打扰用户）
      process.exitCode = 1;
    }
  });

// ═══════════════════════════════════════════════════════════
// 工作流命令（Workflow Commands，原 experimental）
// ═══════════════════════════════════════════════════════════
// 这一组命令是给 AI Agent 调用的，输出 JSON 格式的指令和状态

// ============== status 命令 ==============
// 显示一个 change 的 artifact 完成状态
program
  .command('status')
  .description('Display artifact completion status for a change')
  .option('--change <id>', 'Change name to show status for')
  .option('--schema <name>', 'Schema override (auto-detected from config.yaml)')
  .option('--json', 'Output as JSON')
  .option('--store <id>', STORE_OPTION_DESCRIPTION)
  .addOption(hiddenStorePathOption())
  .action(async (options: StatusOptions) => {
    try {
      await statusCommand(options);
    } catch (error) {
      failWithError(error, { enabled: options.json, fallbackCode: 'change_error' });
      process.exit(1);
    }
  });

// ============== instructions 命令 ==============
// 输出创建 artifact 或应用 tasks 的丰富指令
program
  .command('instructions [artifact]')
  .description('Output enriched instructions for creating an artifact or applying tasks')
  .option('--change <id>', 'Change name')
  .option('--schema <name>', 'Schema override (auto-detected from config.yaml)')
  .option('--json', 'Output as JSON')
  .option('--store <id>', STORE_OPTION_DESCRIPTION)
  .addOption(hiddenStorePathOption())
  .action(async (artifactId: string | undefined, options: InstructionsOptions) => {
    try {
      // 特殊情况："apply" 不是 artifact，而是获取 apply 指令的命令
      if (artifactId === 'apply') {
        await applyInstructionsCommand(options);
      } else {
        await instructionsCommand(artifactId, options);
      }
    } catch (error) {
      failWithError(error, { enabled: options.json, fallbackCode: 'change_error' });
      process.exit(1);
    }
  });

// ============== templates 命令 ==============
// 显示一个 schema 下所有 artifact 解析后的模板路径
program
  .command('templates')
  .description('Show resolved template paths for all artifacts in a schema')
  .option('--schema <name>', `Schema to use (default: ${DEFAULT_SCHEMA})`)
  .option('--json', 'Output as JSON mapping artifact IDs to template paths')
  .action(async (options: TemplatesOptions) => {
    try {
      await templatesCommand(options);
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// ============== schemas 命令 ==============
// 列出所有可用的 workflow schema 及其描述
program
  .command('schemas')
  .description('List available workflow schemas with descriptions')
  .option('--json', 'Output as JSON (for agent use)')
  .action(async (options: SchemasOptions) => {
    try {
      await schemasCommand(options);
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// ============== new 命令组 ==============
// 创建新项目的命令组
const newCmd = program.command('new').description('Create new items');

// new change：创建一个新的 change 目录
newCmd
  .command('change <name>')
  .description('Create a new change directory')
  .option('--description <text>', 'Description to add to README.md')
  .option('--goal <text>', 'Optional goal metadata to store with the change')
  .option('--schema <name>', `Workflow schema to use (default: ${DEFAULT_SCHEMA})`)
  .option('--json', 'Output as JSON')
  .option('--store <id>', STORE_OPTION_DESCRIPTION)
  .addOption(hiddenStorePathOption())
  // 已移除的选项仍然注册（但隐藏），这样用户传这些参数时会得到明确的
  // 解释，而不是通用的"未知选项"错误
  .addOption(new Option('--initiative <id>', 'No longer supported').hideHelp())
  .addOption(new Option('--areas <names>', 'No longer supported').hideHelp())
  .action(async (name: string, options: NewChangeOptions) => {
    try {
      await newChangeCommand(name, options);
    } catch (error) {
      failWithError(error);
      process.exit(1);
    }
  });

// ============== 导出 program 供外部使用 ==============
export { program };

/**
 * 运行 CLI（解析 argv 并执行对应命令）
 *
 * @param argv - 命令行参数数组，默认为 process.argv
 */
export function runCli(argv = process.argv): void {
  program.parse(argv);
}

// ============== 直接执行入口 ==============
// 当本文件被直接运行（而非被 import）时，自动运行 CLI
// 通过对比 process.argv[1] 和当前文件路径来判断
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
