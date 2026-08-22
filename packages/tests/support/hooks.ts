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
 * edit) and neither can the repository (the fixtures are tracked). By default
 * each scratch scenario gets a fresh copy and a server of its very own, both
 * thrown away afterwards.
 *
 * Features opt into sharing with `@share-scratch` (see `support/scratch.ts`):
 * one copy and one server per feature per worker. After each sharing scenario
 * the tree is restored to the fixture and the server re-reads
 * (`POST /olai/resync`), so overlapping writers share too. A restore that
 * cannot put the tree back fails naming the files. A scenario restore cannot
 * make true (it restarts the server) keeps a private copy with `@own-scratch`.
 * Sharing never crosses workers — the lock is still one olai per directory.
 *
 * WHAT A SHARED SERVER SERVES is a per-WORKER copy of the tracked corpus, never
 * the tracked directory itself, and that is not tidiness. `--parallel` is one
 * process per worker, each with its own `servers` map, so four workers asking
 * for `good` are four olai — and one olai per directory is now enforced by the
 * kernel (`packages/server/src/lock.ts`, "one brain per vault"): the second
 * worker's server would REFUSE to boot and every scenario behind it would fail
 * in its `Before`. A copy per worker is what makes each of those a directory of
 * its own, which is what the lock is asking for and what a parallel harness
 * should have been doing anyway — before this, a scenario that wrote where it
 * should not have was writing into the repository's tracked fixtures.
 */

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import type { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { After, AfterAll, Before, BeforeAll, Status } from "@cucumber/cucumber";
import { findLogfmt } from "@olai/log/testlib";
import { chromium } from "playwright";
import type { Browser } from "playwright";

import { BROWSER_ARGS } from "./browser.ts";
import {
  alreadyShared,
  askResync,
  DEFAULT_CORPUS,
  filesOf,
  leftovers,
  requestOf,
  restartGate,
  restoreTree,
  sameTree,
  unrestoredError,
} from "./scratch.ts";
import { SCENARIO_SETUP_TIMEOUT, SERVER_START_TIMEOUT } from "./world.ts";
import type { GitMode } from "./world.ts";
import type { OlaiWorld } from "./world.ts";
import {
  holdPort,
  isolateEnv,
  releasePort,
  spawnFingerprint,
  workerId,
} from "./workers.ts";

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

/**
 * The directory holding a fake `kolu`, put FIRST on every spawned server's
 * PATH — so whether this host "is running kolu" is a property of the scenario
 * rather than of the laptop the run is on. A developer whose machine really is
 * running one would otherwise get a different suite than a CI lane does.
 *
 * The default that fixture answers with is the unhelpful one (a kolu that
 * reaches no daemon), so a scenario that says nothing about kolu is a scenario
 * whose session gets olai's tool server and nothing else. `@kolu` is what makes
 * it answer.
 */
const FAKE_KOLU_DIR = path.resolve(import.meta.dirname, "..", "agent", "kolu");

/**
 * The directory holding a fake `opencode`, put on a spawned server's
 * `OLAI_AGENT_PATH` when — and only when — a scenario asks for one.
 *
 * WHICH AGENTS A SERVER FINDS IS A PROPERTY OF THE SCENARIO, for the fake
 * kolu's reason and a sharper version of it: the roster decides whether the
 * panel ASKS which agent, so a developer with the real opencode installed would
 * otherwise run a different suite than a CI lane does — one where every chat
 * scenario opens on a picker.
 *
 * It is the agent search path rather than `PATH` because that is the variable
 * olai probes with, and because the default has to be "nothing": every other
 * scenario spawns with `OLAI_AGENT_PATH` set to the EMPTY string, which finds
 * no agent anywhere and leaves the roster as the one `OLAI_ACP_AGENT` names —
 * a roster of one, which is what every olai in the world is running today and
 * the state the rest of this suite is written against.
 */
const FAKE_OPENCODE_DIR = path.resolve(import.meta.dirname, "..", "agent", "opencode");

/**
 * A `git` that is found and cannot work, put FIRST on the PATH of a server a
 * `@git:broken` scenario spawns — same argument as the kolu above: whether git
 * works is a property of the scenario rather than of the machine the run is on,
 * and there is no way to break the real one for one server only.
 */
const BROKEN_GIT_DIR = path.resolve(import.meta.dirname, "..", "bin", "broken-git");

/** `@kolu`: this scenario's host is running kolu, so its session should be
 *  handed kolu's terminals alongside olai's own tools. */
const KOLU_TAG = "@kolu";

/** `@opencode`: this scenario's machine HAS opencode, so its server's roster is
 *  two agents and the panel asks which one a conversation is with. Untagged,
 *  the agent search path is empty and the roster is the scripted Claude-shaped
 *  agent alone — see {@link FAKE_OPENCODE_DIR}. */
const OPENCODE_TAG = "@opencode";

/** `@wire`: this scenario asks what the SERVER SENT rather than what the page
 *  drew, so every websocket frame the tab is delivered is kept for it
 *  (`world.socketFrames`, which says why that is a tag and not the default). */
const WIRE_TAG = "@wire";

/** `@agent-stored`: the fake agent answers `session/list` with two stored
 *  conversations, so the server's boot loads one of them and replays it. Unset,
 *  nothing is stored and boot opens a fresh session — the two boot paths, chosen
 *  by a property of the machine rather than by anything the client says.
 *
 *  WHICH of the two is what several of those scenarios are about: a first boot
 *  has nothing written down and takes the most recent (the fallback, and once
 *  the whole rule), while a restart after one has been PICKED comes back to the
 *  picked one — and to the newest again only once the picked one is gone. */
const STORED_TAG = "@agent-stored";

/** `@no-agent`: this scenario's server is started with NO agent, which is the
 *  one state a person should never reach by following a documented launch path
 *  — every one of them defaults to the pinned adapter. It is reached here the
 *  same way a person would reach it deliberately: `OLAI_ACP_AGENT` set to the
 *  empty string, which survives the packaged binary's `${VAR-…}` wrapper. */
const NO_AGENT_TAG = "@no-agent";

/**
 * `@git:<repo|none|broken>`: this scenario's server COMMITS, and its directory
 * is one of the three things git can make of it — a work tree, no work tree, or
 * a git that fails when it is asked. Everything else runs with `--no-commit`
 * (below), which is a fourth state and the one the header calls `commits off`.
 *
 * A tag rather than a step because it decides how the server is STARTED, and
 * the whole point of the git indicator is that a page knows before anyone
 * writes anything.
 */
const GIT_TAG = /^@git:(repo|none|broken)$/;

/**
 * `@pin:commit=<mode>` / `@pin:push=<mode>`: this scenario's server was started
 * with a git POLICY, so every browser draws those two preference rows read-only
 * with the flag named (`vault-level-settings`).
 *
 * A TAG rather than a step for the reason `@git:` is one: it decides how the
 * server is STARTED, and the whole point of a pin is that a page knows before
 * anybody presses anything. Both may be given; each is independent, which is
 * what lets a scenario pin one row and leave the other live.
 *
 * It requires a `@git:` tag beside it, and the Before hook says so: without one
 * the server is started `--no-commit`, which is `--commit=off` under another
 * name and would quietly win over whatever the tag asked for.
 *
 * A SCENARIO's tag beats its feature's for the same flag, because cucumber
 * hands the feature's tags first and the collection below keeps the last of
 * each key. That is what lets one feature pin a policy for every scenario in it
 * and one scenario in it ask for a different one.
 */
const PIN_TAG = /^@pin:(commit|push)=([a-z]+)$/;

/**
 * `@avatar-template`: this scenario's server was started with an avatar URL
 * TEMPLATE (`OLAI_IDENTITY_AVATAR_TEMPLATE`), which is the second rung of the
 * picture ladder and the answer for a proxy that hands over a username rather
 * than an address — GitHub serves every user's avatar at
 * `https://github.com/<login>.png`, with no API and no token.
 *
 * A TAG rather than a step for the reason `@pin:` is one: it decides how the
 * server is STARTED. The template itself is fixed here rather than spelled in
 * the tag, because a tag is a name and a URL with a `/` in it is not: what a
 * scenario is choosing is "this server has a template", and {@link
 * AVATAR_TEMPLATE} is the documented one.
 *
 * It needs a server of its own (`@scratch:`) — a shared corpus server is
 * running for every other scenario too, so what it pictures people with is
 * not this one's to choose.
 */
const AVATAR_TAG = "@avatar-template";
const AVATAR_TEMPLATE = "https://github.com/{login}.png";

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

/** The handset's own two numbers, for the one scenario that needs LESS room
 *  than the whole screen: a page taller than the viewport, which no fixture
 *  here is at 844 points. The width is the same phone; the height is what a
 *  handset with its keyboard up has left, and a scenario that shrinks to it
 *  says so and checks it (`phone_steps.ts`). Exported rather than re-spelled,
 *  so the two sizes cannot drift into being two different phones. */
export const PHONE_WIDTH = PHONE.viewport.width;
export const SHORT_PHONE_HEIGHT = 400;
/** Everything else: a laptop, with a pointer. */
export const DESKTOP = { viewport: { width: 1440, height: 900 } } as const;

let browser: Browser | undefined;

interface RunningServer {
  readonly baseUrl: string;
  readonly child?: ChildProcess;
  /** Everything this child has printed, for the life of the process.
   *  A box rather than a string so the restart assertion can watch the
   *  same buffer the boot wait already filled — no gap, no second listener. */
  readonly said: { text: string };
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

/**
 * Feature-shared scratch slots, keyed by feature URI + corpus + spawn
 * fingerprint. One map per worker process (see the header). Not folded into
 * `servers`: those are the read-only corpus servers, keyed by corpus name,
 * and a shared scratch of `good` is not the `good` corpus server.
 */
interface SharedSlot {
  readonly server: RunningServer & { readonly root: string };
  /** Content hashes of the fixture this slot was copied from. After restores
   *  to this origin; leftovers against it are a restore that did not take. */
  readonly origin: Map<string, string>;
  readonly fixture: string;
  readonly seenPickles: Set<string>;
}

const sharedScratches = new Map<string, Promise<SharedSlot>>();

/** Successful `startServerChild` returns, for the before/after spawn census. */
let spawned = 0;

/** Every child spawned and not yet seen exit. The promises above are useless
 *  on the hard-exit path — `process.on("exit")` runs no microtasks, so a
 *  `.then` registered there never fires — and this is what that path can act
 *  on synchronously. Not a second cache: nothing looks a corpus up in it. */
const live = new Set<ChildProcess>();

/** Set by the teardown, so a spawn still in flight gives up instead of
 *  retrying its way onto a fresh port after the run is over. */
let stopped = false;

/** Per-worker temp root: one directory per corpus this worker serves, each
 *  holding the copy it serves and the XDG state that server writes. Scratch
 *  servers keep theirs beside the scratch copy; `After` deletes the sibling. */
let workerState: string | undefined;

const workerStateRoot = (): string =>
  (workerState ??= fs.mkdtempSync(
    path.join(os.tmpdir(), `olai-e2e-w${workerId()}-`),
  ));

/** This worker's home for one corpus: `<worker>/<corpus>/served` is the copy
 *  its server reads, and `cache`/`state` are its siblings — beside the served
 *  tree and never inside it, the same rule `scratchState` keeps and for the
 *  same reason. */
const corpusHome = (corpus: string): string =>
  path.join(workerStateRoot(), corpus);

/** A copy of the tracked corpus that belongs to THIS worker, made on the first
 *  ask and kept for the run. See the header: two workers over one directory is
 *  two olai over one vault, which the server refuses. */
const workerCopyOf = (corpus: string): string => {
  const root = path.join(corpusHome(corpus), "served");
  if (!fs.existsSync(root)) {
    fs.cpSync(fixtureDir(corpus), root, { recursive: true });
  }
  return root;
};

/** Beside the scratch copy, never inside it. A `@git:repo` scratch is a
 *  real work tree; XDG/HOME written under it would show up as uncommitted
 *  files and flip the Commit pill from `never` to `waiting`. `After`
 *  deletes the sibling with the tree. */
const scratchState = (root: string): string => `${root}.xdg`;

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
      "executable (spawned as `<bin> web <dir> --host 127.0.0.1`, one " +
      "server per corpus on an OS-assigned port — this is what `just e2e` " +
      "does), or set OLAI_URL to the base URL of a server you are already " +
      "running.",
  );
};

