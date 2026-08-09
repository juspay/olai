/**
 * Lifecycle: one browser for the whole run, one server per fixture corpus, one
 * fresh context and page per scenario.
 *
 * The one structural decision here is the CORPUS. A scenario says which
 * directory of fixture outlines it wants served with a `@corpus:<name>` tag,
 * and the matching server is started the first time some scenario asks for it
 * and then kept for the rest of the run. That is what lets the error-view
 * features exist at all: a server that has loaded a broken set cannot also be
 * serving a good one, and starting a server per SCENARIO would pay a process
 * spawn for every step file in the suite. Lazy plus cached gives one spawn per
 * corpus actually exercised — a run of `features/see_the_outline.feature`
 * never boots the broken servers.
 */

import { spawn, type ChildProcess } from "node:child_process";
import type { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";

import { After, AfterAll, Before, BeforeAll, Status } from "@cucumber/cucumber";
import { chromium } from "playwright";
import type { Browser } from "playwright";

import { SCENARIO_SETUP_TIMEOUT, SERVER_START_TIMEOUT } from "./world.ts";
import type { OlaiWorld } from "./world.ts";

/** Chromium under Nix, in a container, on a CI runner with no display and a
 *  64 MB `/dev/shm`. Every flag is load-bearing there and harmless locally, so
 *  the same argv is used everywhere rather than branching on `CI`: a browser
 *  configured differently in CI than on a laptop is a class of bug that only
 *  ever reproduces where it is hardest to debug. */
const ciArgs = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--headless=new",
];

const FIXTURES = path.resolve(import.meta.dirname, "..", "fixtures");
const REPORTS = path.resolve(import.meta.dirname, "..", "reports");

/** The corpus a scenario gets when it names none. */
const DEFAULT_CORPUS = "good";
const CORPUS_TAG = /^@corpus:([A-Za-z0-9_-]+)$/;

let browser: Browser | undefined;

interface RunningServer {
  readonly baseUrl: string;
  readonly child?: ChildProcess;
}

/** corpus → its server. Populated lazily by `serverFor`, drained by `killAll`. */
const servers = new Map<string, RunningServer>();
/** In-flight starts, so two scenarios asking for the same corpus at once (a
 *  `--parallel` run) share one spawn instead of racing two onto one port. */
const starting = new Map<string, Promise<RunningServer>>();

// ── the server under test ──────────────────────────────────────────────

/** `OLAI_SERVER` is either an http URL — reuse a server someone else is
 *  running, the `just dev` loop — or the path to the `olai` executable, which
 *  the harness spawns per corpus. */
const olaiServer = (): string => {
  const value = process.env.OLAI_SERVER;
  if (!value) {
    throw new Error(
      "OLAI_SERVER must be set: either an http:// URL of an already-running " +
        "server, or the path to the olai executable (spawned as " +
        "`<bin> web <dir> --port <port> --host 127.0.0.1`).",
    );
  }
  return value;
};

const isReusedServer = (): boolean => olaiServer().startsWith("http");

/** `bun-types`' `node:net` and `node:child_process` declarations do not carry
 *  EventEmitter's methods, although the objects have them at runtime — a gap in
 *  the types, not in the behaviour (`node:stream`'s do, which is why the pipes
 *  below need no help). One narrowing, named and in one place, beats an `any`
 *  at each call site; when a later bun-types closes the gap, deleting this
 *  function and its callers' wrappers is the whole migration. */
const events = (source: object): EventEmitter =>
  source as unknown as EventEmitter;

/** A port nothing is listening on right now. Racy by construction — the
 *  kernel can hand the same port to something else between the close and the
 *  spawn — so `startServerChild` retries on a fresh one rather than trusting
 *  this. */
const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    events(probe).on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close();
        reject(new Error("could not read a port from the probe socket"));
        return;
      }
      const { port } = address;
      probe.close(() => resolve(port));
    });
  });

const fixtureDir = (corpus: string): string => {
  const dir = path.join(FIXTURES, corpus);
  if (!fs.existsSync(dir)) {
    const available = fs.existsSync(FIXTURES)
      ? fs.readdirSync(FIXTURES).join(", ")
      : "none";
    throw new Error(
      `no fixture corpus named "${corpus}" (looked in ${dir}); available: ${available}. ` +
        `A scenario selects one with a @corpus:<name> tag.`,
    );
  }
  return dir;
};

const MAX_SPAWN_ATTEMPTS = 3;

/** Spawn the server against one fixture directory and wait until it says it is
 *  listening. The contract is the printed URL, not a sleep and not a health
 *  poll: the server prints `http://127.0.0.1:<port>` on stdout once bound, so
 *  that line is both the readiness signal and the address. */
