/**
 * Math-aware background highlight helpers for Editing Toolbar Math.
 * Applies MathJax \bbox to $...$ / $$...$$ without changing formula text color.
 */

export interface MathRange {
  start: number;
  end: number;
  innerStart: number;
  innerEnd: number;
  isBlock: boolean;
}

/** Find inline $...$ and block $$...$$ ranges (skips escaped \$). */
export function findMathRanges(text: string): MathRange[] {
  const ranges: MathRange[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "\\" && i + 1 < text.length) {
      i += 2;
      continue;
    }
    if (text.startsWith("$$", i)) {
      const end = text.indexOf("$$", i + 2);
      if (end === -1) break;
      ranges.push({
        start: i,
        end: end + 2,
        innerStart: i + 2,
        innerEnd: end,
        isBlock: true,
      });
      i = end + 2;
      continue;
    }
    if (text[i] === "$") {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "\\" && j + 1 < text.length) {
          j += 2;
          continue;
        }
        if (text[j] === "$") break;
        j++;
      }
      if (j >= text.length) break;
      ranges.push({
        start: i,
        end: j + 1,
        innerStart: i + 1,
        innerEnd: j,
        isBlock: false,
      });
      i = j + 1;
      continue;
    }
    i++;
  }
  return ranges;
}

/**
 * Expand [from, to) so any intersecting math span is fully included.
 * Returns new offsets (may be unchanged).
 */
export function expandOffsetsToFullMath(
  doc: string,
  from: number,
  to: number
): { from: number; to: number } {
  let newFrom = from;
  let newTo = to;
  for (const r of findMathRanges(doc)) {
    if (r.start < to && r.end > from) {
      newFrom = Math.min(newFrom, r.start);
      newTo = Math.max(newTo, r.end);
    }
  }
  return { from: newFrom, to: newTo };
}

/** Convert CSS colors with commas (rgba) to #rrggbb for \bbox optional args. */
export function cssColorToBboxColor(color: string): string {
  const rgba = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/i
  );
  if (rgba) {
    const hex = (n: string) =>
      Math.max(0, Math.min(255, Number(n)))
        .toString(16)
        .padStart(2, "0");
    return `#${hex(rgba[1])}${hex(rgba[2])}${hex(rgba[3])}`;
  }
  return color.trim();
}

function findMatchingBrace(text: string, openIdx: number): number {
  if (text[openIdx] !== "{") return -1;
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === "\\" && i + 1 < text.length) {
      i++;
      continue;
    }
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Strip a single outer \bbox[...]{...} or \colorbox{...}{...} if it wraps the whole inner. */
export function stripOuterMathBackground(inner: string): string {
  const s = inner.trim();
  if (s.startsWith("\\bbox")) {
    let i = "\\bbox".length;
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] === "[") {
      const close = s.indexOf("]", i);
      if (close === -1) return inner;
      i = close + 1;
      while (i < s.length && /\s/.test(s[i])) i++;
    }
    if (s[i] !== "{") return inner;
    const end = findMatchingBrace(s, i);
    if (end === -1) return inner;
    if (s.slice(end + 1).trim() !== "") return inner;
    return s.slice(i + 1, end);
  }
  if (s.startsWith("\\colorbox")) {
    let i = "\\colorbox".length;
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== "{") return inner;
    const colorEnd = findMatchingBrace(s, i);
    if (colorEnd === -1) return inner;
    i = colorEnd + 1;
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== "{") return inner;
    const end = findMatchingBrace(s, i);
    if (end === -1) return inner;
    if (s.slice(end + 1).trim() !== "") return inner;
    return s.slice(i + 1, end);
  }
  return inner;
}

export function applyBboxToMathInner(inner: string, color: string): string {
  const body = stripOuterMathBackground(inner);
  const bboxColor = cssColorToBboxColor(color);
  return `\\bbox[${bboxColor}]{${body}}`;
}

