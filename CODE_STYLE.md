# 摸金枪战 · 代码规范

本仓库使用统一的代码风格与质量检查，所有 PR / push 到 `main` 都会跑 CI。

## 工具链

| 工具 | 作用 | 本地命令 |
|------|------|----------|
| **TypeScript** | 类型检查 | `npm run check` |
| **ESLint** | 代码质量 / React Hooks 规则 | `npm run lint` |
| **Prettier** | 代码格式化 | `npm run format`（写入） / `npm run format:check`（仅检查） |
| **Vitest** | 单元测试 | `npm run test` |
| **EditorConfig** | 编辑器统一缩进 / 换行 | 自动生效 |

一键本地检查（与 CI 一致）：

```bash
npm run ci
```

## 格式化规则（Prettier）

- 缩进：**2 空格**（不使用 Tab）
- 引号：**双引号**
- 分号：**必须有**
- 行宽：**80**
- 尾随逗号：ES5 兼容
- 箭头函数参数：单参数可省略括号（`x => x`）
- 换行符：LF

配置文件：`.prettierrc`

## ESLint 要点

- 使用 flat config（`eslint.config.js`）
- 启用：
  - `@eslint/js` recommended
  - `typescript-eslint` recommended
  - `react-hooks` recommended
  - `react-refresh`（Vite）
- 忽略目录：`dist/`

## TypeScript

- 严格使用项目 `tsconfig.*.json`
- 路径别名：
  - `@/*` → `src/*`
  - `@contracts/*` → `contracts/*`
  - `@db/*` → `db/*`
- 提交前务必保证 `npm run check` 通过

## 命名与结构约定

- **组件**：PascalCase（`QuestPanel.tsx`）
- **工具 / 普通函数 / 变量**：camelCase
- **常量 / 枚举**：UPPER_SNAKE 或 PascalCase 按场景
- **文件**：
  - React 组件：与导出组件同名
  - 游戏逻辑：放在 `src/game/`
  - UI 基础组件：`src/components/ui/`（尽量不改 shadcn 生成代码）
- **类型**：优先放在 `src/game/types.ts` 或就近文件


## 仓库双推（强制）

每次提交代码、文档、Backlog，必须同时推到下面两个仓库，缺一不可，不要只推其中一个：

1. **主仓库（私有，优先）**：https://github.com/kenvin-du/mojin-game.git
2. **镜像仓库（公开）**：https://github.com/adoocoke/mojin-game.git

约定：

- 默认目标永远是 `kenvin-du/mojin-game`，再镜像一份到 `adoocoke/mojin-game`
- 不要把 `adoocoke` 当成唯一仓库
- 连接器若只能写 `adoocoke`，用 `kenvin-du` 的写权限补推主仓库
- 不要把 token / PAT 写进仓库文件
- 回复里写清两个仓库各自的 commit SHA

## Git 提交建议

- 使用清晰的 commit message（推荐 Conventional Commits 风格）：
  - `feat:` 新功能
  - `fix:` 修复
  - `refactor:` 重构
  - `docs:` 文档
  - `chore:` 构建 / 工具 / CI
  - `ci:` CI 相关
- 一个 commit 尽量只做一件事

## CI 行为

推送到 `main` 或打开/更新 PR 时自动执行：

1. TypeScript 类型检查
2. ESLint
3. Prettier 格式检查（不自动修复，只报错）
4. Vitest 单元测试

任一失败都会阻止合并（如果开启了 branch protection）。

## 本地开发建议

1. 安装依赖后运行一次 `npm run format`
2. 编辑器安装 EditorConfig + Prettier + ESLint 插件
3. 保存时自动 format（推荐）
4. 提交前跑 `npm run ci`

有问题直接改配置文件或提 Issue。


## 测试规范

单元测试使用 Vitest，详细约定见 **[TESTING.md](./TESTING.md)**。

本地 / CI 统一命令：

```bash
npm run test   # 仅测试
npm run ci     # 类型 + lint + 格式 + 测试
```

新增核心逻辑（背包、价值、任务判定等）时，请同步补充 `*.test.ts`。
