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
 *
 * A `@scratch:<name>` tag is the other half, and the reason it exists is the
 * live store: those scenarios EDIT the files while the server is watching them.
 * A shared corpus cannot survive that (the next scenario would inherit the
 * edit) and neither can the repository (the fixtures are tracked), so each
 * scratch scenario gets a fresh copy of the named corpus in a temp directory
 * and a server of its very own, both thrown away afterwards. It is the one case
 * where the per-scenario spawn is worth paying for.
 */

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import type { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

import { After, AfterAll, Before, BeforeAll, Status } from "@cucumber/cucumber";
import { findLogfmt } from "@olai/log/testlib";
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

/**
 * The ACP agent every server under test is pointed at.
 *
 * It is the scripted one (`support/fake-acp-agent.ts`), and it is handed to
 * EVERY server rather than only to the chat scenarios, for the same reason the
 * browser flags are not branched on `CI`: a server configured differently for
 * one feature than for another is a class of bug that only reproduces where it
 * is hardest to see. A scenario that never opens the panel is unaffected — the
 * agent is spawned lazily and says nothing.
 *
 * The real Claude adapter is for driving this by hand. It needs a model, a
 * network and an account, and a CI lane can afford none of the three.
 */
const FAKE_AGENT = path.resolve(
  import.meta.dirname,
  "..",
  "agent",
  "fake-acp-agent.ts",
);

/** `@agent-stored`: the fake agent answers `session/list` with two stored
 *  conversations, so the server's boot ADOPTS the most recent one and replays
 *  it. Unset, nothing is stored and boot opens a fresh session — the two boot
 *  paths, chosen by a property of the machine rather than by anything the
 *  client says. */
const STORED_TAG = "@agent-stored";

/** `@no-agent`: this scenario's server is started with NO agent, which is the
 *  one state a person should never reach by following a documented launch path
 *  — every one of them defaults to the pinned adapter. It is reached here the
 *  same way a person would reach it deliberately: `OLAI_ACP_AGENT` set to the
 *  empty string, which survives the packaged binary's `${VAR-…}` wrapper. */
const NO_AGENT_TAG = "@no-agent";

/** `@git`: this scenario's scratch copy is made a git repository with one
 *  commit in it, and its server is started with `--commit=manual` rather than
 *  the harness's usual `--no-commit`. It is what the Commit button needs to
 *  have anything to say, and it is deliberately opt-in: every other scenario
 *  serves a temp directory whose history is nobody's business. */
const GIT_TAG = "@git";

/** `@no-git`: commits are ON for this scenario's server, and its scratch copy
 *  is deliberately NOT a repository. It is the one way to reach the pill's
 *  "no git here" face — a directory olai will never record anything in, which
 *  is the state the always-visible rule exists to make visible. */
const NO_GIT_TAG = "@no-git";

/** The corpus a scenario gets when it names none. */
const DEFAULT_CORPUS = "good";
/** `@corpus:<name>` shares the tracked fixture directory; `@scratch:<name>`
 *  gets a private, writable copy of it. One pattern rather than two, because
 *  they are one question — which corpus, and may I write to it — and two
 *  regexes is how the answer ends up parsed in two places. */
const CORPUS_TAG = /^@(corpus|scratch):([A-Za-z0-9_-]+)$/;

/** The screen a scenario is read on, and the pointer it is read with.
 *
 *  A `@phone` scenario gets a handset: 390×844 CSS pixels (an iPhone 13's, and
 *  the size the mobile scenarios are written against), a touch screen and no
 *  mouse. `isMobile` is what makes Chromium honour the shell's `<meta
 *  name="viewport">` at all — without it the page is laid out as a 390px-wide
 *  DESKTOP, which is a different thing that happens to have the same media
 *  queries fire, and would let a broken viewport tag pass.
 *
 *  Not one of Playwright's `devices` entries: those also install a Safari user
 *  agent on top of Chromium, and a browser lying about which browser it is has
 *  nothing to do with what these scenarios are about. */
const PHONE_TAG = "@phone";
const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
} as const;
/** Everything else: a laptop, with a pointer. */
export const DESKTOP = { viewport: { width: 1440, height: 900 } } as const;