let mode: Mode | undefined;
/** Read once. The environment cannot change mid-run, and re-deriving it per
 *  scenario would let the same mistake be reported forty times. */
const modeOf = (): Mode => (mode ??= readMode());

/** `bun-types`' `node:net` and `node:child_process` declarations do not carry
 *  EventEmitter's methods, although the objects have them at runtime — a gap in
 *  the types, not in the behaviour (`node:stream`'s do, which is why the pipes
 *  below need no help). One narrowing, named and in one place, beats an `any`
 *  at each call site; when a later bun-types closes the gap, deleting this
 *  function and its callers' wrappers is the whole migration. */
const events = (source: object): EventEmitter =>
  source as unknown as EventEmitter;

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

/**
 * Take a spawned olai, and everything it started, off the box.
 *
 * The child is a process-group leader (`detached: true` at spawn). A kill of
 * the pid alone leaves its ACP agent (and any other grandchild) holding the
 * pipes this worker is still reading — cucumber never prints the summary,
 * odu's log drain hangs, the node is stopped with "output still owed". SIGKILL
 * of the group, then destroy the pipes, is what actually ends the worker.
 */
const killChild = (child: ChildProcess | undefined): void => {
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

/** Signal, then wait until the process is actually gone (or a short bound). */
const reap = (child: ChildProcess | undefined): Promise<void> =>
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
    killChild(child);
  });

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
 *  is both the readiness signal and the address. No `--port` unless the caller
 *  pins one: the process default is 0, so two worktrees cannot pick the same
 *  number and cannot squat production.
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
  /** `true` puts a kolu on PATH that a padi answers, which is the whole of
   *  "this host is running kolu". Otherwise the one on PATH reaches no daemon,
   *  which detection must refuse. */
  readonly kolu?: boolean;
  /** `true` puts a fake `opencode` on the agent search path, so this server's
   *  roster is two agents. Otherwise that path is EMPTY and the roster is the
   *  scripted agent alone — see {@link FAKE_OPENCODE_DIR}. */
  readonly opencode?: boolean;
  /** Absent is `--no-commit`, which is what every scenario but the git ones
   *  wants. Present drops the opt-out and says which of the three git
   *  situations this server is being started into. */
  readonly git?: GitMode;
  /** The git POLICY, when the scenario pinned one — see {@link PIN_TAG}. Each
   *  half is absent when that flag was not asked for, because "nobody gave the
   *  flag" is exactly what leaves the preference row live in a browser. */
  readonly pin?: { readonly commit?: string; readonly push?: string };
  /** The avatar URL template this server pictures people with, when the
   *  scenario asked for one — see {@link AVATAR_TAG}. Absent is no template,
   *  which is every other scenario. */
  readonly avatar?: string;
  /** Private XDG cache root this child may write to. Required: a spawn
   *  that inherited the host's would share a cache (and a padi) with every
   *  other worker. HOME is not overridden — see `isolateEnv`. */
  readonly stateRoot: string;
}

