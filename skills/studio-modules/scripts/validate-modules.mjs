#!/usr/bin/env node
// Deterministic gates for modules.json against clusters.json.
// Usage: node validate-modules.mjs <clusters.json> <modules.json>
import { readFileSync } from "node:fs";

const [clustersFile, modulesFile] = process.argv.slice(2);
if (!clustersFile || !modulesFile) {
  console.error("usage: validate-modules.mjs <clusters.json> <modules.json>");
  process.exit(1);
}
const clusters = JSON.parse(readFileSync(clustersFile, "utf8"));
const m = JSON.parse(readFileSync(modulesFile, "utf8"));

const errors = [];
if (m.state !== "trial") errors.push(`state must be "trial", got ${JSON.stringify(m.state)}`);
if (typeof m.basedOn !== "string" || !m.basedOn) errors.push("basedOn missing");
if (!Array.isArray(m.modules) || m.modules.length === 0) errors.push("modules must be a non-empty array");
if (m.modules.length > 60) errors.push(`too many modules (${m.modules.length} > 60)`);

const seenIds = new Set();
const covered = [];
for (const mod of m.modules ?? []) {
  const label = mod.id ?? "<no-id>";
  if (typeof mod.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(mod.id)) errors.push(`${label}: id must be kebab-case`);
  if (seenIds.has(mod.id)) errors.push(`${label}: duplicate id`);
  seenIds.add(mod.id);
  if (typeof mod.name !== "string" || !mod.name.trim()) errors.push(`${label}: name empty`);
  if (typeof mod.summary !== "string" || !mod.summary.trim()) errors.push(`${label}: summary empty`);
  if (!Array.isArray(mod.files) || mod.files.length === 0) errors.push(`${label}: files empty`);
  for (const f of mod.files ?? []) covered.push(f);
}

const expected = new Set(clusters.files);
const actual = new Set(covered);
if (covered.length !== actual.size) errors.push(`${covered.length - actual.size} file(s) listed more than once`);
const missing = [...expected].filter((f) => !actual.has(f));
const extra = [...actual].filter((f) => !expected.has(f));
if (missing.length > 0) errors.push(`missing ${missing.length} file(s): ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? " …" : ""}`);
if (extra.length > 0) errors.push(`unknown ${extra.length} file(s): ${extra.slice(0, 5).join(", ")}${extra.length > 5 ? " …" : ""}`);

if (errors.length > 0) {
  console.error(`FAIL (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`PASS: ${m.modules.length} modules, ${covered.length}/${expected.size} files covered`);
