/**
 * A cancelled cucumber run leaves no server.
 *
 * The harness used to register only `process.on("exit")`. SIGINT of cucumber
 * skipped AfterAll; SIGKILL never ran `exit` at all; and `detached: true`
 * put each olai in a process group the signal never reached. This file is
 * that property as a unit: a parent that uses {@link installReaper} is
 * SIGINT'd, and the detached child it started is gone.
 */

import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import * as path from "node:path";

const REAPER = path.join(import.meta.dirname, "support/reaper.ts");
const BOUND_MS = 5_000;

test("PIN (reaper): SIGINT of the parent kills a detached child", async () => {
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
      process.on("SIGINT", () => process.exit(130));
      process.stdout.write(String(child.pid) + "\\n");
      setInterval(() => {}, 1 << 30);
      `,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let said = "";
  parent.stdout?.setEncoding("utf8");
  parent.stdout?.on("data", (chunk: string) => {
    said += chunk;
  });
  try {
    const started = Date.now();
    while (said.trim() === "" && Date.now() - started < BOUND_MS) {
      await Bun.sleep(25);
    }
    const childPid = Number(said.trim());
    expect(childPid).toBeGreaterThan(0);
    expect(() => process.kill(childPid, 0)).not.toThrow();
    parent.kill("SIGINT");
    await new Promise<void>((resolve) => {
      parent.once("exit", () => resolve());
      setTimeout(resolve, BOUND_MS);
    });
    expect(() => process.kill(childPid, 0)).toThrow();
  } finally {
    parent.kill("SIGKILL");
  }
}, BOUND_MS * 2);