const startServerChild = async (
  bin: string,
  dir: string,
  label: string,
  spawnOptions: Spawn,
): Promise<RunningServer> => {
  const fixedPort = spawnOptions.port;
  let lastFailure = "";
  const attempts = fixedPort === undefined ? MAX_SPAWN_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (stopped) throw new Error(shuttingDown(label));
    // `--no-commit` unless the scenario is ABOUT git: a scratch directory is a
    // temp copy, and committing to whatever repository happens to contain the
    // temp dir is not the suite's business. A `@git:` scenario is the exception
    // and owns its own directory, which `scratchServerFor` has already made
    // into whichever of the three situations it asked for.
    const argv = [
      "web",
      dir,
      "--host",
      "127.0.0.1",
      ...(fixedPort === undefined ? [] : ["--port", String(fixedPort)]),
      ...(spawnOptions.git === undefined ? ["--no-commit"] : []),
      // The git POLICY, when the scenario asked for one — see `PIN_TAG`. Each
      // flag is passed only where a value was given, because giving it at all
      // is what freezes that row in every browser.
      ...(spawnOptions.pin?.commit === undefined
        ? []
        : ["--commit", spawnOptions.pin.commit]),
      ...(spawnOptions.pin?.push === undefined
        ? []
        : ["--push", spawnOptions.pin.push]),
    ];
    const child = spawn(bin, argv, {
      stdio: ["ignore", "pipe", "pipe"],
      // Own process group so killChild can SIGKILL the server AND the ACP
      // agent it spawned. Same group as the worker would take cucumber down
      // with the servers.
      detached: true,
      env: isolateEnv(spawnOptions.stateRoot, {
        // The EMPTY string is the explicit off switch, and it is what a person
        // turning chat off would set — so the no-agent scenario reaches that
        // state the same way rather than through a hole in the harness.
        OLAI_ACP_AGENT: spawnOptions.agent === false ? "" : FAKE_AGENT,
        ...(spawnOptions.stored === true ? { OLAI_FAKE_ACP_STORED: "yes" } : {}),
        // WHERE OLAI LOOKS FOR AGENTS, and by default nowhere: the empty
        // string is "look on no path at all", so a developer's own opencode
        // cannot decide a scenario. `@opencode` is what puts one there.
        OLAI_AGENT_PATH: spawnOptions.opencode === true ? FAKE_OPENCODE_DIR : "",
        ...(spawnOptions.opencode === true && spawnOptions.stored === true
          ? { OLAI_FAKE_OPENCODE_STORED: "yes" }
          : {}),
        // FIRST, so a real kolu on the developer's PATH does not decide a
        // scenario. Which one this is, is the tag's business — and the broken
        // git goes ahead of even that, for exactly the same reason.
        PATH: [
          ...(spawnOptions.git === "broken" ? [BROKEN_GIT_DIR] : []),
          FAKE_KOLU_DIR,
          process.env.PATH ?? "",
        ].join(path.delimiter),
        OLAI_FAKE_KOLU: spawnOptions.kolu === true ? "live" : "stale",
        // The avatar template, when the scenario asked for one (`AVATAR_TAG`).
        // Passed only where it was asked for: the variable being SET at all is
        // what puts the second rung of the picture ladder in play.
        ...(spawnOptions.avatar === undefined
          ? {}
          : { OLAI_IDENTITY_AVATAR_TEMPLATE: spawnOptions.avatar }),
        // The harness parses logfmt (`findLogfmt` for the serving line). A
        // developer's `OLAI_LOG=pretty` would make every boot hang on readiness.
        OLAI_LOG: "logfmt",
      }),
    });
    live.add(child);
    events(child).once("exit", () => live.delete(child));

    // Buffer both streams for the LIFE of the child. Detaching after
    // "serving" dropped the stale-tab line when it arrived in the gap
    // before startOwnServer attached its own listener — the restart flake
    // under load. Verbose still streams; the box is what assertions read.
    const said = { text: "" };
    let err = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      said.text += chunk;
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
      const served = (): string | null => servingUrl(said.text);
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
      spawned += 1;
      return { baseUrl: listening, child, said };
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
      `\n  stdout: ${said.text.trim() || "(empty)"}` +
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
  const refused = restartGate(world.scratchShare);
  if (refused !== undefined) throw refused;
  const child = ownServerOf(world);
  const port = Number(new URL(world.baseUrl).port);
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    events(child).once("exit", () => resolve());
    killChild(child);
  });
  live.delete(child);
  world.ownServer = undefined;
  // Bind the port ourselves until startOwnServer releases it, so nothing on
  // the box can take the address during the kill. The hold covers kill →
  // release, not release → the child's listen: startOwnServer lets the hold
  // go and then spawns, and that window is open. A claimed band below the
  // kernel's ephemeral range used to make a `listen(0)` elsewhere unable
  // to land in it; ports are now OS-assigned from that range, and a
  // collision is a hard restart failure (no retry on the fixed-port path).
  // The bet is the width of the ephemeral pool, not a closed window.
  world.portHold = await holdPort(port);
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
  if (world.portHold !== undefined) {
    await releasePort(world.portHold);
    world.portHold = undefined;
  }
  const started = await startServerChild(
    active.bin,
    world.scratch(),
    `the restarted server for corpus "${world.corpus}"`,
    // The SAME agent configuration as the first boot, because that is the whole
    // claim being tested: a restarted server comes up in the conversation it was
    // last in, which it can only do if its agent still keeps the same sessions.
    {
      port,
      stored: world.storedSessions,
      agent: world.hasAgent,
      opencode: world.hasOpencode,
      kolu: world.hasKolu,
      stateRoot: scratchState(world.scratch()),
      ...(world.gitMode === undefined ? {} : { git: world.gitMode }),
      // ... and the same git POLICY, for the same reason: a restart that came
      // back unpinned would hand the open page its preferences back, which is a
      // different server rather than the same one restarted.
      ...(Object.keys(world.gitPin).length === 0 ? {} : { pin: world.gitPin }),
      // ... and the same avatar template, on the same sentence: a restart that
      // came back without it would draw the open page's person off a lower rung.
      ...(world.avatarTemplate === undefined
        ? {}
        : { avatar: world.avatarTemplate }),
    },
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
  // The same box the boot wait already filled. A second listener used to
  // attach here, after the first was torn off — and that is the gap the
  // stale-tab line fell through under load.
  world.serverLog = started.said;
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
  return { baseUrl, said: { text: "" } };
};

