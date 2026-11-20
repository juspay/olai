import type { ChildProcess } from "node:child_process";

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
  // Node's `exit` does not fire on SIGKILL, and a SIGINT or SIGTERM listener
  // disables Node's default termination, so the run is ended here.
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
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    killProcessGroup(child);
  });
