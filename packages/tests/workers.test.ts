/**
 * Pins on how the suite occupies the machine. Each test is a sabotage
 * target: if the default goes back to 1, if two workers share a port
 * band, if a spawned server still sees the host's padi or cache, the
 * named assertion is what goes red.
 */

import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  defaultWorkers,
  freePortIn,
  holdPort,
  isolateEnv,
  PORT_BASE,
  PORTS_PER_WORKER,
  portRange,
  releasePort,
  WORKER_CAP,
  workerCount,
  workerId,
} from "./support/workers.ts";

test("PIN (serial override): CUCUMBER_PARALLEL=1 is one worker, even on a big box", () => {
  expect(workerCount({ CUCUMBER_PARALLEL: "1" }, () => 16)).toBe(1);
});

test("PIN (override): CUCUMBER_PARALLEL is taken as the count", () => {
  expect(workerCount({ CUCUMBER_PARALLEL: "4" }, () => 2)).toBe(4);
});

test("PIN (default): unset derives from availableParallelism, not 1", () => {
  expect(workerCount({}, () => 16)).toBe(WORKER_CAP);
  expect(workerCount({}, () => 16)).not.toBe(1);
});

test("derivation is cores-1, floored at 1, capped at WORKER_CAP", () => {
  expect(defaultWorkers(1)).toBe(1);
  expect(defaultWorkers(2)).toBe(1);
  expect(defaultWorkers(4)).toBe(3);
  expect(defaultWorkers(16)).toBe(WORKER_CAP);
  expect(defaultWorkers(64)).toBe(WORKER_CAP);
});

test("an empty CUCUMBER_PARALLEL is unset, not serial", () => {
  expect(workerCount({ CUCUMBER_PARALLEL: "" }, () => 8)).toBe(WORKER_CAP);
});

test("a non-integer CUCUMBER_PARALLEL is refused, not silently serial", () => {
  expect(() => workerCount({ CUCUMBER_PARALLEL: "no" })).toThrow(/positive integer/);
});

test("PIN (worker id): unset is band 0; Cucumber's CUCUMBER_WORKER_ID is honoured", () => {
  expect(workerId({})).toBe(0);
  expect(workerId({ CUCUMBER_WORKER_ID: "3" })).toBe(3);
});

test("PIN (port bands): two workers' ranges do not overlap", () => {
  const a = portRange(0);
  const b = portRange(1);
  expect(a.hi).toBe(b.lo);
  expect(a.hi - a.lo).toBe(PORTS_PER_WORKER);
  expect(a.lo).toBe(PORT_BASE);
  // A port in B cannot be in A.
  expect(b.lo >= a.hi).toBe(true);
});

test("PIN (port hold): a held port is not handed out as free", async () => {
  const range = portRange(0);
  const port = await freePortIn(range);
  const holder = await holdPort(port);
  try {
    expect(await freePortIn(range)).not.toBe(port);
  } finally {
    await releasePort(holder);
  }
});

test("PIN (profile): cucumber.js asks workerCount(); it does not hardcode 1", () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, "cucumber.js"), "utf8");
  expect(src).toContain('from "./support/parallelism.js"');
  expect(src).toContain("workerCount()");
  expect(src).not.toMatch(/CUCUMBER_PARALLEL\s*\|\|\s*["']1["']/);
});

test("PIN (env): a spawned server does not inherit the host's padi or cache", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-e2e-iso-"));
  try {
    const env = isolateEnv(root, {
      PADI_SOCKET: "/run/user/1000/padi.sock",
      GIT_DIR: "/home/someone/notes/.git",
      GIT_WORK_TREE: "/home/someone/notes",
      XDG_CACHE_HOME: "/tmp/host-cache",
      XDG_STATE_HOME: "/tmp/host-state",
    });
    expect(env.PADI_SOCKET).toBeUndefined();
    expect(env.GIT_DIR).toBeUndefined();
    expect(env.GIT_WORK_TREE).toBeUndefined();
    expect(env.XDG_CACHE_HOME).toBe(path.join(root, "cache"));
    expect(env.XDG_CACHE_HOME).not.toBe("/tmp/host-cache");
    expect(fs.existsSync(env.XDG_CACHE_HOME!)).toBe(true);
    // The same treatment for STATE, which is where the chat panel's own note
    // of which conversation it was in lands: a scenario's server must read
    // back what its own earlier boot wrote, and never the developer's.
    expect(env.XDG_STATE_HOME).toBe(path.join(root, "state"));
    expect(env.XDG_STATE_HOME).not.toBe("/tmp/host-state");
    expect(fs.existsSync(env.XDG_STATE_HOME!)).toBe(true);
    // HOME stays the host's: overriding it emptied apply inverse.
    expect(env.HOME).toBe(process.env.HOME);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