/** The server serving `corpus`, started on first ask and kept for the run. */
const serverFor = (corpus: string): Promise<RunningServer> => {
  const cached = servers.get(corpus);
  if (cached) return cached;

  const active = modeOf();
  const started =
    active.kind === "reuse"
      ? reusedServer(active.baseUrl, corpus)
      : startServerChild(
          active.bin,
          workerCopyOf(corpus),
          `corpus "${corpus}"`,
          { stateRoot: corpusHome(corpus) },
        );

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
  spawnOptions: Omit<Spawn, "stateRoot">,
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
    if (spawnOptions.git === "repo") makeRepository(root);
    const server = await startServerChild(
      active.bin,
      root,
      `scratch copy of corpus "${corpus}"`,
      { ...spawnOptions, stateRoot: scratchState(root) },
    );
    return { ...server, root };
  } catch (cause) {
    fs.rmSync(root, { recursive: true, force: true });
    throw cause;
  }
};

/**
 * Turn a scratch copy into a real git repository, the way somebody's notes
 * directory is one: a work tree with an identity and a first commit in it.
 *
 * Real git, and a real repository, because what is being tested is what olai
 * makes of one — a fake would only reproduce what we already believe. Its
 * identity is LOCAL so the run does not depend on the developer's global config
 * and does not touch it.
 */
