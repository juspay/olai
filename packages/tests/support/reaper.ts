/**
 * Take a spawned olai, and everything it started, off the box.
 *
 * The child is a process-group leader (`detached: true` at spawn). A kill of
 * the pid alone leaves its ACP agent (and any other grandchild) holding the
 * pipes this worker is still reading — cucumber never prints the summary,
 * odu's log drain hangs, the node is stopped with "output still owed". SIGKILL
 * of the group is what actually ends the worker.
 *
 * `process.on("exit")` is not enough: a cucumber run killed from the keyboard
 * skips AfterAll, and `exit` itself does not fire on SIGKILL of this process.
 * SIGINT and SIGTERM are the cancellations this process can still hear, and
 * they kill the group synchronously so a cancelled run leaves no server. The
 * server itself also dies with its parent (`prctl` in `olai web`) and when its
 * served directory disappears — this module is the harness half of that.
 */

import type { ChildProcess } from "node:child_process";
import type { EventEmitter } from "node:events";

/** `bun-types`' `node:child_process` declarations do not carry EventEmitter's
 *  methods. Same gap `hooks.ts` names; one copy here so this module does not
 *  import the World. */
const events = (source: object): EventEmitter =>
  source as unknown as EventEmitter;

/**
 * SIGKILL of the child's process group, then of the pid if the group is
 * already gone. Idempotent on a process that has exited.
 */
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
      // already gone
    }
  }
};

/**
 * Kill every child in `live` the moment this process is told to stop.
 *
 * `onStop` runs first and is how the spawn loop learns not to retry onto a
 * fresh port after the run is over. Returns the same function so AfterAll
 * can wait on the children after signalling them.
 */
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
  process.on("SIGINT", killLive);
  process.on("SIGTERM", killLive);
  return killLive;
};

/** Signal, then wait until the process is actually gone (or a short bound). */
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
