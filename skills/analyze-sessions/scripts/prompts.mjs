#!/usr/bin/env node
/**
 * Dump user prompts across pi sessions for pattern analysis.
 *
 * Node port of amosblomqvist/pi-config skills/analyze-sessions/scripts/prompts.py.
 * Reads `PI_CODING_AGENT_DIR/sessions/` (falls back to `~/.pi/agent/sessions`),
 * filters by date/cwd/session/grep, and prints prompts as markdown grouped by
 * project or as JSONL. Zero dependencies, Node >= 18.
 *
 * Usage:
 *   node prompts.mjs --since 30d
 *   node prompts.mjs --since 7d --max-chars 1500 --format jsonl
 *   node prompts.mjs --cwd pi-hub --grep "review"
 *   node prompts.mjs --self-test
 */
import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import assert from "node:assert";

const SESSIONS_ROOT = resolveSessionsRoot();
const DEFAULT_MAX_CHARS = 2000;
const DEFAULT_MIN_CHARS = 1;
const REL_DATE_MS = { d: 86400000, w: 604800000, h: 3600000, m: 60000 };
const SUBAGENT_RUN_RE = /^run-\d+$/;

/**
 * Entry point: parse CLI args, load matching sessions, render the dump.
 */
export function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.selfTest) return runSelfTest();

  const matched = loadMatchingSessions(args);
  const windowed = matched.filter((s) => s.windowedPrompts.length > 0);
  if (windowed.length === 0) {
    console.error("No prompts matched.");
    return;
  }

  if (args.format === "jsonl") renderJsonl(windowed);
  else renderMarkdown(windowed);
}

/**
 * Resolve the sessions directory from the pi agent dir.
 */
function resolveSessionsRoot() {
  const agentDir =
    process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  return join(agentDir, "sessions");
}

// ── Pure helpers (exported for testing) ──

/**
 * Parse a CLI date value (`7d`, `2w`, `3h`, `30m`, ISO date/datetime) to epoch ms.
 */
export function parseWhen(value) {
  const rel = value.match(/^(\d+)([dwhm])$/);
  if (rel) return Date.now() - Number(rel[1]) * REL_DATE_MS[rel[2]];
  const ms = Date.parse(value.includes(" ") ? value.replace(" ", "T") : value);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${value}`);
  return ms;
}

/**
 * True when a session-file path (relative to the sessions root) is a nested
 * subagent transcript rather than a top-level session file.
 */
export function isSubagentRelPath(relPath) {
  const segments = relPath.split(/[\\/]/);
  if (segments.length !== 2) return true;
  return segments.some((seg) => SUBAGENT_RUN_RE.test(seg));
}

/**
 * Join the `text` chunks of a message content array; non-list content yields "".
 */
export function extractText(content) {
  if (!Array.isArray(content)) return "";
  const chunks = [];
  for (const part of content) {
    if (part && part.type === "text" && part.text) chunks.push(part.text);
  }
  return chunks.join("\n");
}

// ── CLI ──

/**
 * Parse and validate CLI arguments into a plain options object.
 */
function parseCliArgs(argv) {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      format: { type: "string", default: "md" },
      "max-chars": { type: "string", default: String(DEFAULT_MAX_CHARS) },
      "min-chars": { type: "string", default: String(DEFAULT_MIN_CHARS) },
      since: { type: "string" },
      until: { type: "string" },
      cwd: { type: "string" },
      session: { type: "string" },
      grep: { type: "string" },
      "self-test": { type: "boolean", default: false },
    },
  });
  const values = parsed.values;
  if (values.format !== "md" && values.format !== "jsonl") {
    throw new Error(`--format must be md or jsonl, got: ${values.format}`);
  }
  return {
    format: values.format,
    maxChars: toNonNegativeInt("max-chars", values["max-chars"]),
    minChars: toNonNegativeInt("min-chars", values["min-chars"]),
    since: values.since || null,
    until: values.until || null,
    cwdNeedles: values.cwd
      ? values.cwd.split(",").map((s) => s.trim().toLowerCase())
      : [],
    sessionPrefix: values.session ? values.session.toLowerCase() : null,
    grep: values.grep ? values.grep.toLowerCase() : null,
    selfTest: values["self-test"],
  };
}

/**
 * Coerce a CLI string value to a non-negative integer or throw.
 */
function toNonNegativeInt(name, value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`--${name} must be a non-negative integer, got: ${value}`);
  }
  return n;
}

// ── Loading ──

/**
 * Scan the sessions root and return sessions passing every filter, newest
 * first. Each entry carries all user prompts (for grep) and the prompts inside
 * the length window (for output).
 */
function loadMatchingSessions(args) {
  const sinceMs = args.since ? parseWhen(args.since) : null;
  const untilMs = args.until ? parseWhen(args.until) : null;
  const matched = [];

  const relFiles = readdirSync(SESSIONS_ROOT, { recursive: true });
  for (const relPath of relFiles) {
    if (!relPath.endsWith(".jsonl") || isSubagentRelPath(String(relPath)))
      continue;

    const header = readSessionHeader(join(SESSIONS_ROOT, String(relPath)));
    if (!header) continue;
    const startedMs = Date.parse(header.timestamp);
    if (sinceMs !== null && startedMs < sinceMs) continue;
    if (untilMs !== null && startedMs > untilMs) continue;
    if (
      args.cwdNeedles.length > 0 &&
      !args.cwdNeedles.some((n) => header.cwd.toLowerCase().includes(n))
    )
      continue;
    if (
      args.sessionPrefix &&
      !header.id.toLowerCase().startsWith(args.sessionPrefix)
    )
      continue;

    const prompts = collectUserPrompts(join(SESSIONS_ROOT, String(relPath)));
    if (
      args.grep &&
      !prompts.some((p) => p.text.toLowerCase().includes(args.grep))
    )
      continue;

    matched.push({
      cwd: header.cwd,
      shortId: header.id.slice(0, 8),
      startedMs,
      prompts,
      windowedPrompts: applyLengthWindow(prompts, args.minChars, args.maxChars),
    });
  }

  matched.sort((a, b) => b.startedMs - a.startedMs);
  return matched;
}

/**
 * Read the first `session` record from a session file, or null if absent.
 */
function readSessionHeader(filePath) {
  const lines = readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    // A truncated final line must not kill the whole scan — skip and keep looking.
    const rec = tryParseJson(line);
    if (!rec) continue;
    if (rec.type === "session") return rec;
    return null;
  }
  return null;
}

/**
 * Collect every user-message text in a session file, in file order.
 */
function collectUserPrompts(filePath) {
  const prompts = [];
  const lines = readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const rec = tryParseJson(line);
    if (!rec) continue;
    if (rec.type !== "message" || !rec.message || rec.message.role !== "user")
      continue;
    const text = extractText(rec.message.content);
    if (text) prompts.push({ tsMs: rec.message.timestamp, text });
  }
  return prompts;
}

/**
 * Keep prompts whose length falls inside [minChars, maxChars]; maxChars 0 disables the upper bound.
 */
function applyLengthWindow(prompts, minChars, maxChars) {
  return prompts.filter((p) => {
    const n = p.text.length;
    return n >= minChars && (maxChars === 0 || n <= maxChars);
  });
}

// ── Rendering ──

/**
 * Print one JSON object per prompt, summary line to stderr.
 */
function renderJsonl(sessions) {
  let total = 0;
  for (const s of sessions) {
    for (const p of s.windowedPrompts) {
      total += 1;
      console.log(
        JSON.stringify({
          session_id: s.shortId,
          cwd: s.cwd,
          timestamp: p.tsMs,
          text: p.text,
        }),
      );
    }
  }
  console.error(`# ${total} prompts across ${sessions.length} sessions`);
}

