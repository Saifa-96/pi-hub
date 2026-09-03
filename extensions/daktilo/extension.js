/**
 * pi-daktilo: start daktilo with the first pi session, stop it with the last.
 *
 * KNOWN LIMIT (verified 2026-09-03, Win11 + Git Bash/Windows Terminal): closing
 * the terminal window hard-kills pi before `session_shutdown` can run. Node only
 * receives the close event (CTRL_CLOSE_EVENT → SIGHUP) when attached to a real
 * console (ConPTY); under mintty it never arrives, and even under ConPTY Windows
 * force-terminates the process ~5s later — async cleanup may be cut off. Result:
 * daktilo is orphaned until the next `session_start` sweep (marker + adoption)
 * or a reboot. No user-mode hook can close this gap; the kernel-level fix would
 * be a named Job Object with KILL_ON_JOB_CLOSE held by every pi process —
 * deliberately not adopted to avoid a native-addon dependency.
 *
 * - Refcount via per-pi-process marker files in a tmpdir state dir; markers of
 *   dead processes are swept on every event, so a SIGKILLed pi self-heals
 *   instead of leaking the count forever.
 * - Single instance enforced by a system-wide process probe (pgrep/tasklist):
 *   a manually started daktilo — or one surviving state-dir loss — is adopted
 *   (and later stopped) rather than duplicated.
 * - ensure-alive on every session_start: a crashed daktilo is restarted, not
 *   just on the 0→1 transition.
 * - mkdir-lock guards cross-process mutation; a lock frozen >2s (crashed owner)
 *   is stolen so the extension cannot brick itself.
 *
 * Binary resolution: $DAKTILO_BIN → ./daktilo[.exe] bundled here → PATH.
 */
import { execFile as execFileCb, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);
const IS_WIN = process.platform === "win32";
const PKG_BIN = fileURLToPath(
  new URL(`./daktilo${IS_WIN ? ".exe" : ""}`, import.meta.url),
);
const EXE = IS_WIN ? "daktilo.exe" : "daktilo";
const STEAL_MS = 2000;

const STATE_DIR = join(tmpdir(), "pi-daktilo-lifecycle");
const SESSIONS_DIR = join(STATE_DIR, "sessions");
const PID_FILE = join(STATE_DIR, "pid");
const LOCK_DIR = join(STATE_DIR, "lock");
const MY_MARKER = join(SESSIONS_DIR, String(process.pid));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const alive = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM"; // exists but owned by another user
  }
};

const readPid = () => {
  try {
    return parseInt(readFileSync(PID_FILE, "utf8"), 10) || 0;
  } catch {
    return 0;
  }
};

function findBin() {
  const candidates = [process.env.DAKTILO_BIN, PKG_BIN, EXE].filter(Boolean);
  for (const c of candidates) {
    // Absolute/relative candidate: must exist. Bare name: trust PATH, let spawn fail softly.
    if (c.includes("/") && !existsSync(c)) continue;
    return c;
  }
  return null;
}

/** Any daktilo process on the machine (exact name match), 0 if none. */
async function probeDaktilo() {
  try {
    if (IS_WIN) {
      const { stdout } = await execFile(
        "tasklist",
        ["/FI", `IMAGENAME eq ${EXE}`, "/FO", "CSV", "/NH"],
        { timeout: 1500 },
      );
      for (const line of stdout.split("\n")) {
        if (line.toLowerCase().includes(EXE)) {
          const pid = parseInt(line.split('","')[1], 10);
          if (pid) return pid;
        }
      }
    } else {
      const { stdout } = await execFile("pgrep", ["-x", "daktilo"], {
        timeout: 1500,
      });
      const pid = parseInt(stdout.trim().split("\n")[0], 10);
      if (pid) return pid;
    }
  } catch {} // no match (exit 1) or probe failure → treat as none
  return 0;
}

/** Remove markers whose pi process died without firing session_shutdown. */
function sweepDeadMarkers() {
  for (const name of readdirSync(SESSIONS_DIR)) {
    const pid = parseInt(name, 10);
    if (pid && pid !== process.pid && !alive(pid)) {
      rmSync(join(SESSIONS_DIR, name), { force: true });
    }
  }
}

const liveSessions = () => readdirSync(SESSIONS_DIR).length;

async function withLock(fn) {
  mkdirSync(STATE_DIR, { recursive: true });
  let held = false;
  for (let i = 0; i < 100 && !held; i++) {
    try {
      mkdirSync(LOCK_DIR);
      held = true;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let stale = false;
      try {
        stale = Date.now() - statSync(LOCK_DIR).mtimeMs > STEAL_MS;
      } catch {
        continue; // lock vanished between mkdir and stat — retry immediately
      }
      if (stale) {
        rmSync(LOCK_DIR, { recursive: true, force: true });
        continue;
      }
      await sleep(30);
    }
  }
  if (!held) throw new Error("pi-daktilo: could not acquire lock");
  try {
    return await fn();
  } finally {
    try {
      rmdirSync(LOCK_DIR);
    } catch {} // stolen back or already removed
  }
}

async function ensureRunning() {
  if (alive(readPid())) return;
  const found = await probeDaktilo(); // adopt a manual/stale instance instead of duplicating
  if (found) {
    writeFileSync(PID_FILE, String(found));
    return;
  }
  const bin = findBin();
  if (!bin) return; // not installed on this machine — no-op
  const child = spawn(bin, [], { stdio: "ignore", detached: true });
  child.on("error", () => {}); // ENOENT/permission — retried next session
  child.unref();
  if (child.pid) writeFileSync(PID_FILE, String(child.pid));
}

export default function (pi) {
  pi.on("session_start", () =>
    withLock(async () => {
      mkdirSync(SESSIONS_DIR, { recursive: true });
      sweepDeadMarkers();
      writeFileSync(MY_MARKER, String(Date.now()));
      await ensureRunning();
    }),
  );

  // Marker is per-process, so /new, /resume and /reload inside one pi
  // (shutdown→start in the same process) leave daktilo untouched.
  pi.on("session_shutdown", () =>
    withLock(() => {
      rmSync(MY_MARKER, { force: true });
      sweepDeadMarkers();
      if (liveSessions() > 0) return;
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