const makeRepository = (root: string): void => {
  const git = (...argv: ReadonlyArray<string>) => {
    execFileSync("git", argv, { cwd: root, stdio: "ignore" });
  };
  git("init", "--quiet");
  git("config", "user.email", "tests@olai.invalid");
  git("config", "user.name", "olai e2e");
  git("add", "-A");
  git("commit", "--quiet", "--no-verify", "-m", "the corpus, as somebody's notes");
};

/** The synchronous half of the teardown: every child that has a process right
 *  now. This is all `process.on("exit")` can do — it runs no microtasks. */
const killLive = (): void => {
  stopped = true;
  for (const child of live) killChild(child);
  live.clear();
};

const forgetShared = async (
  entry: Promise<SharedSlot>,
): Promise<void> => {
  try {
    const slot = await entry;
    await reap(slot.server.child);
    fs.rmSync(slot.server.root, { recursive: true, force: true });
    fs.rmSync(scratchState(slot.server.root), { recursive: true, force: true });
  } catch {
    // A failed start already cleaned its tree (scratchServerFor); nothing to
    // kill, and re-throwing from teardown would hide the scenario's error.
  }
};

/** Kill every server, spawned OR still spawning. A start in flight has no
 *  process to kill yet, so the only way to reach it is to wait for it — which
 *  is why the cache holds promises. Shared scratches live in a second map
 *  and own their temp trees; those go here too, not in After. */
