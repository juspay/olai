import { expect, test } from "bun:test";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

import {
  defaultWorkers,
  holdPort,
  isolateEnv,
  releasePort,
  spawnFingerprint,
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
  expect(workerCount({}, () => 16)).toBe(4);
  expect(workerCount({}, () => 16)).not.toBe(1);
});

test("derivation: cores-1 at most 4; from 20 cores, one worker per four", () => {
  expect(defaultWorkers(1)).toBe(1);
  expect(defaultWorkers(2)).toBe(1);
  expect(defaultWorkers(4)).toBe(3);
  expect(defaultWorkers(8)).toBe(4);
  expect(defaultWorkers(16)).toBe(4);
  expect(defaultWorkers(19)).toBe(4);
  expect(defaultWorkers(20)).toBe(5);
  expect(defaultWorkers(32)).toBe(WORKER_CAP);
  expect(defaultWorkers(64)).toBe(WORKER_CAP);
});

test("an empty CUCUMBER_PARALLEL is unset, not serial", () => {
  expect(workerCount({ CUCUMBER_PARALLEL: "" }, () => 8)).toBe(4);
});

test("a non-integer CUCUMBER_PARALLEL is refused, not silently serial", () => {
  expect(() => workerCount({ CUCUMBER_PARALLEL: "no" })).toThrow(/positive integer/);
});

test("PIN (worker id): unset is 0; Cucumber's CUCUMBER_WORKER_ID is honoured", () => {
  expect(workerId({})).toBe(0);
  expect(workerId({ CUCUMBER_WORKER_ID: "3" })).toBe(3);
});

const ephemeral = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close();
        reject(new Error("could not read a port from the probe socket"));
        return;
      }
      const port = address.port;
      probe.close(() => resolve(port));
    });
  });

test("PIN (port hold): a held port is not bindable by someone else", async () => {
  const port = await ephemeral();
  const holder = await holdPort(port);
  try {
    let took = false;
    try {
      await releasePort(await holdPort(port));
      took = true;
    } catch {
    }
    expect(took).toBe(false);
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

test("PIN (spawn shape): fingerprints differ when the server would start differently", () => {
  const base = { stored: false, agent: true, fakes: [] as string[] };
  expect(spawnFingerprint(base)).toBe(spawnFingerprint({ ...base }));
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, fakes: ["kolu"] }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, git: "repo" }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, stored: true }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, agent: false }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, fakes: ["opencode"] }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, fakes: ["pi"] }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, fakes: ["omp"] }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, fakes: ["codex"] }),
  );
  expect(spawnFingerprint({ ...base, fakes: ["pi", "omp"] })).toBe(
    spawnFingerprint({ ...base, fakes: ["omp", "pi"] }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, rowsOn: "xyne-spaces" }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, rowsOff: "journal" }),
  );
});

test("PIN (env): a spawned server does not inherit the host's padi or cache", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-e2e-iso-"));
  try {
    process.env.PADI_SOCKET = "/run/user/1000/padi.sock";
    process.env.ODU_WEB_ORIGIN = "127.0.0.1:18440";
    const env = isolateEnv(root, {
      GIT_DIR: "/home/someone/notes/.git",
      GIT_WORK_TREE: "/home/someone/notes",
      XDG_CACHE_HOME: "/tmp/host-cache",
      XDG_STATE_HOME: "/tmp/host-state",
    });
    expect(env.PADI_SOCKET).toBeUndefined();
    expect(
      isolateEnv(root, { PADI_SOCKET: "/tmp/scenario/padi.sock" }).PADI_SOCKET,
    ).toBe("/tmp/scenario/padi.sock");
    expect(env.ODU_WEB_ORIGIN).toBe("http://127.0.0.1:1");
    expect(
      isolateEnv(root, { ODU_WEB_ORIGIN: "http://127.0.0.1:9999" }).ODU_WEB_ORIGIN,
    ).toBe("http://127.0.0.1:9999");
    expect(env.GIT_DIR).toBeUndefined();
    expect(env.GIT_WORK_TREE).toBeUndefined();
    expect(env.XDG_CACHE_HOME).toBe(path.join(root, "cache"));
    expect(env.XDG_CACHE_HOME).not.toBe("/tmp/host-cache");
    expect(fs.existsSync(env.XDG_CACHE_HOME!)).toBe(true);
    expect(env.XDG_STATE_HOME).toBe(path.join(root, "state"));
    expect(env.XDG_STATE_HOME).not.toBe("/tmp/host-state");
    expect(fs.existsSync(env.XDG_STATE_HOME!)).toBe(true);
    expect(env.XDG_RUNTIME_DIR).toBe(path.join(root, "runtime"));
    expect(env.XDG_RUNTIME_DIR).not.toBe(process.env.XDG_RUNTIME_DIR);
    expect(fs.existsSync(env.XDG_RUNTIME_DIR!)).toBe(true);
    expect(env.HOME).toBe(process.env.HOME);
  } finally {
    delete process.env.PADI_SOCKET;
    delete process.env.ODU_WEB_ORIGIN;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