let browser: Browser | undefined;

interface RunningServer {
  readonly baseUrl: string;
  readonly child?: ChildProcess;
}

/** corpus → its server, from the moment the start BEGINS.
 *
 *  One map holding the promise, not two holding "running" and "starting"
 *  separately: with two, a teardown can only drain the one it knows about, so
 *  a run interrupted mid-spawn left an orphan server holding a port. Here
 *  every entry — settled or in flight — is something `killAll` can attach a
 *  kill to. It is also what makes a `--parallel` run share one spawn instead
 *  of racing two onto one port. */
const servers = new Map<string, Promise<RunningServer>>();

/** Every child spawned and not yet seen exit. The promises above are useless
 *  on the hard-exit path — `process.on("exit")` runs no microtasks, so a
 *  `.then` registered there never fires — and this is what that path can act
 *  on synchronously. Not a second cache: nothing looks a corpus up in it. */
const live = new Set<ChildProcess>();

/** Set by the teardown, so a spawn still in flight gives up instead of
 *  retrying its way onto a fresh port after the run is over. */
let stopped = false;

// ── the server under test ──────────────────────────────────────────────

/** WHO owns the server process, and WHERE it is. Two decisions, so two
 *  variables: `OLAI_BIN` names an executable this harness spawns — one server
 *  per corpus, which is what `just e2e` does — and `OLAI_URL` names a server
 *  someone else is already running, reused as it is. One variable carrying
 *  both, discriminated by an `http` prefix, would make the reuse guard below
 *  read as a consequence of how the address was spelled rather than as what it
 *  is: a fact about who owns the process. */
type Mode =
  | { readonly kind: "spawn"; readonly bin: string }
  | { readonly kind: "reuse"; readonly baseUrl: string };

const readMode = (): Mode => {
  const bin = process.env.OLAI_BIN;
  const url = process.env.OLAI_URL;
  if (bin && url) {
    throw new Error(
      `OLAI_BIN (${bin}) and OLAI_URL (${url}) are both set, and they are ` +
        "alternatives: OLAI_BIN spawns a server per fixture corpus, OLAI_URL " +
        "reuses one that is already running. Unset whichever you did not mean.",
    );
  }
  if (bin) return { kind: "spawn", bin };
  if (url) return { kind: "reuse", baseUrl: url };
  throw new Error(
    "neither OLAI_BIN nor OLAI_URL is set. Set OLAI_BIN to the olai " +
      "executable (spawned as `<bin> web <dir> --port <port> --host " +
      "127.0.0.1`, one server per corpus — this is what `just e2e` does), or " +
      "set OLAI_URL to the base URL of a server you are already running.",
  );
};

let mode: Mode | undefined;
/** Read once. The environment cannot change mid-run, and re-deriving it per
 *  scenario would let the same mistake be reported forty times. */
const modeOf = (): Mode => (mode ??= readMode());

/** The olai executable this harness spawns.
 *
 *  For the one caller that launches something OTHER than a server with it: the
 *  external tool surface is a subcommand of the same binary, and a scenario
 *  about a terminal agent has to run the artefact a person would have, not a
 *  script in this tree. A reused server (`OLAI_URL`) is somebody else's
 *  process and says nothing about where its binary is. */
export const olaiBin = (): string => {
  const active = modeOf();
  if (active.kind !== "spawn") {
    throw new Error(
      "this scenario launches the olai binary itself (`olai mcp`), so it needs " +
        `OLAI_BIN — OLAI_URL (${active.baseUrl}) names a running server, not an ` +
        "executable this harness can start.",
    );
  }
  return active.bin;
};

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

const killChild = (child: ChildProcess | undefined): void => {
  if (child && child.exitCode === null) child.kill("SIGKILL");
};

const shuttingDown = (label: string): string =>
  `the run is shutting down; abandoning the server for ${label}`;

const MAX_SPAWN_ATTEMPTS = 3;