const killAll = async (): Promise<void> => {
  const pending = [...servers.values()];
  const pendingShared = [...sharedScratches.values()];
  const reaping = [...live];
  servers.clear();
  sharedScratches.clear();
  killLive();
  await Promise.all([
    ...pending.map((entry) =>
      entry.then(
        (server) => reap(server.child),
        () => undefined,
      ),
    ),
    ...pendingShared.map(forgetShared),
    ...reaping.map(reap),
  ]);
};
// A cucumber run killed from the keyboard skips AfterAll; without this, every
// interrupted run leaks a server holding a port.
process.on("exit", killLive);

// ── hooks ──────────────────────────────────────────────────────────────

/**
 * What `git` says about the tracked fixtures — the sweep's two readings, taken
 * before the run and after it.
 *
 * Copies and `world.scratch()` between them make "a scenario wrote into the
 * repository's fixtures" hard to do, and hard is not the same as impossible: a
 * step that joins a raw path, or a future caller of `fixtureDir` that forgets
 * to copy, would put it back and nothing would say so. Silence is the whole
 * failure mode — a dirty fixture is a change to a file the NEXT run reads as
 * its baseline — so the invariant the copies were made to hold is asserted
 * rather than trusted.
 *
 * TWO readings rather than one, because a clean tree is not the invariant.
 * Somebody adding a fixture has uncommitted work under `fixtures/` and their
 * run must not fail for it; what may not happen is a CHANGE across the run.
 *
 * `null` when git cannot answer (no git, not a work tree) — the sweep is a
 * guard, and a guard that cannot read is not a failure of the thing it guards.
 */
const fixtureStatus = (): string | null => {
  try {
    return execFileSync("git", ["status", "--porcelain", "--", FIXTURES], {
      cwd: FIXTURES,
      encoding: "utf8",
    });
  } catch {
    return null;
  }
};

let fixturesWere: string | null = null;

BeforeAll(async () => {
  // Fail here rather than in the first scenario: an unset (or doubly set)
  // OLAI_BIN/OLAI_URL is a setup mistake, and reporting it once beats
  // reporting it per scenario.
  modeOf();
  fixturesWere = fixtureStatus();
  browser = await chromium.launch({
    headless: process.env.HEADLESS !== "false",
    args: [...BROWSER_ARGS],
  });
});

AfterAll(async () => {
  // Servers first: a Chromium still holding sockets to a live olai is a
  // `browser.close()` that never returns, and that is the same hang as a
  // grandchild holding stdio — cucumber never reaches the summary.
  await killAll();
  if (browser) await browser.close();
  if (workerState !== undefined) {
    fs.rmSync(workerState, { recursive: true, force: true });
    workerState = undefined;
  }
  // One line per worker, grep-able, for the before/after spawn census. A
  // sharing feature drops this number; a silent no-op would look like a
  // win on wall time that was just the machine being quieter.
  console.error(`olai-e2e: worker ${workerId()} spawned ${spawned} servers`);

  // LAST, and after the servers are down: a server still running is a server
  // still able to write, and this reading has to be of a tree nobody holds.
  const now = fixtureStatus();
  if (fixturesWere !== null && now !== null && now !== fixturesWere) {
    throw new Error(
      "this run changed the tracked fixtures, which no scenario may do — a " +
        "shared corpus is served from a per-worker COPY and a writing scenario " +
        "owns a scratch copy of its own (support/hooks.ts's header).\n" +
        `  before: ${fixturesWere.trim() || "(clean)"}\n` +
        `  after:  ${now.trim() || "(clean)"}\n` +
        "  Restore them with: git checkout -- packages/tests/fixtures",
    );
  }
});

