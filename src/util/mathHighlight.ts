/**
 * Math-aware highlight helpers for Editing Toolbar.
 * Applies MathJax \bbox to formula content without changing text color.
 *
 * Partial selection (behavior B): only the selected LaTeX slice gets \bbox;
 * selection is NOT expanded to the full $...$ / $$...$$ span.
 */

export interface MathRange {
  start: number;
  end: number;
  innerStart: number;
  innerEnd: number;
  isBlock: boolean;
}

type SegKind = "text" | "math-inner" | "delim";

interface Seg {
  start: number;
  end: number;
  kind: SegKind;
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
 * Expand [from, to) to full math spans (legacy behavior A).
 * Kept for callers that opt in; default highlight paths do NOT use this.
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

/** Strip a single outer \bbox[...]{...} or \colorbox{...}{...} if it wraps the whole string. */
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

/** Convert regular spaces to &nbsp; so HTML/Obsidian keeps highlight width. */
function spacesToNbsp(s: string): string {
  return s.replace(/ /g, "&nbsp;");
}

/** Restore &nbsp; / NBSP to normal spaces when stripping marks. */
function nbspToSpaces(s: string): string {
  return s.replace(/&nbsp;/gi, " ").replace(/\u00a0/g, " ");
}

/** Apply existing <mark> background wrap to non-math text. */
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
      line.length > 0
        ? `<mark style="background:${color}">${spacesToNbsp(line)}</mark>`
        : line
    )
    .join("\n");
}

/** Build text / math-inner / delimiter segments inside [from, to). */
export function buildMathAwareSegments(
  doc: string,
  from: number,
  to: number
): Seg[] {
  if (from >= to) return [];
  const ranges = findMathRanges(doc);
  const cuts = new Set<number>([from, to]);
  for (const r of ranges) {
    if (r.end <= from || r.start >= to) continue;
    cuts.add(Math.max(r.start, from));
    cuts.add(Math.min(r.innerStart, to));
    cuts.add(Math.max(r.innerStart, from));
    cuts.add(Math.min(r.innerEnd, to));
    cuts.add(Math.max(r.innerEnd, from));
    cuts.add(Math.min(r.end, to));
  }
  const points = [...cuts]
    .filter((p) => p >= from && p <= to)
    .sort((a, b) => a - b);

  const segs: Seg[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a === b) continue;
    const mid = (a + b) / 2;
    let kind: SegKind = "text";
    for (const r of ranges) {
      if (mid >= r.innerStart && mid < r.innerEnd) {
        kind = "math-inner";
        break;
      }
      if (
        (mid >= r.start && mid < r.innerStart) ||
        (mid >= r.innerEnd && mid < r.end)
      ) {
        kind = "delim";
        break;
      }
    }
    segs.push({ start: a, end: b, kind });
  }
  return segs;
}

/**
 * Transform a document range with behavior B (no expand-to-full-formula).
 * Delimiters stay raw; math-inner slices get onMathInner; other text gets onText.
 */
/**
 * Keep $$ display-math delimiters from being glued to ==highlight== / <mark>,
 * which breaks Obsidian Live Preview MathJax (raw $$ source shows up).
 *
 * Note: in String.replace replacement strings, "$$" means a literal "$",
 * so we use function replacers whenever we need to emit "$$".
 */
export function normalizeDisplayMathAdjacency(text: string): string {
  let s = text;
  // highlight/mark immediately before opening $$
  s = s.replace(/==\)\$\$/g, () => "==)\n$$");
  s = s.replace(/==\$\$/g, () => "==\n$$");
  s = s.replace(/<\/mark>\$\$/gi, () => "</mark>\n$$");
  // closing $$ immediately followed by highlight/mark
  s = s.replace(/\$\$\(\s*==/g, () => "$$\n(==");
  s = s.replace(/\$\$==/g, () => "$$\n==");
  s = s.replace(/\$\$<mark/gi, () => "$$\n<mark");
  // prose character stuck to $$ — keep $$ on its own line
  s = s.replace(/([^\n$])\$\$\n/g, (_m, ch: string) => `${ch}\n$$\n`);
  s = s.replace(/\n\$\$([^\n$])/g, (_m, ch: string) => `\n$$\n${ch}`);
  return s;
}