/** The address the `serving` line reports, as its own `url=` field. The server
 *  prints the address it ACTUALLY bound, which is not always the one it was
 *  asked for: a port that turns out to be busy is retried on one the OS picks.
 *  So the URL is read out of the line rather than assumed from the argv — the
 *  printed address is the contract, and it is the only thing that knows.
 *
 *  `findLogfmt` rather than a regex of this suite's own: the format belongs to
 *  `@olai/log`, so its decoder does too — and it matches the message EXACTLY,
 *  which matters because the busy-port fallback line carries a `url=` of its
 *  own and a looser match would be a coin toss between the two. */
const servingUrl = (out: string): string | null =>
  findLogfmt(out, "serving")?.url ?? null;

/** Spawn the server against one fixture directory and wait until it says it is
 *  listening. The contract is that line, not a sleep and not a health poll: it
 *  is both the readiness signal and the address.
 *
 *  `fixedPort` is for the ONE caller that cannot take whatever port is free: a
 *  scenario restarting the server under an open page needs the SAME address,
 *  because the page is already pointed at it. There is no retry on that path —
 *  a second attempt would land somewhere else, which is not a slower success
 *  but a different thing entirely, and `startOwnServer` says so out loud. */
/** The knobs a spawned server takes beyond where it looks. An options object
 *  rather than a tail of positionals: three of them are booleans, and a call
 *  site reading `(bin, dir, label, undefined, true)` says nothing. */
interface Spawn {
  /** The one caller that cannot take whatever port is free: a scenario
   *  restarting the server under an open page needs the SAME address. */
  readonly port?: number;
  readonly stored?: boolean;
  /** `false` starts the server with no agent at all. */
  readonly agent?: boolean;
  /** `true` makes the scratch copy a repository — see {@link GIT_TAG}. */
  readonly repo?: boolean;
  /** How the server is told to commit. Two facts rather than one: a directory
   *  that is not a repository with commits ON is a state of its own, and the
   *  pill has a face for it. */
  readonly commits?: "off" | "manual";
}

const startServerChild = async (
  bin: string,
  dir: string,
  label: string,
  spawnOptions: Spawn = {},
): Promise<RunningServer> => {
  const fixedPort = spawnOptions.port;
  let lastFailure = "";
  const attempts = fixedPort === undefined ? MAX_SPAWN_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (stopped) throw new Error(shuttingDown(label));
    const port = fixedPort ?? (await freePort());
    // `--commit=off` unless the scenario said otherwise: a scratch directory is
    // a temp copy, and committing to whatever repository happens to contain the
    // temp dir is not the suite's business. A `@git` scenario made itself one,
    // so there is somewhere safe to commit — and `manual` is what a person
    // gets, which is the thing under test.
    const argv = [
      "web",
      dir,
      "--port",
      String(port),
      "--host",
      "127.0.0.1",
      `--commit=${spawnOptions.commits ?? "off"}`,
    ];
    const child = spawn(bin, argv, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        // The EMPTY string is the explicit off switch, and it is what a person
        // turning chat off would set — so the no-agent scenario reaches that
        // state the same way rather than through a hole in the harness.
        OLAI_ACP_AGENT: spawnOptions.agent === false ? "" : FAKE_AGENT,
        ...(spawnOptions.stored === true ? { OLAI_FAKE_ACP_STORED: "yes" } : {}),
      },
    });
    live.add(child);
    events(child).once("exit", () => live.delete(child));

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

    const listening = await new Promise<string | null>((resolve) => {
      let settled = false;
      const finish = (url: string | null) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timer);
        resolve(url);
      };
      const served = (): string | null => servingUrl(out);
      const poll = setInterval(() => {
        const url = served();
        if (url !== null) finish(url);
      }, 50);
      const timer = setTimeout(() => finish(null), SERVER_START_TIMEOUT);
      events(child).once(
        "exit",
        (code: number | null, signal: string | null) => {
          // A child that exited without printing the line never will.
          if (served() === null) {
            lastFailure = `exited early (code ${code}, signal ${signal ?? "none"})`;
            finish(null);
          }
        },
      );
      events(child).once("error", (cause: Error) => {
        lastFailure = `could not be spawned: ${cause.message}`;
        finish(null);
      });
    });

    if (listening !== null) {
      // The teardown may have run while this was coming up; handing the caller
      // a server nothing will ever kill is the leak this whole shape exists to
      // close.
      if (stopped) {
        killChild(child);
        throw new Error(shuttingDown(label));
      }
      child.stdout?.removeAllListeners("data");
      child.stderr?.removeAllListeners("data");
      child.stdout?.resume();
      child.stderr?.resume();
      return { baseUrl: listening, child };
    }

    killChild(child);
    if (!lastFailure) {
      lastFailure =
        `never printed a "serving" line with a url= field within ${SERVER_START_TIMEOUT}ms`;
    }
    // Quote the child's own diagnostics: a bind race, a missing fixture dir and
    // a crash-on-load all look identical from out here otherwise.
    lastFailure +=
      `\n  argv: ${bin} ${argv.join(" ")}` +
      `\n  stdout: ${out.trim() || "(empty)"}` +
      `\n  stderr: ${err.trim() || "(empty)"}`;
  }

  throw new Error(
    `the olai server for ${label} never came up after ` +
      `${attempts} attempt(s).\n  ${lastFailure}`,
  );
};

