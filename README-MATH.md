# Editing Toolbar Math

基于 [Editing Toolbar](https://github.com/cumany/obsidian-editing-toolbar) 的本地 fork（插件 id：`editing-toolbar-math`）。

## V1 能力

工具栏「背景色 / 高亮」作用于选区时：

- 普通文字：仍用 `<mark style="background:...">`
- 行内 `$...$` / 块公式 `$$...$$`：写入 `\bbox[#色]{...}`（**不改字色**）
- 部分选中公式时：只给选中的那截 LaTeX 加 `\bbox`（不扩成整个 `$...$`）
- 高亮不会与 `$$` 粘在同一段（避免 Live Preview 公式变源码）
- 引用块：选区含 `$$` / 图片时也会加 `>`，紫线在公式处不断开
- 再次高亮：覆盖旧 `\bbox` / `\colorbox`
- 格式橡皮擦：去掉公式内 `\bbox` / `\colorbox`

公式**字色**（`\textcolor`）留待下一版。

## 使用

1. 关闭原版 **Editing Toolbar**（勿两套同时开）
2. 启用 **Editing Toolbar Math**
3. 重载 Obsidian（或重启）
4. 框选含公式的文字 → 点背景色

## 开发

```bash
npm install --legacy-peer-deps
npx tsx scripts/test-math-highlight.ts
npm run build
```

构建产物在 `Editing-Toolbar-Test-Vault/.obsidian/plugins/editing-toolbar-math/`，再拷到目标库的同名 plugins 目录。
