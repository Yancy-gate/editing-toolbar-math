/**
 * Run: npx tsx scripts/test-math-highlight.ts
 */
import assert from "assert";
import {
  findMathRanges,
  expandOffsetsToFullMath,
  cssColorToBboxColor,
  applyBboxToMathInner,
  applyBackgroundWithMath,
  applyBackgroundToDocRange,
  applyEqualsHighlightToDocRange,
  stripMathBackgrounds,
  stripOuterMathBackground,
  toggleEqualsHighlightWithMath,
  toggleEqualsHighlightInDocRange,
  decideHighlightToggle,
  normalizeDisplayMathAdjacency,
} from "../src/util/mathHighlight";

{
  const text = "故 $A^*$ 有 $\\frac{1}{2}$ 和 $$x=1$$ 结束";
  const ranges = findMathRanges(text);
  assert.strictEqual(ranges.length, 3);
  assert.strictEqual(text.slice(ranges[0].start, ranges[0].end), "$A^*$");
  assert.strictEqual(
    text.slice(ranges[1].innerStart, ranges[1].innerEnd),
    "\\frac{1}{2}"
  );
  assert.strictEqual(ranges[2].isBlock, true);
}

{
  const doc = "前 $a+b$ 后";
  const a = doc.indexOf("a");
  const exp = expandOffsetsToFullMath(doc, a, a + 1);
  assert.strictEqual(doc.slice(exp.from, exp.to), "$a+b$");
}

assert.strictEqual(cssColorToBboxColor("rgba(255, 248, 143)"), "#fff88f");
assert.strictEqual(cssColorToBboxColor("#FFE066"), "#FFE066");

{
  const once = applyBboxToMathInner("x^2", "rgb(255, 248, 143)");
  assert.strictEqual(once, "\\bbox[#fff88f]{x^2}");
  const twice = applyBboxToMathInner(once, "#ff0000");
  assert.strictEqual(twice, "\\bbox[#ff0000]{x^2}");
}

{
  const input = "故 $A^*$ 有特征值 $\\frac{|A|}{\\lambda}$ 。";
  const out = applyBackgroundWithMath(input, "rgb(255, 248, 143)");
  assert.ok(
    out.includes('<mark style="background:rgb(255, 248, 143)">故 </mark>')
  );
  assert.ok(out.includes("$\\bbox[#fff88f]{A^*}$"));
  assert.ok(out.includes("$\\bbox[#fff88f]{\\frac{|A|}{\\lambda}}$"));
  assert.ok(!out.match(/<mark[^>]*>\$/));
}

{
  const highlighted = "故 $\\bbox[#fff88f]{A^*}$ 有";
  assert.strictEqual(stripMathBackgrounds(highlighted), "故 $A^*$ 有");
  assert.strictEqual(
    stripOuterMathBackground("\\colorbox{yellow}{a+b}"),
    "a+b"
  );
}

// Behavior B: partial selection inside a formula only bboxes that slice
{
  const doc = "前 $\\lambda_1, \\lambda_2, \\dots$ 后";
  const slice = "\\lambda_2";
  const from = doc.indexOf(slice);
  const to = from + slice.length;
  const out = applyBackgroundToDocRange(doc, from, to, "#ffe066");
  assert.strictEqual(out, "\\bbox[#ffe066]{\\lambda_2}");
  // full formula must remain un-expanded
  assert.ok(!out.includes("\\lambda_1"));
  assert.ok(!out.includes("\\dots"));
}

{
  const doc = "故 $\\lambda_1, \\lambda_2$ 结束";
  const from = doc.indexOf("\\lambda_2");
  const to = from + "\\lambda_2".length;
  const out = applyEqualsHighlightToDocRange(doc, from, to);
  assert.strictEqual(out, "\\bbox[#ffe066]{\\lambda_2}");
}

{
  const input = "故 $A^*$ 有特征值";
  const out = toggleEqualsHighlightWithMath(input);
  assert.ok(out.includes("$\\bbox[#ffe066]{A^*}$"));
  assert.ok(out.includes("=="));
  for (const m of out.matchAll(/==([\s\S]*?)==/g)) {
    assert.strictEqual(findMathRanges(m[1]).length, 0, `math inside ==: ${m[1]}`);
  }

  const broken = "==$\\lambda$ 是 $P^{-1}AP$ 的特征值==";
  assert.strictEqual(decideHighlightToggle(broken), "repair");
  const repaired = toggleEqualsHighlightWithMath(broken);
  assert.ok(repaired.includes("\\bbox[#ffe066]{\\lambda}"));
  assert.ok(repaired.includes("\\bbox[#ffe066]{P^{-1}AP}"));

  const removed = toggleEqualsHighlightWithMath(repaired);
  assert.ok(!removed.includes("\\bbox"));
  assert.ok(!removed.includes("=="));
}

{
  const doc = "前 $\\lambda_1, \\lambda_2$ 后";
  const from = doc.indexOf("\\lambda_2");
  const to = from + "\\lambda_2".length;
  const on = toggleEqualsHighlightInDocRange(doc, from, to);
  assert.strictEqual(on, "\\bbox[#ffe066]{\\lambda_2}");
  const off = toggleEqualsHighlightInDocRange(on, 0, on.length);
  assert.strictEqual(off, "\\lambda_2");
}

{
  const doc = "故 $A^*$ 有特征值";
  const out = toggleEqualsHighlightInDocRange(doc, 0, doc.length);
  assert.ok(out.includes("==故 =="));
  assert.ok(out.includes("$\\bbox[#ffe066]{A^*}$"));
  assert.ok(out.includes("== 有特征值=="));
}

{
  const broken =
    "特征值==)$$\n\\left| b \\pmb {E} \\right|\n$$(==注意行列式==)";
  const fixed = normalizeDisplayMathAdjacency(broken);
  assert.ok(fixed.includes("==)\n$$"));
  assert.ok(fixed.includes("$$\n(=="));
  assert.ok(!/==\)\$\$/.test(fixed));
  assert.ok(!/\$\$\(==/.test(fixed));
}

console.log("mathHighlight tests passed");