// ── restarting the server a scenario owns ──────────────────────────────

/**
 * Stop and start the server a `@scratch:` scenario owns, WITHOUT touching the
 * page in front of it.
 *
 * This is the one thing the suite could not do until now, and its absence is
 * why a tab left holding a replaced server shipped: every scenario had a server
 * that outlived it, so nothing ever asked what an open page does when its
 * server is not the same process any more.
 *
 * The port is the whole difficulty. The page is pointed at an address, so the
 * replacement has to come back on the SAME one — and the server is entitled to
 * fall back to a port the OS picks when the one it was asked for is busy, which
 * would leave the page talking to nothing and the scenario failing for a reason
 * that has nothing to do with what it is testing. So: stop first and WAIT for
 * the process to actually be gone, then bind the exact port, then check the
 * address that came back is the one we started with, and say so plainly if it
 * is not.
 */
export const stopOwnServer = async (world: OlaiWorld): Promise<void> => {
  const child = ownServerOf(world);
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    events(child).once("exit", () => resolve());
    child.kill("SIGKILL");
  });
  live.delete(child);
  world.ownServer = undefined;
};

export const startOwnServer = async (world: OlaiWorld): Promise<void> => {
  if (world.ownServer !== undefined) {
    throw new Error(
      "this scenario's server is still running; stop it before starting it again",
    );
  }
  const active = modeOf();
  if (active.kind !== "spawn") {
    throw new Error(
      "restarting the server needs one this harness owns (OLAI_BIN), not one " +
        `someone else is running (OLAI_URL ${active.baseUrl})`,
    );
  }
  const port = Number(new URL(world.baseUrl).port);
  const started = await startServerChild(
    active.bin,
    world.scratch(),
    `the restarted server for corpus "${world.corpus}"`,
    // The SAME agent configuration as the first boot, because that is the whole
    // claim being tested: a restarted server comes up in the conversation it was
    // last in, which it can only do if its agent still keeps the same sessions.
    { port, stored: world.storedSessions, agent: world.hasAgent },
  );
  if (started.baseUrl !== world.baseUrl) {
    killChild(started.child);
    throw new Error(
      `the restarted server came up on ${started.baseUrl}, not ${world.baseUrl} — ` +
        "something else took the port while it was free, so the open page would " +
        "have been left pointing at nothing",
    );
  }
  world.ownServer = started.child;
  // Keep what it says from here on. A scenario asserts on the rejection line
  // (`message="stale tab rejected" … claimed=…`), which is the server's own record
  // that the stale-tab gate fired — the half of the handshake a browser cannot
  // see. The startup listeners are detached by then, so this attaches its own.
  started.child?.stdout?.on("data", (chunk: string) => {
    world.serverSaid += chunk;
  });
};

/** The server this scenario owns, or the diagnostic for a scenario that has
 *  none. Restarting a SHARED corpus server would take it out from under every
 *  other scenario in the run, so the tag is the gate. */