/**
 * Print prompts as markdown: grouped by project, projects ordered by most
 * recent session, sessions newest first, prompts as blockquotes.
 */
function renderMarkdown(sessions) {
  const byProject = new Map();
  for (const s of sessions) {
    const list = byProject.get(s.cwd) || [];
    list.push(s);
    byProject.set(s.cwd, list);
  }
  const projects = [...byProject.keys()].sort((a, b) => {
    const aMax = Math.max(...byProject.get(a).map((s) => s.startedMs));
    const bMax = Math.max(...byProject.get(b).map((s) => s.startedMs));
    return bMax - aMax;
  });

  const totalPrompts = sessions.reduce(
    (sum, s) => sum + s.windowedPrompts.length,
    0,
  );
  console.log("# Pi prompts dump");
  console.log(
    `_${totalPrompts} prompts across ${sessions.length} sessions, ${projects.length} projects._`,
  );
  console.log();

  for (const project of projects) {
    console.log(`## ${project}`);
    console.log();
    const projectSessions = byProject.get(project);
    for (const s of projectSessions) {
      const plural = s.windowedPrompts.length === 1 ? "prompt" : "prompts";
      console.log(
        `### ${fmtShortTs(s.startedMs)}  ·  \`${s.shortId}\`  ·  ${s.windowedPrompts.length} ${plural}`,
      );
      console.log();
      for (const p of s.windowedPrompts) {
        for (const line of p.text.split("\n")) console.log(`> ${line}`);
        console.log();
      }
    }
  }
}

/**
 * Parse a JSONL line, returning null for blank or malformed input.
 */
function tryParseJson(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

/**
 * Format epoch ms as a local `YYYY-MM-DD HH:MM` string.
 */
function fmtShortTs(ms) {
  return new Date(ms).toLocaleString("sv").slice(0, 16);
}

// ── Self-check ──

/**
 * Assert-based smoke checks for the pure helpers.
 */
function runSelfTest() {
  const now = Date.now();
  assert.ok(
    Math.abs(parseWhen("1h") - (now - 3600000)) < 2000,
    "relative hours",
  );
  assert.ok(
    Math.abs(parseWhen("2w") - (now - 1209600000)) < 2000,
    "relative weeks",
  );
  assert.strictEqual(parseWhen("2026-08-09"), Date.UTC(2026, 7, 9), "ISO date");
  assert.throws(() => parseWhen("soon"), /Invalid date/, "invalid date throws");
  assert.strictEqual(
    isSubagentRelPath("dir--/a.jsonl"),
    false,
    "top-level file",
  );
  assert.strictEqual(
    isSubagentRelPath("dir--/parent/child/run-1/a.jsonl"),
    true,
    "subagent run",
  );
  assert.strictEqual(
    extractText([{ type: "text", text: "a" }, { type: "image" }]),
    "a",
    "text parts",
  );
  assert.strictEqual(extractText("not-a-list"), "", "non-list content");
  console.error("self-test passed");
}

const invokedAsScript =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) {
  try {
    main();
  } catch (err) {
    console.error(String(err.message || err));
    process.exit(1);
  }
}