const startServerChild = async (corpus: string): Promise<RunningServer> => {
  const bin = olaiServer();
  const dir = fixtureDir(corpus);
  let lastFailure = "";

  for (let attempt = 1; attempt <= MAX_SPAWN_ATTEMPTS; attempt++) {
    const port = await freePort();
    const expected = `http://127.0.0.1:${port}`;
    const argv = ["web", dir, "--port", String(port), "--host", "127.0.0.1"];
    const child = spawn(bin, argv, { stdio: ["ignore", "pipe", "pipe"] });

    // Buffer both streams whole. stdout because the listening line can arrive
    // split across chunks; stderr because it is the only thing worth printing
    // when the wait times out, and a server that dies at boot says why THERE.
    let out = "";
    let err = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      out += chunk;
      if (process.env.OLAI_TEST_VERBOSE) process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk: string) => {
      err += chunk;
      if (process.env.OLAI_TEST_VERBOSE) process.stderr.write(chunk);
    });

    const listening = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timer);
        resolve(ok);
      };
      const poll = setInterval(() => {
        if (out.includes(expected)) finish(true);
      }, 50);
      const timer = setTimeout(() => finish(false), SERVER_START_TIMEOUT);
      events(child).once(
        "exit",
        (code: number | null, signal: string | null) => {
          // A child that exited without printing the line never will.
          if (!out.includes(expected)) {
            lastFailure = `exited early (code ${code}, signal ${signal ?? "none"})`;
            finish(false);
          }
        },
      );
      events(child).once("error", (cause: Error) => {
        lastFailure = `could not be spawned: ${cause.message}`;
        finish(false);
      });
    });

    if (listening) {
      child.stdout?.removeAllListeners("data");
      child.stderr?.removeAllListeners("data");
      child.stdout?.resume();
      child.stderr?.resume();
      return { baseUrl: expected, child };
    }

    child.kill("SIGKILL");
    if (!lastFailure) {
      lastFailure = `never printed "${expected}" within ${SERVER_START_TIMEOUT}ms`;
    }
    // Quote the child's own diagnostics: a bind race, a missing fixture dir and
    // a crash-on-load all look identical from out here otherwise.
    lastFailure +=
      `\n  argv: ${bin} ${argv.join(" ")}` +
      `\n  stdout: ${out.trim() || "(empty)"}` +
      `\n  stderr: ${err.trim() || "(empty)"}`;
  }

  throw new Error(
    `the olai server for corpus "${corpus}" never came up after ` +
      `${MAX_SPAWN_ATTEMPTS} attempts.\n  ${lastFailure}`,
  );
};

/** The server serving `corpus`, started on first ask and kept for the run. */
const serverFor = async (corpus: string): Promise<RunningServer> => {
  const running = servers.get(corpus);
  if (running) return running;
  const pending = starting.get(corpus);
  if (pending) return pending;

  // Reuse mode: one server, already running, already pointed at one directory.
  // We cannot repoint it, so asking for a different corpus is a mistake worth
  // naming rather than a scenario that mysteriously sees the wrong outlines.
  if (isReusedServer()) {
    const served = process.env.OLAI_CORPUS ?? DEFAULT_CORPUS;
    if (corpus !== served) {
      throw new Error(
        `this scenario needs the "${corpus}" fixture corpus, but OLAI_SERVER is a URL ` +
          `(${olaiServer()}) and a running server serves one directory. Either run it against ` +
          `packages/tests/fixtures/${corpus} and set OLAI_CORPUS=${corpus}, or point OLAI_SERVER ` +
          `at the olai executable so the harness can start a server per corpus.`,
      );
    }
    const reused: RunningServer = { baseUrl: olaiServer() };
    servers.set(corpus, reused);
    return reused;
  }

  const start = startServerChild(corpus).then((server) => {
    servers.set(corpus, server);
    starting.delete(corpus);
    return server;
  });
  starting.set(corpus, start);
  return start.catch((cause: unknown) => {
    starting.delete(corpus);
    throw cause;
  });
};

const killAll = (): void => {
  for (const { child } of servers.values()) {
    if (child && child.exitCode === null) child.kill("SIGKILL");
  }
  servers.clear();
};
// A cucumber run killed from the keyboard skips AfterAll; without this, every
// interrupted run leaks a server holding a port.
process.on("exit", killAll);

// ── hooks ──────────────────────────────────────────────────────────────

BeforeAll(async () => {
  // Fail here rather than in the first scenario: a missing OLAI_SERVER is a
  // setup mistake, and reporting it once beats reporting it per scenario.
  olaiServer();
  browser = await chromium.launch({
    headless: process.env.HEADLESS !== "false",
    args: ciArgs,
  });
});

AfterAll(async () => {
  if (browser) await browser.close();
  killAll();
});

/** The corpus a scenario asked for, or the default. */
const corpusOf = (tags: ReadonlyArray<{ readonly name: string }>): string => {
  const named = tags
    .map((tag) => CORPUS_TAG.exec(tag.name)?.[1])
    .filter((name): name is string => name !== undefined);
  if (named.length > 1) {
    throw new Error(
      `a scenario may serve one corpus; this one asks for ${named.join(", ")}`,
    );
  }
  return named[0] ?? DEFAULT_CORPUS;
};

Before(
  { timeout: SCENARIO_SETUP_TIMEOUT },
  async function (this: OlaiWorld, scenario) {
    if (!browser) throw new Error("BeforeAll did not launch a browser");
    this.browser = browser;
    this.corpus = corpusOf(scenario.pickle.tags);
    this.baseUrl = (await serverFor(this.corpus)).baseUrl;

    this.context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      baseURL: this.baseUrl,
    });
    this.page = await this.context.newPage();

    // Collected for the whole scenario, asserted on by whichever step cares.
    this.errors = [];
    this.page.on("pageerror", (error) => {
      this.errors.push(`pageerror: ${error.message}`);
    });
    this.page.on("console", (message) => {
      if (message.type() === "error") {
        this.errors.push(`console.error: ${message.text()}`);
      }
    });
  },
);

After(async function (this: OlaiWorld, scenario) {
  if (scenario.result?.status === Status.FAILED && this.page) {
    const name =
      scenario.pickle.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "scenario";
    const dir = path.join(REPORTS, "screenshots");
    fs.mkdirSync(dir, { recursive: true });
    await this.page
      .screenshot({ path: path.join(dir, `${name}.png`), fullPage: true })
      .catch((cause: unknown) => {
        console.error("could not capture a failure screenshot:", cause);
      });
  }
  // Closing the CONTEXT (not the browser) is what isolates scenarios: storage,
  // cookies and any in-flight WebSocket go with it, so the next scenario's
  // first frame is a genuine cold load.
  if (this.context) await this.context.close();
});
