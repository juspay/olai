/**
 * The child is a process-group leader (`detached: true` at spawn). A kill of
 * the pid alone leaves its ACP agent (and any other grandchild) holding the
 * pipes this worker is still reading, so SIGKILL of the group is what ends it.
 *
 * `process.on("exit")` is not enough: a cucumber run killed from the keyboard
 * skips AfterAll, and `exit` itself does not fire on SIGKILL of this process.
 */

import type { ChildProcess } from "node:child_process";
import type { EventEmitter } from "node:events";

/** `bun-types`' `node:child_process` declarations do not carry EventEmitter's
 *  methods. */
const events = (source: object): EventEmitter =>
  source as unknown as EventEmitter;

export const killProcessGroup = (child: ChildProcess | undefined): void => {
  if (!child || child.exitCode !== null) return;
  child.stdout?.destroy();
  child.stderr?.destroy();
  const pid = child.pid;
  if (pid === undefined) {
    child.kill("SIGKILL");
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
    }
  }
};

export const installReaper = (
  live: Set<ChildProcess>,
  onStop?: () => void,
): (() => void) => {
  const killLive = (): void => {
    onStop?.();
    for (const child of live) killProcessGroup(child);
    live.clear();
  };
  process.on("exit", killLive);
  // A SIGINT/SIGTERM listener disables Node's default termination, so the
  // run has to be ended here after the synchronous kill.
  process.on("SIGINT", () => {
    killLive();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    killLive();
    process.exit(143);
  });
  return killLive;
};

export const reap = (child: ChildProcess | undefined): Promise<void> =>
  new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, 2000);
    events(child).once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    killProcessGroup(child);
  });