const ownServerOf = (world: OlaiWorld): ChildProcess => {
  if (world.ownServer === undefined) {
    throw new Error(
      `this scenario restarts the server it is served by, so it must be tagged ` +
        `@scratch:${world.corpus} rather than @corpus:${world.corpus} — the shared ` +
        `corpus servers are running for every other scenario too`,
    );
  }
  return world.ownServer;
};

/** A server someone else is running serves ONE directory, and we cannot
 *  repoint it. So the corpus a scenario asks for has to be the one that server
 *  was pointed at — a plain guard on the reuse path, not a consequence of how
 *  the address was spelled. */
const reusedServer = async (
  baseUrl: string,
  corpus: string,
): Promise<RunningServer> => {
  const served = process.env.OLAI_CORPUS ?? DEFAULT_CORPUS;
  if (corpus !== served) {
    throw new Error(
      `this scenario needs the "${corpus}" fixture corpus, but OLAI_URL (${baseUrl}) ` +
        `names a server serving "${served}" (OLAI_CORPUS), and a running server serves ` +
        `one directory. Either point that server at packages/tests/fixtures/${corpus} and ` +
        `set OLAI_CORPUS=${corpus}, or use OLAI_BIN instead so the harness starts a ` +
        `server per corpus.`,
    );
  }
  return { baseUrl };
};

/** The server serving `corpus`, started on first ask and kept for the run. */
const serverFor = (corpus: string): Promise<RunningServer> => {
  const cached = servers.get(corpus);
  if (cached) return cached;

  const active = modeOf();
  const started =
    active.kind === "reuse"
      ? reusedServer(active.baseUrl, corpus)
      : startServerChild(active.bin, fixtureDir(corpus), `corpus "${corpus}"`, {});

  // A FAILED start is not kept: the next scenario asking for this corpus
  // deserves a real attempt rather than a replay of the same rejection.
  const entry: Promise<RunningServer> = started.catch((cause: unknown) => {
    if (servers.get(corpus) === entry) servers.delete(corpus);
    throw cause;
  });
  servers.set(corpus, entry);
  return entry;
};

/** A private, WRITABLE copy of a corpus, and a server watching it, for the one
 *  scenario that asked. Not in the cache: nothing else may reach it, and it
 *  goes away with the scenario rather than with the run. */
const scratchServerFor = async (
  corpus: string,
  spawnOptions: Spawn,
): Promise<RunningServer & { readonly root: string }> => {
  const active = modeOf();
  if (active.kind === "reuse") {
    throw new Error(
      `this scenario edits the files it is served (@scratch:${corpus}), so it needs a ` +
        `server of its own — but OLAI_URL (${active.baseUrl}) names one that is already ` +
        `running against a directory this harness does not own. Use OLAI_BIN instead.`,
    );
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), `olai-scratch-${corpus}-`));
  try {
    fs.cpSync(fixtureDir(corpus), root, { recursive: true });
    if (spawnOptions.repo === true) initRepo(root);
    const server = await startServerChild(
      active.bin,
      root,
      `scratch copy of corpus "${corpus}"`,
      spawnOptions,
    );
    return { ...server, root };
  } catch (cause) {
    fs.rmSync(root, { recursive: true, force: true });
    throw cause;
  }
};

/** A repository around a scratch copy, with the fixtures already in it — so
 *  what the Commit button has to say afterwards is exactly what the scenario
 *  did and nothing else. Its identity is the suite's, not the machine's:
 *  `--no-verify` is the server's business, but a runner with no `user.email`
 *  configured would otherwise fail the first commit. */
const initRepo = (root: string): void => {
  const git = (...argv: ReadonlyArray<string>) =>
    execFileSync("git", argv, { cwd: root, stdio: "ignore" });
  git("init", "--quiet", "--initial-branch", "main");
  git("config", "user.email", "tests@olai.invalid");
  git("config", "user.name", "olai e2e");
  git("add", "-A");
  git("commit", "--quiet", "-m", "fixtures");
};

/** The synchronous half of the teardown: every child that has a process right
 *  now. This is all `process.on("exit")` can do — it runs no microtasks. */
const killLive = (): void => {
  stopped = true;
  for (const child of live) killChild(child);
  live.clear();
};

/** Kill every server, spawned OR still spawning. A start in flight has no
 *  process to kill yet, so the only way to reach it is to wait for it — which
 *  is why the cache holds promises. */
