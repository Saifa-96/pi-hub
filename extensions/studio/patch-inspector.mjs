import { readFileSync, writeFileSync } from "node:fs";

const path = "web/inspector.js";
let src = readFileSync(path, "utf8");

const oldBlock = `\t\t<div class="inspector-section-title">输入</div>
\t\t\${(io?.inputs ?? []).length > 0 ? html\`<\${IoList} items=\${io.inputs} />\` : html\`<div class="text-xs text-zinc-400">（无）</div>\`}
\t\t<div class="inspector-section-title">输出</div>
\t\t\${(io?.outputs ?? []).length > 0 ? html\`<\${IoList} items=\${io.outputs} />\` : html\`<div class="text-xs text-zinc-400">（无）</div>\`}`;

const newBlock = `\t\t\${io ? html\`<div class="inspector-section-title">输入</div>
\t\t\${(io.inputs ?? []).length > 0 ? html\`<\${IoList} items=\${io.inputs} />\` : html\`<div class="text-xs text-zinc-400">（无）</div>\`}
\t\t<div class="inspector-section-title">输出</div>
\t\t\${(io.outputs ?? []).length > 0 ? html\`<\${IoList} items=\${io.outputs} />\` : html\`<div class="text-xs text-zinc-400">（无）</div>\`}\` : null}`;

if (!src.includes(oldBlock)) {
	console.error("old block not found");
	process.exit(1);
}
src = src.replace(oldBlock, newBlock);
writeFileSync(path, src);
console.log("gated: io 区块仅在 io 字段存在时渲染");