const sharedScratchFor = (
  key: string,
  corpus: string,
  spawnOptions: Omit<Spawn, "stateRoot">,
): Promise<SharedSlot> => {
  const cached = sharedScratches.get(key);
  if (cached) return cached;
  const fixture = fixtureDir(corpus);
  const started = scratchServerFor(corpus, spawnOptions).then((server) => ({
    server,
    origin: filesOf(fixture),
    fixture,
    seenPickles: new Set<string>(),
  }));
  const entry: Promise<SharedSlot> = started.catch((cause: unknown) => {
    if (sharedScratches.get(key) === entry) sharedScratches.delete(key);
    throw cause;
  });
  sharedScratches.set(key, entry);
  return entry;
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
    this.hasKolu = scenario.pickle.tags.some((tag) => tag.name === KOLU_TAG);
    this.hasOpencode = scenario.pickle.tags.some(
      (tag) => tag.name === OPENCODE_TAG,
    );
    // On the world rather than in a local, because a restart mid-scenario has
    // to reproduce this boot (`startOwnServer`).
    this.avatarTemplate = scenario.pickle.tags.some(
      (tag) => tag.name === AVATAR_TAG,
    )
      ? AVATAR_TEMPLATE
      : undefined;
    const templated = this.avatarTemplate !== undefined;
    this.gitMode = scenario.pickle.tags.flatMap((tag) => {
      const asked = GIT_TAG.exec(tag.name);
      return asked === null ? [] : [asked[1] as GitMode];
    })[0];
    this.gitPin = Object.fromEntries(
      scenario.pickle.tags.flatMap((tag) => {
        const asked = PIN_TAG.exec(tag.name);
        return asked === null ? [] : [[asked[1]!, asked[2]!] as const];
      }),
    );
    const pinned = Object.keys(this.gitPin).length > 0;
    // A pinned server without a `@git:` tag is started `--no-commit`, which is
    // `--commit=off` under another name and would quietly beat whatever the pin
    // asked for. Said here rather than left to an assertion, which would fail
    // about a preference row instead of about the tag.
    if (pinned && this.gitMode === undefined) {
      throw new Error(
        "@pin: states this server's git policy, so the scenario must say which " +
          "git situation it is in too: add @git:repo (or none/broken).",
      );
    }
    // A shared corpus server serves every other scenario too, so whether it
    // commits — and into what — is not this one's to choose. Same rule as
    // `@kolu`, and said here rather than left to an assertion that would fail
    // about a readout instead of about the tag. A feature-shared scratch is
    // still a scratch: this scenario owns the write, even if it shares the
    // process with the rest of its feature.
    const writes = asked.mode !== "corpus";
    if (this.gitMode !== undefined && !writes) {
      throw new Error(
        `@git:${this.gitMode} decides what its server commits to, so the scenario must own ` +
          `that server: tag it @scratch:${asked.corpus} rather than @corpus:${asked.corpus}.`,
      );
    }
    // A shared corpus server is running for every other scenario too, so which
    // kolu it found is not this one's to choose. Said here rather than left to
    // the assertion, which would fail thirty seconds later about the transcript
    // instead of about the tag.
    if (this.hasKolu && !writes) {
      throw new Error(
        `${KOLU_TAG} decides what its server finds on PATH, so the scenario must own that ` +
          `server: tag it @scratch:${asked.corpus} rather than @corpus:${asked.corpus}.`,
      );
    }
    // ... and the same for the roster, for the same reason: which agents a
    // server offers decides whether its panel asks, and a shared corpus server
    // is answering that for every other scenario in the run too.
    if (this.hasOpencode && !writes) {
      throw new Error(
        `${OPENCODE_TAG} decides which agents its server finds, so the scenario must own ` +
          `that server: tag it @scratch:${asked.corpus} rather than @corpus:${asked.corpus}.`,
      );
    }
    // …and the same rule for the avatar template, which is one more thing a
    // shared server would be deciding for every scenario that borrowed it.
    if (templated && !writes) {
      throw new Error(
        `${AVATAR_TAG} decides what its server pictures people with, so the ` +
          `scenario must own that server: tag it @scratch:${asked.corpus} ` +
          `rather than @corpus:${asked.corpus}.`,
      );
    }

    if (writes) {
      const spawnOptions = {
        stored: this.storedSessions,
        agent: this.hasAgent,
        opencode: this.hasOpencode,
        kolu: this.hasKolu,
        ...(this.avatarTemplate === undefined
          ? {}
          : { avatar: this.avatarTemplate }),
        ...(this.gitMode === undefined ? {} : { git: this.gitMode }),
        ...(pinned ? { pin: this.gitPin } : {}),
      };
      const ownCopy = async (): Promise<void> => {
        const own = await scratchServerFor(asked.corpus, spawnOptions);
        this.baseUrl = own.baseUrl;
        this.served = own.root;
        this.ownServer = own.child;
      };
      if (asked.mode === "share") {
        const featureKey = `${scenario.pickle.uri}::${asked.corpus}::${spawnFingerprint(spawnOptions)}`;
        const slot = await sharedScratchFor(featureKey, asked.corpus, spawnOptions);
        // A retry of a sharing scenario would inherit its first attempt's
        // writes; a private copy is a different server, not a flag on this one
        // (CUCUMBER_RETRY, default 0).
        if (alreadyShared(slot.seenPickles, scenario.pickle.id)) {
          await ownCopy();
        } else {
          slot.seenPickles.add(scenario.pickle.id);
          this.baseUrl = slot.server.baseUrl;
          this.served = slot.server.root;
          this.ownServer = slot.server.child;
          this.scratchShare = { key: featureKey };
        }
      } else {
        await ownCopy();
      }
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
    this.refused = [];
    // ONE listener, recording everything: which of those left this server, and
    // which arrived after a step started watching, are both questions asked of
    // the same list afterwards (see `world.offSite` / `world.watchRequests`).
    this.page.on("request", (request) => {
      this.requests.push(request.url());
    });
    // …and a second recording of a different fact: which of them the browser
    // refused to make, and why it said so. A request is recorded above when a
    // document ASKS for it, which is before a content policy has had its say —
    // so the two lists are what tell "asked and was stopped" apart from "asked
    // and was answered" (`world.refused`).
    this.page.on("requestfailed", (request) => {
      this.refused.push({
        url: request.url(),
        why: request.failure()?.errorText ?? "no reason given",
      });
    });
    // …and the OTHER wire, for the scenarios that asked: what the surface
    // delivered down the socket. It makes no requests, so nothing in the two
    // lists above can see it, and "what did the server send this reader" is a
    // question only this can answer (`world.socketCarried`).
    //
    // BY TAG, unlike its neighbours, because unlike them it retains PAYLOADS —
    // every byte of every frame for the life of the scenario, which for a chat
    // or a document is the whole session's traffic in the worker's heap. The
    // two scenarios that ask are worth that; the other seven hundred are not.
    // A scenario that forgot the tag does not quietly assert over nothing: the
    // list stays `undefined` and the step throws.
    //
    // Registered per SOCKET because a tab that reconnects opens another one,
    // and the recording is of the tab.
    //
    // BOTH DIRECTIONS, because the tag arms a recording of the wire and the two
    // halves answer two kinds of claim: what the server chose to SEND this
    // reader (`world.socketCarried`), and how often this tab ASKED
    // (`world.socketAskedSince`) — which is the only place a client that
    // re-subscribes or re-asks per keystroke shows up at all.
    if (scenario.pickle.tags.some((tag) => tag.name === WIRE_TAG)) {
      const frames: string[] = [];
      const asks: string[] = [];
      this.socketFrames = frames;
      this.socketAsks = asks;
      const text = (payload: string | Buffer): string =>
        typeof payload === "string" ? payload : payload.toString("utf8");
      this.page.on("websocket", (socket) => {
        socket.on("framereceived", (frame) => {
          frames.push(text(frame.payload));
        });
        socket.on("framesent", (frame) => {
          asks.push(text(frame.payload));
        });
      });
    }
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
    const worker = process.env.CUCUMBER_WORKER_ID ?? "0";
    await this.page
      .screenshot({
        path: path.join(dir, `${worker}-${name}.png`),
        fullPage: true,
      })
      .catch((cause: unknown) => {
        console.error("could not capture a failure screenshot:", cause);
      });
  }
  // Closing the CONTEXT (not the browser) is what isolates scenarios: storage,
  // cookies and any in-flight WebSocket go with it, so the next scenario's
  // first frame is a genuine cold load.
  if (this.context) await this.context.close();

  if (this.portHold !== undefined) {
    await releasePort(this.portHold);
    this.portHold = undefined;
  }

  // A terminal agent is a second process watching the same directory, and it
  // goes first for the same reason the server goes before the directory: it is
  // this scenario's, and nothing should still be reading a tree that is about
  // to be removed.
  this.terminalAgent?.stop();

  // A feature-shared scratch outlives the scenario: After puts the fixture
  // back under the still-running server and asks it to re-read, so the next
  // scenario starts from the original corpus. Leftovers after that restore
  // are a restore that did not take, not a collision with an earlier writer.
  const share = this.scratchShare;
  const served = this.served;
  if (share !== undefined && served !== undefined) {
    const slot = await sharedScratches.get(share.key);
    if (slot !== undefined && !sameTree(filesOf(served), slot.origin)) {
      restoreTree(served, slot.fixture);
      await askResync(this.baseUrl, SERVER_START_TIMEOUT);
      const left = leftovers(slot.origin, served);
      if (left.length > 0) {
        throw unrestoredError(
          path.basename(scenario.pickle.uri),
          scenario.pickle.name,
          left,
        );
      }
    }
    return;
  }

  // A private scratch owns its server and its directory, and both die here —
  // the server first, so nothing is watching the tree while it is removed.
  if (this.ownServer) {
    killChild(this.ownServer);
    live.delete(this.ownServer);
  }
  if (this.served) {
    fs.rmSync(this.served, { recursive: true, force: true });
    fs.rmSync(scratchState(this.served), { recursive: true, force: true });
  }
});