const killAll = async (): Promise<void> => {
  const pending = [...servers.values()];
  servers.clear();
  killLive();
  await Promise.all(
    pending.map((entry) =>
      entry.then(
        (server) => killChild(server.child),
        () => undefined,
      ),
    ),
  );
};
// A cucumber run killed from the keyboard skips AfterAll; without this, every
// interrupted run leaks a server holding a port.
process.on("exit", killLive);

// ── hooks ──────────────────────────────────────────────────────────────

BeforeAll(async () => {
  // Fail here rather than in the first scenario: an unset (or doubly set)
  // OLAI_BIN/OLAI_URL is a setup mistake, and reporting it once beats
  // reporting it per scenario.
  modeOf();
  browser = await chromium.launch({
    headless: process.env.HEADLESS !== "false",
    args: ciArgs,
  });
});

AfterAll(async () => {
  if (browser) await browser.close();
  await killAll();
});

/** Which corpus a scenario asked for, and whether it wants its own copy. */
const requestOf = (
  tags: ReadonlyArray<{ readonly name: string }>,
): { readonly corpus: string; readonly scratch: boolean } => {
  const named = tags.flatMap((tag) => {
    const asked = CORPUS_TAG.exec(tag.name);
    return asked === null
      ? []
      : [{ corpus: asked[2]!, scratch: asked[1] === "scratch" }];
  });
  if (named.length > 1) {
    throw new Error(
      `a scenario may serve one corpus; this one asks for ${
        named.map((ask) => ask.corpus).join(", ")
      }`,
    );
  }
  return named[0] ?? { corpus: DEFAULT_CORPUS, scratch: false };
};

Before(
  { timeout: SCENARIO_SETUP_TIMEOUT },
  async function (this: OlaiWorld, scenario) {
    if (!browser) throw new Error("BeforeAll did not launch a browser");
    this.browser = browser;
    const asked = requestOf(scenario.pickle.tags);
    this.corpus = asked.corpus;
    this.storedSessions = scenario.pickle.tags.some(
      (tag) => tag.name === STORED_TAG,
    );
    this.hasAgent = !scenario.pickle.tags.some(
      (tag) => tag.name === NO_AGENT_TAG,
    );

    if (asked.scratch) {
      const wantsRepo = scenario.pickle.tags.some((tag) => tag.name === GIT_TAG);
      const commitsOn = wantsRepo ||
        scenario.pickle.tags.some((tag) => tag.name === NO_GIT_TAG);
      const own = await scratchServerFor(asked.corpus, {
        stored: this.storedSessions,
        agent: this.hasAgent,
        repo: wantsRepo,
        commits: commitsOn ? "manual" : "off",
      });
      this.baseUrl = own.baseUrl;
      this.served = own.root;
      this.ownServer = own.child;
    } else {
      this.baseUrl = (await serverFor(this.corpus)).baseUrl;
    }

    const handheld = scenario.pickle.tags.some((tag) => tag.name === PHONE_TAG);
    this.context = await browser.newContext({
      ...(handheld ? PHONE : DESKTOP),
      baseURL: this.baseUrl,
    });
    this.page = await this.context.newPage();

    // Collected for the whole scenario, asserted on by whichever step cares.
    this.errors = [];
    this.requests = [];
    // ONE listener, recording everything: which of those left this server, and
    // which arrived after a step started watching, are both questions asked of
    // the same list afterwards (see `world.offSite` / `world.watchRequests`).
    this.page.on("request", (request) => {
      this.requests.push(request.url());
    });
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

  // A terminal agent is a second process watching the same directory, and it
  // goes first for the same reason the server goes before the directory: it is
  // this scenario's, and nothing should still be reading a tree that is about
  // to be removed.
  this.terminalAgent?.stop();

  // A scratch scenario owns its server and its directory, and both die here —
  // the server first, so nothing is watching the tree while it is removed.
  if (this.ownServer) {
    killChild(this.ownServer);
    live.delete(this.ownServer);
  }
  if (this.served) fs.rmSync(this.served, { recursive: true, force: true });
});