/** Apply existing <mark> background wrap to non-math text (same rules as setBackgroundcolor). */
export function applyMarkBackground(text: string, color: string): string {
  if (!text) return text;
  const bgColorRegex =
    /<mark\s+style=["']?background:(?:#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))["']?>([\s\S]*?)<\/mark>/g;
  const hasColorTag = bgColorRegex.test(text);
  bgColorRegex.lastIndex = 0;

  const escapedColor = color.replace(/([()[{*+.$^\\|?])/g, "\\$1");
  const cleanColorRegex = new RegExp(
    `^<mark\\s+style=["']?background:${escapedColor}["']?>([\\s\\S]+)<\\/mark>$`
  );
  if (cleanColorRegex.test(text.trim())) {
    return text;
  }

  if (hasColorTag) {
    return text.replace(
      /(background:)(?:#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/gi,
      `$1${color}`
    );
  }
  return text
    .split("\n")
    .map((line) =>
      line.trim() ? `<mark style="background:${color}">${line}</mark>` : line
    )
    .join("\n");
}

/**
 * Highlight selection: non-math → <mark>; math → \bbox (overwrite old bbox/colorbox).
 */
export function applyBackgroundWithMath(text: string, color: string): string {
  const ranges = findMathRanges(text);
  if (ranges.length === 0) {
    return applyMarkBackground(text, color);
  }

  let result = "";
  let last = 0;
  for (const r of ranges) {
    result += applyMarkBackground(text.slice(last, r.start), color);
    const open = text.slice(r.start, r.innerStart);
    const inner = text.slice(r.innerStart, r.innerEnd);
    const close = text.slice(r.innerEnd, r.end);
    result += open + applyBboxToMathInner(inner, color) + close;
    last = r.end;
  }
  result += applyMarkBackground(text.slice(last), color);
  return result;
}

/** Remove outer \bbox / \colorbox inside every math span. */
export function stripMathBackgrounds(text: string): string {
  const ranges = findMathRanges(text);
  if (ranges.length === 0) return text;

  let result = "";
  let last = 0;
  for (const r of ranges) {
    result += text.slice(last, r.start);
    const open = text.slice(r.start, r.innerStart);
    const inner = text.slice(r.innerStart, r.innerEnd);
    const close = text.slice(r.innerEnd, r.end);
    result += open + stripOuterMathBackground(inner) + close;
    last = r.end;
  }
  result += text.slice(last);
  return result;
}

/** Default color approximating Obsidian --text-highlight-bg (opaque for \\bbox). */
export const DEFAULT_HIGHLIGHT_BBOX_COLOR = "#ffe066";

function wrapEqualsSegments(text: string): string {
  if (!text) return text;
  // Already a single ==...== wrapper
  if (/^==[\s\S]*==$/.test(text.trim()) && text.trim().startsWith("==")) {
    return text;
  }
  return text
    .split("\n")
    .map((line) => {
      if (!line) return line;
      const trimmed = line.trim();
      if (trimmed.startsWith("==") && trimmed.endsWith("==")) return line;
      return `==${line}==`;
    })
    .join("\n");
}

function unwrapEquals(text: string): string {
  return text.replace(/==([\s\S]*?)==/g, "$1");
}

function containsMath(text: string): boolean {
  return findMathRanges(text).length > 0;
}

function containsMathBbox(text: string): boolean {
  return /\\bbox\s*[\[{]/.test(text) || /\\colorbox\s*\{/.test(text);
}

/**
 * Markdown ==highlight== with math: text → ==...==, formulas → \\bbox (no text color change).
 */
export function applyEqualsHighlightWithMath(
  text: string,
  color: string = DEFAULT_HIGHLIGHT_BBOX_COLOR
): string {
  const ranges = findMathRanges(text);
  if (ranges.length === 0) {
    return wrapEqualsSegments(text);
  }

  let result = "";
  let last = 0;
  for (const r of ranges) {
    result += wrapEqualsSegments(text.slice(last, r.start));
    const open = text.slice(r.start, r.innerStart);
    const inner = text.slice(r.innerStart, r.innerEnd);
    const close = text.slice(r.innerEnd, r.end);
    result += open + applyBboxToMathInner(inner, color) + close;
    last = r.end;
  }
  result += wrapEqualsSegments(text.slice(last));
  return result;
}

export function stripEqualsHighlightWithMath(text: string): string {
  return stripMathBackgrounds(unwrapEquals(text));
}

export type HighlightToggleMode = "apply" | "remove" | "repair";

/**
 * Decide highlight toggle behavior for a selection.
 * - repair: ==...$math$...== without bbox → rewrite to math-aware form
 * - remove: already math-aware or plain == → strip
 * - apply: add highlight
 */
export function decideHighlightToggle(text: string): HighlightToggleMode {
  const trimmed = text.trim();
  const hasEquals = /==[\s\S]*?==/.test(text);
  const hasMath = containsMath(unwrapEquals(text));
  const hasBbox = containsMathBbox(text);

  if (hasEquals && hasMath && !hasBbox) {
    return "repair";
  }
  if (
    hasBbox ||
    (hasEquals && trimmed.startsWith("==") && trimmed.endsWith("=="))
  ) {
    return "remove";
  }
  return "apply";
}

export function toggleEqualsHighlightWithMath(
  text: string,
  color: string = DEFAULT_HIGHLIGHT_BBOX_COLOR
): string {
  const mode = decideHighlightToggle(text);
  if (mode === "repair") {
    return applyEqualsHighlightWithMath(unwrapEquals(text), color);
  }
  if (mode === "remove") {
    return stripEqualsHighlightWithMath(text);
  }
  return applyEqualsHighlightWithMath(text, color);
}
