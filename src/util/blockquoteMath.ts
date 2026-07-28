import type { Editor } from "obsidian";

const BLOCKQUOTE_PREFIX_RE = /^\s*> ?/;

function isQuotedLine(line: string): boolean {
  return BLOCKQUOTE_PREFIX_RE.test(line);
}

/**
 * Toggle blockquote on every line in the selection, including `$$` / blank lines,
 * so display math stays inside the quote (purple bar stays continuous).
 */
export function toggleBlockquoteWithMath(editor: Editor): void {
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");

  if (from.line === to.line && from.ch === to.ch) {
    const ed = editor as Editor & {
      toggleMarkdownFormatting?: (name: string) => void;
    };
    ed.toggleMarkdownFormatting?.("blockquote");
    return;
  }

  const startLine = Math.min(from.line, to.line);
  const endLine = Math.max(from.line, to.line);

  const lines: string[] = [];
  for (let i = startLine; i <= endLine; i++) {
    lines.push(editor.getLine(i));
  }

  const allQuoted = lines.every(
    (line) => line.trim() === "" || isQuotedLine(line)
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let newLine: string;
    if (allQuoted) {
      newLine = line.replace(BLOCKQUOTE_PREFIX_RE, "");
    } else if (isQuotedLine(line)) {
      newLine = line;
    } else {
      newLine = line.length === 0 ? "> " : `> ${line}`;
    }
    editor.setLine(startLine + i, newLine);
  }
}
