# 安装

## 前提条件

- **Node.js 20.19.0 或更高** — 检查版本：`node --version`

## 包管理器

### npm

```bash
npm install -g @fission-ai/openspec@latest
```

### pnpm

```bash
pnpm add -g @fission-ai/openspec@latest
```

### yarn

```bash
yarn global add @fission-ai/openspec@latest
```

### bun

Bun 可以全局安装 OpenSpec，但 OpenSpec 目前运行在 Node.js 上。你仍然需要 Node.js 20.19.0+ 在 `PATH` 上可用。

```bash
bun add -g @fission-ai/openspec@latest
```

## Nix

无需安装直接运行 OpenSpec：

```bash
nix run github:Fission-AI/OpenSpec -- init
```

或安装到你的 profile：

```bash
nix profile install github:Fission-AI/OpenSpec
```

或在 `flake.nix` 中添加到开发环境：

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    openspec.url = "github:Fission-AI/OpenSpec";
  };

  outputs = { nixpkgs, openspec, ... }: {
    devShells.x86_64-linux.default = nixpkgs.legacyPackages.x86_64-linux.mkShell {
      buildInputs = [ openspec.packages.x86_64-linux.default ];
    };
  };
}
```

## 验证安装

```bash
openspec --version
```

## 更新

升级包，然后刷新每个项目的生成文件：

```bash
npm install -g @fission-ai/openspec@latest   # 或 pnpm/yarn/bun 等效命令
openspec update                              # 在每个项目中运行
```

`openspec update` 为你配置的工具重新生成技能和命令文件，使你的斜杠命令与安装版本保持同步。

## 卸载

没有 `openspec uninstall` 命令，因为 OpenSpec 只是一个全局包加上你项目中的一些文件。删除它是几个手动步骤，这里没有东西会触及你的源代码。

**1. 删除全局包：**

```bash
npm uninstall -g @fission-ai/openspec   # 或：pnpm rm -g / yarn global remove / bun rm -g
```

**2. 从项目中删除 OpenSpec（可选）。**删除 `openspec/` 目录如果你不再需要它的规范和变更：

```bash
rm -rf openspec/
```

在执行此操作前请三思：`openspec/specs/` 和 `openspec/changes/archive/` 是你系统如何行为以及为什么变更的记录。如果你可能想要那段历史，保留文件夹（或保留在 git 中），即使卸载了。

**3. 删除生成的 AI 工具文件（可选）。**OpenSpec 将技能和命令文件写入各工具的目录，如 `.claude/skills/openspec-*/`、`.cursor/commands/opsx-*` 等。删除你配置的任何工具的 `openspec-*` 技能和 `opsx-*` 命令。每个工具的确切路径列在 [支持的工具](supported-tools.md) 中。

如果你在 `CLAUDE.md` 或 `AGENTS.md` 等文件中也有 OpenSpec 标记块，手动删除这些块；你在这些文件中自己的内容归你保留。

## 下一步

安装后，在你的项目中初始化 OpenSpec：

```bash
cd your-project
openspec init
```

参见 [快速上手](getting-started.md) 获取完整演练。