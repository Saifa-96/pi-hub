/**
 * daktilo-lifecycle: start daktilo with the first pi session, stop it with the last.
 *
 * Cross-process refcount in a tmpdir state dir (mkdir-lock for atomicity).
 * Crash self-heal: a leaked daktilo (last pi was SIGKILLed) is detected via
 * stale PID check and adopted by the next pi instead of double-spawning.
 *
 * Binary resolution order: $DAKTILO_BIN → the daktilo binary bundled next to
 * this extension (./daktilo) → PATH. If none exists, no-op silently.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const IS_WIN = process.platform === "win32";
const PKG_BIN = fileURLToPath(new URL(`./daktilo${IS_WIN ? ".exe" : ""}`, import.meta.url));

const STATE_DIR = join(tmpdir(), "pi-daktilo-lifecycle");
const COUNT_FILE = join(STATE_DIR, "count");
const PID_FILE = join(STATE_DIR, "pid");
const LOCK_DIR = join(STATE_DIR, "lock");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBin() {
  const candidates = [process.env.DAKTILO_BIN, PKG_BIN, IS_WIN ? "daktilo.exe" : "daktilo"].filter(Boolean);
  for (const c of candidates) {
    // Absolute/relative candidate: must exist. Bare name: trust PATH, let spawn fail softly.
    if (c.includes("/") && !existsSync(c)) continue;
    return c;
  }
  return null;
}

function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM"; // exists but owned by another user
  }
}

const readCount = () => {
  try {
    return parseInt(readFileSync(COUNT_FILE, "utf8"), 10) || 0;
  } catch {
    return 0;
  }
};

const readPid = () => {
  try {
    return parseInt(readFileSync(PID_FILE, "utf8"), 10) || 0;
  } catch {
    return 0;
  }
};

async function withLock(fn) {
  mkdirSync(STATE_DIR, { recursive: true });
  for (let i = 0; i < 50; i++) {
    try {
      mkdirSync(LOCK_DIR);
      try {
        return await fn();
      } finally {
        rmdirSync(LOCK_DIR);
      }
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      await sleep(20);
    }
  }
}

export default function (pi) {
  pi.on("session_start", () =>
    withLock(() => {
      const n = readCount() + 1;
      writeFileSync(COUNT_FILE, String(n));
      if (n > 1) return; // daktilo already serves other sessions
      if (alive(readPid())) return; // adopt a leaked instance (previous SIGKILL)
      const bin = findBin();
      if (!bin) return; // not installed on this machine — no-op
      const child = spawn(bin, [], { stdio: "ignore", detached: true });
      child.on("error", () => {}); // ENOENT/permission — retried next session
      child.unref();
      if (child.pid) writeFileSync(PID_FILE, String(child.pid));
    }),
  );

  // ponytail: /new, /resume and /reload inside a single pi also fire
  // shutdown→start, so a lone session briefly restarts daktilo on those.
  // Add a delayed-stop timer here if the gap ever becomes noticeable.
  pi.on("session_shutdown", () =>
    withLock(() => {
      const n = Math.max(0, readCount() - 1);
      writeFileSync(COUNT_FILE, String(n));
      if (n > 0) return;
      const pid = readPid();
      rmSync(PID_FILE, { force: true });
      if (alive(pid)) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {}
      }
    }),
  );
}
