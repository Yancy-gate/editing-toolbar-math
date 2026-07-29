# Editing Toolbar Math

> 基于 [Editing Toolbar](https://github.com/cumany/obsidian-editing-toolbar)（原版 v4.0.11）的 **个人 fork**，插件 id 为 `editing-toolbar-math`，专门解决 **数学笔记里工具栏上色 / 高亮 / 引用** 与 MathJax 公式不兼容的问题。

**仓库：** https://github.com/Yancy-gate/editing-toolbar-math  
**当前版本：** `4.0.11-math.9`（在 upstream `4.0.11` 之上叠加 math 系列补丁）

---

## 为什么要 fork？

原版 Editing Toolbar 的上色、荧光笔高亮、引用块，都是按 **普通 Markdown 文字** 设计的。在含 `$...$` / `$$...$$` 的数学笔记里会出现：

| 现象 | 原因 |
|------|------|
| 高亮后公式仍是黑字、黄底断档 | `==高亮==` / `<mark>` 无法作用到 MathJax 渲染层 |
| 整段高亮后公式显示成源码 | `==` 与 `$$` 粘在一起，破坏数学环境 |
| 引用块左侧紫线在公式处断开 | 块级公式行没有 `>` 前缀，Live Preview 不视为引用内容 |

本 fork **不改原版插件 id**（避免与官方社区插件冲突），以独立插件安装，可与原版二选一使用（**不要同时启用两个**）。

---

## 相对原版的改进一览

| 功能 | 原版行为 | 本 fork |
|------|----------|---------|
| 荧光笔 `==高亮==` | 只包文字，公式跳过 | 纯文字用 `==...==`；**混选文字+公式**时文字用 `<mark>`、公式写 `\bbox`（避免 `==` 包住公式导致渲染出错） |
| 背景色（调色板） | 只包 `<mark>`，公式跳过 | 文字 `<mark>`，公式 `\bbox` |
| 部分选中公式 | 无特殊处理 | **只给选中那截 LaTeX 上色**（不扩成整个 `$...$`） |
| 再次高亮 | 可能叠多层 | **覆盖**旧 `\bbox` / `\colorbox` |
| 格式橡皮擦 | 不清公式内样式 | **一并去掉** `\bbox` / `\colorbox` |
| `==` 与 `$$` 粘连 | 易出现 | 自动插入换行，避免公式变源码 |
| 引用块 + `$$` / 图片 | 公式行常无 `>`，紫线断 | 选区每行都加 `>`；CSS 延续紫线 |
| 阅读模式公式高亮 | 无 | `<mark>` 内公式补背景 CSS |

**尚未实现（计划下一版）：** 工具栏直接改公式**字色**（`\textcolor`）。当前只做**背景高亮**，不改字色。

---

## 详细说明

### 1. 公式感知高亮（荧光笔 `==`）

**涉及命令：** `Highlight`（`editing-toolbar-math:toggle-highlight`）

- 选中文字后点荧光笔：
  - **仅普通文字** → 包 `==...==`
  - **混选文字 + 行内/块级公式** → 文字用 `<mark style="background:#ffe066">...</mark>`，公式内部写 `\bbox[#ffe066]{...}`（避免 Obsidian 的 `==` 贪婪匹配把公式包进去而显示成源码）
  - **只选公式** → 只写 `\bbox`，不包 `==` / `<mark>`
- **部分选中公式（行为 B）**：例如只选中 `\lambda_2`，只给这一截加 `\bbox`，不会把整个 `$...$` 都上色。
- **再点一次高亮**：去掉 `==` / `<mark>` 和 `\bbox`。
- **旧笔记修复**：若已有 `==...$公式$...==` 且公式没 bbox，再点一次高亮会**自动修复**为混选安全形式。

**示例：**

```markdown
故 $\bbox[#ffe066]{A^*}$ 有特征值 $\bbox[#ffe066]{\frac{|A|}{\lambda}}$ 。
```

### 2. 公式感知背景色（调色板）

**涉及：** 工具栏背景色按钮 / `change-background-color`

- 逻辑与荧光笔类似，但文字侧用 HTML：
  - 文字 → `<mark style="background:#色">...</mark>`
  - 公式 → `\bbox[#色]{...}`
- 支持 `rgba(...)` 自动转成 `#rrggbb` 供 `\bbox` 使用。

### 3. 防止 `==` 与 `$$` 粘连

高亮混排时，若写成：

```markdown
…特征值==)$$
\left| ... \right|
$$(==注意…==)
```

Obsidian 会把 `$$` 当坏掉的数学环境，**整段显示 LaTeX 源码**。

本 fork 在写入后自动规范化，例如：

```markdown
…特征值==)
$$
\left| ... \right|
$$
(==注意…==)
```

### 4. 格式橡皮擦支持公式

**涉及：** `Format Eraser`（格式橡皮擦）

- 清除选区格式时，会去掉公式里的 `\bbox`、`\colorbox`，恢复为普通 `$...$`。

### 5. 引用块紫线穿过公式

**涉及：** 工具栏「引用」/ `editor:toggle-blockquote`

**问题：** Live Preview 里引用紫线只画在有 `> ` 的行上；`$$` 块、图片嵌入行若没有 `>`，紫线会断。

**改进：**

1. **逻辑**：框选后点引用时，选区内**每一行**（含 `$$`、空行）都加/去 `> `，不再只处理文字行。
2. **CSS**：为引用后的公式块、图片嵌入补左侧边框与背景，阅读模式 / Note 预览里紫线更连贯。

**若旧笔记紫线仍断：** 框选整段（含公式）再点一次「引用」即可补上缺失的 `>`。

### 6. Live Preview / 阅读模式 CSS 补丁

`styles.css` 中额外包含：

- `==高亮==` 旁的行内公式背景衔接
- `<mark>` 内 MathJax 容器背景
- 引用块内块级公式、图片的左边线延续

---

## 安装

### 方式 A：手动安装（推荐）

1. 在本仓库 [Releases](https://github.com/Yancy-gate/editing-toolbar-math/releases) 或 `Editing-Toolbar-Test-Vault/.obsidian/plugins/editing-toolbar-math/` 取构建产物：
   - `main.js`
   - `manifest.json`
   - `styles.css`
2. 复制到库的 `.obsidian/plugins/editing-toolbar-math/`
3. **设置 → 第三方插件**：启用 **Editing Toolbar Math**，**关闭**原版 **Editing Toolbar**
4. 重载 Obsidian

### 方式 B：从源码构建

```bash
git clone https://github.com/Yancy-gate/editing-toolbar-math.git
cd editing-toolbar-math
npm install --legacy-peer-deps
npm run build
```

产物目录：`Editing-Toolbar-Test-Vault/.obsidian/plugins/editing-toolbar-math/`

---

## 使用提示

1. **不要与原版 Editing Toolbar 同时开启**（命令 id、工具栏会冲突）。
2. 第一次启用后，可在设置里按需调整工具栏按钮；也可从原版导出配置再导入（注意命令 id 已变为 `editing-toolbar-math:*`）。
3. 数学笔记推荐流程：
   - 混排文字 + 公式 → 框选 → 点**荧光笔**或**背景色**
   - 长引用含公式 → 框选整段 → 点**引用**
4. 若公式仍显示源码，检查是否有 `==)$$` 或 `$$(==` 粘连；对选区再点一次高亮可自动修复。

---

## 开发与测试

```bash
npm install --legacy-peer-deps
npx tsx scripts/test-math-highlight.ts   # 公式高亮单元测试
npm run build
```

**主要新增源码：**

| 文件 | 作用 |
|------|------|
| `src/util/mathHighlight.ts` | 公式区间识别、`\bbox` 读写、荧光笔/背景色、防粘连 |
| `src/util/blockquoteMath.ts` | 引用块逐行加 `>` |
| `src/util/util.ts` | `setBackgroundcolor` 接入公式逻辑 |
| `src/commands/commands.ts` | `toggle-highlight`、引用命令挂钩 |
| `src/modals/editingToolbarModal.ts` | 格式橡皮擦清 `\bbox` |
| `styles.css` | 公式高亮与引用紫线 CSS |
| `scripts/test-math-highlight.ts` | 单元测试 |

---

## 版本记录（math 系列）

| 版本 | 说明 |
|------|------|
| `4.0.11-math.1` | 初版 fork；背景色 + `\bbox`；独立插件 id |
| `4.0.11-math.2` | 荧光笔 `==` 支持公式；修复旧 `==$...$==` |
| `4.0.11-math.3` | 部分选中公式只上色选中片段（行为 B） |
| `4.0.11-math.4` | 防止 `==` 与 `$$` 粘连导致公式变源码 |
| `4.0.11-math.5` | 引用块紫线穿过 `$$` / 图片；引用逐行加 `>` |
| `4.0.11-math.6` | 修复混选“文字+公式”高亮时的兜底路径；异常场景仍保持公式感知高亮 |
| `4.0.11-math.7` | 混选改用 `<mark>`+`\bbox`，避免 `==` 贪婪包住公式导致渲染出错 |
| `4.0.11-math.8` | 自动修复已坏的 `==...$\bbox$...==`；点一次高亮即可改成整句连续黄底 |
| `4.0.11-math.9` | 公式前后空格也高亮：空白段包进 `<mark>`，空格转 `&nbsp;`，CSS `white-space: pre-wrap` |

---

## 与上游的关系

- **上游：** [cumany/obsidian-editing-toolbar](https://github.com/cumany/obsidian-editing-toolbar)（亦见 [PKM-er](https://github.com/PKM-er/obsidian-editing-toolbar) 镜像）
- **本 fork：** 仅维护数学笔记相关补丁，**不打算合并回上游**（个人库专用）。
- 原版英文说明见仓库内历史文档；上游功能（AI 工具栏、多配置、跟随工具栏等）均保留。

---

## 许可

与上游相同（MIT）。原版版权归 [Cuman](https://github.com/cumany) 及贡献者；math 系列补丁由本 fork 维护。
