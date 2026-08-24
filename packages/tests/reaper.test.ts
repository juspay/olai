/**
 * A cancelled cucumber run leaves no server.
 *
 * The harness used to register only `process.on("exit")`. SIGINT of cucumber
 * skipped AfterAll; SIGKILL never ran `exit` at all; and `detached: true`
 * put each olai in a process group the signal never reached. This file is
 * that property as a unit: a parent that uses {@link installReaper} is
 * signalled, the detached child it started is gone, and the parent itself
 * exits 130 (SIGINT) or 143 (SIGTERM) — which is how a cancelled run ends
 * instead of grinding to AfterAll.
 */

import { expect, test } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";

const REAPER = path.join(import.meta.dirname, "support/reaper.ts");

/** Hang detector only. The waits are the pid line, the parent's exit, and
 *  the child's death; this number tells "never" from "slow". */
const BOUND_MS = 10_000;

const launch = (): {
  readonly parent: ChildProcess;
  readonly said: () => string;
  readonly err: () => string;
  readonly exited: Promise<{
    readonly code: number | null;
    readonly signal: NodeJS.Signals | null;
  }>;
} => {
  const parent = spawn(
    process.execPath,
    [
      "-e",
      `
      import { spawn } from "node:child_process";
      import { installReaper } from ${JSON.stringify(REAPER)};
      const child = spawn("sleep", ["30"], { detached: true, stdio: "ignore" });
      const live = new Set([child]);
      installReaper(live);
      process.stdout.write(String(child.pid) + "\\n");
      setInterval(() => {}, 1 << 30);
      `,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let said = "";
  let err = "";
  parent.stdout?.setEncoding("utf8");
  parent.stderr?.setEncoding("utf8");
  parent.stdout?.on("data", (chunk: string) => {
    said += chunk;
  });
  parent.stderr?.on("data", (chunk: string) => {
    err += chunk;
  });
  const exited = new Promise<{
    readonly code: number | null;
    readonly signal: NodeJS.Signals | null;
  }>((resolve) => {
    parent.once("exit", (code, signal) => resolve({ code, signal }));
  });
  return { parent, said: () => said, err: () => err, exited };
};

/** The pid line, not a poll. Late caller: look once in the box. Early
 *  caller: the `data` event that carries it. {@link BOUND_MS} is only the
 *  hang detector. */
const pidOf = (box: ReturnType<typeof launch>): Promise<number> =>
  new Promise((resolve, reject) => {
    let settled = false;
    const finish = (act: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      act();
    };
    const look = (): void => {
      const n = Number(box.said().trim());
      if (Number.isInteger(n) && n > 0) finish(() => resolve(n));
    };
    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            `parent never said the child pid:\nstdout:\n${box.said()}\nstderr:\n${box.err()}`,
          ),
        ),
      );
    }, BOUND_MS);
    box.parent.stdout?.on("data", look);
    void box.exited.then(() => {
      look();
      finish(() =>
        reject(
          new Error(
            `parent exited before it said the child pid:\nstdout:\n${box.said()}\nstderr:\n${box.err()}`,
          ),
        ),
      );
    });
    look();
  });

/** ESRCH, not a deadline. SIGKILL of the group is sent and then the parent
 *  `process.exit`s; the pid can still be in the table (a zombie, or the
 *  kill not yet scheduled) after the parent's `exit` event. */
const untilGone = (pid: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = (): void => {
      try {
        process.kill(pid, 0);
      } catch {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started >= BOUND_MS) {
        clearInterval(timer);
        reject(
          new Error(`detached child ${pid} still alive after the parent exited`),
        );
      }
    };
    const timer = setInterval(poll, 10);
    poll();
  });

const signaled = async (
  signal: "SIGINT" | "SIGTERM",
  code: number,
): Promise<void> => {
  const box = launch();
  let childPid = 0;
  try {
    childPid = await pidOf(box);
    expect(childPid).toBeGreaterThan(0);
    expect(() => process.kill(childPid, 0)).not.toThrow();
    box.parent.kill(signal);
    const ended = await Promise.race([
      box.exited,
      Bun.sleep(BOUND_MS).then(() => {
        throw new Error(`parent did not exit after ${signal}`);
      }),
    ]);
    expect(ended.code).toBe(code);
    await untilGone(childPid);
  } finally {
    if (box.parent.exitCode === null && box.parent.signalCode === null) {
      box.parent.kill("SIGKILL");
    }
    if (childPid > 0) {
      try {
        process.kill(-childPid, "SIGKILL");
      } catch {
        // already gone, or no such process group
      }
      try {
        process.kill(childPid, "SIGKILL");
      } catch {
        // already gone
      }
    }
  }
};

test(
  "PIN (reaper): SIGINT of the parent kills a detached child",
  async () => {
    await signaled("SIGINT", 130);
  },
  BOUND_MS * 3,
);

test(
  "PIN (reaper): SIGTERM of the parent kills a detached child",
  async () => {
    await signaled("SIGTERM", 143);
  },
  BOUND_MS * 3,
);