export function transformDocRange(
  doc: string,
  from: number,
  to: number,
  onText: (slice: string) => string,
  onMathInner: (slice: string) => string
): string {
  let result = "";
  for (const seg of buildMathAwareSegments(doc, from, to)) {
    const slice = doc.slice(seg.start, seg.end);
    let piece: string;
    if (seg.kind === "delim") piece = slice;
    else if (seg.kind === "math-inner") piece = onMathInner(slice);
    else piece = onText(slice);

    // Separate $$ delimiters from adjacent highlight/prose inside the selection result
    if (
      seg.kind === "delim" &&
      slice.startsWith("$$") &&
      result.length > 0 &&
      !/\n$/.test(result)
    ) {
      result += "\n";
    }
    if (
      result.endsWith("$$") &&
      piece.length > 0 &&
      !piece.startsWith("\n") &&
      (/^==/.test(piece) ||
        /^\(==/.test(piece) ||
        /^<mark/i.test(piece) ||
        /^\(/.test(piece))
    ) {
      result += "\n";
    }
    result += piece;
  }
  return normalizeDisplayMathAdjacency(result);
}

export function applyBackgroundToDocRange(
  doc: string,
  from: number,
  to: number,
  color: string
): string {
  return transformDocRange(
    doc,
    from,
    to,
    (text) => applyMarkBackground(text, color),
    (inner) => applyBboxToMathInner(inner, color)
  );
}

/**
 * Highlight selection string: non-math → <mark>; math spans → \bbox.
 * Prefer applyBackgroundToDocRange when editor offsets are available (partial math).
 */
export function applyBackgroundWithMath(text: string, color: string): string {
  return applyBackgroundToDocRange(text, 0, text.length, color);
}

/** Remove outer \bbox / \colorbox inside every math span. */
export function stripMathBackgrounds(text: string): string {
  const ranges = findMathRanges(text);
  if (ranges.length === 0) {
    return stripOuterMathBackground(text);
  }

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
  if (/^==[\s\S]*==$/.test(text.trim()) && text.trim().startsWith("==")) {
    return text;
  }
  return text
    .split("\n")
    .map((line) => {
      // Keep truly empty lines; wrap whitespace-only (" ") too
      if (line.length === 0) return line;
      const trimmed = line.trim();
      if (trimmed.startsWith("==") && trimmed.endsWith("==")) return line;
      return `==${line}==`;
    })
    .join("\n");
}

function unwrapEquals(text: string): string {
  return text.replace(/==([\s\S]*?)==/g, "$1");
}

/** Strip <mark style="background:...">...</mark> wrappers. */
export function stripMarkTags(text: string): string {
  return text.replace(
    /<mark\s+style=["']?background:(?:#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))["']?>([\s\S]*?)<\/mark>/gi,
    (_m, inner: string) => nbspToSpaces(inner)
  );
}

function unwrapHighlightChrome(text: string): string {
  return unwrapEquals(stripMarkTags(text));
}

function containsMath(text: string): boolean {
  return findMathRanges(text).length > 0;
}

/** True if [from, to) overlaps any $...$ / $$...$$ span in doc. */
export function selectionTouchesMath(
  doc: string,
  from: number,
  to: number
): boolean {
  return findMathRanges(doc).some((r) => r.start < to && r.end > from);
}

const rangeOverlapsMath = selectionTouchesMath;

/**
 * Fix broken ==highlight== that landed inside math delimiters, e.g.
 * `$==x^2==$` → `$\\bbox[#ffe066]{x^2}$`. Preserves $ / $$ delimiters.
 */
export function repairEqualsInsideMathSpans(
  text: string,
  color: string = DEFAULT_HIGHLIGHT_BBOX_COLOR
): string {
  const ranges = findMathRanges(text);
  if (ranges.length === 0) return text;

  let result = "";
  let last = 0;
  for (const r of ranges) {
    result += text.slice(last, r.start);
    const open = text.slice(r.start, r.innerStart);
    let inner = text.slice(r.innerStart, r.innerEnd);
    const close = text.slice(r.innerEnd, r.end);

    const whole = inner.match(/^\s*==([\s\S]*?)==\s*$/);
    if (whole) {
      inner = applyBboxToMathInner(whole[1], color);
    } else if (inner.includes("==") && !/\\bbox/.test(inner)) {
      inner = applyBboxToMathInner(
        inner.replace(/==([\s\S]*?)==/g, "$1"),
        color
      );
    }
    result += open + inner + close;
    last = r.end;
  }
  result += text.slice(last);
  return result;
}

function containsMathBbox(text: string): boolean {
  return /\\bbox\s*[\[{]/.test(text) || /\\colorbox\s*\{/.test(text);
}

function containsMarkBackground(text: string): boolean {
  return /<mark\s+style=["']?background:/i.test(text);
}

/** True if this slice must avoid Markdown == (math / bbox / $ delimiters). */
export function selectionNeedsMarkHighlight(
  doc: string,
  from: number,
  to: number
): boolean {
  const slice = doc.slice(from, to);
  return (
    rangeOverlapsMath(doc, from, to) ||
    containsMath(slice) ||
    containsMathBbox(slice) ||
    /\$|\\\(|\\\[/.test(slice)
  );
}

/**
 * Highlight a doc range.
 * - Pure text → Markdown ==...==
 * - Any math / $ / \\bbox → text uses <mark> (never ==), math uses \\bbox
 *
 * Why mark for mixed selections: Obsidian's == highlighter can greedily span
 * across flanking == runs and swallow the math in between, breaking MathJax
 * and leaving bare "==" plus un-highlighted prose.
 */
export function applyEqualsHighlightToDocRange(
  doc: string,
  from: number,
  to: number,
  color: string = DEFAULT_HIGHLIGHT_BBOX_COLOR
): string {
  const useMarkForText = selectionNeedsMarkHighlight(doc, from, to);
  const result = transformDocRange(
    doc,
    from,
    to,
    (text) =>
      useMarkForText
        ? applyMarkBackground(text, color)
        : wrapEqualsSegments(text),
    (inner) => applyBboxToMathInner(inner, color)
  );
  return repairEqualsInsideMathSpans(result, color);
}

/**
 * Markdown ==highlight== with math: pure text → ==...==;
 * mixed / math → <mark> + \\bbox.
 */
export function applyEqualsHighlightWithMath(
  text: string,
  color: string = DEFAULT_HIGHLIGHT_BBOX_COLOR
): string {
  return applyEqualsHighlightToDocRange(text, 0, text.length, color);
}

export function stripEqualsHighlightWithMath(text: string): string {
  return stripMathBackgrounds(unwrapHighlightChrome(text));
}

export type HighlightToggleMode = "apply" | "remove" | "repair";

/**
 * Decide highlight toggle behavior for a selection.
 * - repair: == used with math/bbox (broken flanking ==), or ==/mark wrapping math without bbox
 * - remove: clean math-aware mark+bbox, or plain ==
 * - apply: add highlight
 */
export function decideHighlightToggle(text: string): HighlightToggleMode {
  const trimmed = text.trim();
  const hasEqualsPair = /==[\s\S]*?==/.test(text);
  const hasEqualsToken = text.includes("==");
  const hasMark = containsMarkBackground(text);
  const plain = unwrapHighlightChrome(text);
  const hasMath = containsMath(plain);
  const hasBbox = containsMathBbox(text);
  const hasDollar = /\$|\\\(|\\\[/.test(plain);

  // == landed inside $...$ (e.g. $==x^2==$) — must rewrite to \\bbox
  if (/\$\s*==/.test(text) || /==\s*\$/.test(text)) {
    return "repair";
  }
  // Any == near math/$/bbox is unsafe in Obsidian — rewrite to <mark>+\\bbox
  if (hasEqualsToken && (hasMath || hasBbox || hasDollar)) {
    return "repair";
  }
  if (hasMark && hasMath && !hasBbox) {
    return "repair";
  }
  if (
    (hasBbox || hasMark) &&
    !hasEqualsToken
  ) {
    return "remove";
  }
  if (hasEqualsPair && trimmed.startsWith("==") && trimmed.endsWith("==")) {
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
    const plain = stripMathBackgrounds(unwrapHighlightChrome(text));
    return repairEqualsInsideMathSpans(
      applyEqualsHighlightWithMath(plain, color),
      color
    );
  }
  if (mode === "remove") {
    return stripEqualsHighlightWithMath(text);
  }
  return repairEqualsInsideMathSpans(
    applyEqualsHighlightWithMath(text, color),
    color
  );
}

/**
 * Toggle highlight using document offsets (supports partial math, behavior B).
 */
export function toggleEqualsHighlightInDocRange(
  doc: string,
  from: number,
  to: number,
  color: string = DEFAULT_HIGHLIGHT_BBOX_COLOR
): string {
  const selected = doc.slice(from, to);
  const mode = decideHighlightToggle(selected);

  if (mode === "remove") {
    return transformDocRange(
      doc,
      from,
      to,
      (text) => stripOuterMathBackground(unwrapHighlightChrome(text)),
      (inner) => stripOuterMathBackground(inner)
    );
  }

  if (mode === "repair") {
    const plain = stripMathBackgrounds(unwrapHighlightChrome(selected));
    return repairEqualsInsideMathSpans(
      applyEqualsHighlightToDocRange(plain, 0, plain.length, color),
      color
    );
  }

  return repairEqualsInsideMathSpans(
    applyEqualsHighlightToDocRange(doc, from, to, color),
    color
  );
}
