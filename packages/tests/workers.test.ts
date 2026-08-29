/**
 * Pins on how the suite occupies the machine. Each test is a sabotage
 * target: if the default goes back to 1, if a held restart port is still
 * bindable, if a spawned server still sees the host's padi or cache, the
 * named assertion is what goes red.
 */

import { expect, test } from "bun:test";
import type { EventEmitter } from "node:events";
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

test("PIN (worker id): unset is 0; Cucumber's CUCUMBER_WORKER_ID is honoured", () => {
  expect(workerId({})).toBe(0);
  expect(workerId({ CUCUMBER_WORKER_ID: "3" })).toBe(3);
});

/** `bun-types`' `node:net` is missing EventEmitter's methods — same gap
 *  `workers.ts` names. */
const events = (source: object): EventEmitter =>
  source as unknown as EventEmitter;

/** A free loopback port, borrowed for the length of the hold test. */
const ephemeral = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    events(probe).once("error", reject);
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
      // What is supposed to happen: we are holding it.
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
  const base = { stored: false, agent: true, opencode: false, pi: false, kolu: false };
  expect(spawnFingerprint(base)).toBe(spawnFingerprint({ ...base }));
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, kolu: true }),
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
  // Which AGENTS a server finds decides whether its panel asks which one a
  // conversation is with, so two servers that differ in it are two servers.
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, opencode: true }),
  );
  expect(spawnFingerprint(base)).not.toBe(
    spawnFingerprint({ ...base, pi: true }),
  );
});

// What a server under test trusts for who is looking — and what it pictures
// them with — is the SCENARIO's, never the machine's. A developer with the
// documented avatar template exported would otherwise have handed it to every
// spawned server, and the silhouette scenario would have drawn a GitHub face.
test("PIN (env): the host's identity family never reaches a spawned server", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-e2e-iso-"));
  const was = process.env.OLAI_IDENTITY_AVATAR_TEMPLATE;
  try {
    process.env.OLAI_IDENTITY_AVATAR_TEMPLATE = "https://github.com/{login}.png";
    process.env.OLAI_IDENTITY_LOGIN_HEADER = "X-Somebody-Else";
    expect(isolateEnv(root).OLAI_IDENTITY_AVATAR_TEMPLATE).toBeUndefined();
    expect(isolateEnv(root).OLAI_IDENTITY_LOGIN_HEADER).toBeUndefined();
    // …and what the SPAWN asked for still gets through, which is how
    // `@avatar-template` puts the ladder's second rung in play.
    expect(
      isolateEnv(root, {
        OLAI_IDENTITY_AVATAR_TEMPLATE: "https://example.test/{login}.png",
      }).OLAI_IDENTITY_AVATAR_TEMPLATE,
    ).toBe("https://example.test/{login}.png");
  } finally {
    if (was === undefined) delete process.env.OLAI_IDENTITY_AVATAR_TEMPLATE;
    else process.env.OLAI_IDENTITY_AVATAR_TEMPLATE = was;
    delete process.env.OLAI_IDENTITY_LOGIN_HEADER;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("PIN (env): a spawned server does not inherit the host's padi or cache", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-e2e-iso-"));
  try {
    // The HOST's padi, as a developer running kolu really has it.
    process.env.PADI_SOCKET = "/run/user/1000/padi.sock";
    const env = isolateEnv(root, {
      OLAI_PORT_FILE: "/tmp/olai-dev/url",
      GIT_DIR: "/home/someone/notes/.git",
      GIT_WORK_TREE: "/home/someone/notes",
      XDG_CACHE_HOME: "/tmp/host-cache",
      XDG_STATE_HOME: "/tmp/host-state",
    });
    // SCRUBBED, so a developer running kolu does not hand every spawned server
    // their own live padi — the scenario that says a laptop without kolu draws
    // hollow terminal chips would otherwise draw their actual terminals.
    expect(env.PADI_SOCKET).toBeUndefined();
    // ...and what the SPAWN asked for still gets through, which is how
    // `@padi:<fleet>` points a server at the padi the scenario just started.
    // The same pair as the avatar template above, one variable over: the HOST's
    // copy is taken off before the extras go on, so neither wins by accident.
    expect(
      isolateEnv(root, { PADI_SOCKET: "/tmp/scenario/padi.sock" }).PADI_SOCKET,
    ).toBe("/tmp/scenario/padi.sock");
    expect(env.OLAI_PORT_FILE).toBeUndefined();
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
    // And RUNTIME, which is where the one-brain lock lands. A spawn that
    // inherited the host's `/run/user/…/olai` is how 151k leftover `.lock`
    // files accumulated there.
    expect(env.XDG_RUNTIME_DIR).toBe(path.join(root, "runtime"));
    expect(env.XDG_RUNTIME_DIR).not.toBe(process.env.XDG_RUNTIME_DIR);
    expect(fs.existsSync(env.XDG_RUNTIME_DIR!)).toBe(true);
    // HOME stays the host's: overriding it emptied apply inverse.
    expect(env.HOME).toBe(process.env.HOME);
  } finally {
    delete process.env.PADI_SOCKET;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
