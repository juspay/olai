import { writeFixturePolicy } from "@olai/bundle/testlib";
import { FAKES_ROSTER } from "@olai/bundle/e2e-fakes";
import type { Fake } from "./fake.ts";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { installReaper, killProcessGroup, reap } from "./reaper.ts";

import { After, AfterAll, AfterStep, Before, BeforeAll, Status } from "@cucumber/cucumber";
import { findLogfmt } from "@olai/log/testlib";

import { chromium } from "playwright";
import type { Browser } from "playwright";

import { ALERTS, recordAlerts } from "./alerts.ts";
import { BROWSER_ARGS } from "./browser.ts";
import { LAN_RESOLVER_ARG } from "./lan.ts";
import { type LivePadi, startPadi } from "olai-plugin-kolu/appliance/testlib";
import { type LiveOdu, startOduService } from "olai-plugin-odu/appliance/testlib";
import { DOOR as MAIL_DOOR, DOORS as MAIL_DOOR_NAMES, DOOR_VALUES, startFakeGoogle, startFakeHimalaya } from "olai-plugin-mail/appliance/testlib";
import { ILLEGIBLE_PX, PAINTS, recordPaints, WAITING } from "./paints.ts";
import {
  alreadyShared,
  DEFAULT_CORPUS,
  filesOf,
  requestOf,
  restartGate,
  restoreShared,
  unrestoredError,
} from "./scratch.ts";
import {
  AFTER_SHARE_TIMEOUT,
  SCENARIO_SETUP_TIMEOUT,
  SERVER_START_TIMEOUT,
} from "./world.ts";
import type { GitMode } from "./world.ts";
import type { OlaiWorld } from "./world.ts";
import { FAST_NODE_IDLE_MS } from "./node_idle.ts";
import { FAST_SLEEP } from "./sleep_fast.ts";
import {
  holdPort,
  isolateEnv,
  MAIL_HIMALAYA_OFF,
  NOTHING_LISTENS,
  releasePort,
  spawnFingerprint,
  workerId,
} from "./workers.ts";

const FIXTURES = path.resolve(import.meta.dirname, "..", "fixtures");

const EVIDENCE = process.env["OLAI_E2E_EVIDENCE"] ?? path.join(
  process.env["XDG_STATE_HOME"] ?? path.join(os.homedir(), ".local", "state"),
  "olai", "e2e-evidence",
);

const ATTEMPT = process.env["OLAI_E2E_ATTEMPT"] ?? (() => {
  const named = path.basename(path.resolve(import.meta.dirname, "..", "..", ".."));
  return /^[0-9a-f]{7,40}-\d+-[0-9a-f]+$/.test(named)
    ? named
    : `local-${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
})();

let failingStep: string | undefined;

let failures = 0;


AfterStep(function (this: OlaiWorld, step) {
  if (step.result.status === Status.FAILED) failingStep = step.pickleStep?.text;
});

const keepEvidence = async (world: OlaiWorld, scenario: {
  readonly pickle: { readonly id?: string; readonly name: string; readonly uri: string };
  readonly testCaseStartedId?: string;
  readonly result?: { readonly message?: string };
}): Promise<void> => {
  const name = scenario.pickle.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    || "scenario";
  const worker = process.env["CUCUMBER_WORKER_ID"] ?? "0";
  const feature = path.basename(scenario.pickle.uri).replace(/\.feature$/, "");
  const runs = String(++failures).padStart(3, "0");
  const execution = (scenario.testCaseStartedId ?? scenario.pickle.id ?? "").slice(0, 8);
  const stem = [`${worker}-${runs}`, feature, name, execution].filter((one) => one !== "").join("-");
  const url = (() => { try { return world.page?.url() ?? "no page"; } catch { return "unreadable"; } })();
  const errors = world.errors ?? [];
  const said = [
    `olai-e2e-evidence: scenario ${JSON.stringify(scenario.pickle.name)} (${scenario.pickle.uri})`,
    `olai-e2e-evidence: step ${JSON.stringify(failingStep ?? "unknown")}`,
    `olai-e2e-evidence: url ${url}`,
    `olai-e2e-evidence: page errors ${errors.length}`,
    ...errors.map((one, at) => `olai-e2e-evidence:   [${at}] ${one.replaceAll("\n", " ")}`),
    `olai-e2e-evidence: kept in ${path.join(EVIDENCE, ATTEMPT)}`,
  ];
  const dir = path.join(EVIDENCE, ATTEMPT);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${stem}.txt`), [
      ...said,
      `olai-e2e-evidence: error ${scenario.result?.message ?? "none recorded"}`,
    ].join("\n") + "\n");
  } catch (cause) {
    process.stderr.write(`olai-e2e-evidence: could not write the failure note: ${String(cause)}\n`);
  }
  try {
    const printed = world.serverLog?.text ?? "";
    if (printed !== "") fs.writeFileSync(path.join(dir, `${stem}.server.log`), printed);
  } catch (cause) {
    process.stderr.write(`olai-e2e-evidence: could not write the server log: ${String(cause)}\n`);
  }
  try {
    await world.page?.screenshot({ path: path.join(dir, `${stem}.png`), fullPage: true });
  } catch (cause) {
    process.stderr.write(`olai-e2e-evidence: could not capture the screenshot: ${String(cause)}\n`);
  }
};

const FAKES: ReadonlyArray<Fake> = await Promise.all(
  FAKES_ROSTER.map((row) => row.load().then((module) => module.fake)),
);

const FAKE_OF = (word: string): Fake | undefined =>
  FAKES.find((fake) => fake.word === word);

const DEFAULT_AGENT: Fake | undefined = FAKES.find((fake) => fake.adapter !== undefined);

const fakesOf = (
  tags: ReadonlyArray<{ readonly name: string }>,
): ReadonlyArray<string> => {
  const on = new Set(tags.map((tag) => tag.name));
  return FAKES.flatMap((fake) => [fake.word, ...(fake.variants ?? [])].filter((word) => on.has(`@${word}`)));
};

export const BOX_NAME = "cucumber";

const BROKEN_GIT_DIR = path.resolve(import.meta.dirname, "..", "bin", "broken-git");

const PADI_TAG = /^@padi:([\w-]+)$/;

const ODU_SERVICE_TAG = /^@odu-service:([\w-]+)$/;

const MAIL_HIMALAYA_TAG = /^@mail-himalaya:([\w-]+)$/;
const MAIL_GOOGLE_TAG = /^@mail-google:([\w-]+)$/;

const MAIL_DOORS_TAG = "@mail-doors";

const WIRE_TAG = "@wire";

const ALERTS_TAG = "@alerts";
const ALERTS_DENIED_TAG = "@alerts-denied";

const PAINTS_TAG = "@markdown-paints";

const STORED_TAG = "@agent-stored";


const NO_AGENT_TAG = "@no-agent";

const REMIND_TAG = "@remind-every:";

const GIT_TAG = /^@git:(repo|none|broken)$/;

const POLICY_TAG = /^@policy:git\.(commit|push)=([a-z]+)$/;

const ROWS_TAG = /^@rows:([a-z0-9,-]+)$/;
const ROWS_ON_TAG = /^@rows-on:([a-z0-9,-]+)$/;
const ROWS_OFF_TAG = /^@rows-off:([a-z0-9,-]+)$/;

const AGENT_PATH_TAG = /^@agent-path:(empty)$/;


const AVATAR_TAG = "@avatar-template";
const AVATAR_TEMPLATE = "https://github.com/{login}.png";

const PHONE_TAG = "@phone";
const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  // Chromium honours the shell's `<meta name="viewport">` only under
  // `isMobile`; without it the page is laid out as a 390px-wide desktop.
  isMobile: true,
  hasTouch: true,
} as const;

export const PHONE_WIDTH = PHONE.viewport.width;
export const SHORT_PHONE_HEIGHT = 400;
export const DESKTOP = { viewport: { width: 1440, height: 900 } } as const;

const ZONE_TAG = "@zone:";

let browser: Browser | undefined;

interface RunningServer {
  readonly baseUrl: string;
  readonly child?: ChildProcess;
  readonly said: { text: string };
}

const servers = new Map<string, Promise<RunningServer>>();

interface SharedSlot {
  readonly server: RunningServer & { readonly root: string };
  readonly origin: Map<string, string>;
  readonly fixture: string;
  readonly seenPickles: Set<string>;
}

const sharedScratches = new Map<string, Promise<SharedSlot>>();

let spawned = 0;

/** Every child spawned and not yet seen exit. `process.on("exit")` runs no
 *  microtasks, so only a synchronous reader of this set can act on it there. */
const live = new Set<ChildProcess>();

let stopped = false;

let workerState: string | undefined;

const workerStateRoot = (): string =>
  (workerState ??= fs.mkdtempSync(
    path.join(os.tmpdir(), `olai-e2e-w${workerId()}-`),
  ));

const corpusHome = (corpus: string): string =>
  path.join(workerStateRoot(), corpus);

const copiedCorpora = new Set<string>();
const workerCopyOf = (corpus: string): string => {
  const root = path.join(corpusHome(corpus), "served");
  if (!copiedCorpora.has(corpus)) {
    fs.cpSync(fixtureDir(corpus), root, { recursive: true });
    writeFixturePolicy(root, { process: { "log-format": "logfmt" } });
    copiedCorpora.add(corpus);
  }
  return root;
};

const scratchState = (root: string): string => `${root}.xdg`;


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
const modeOf = (): Mode => (mode ??= readMode());

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

const killChild = killProcessGroup;

const shuttingDown = (label: string): string =>
  `the run is shutting down; abandoning the server for ${label}`;

const MAX_SPAWN_ATTEMPTS = 3;

const servingUrl = (out: string): string | null =>
  findLogfmt(out, "serving")?.url ?? null;

interface Spawn {
  readonly port?: number;
  readonly stored?: boolean;
  readonly fastNodeIdle?: boolean;
  readonly fastSleep?: boolean;
  readonly sleepOff?: boolean;
  readonly remindEvery?: number;

  readonly fakes: ReadonlyArray<string>;
  readonly agentSearchPath?: string;
  readonly agent?: boolean;
  readonly repo?: boolean;
  readonly commits?: "off" | "manual";
  readonly padiSocket?: string;
  readonly oduOrigin?: string;
  readonly himalaya?: string;
  readonly mailGoogle?: string;
  readonly mailDoors?: boolean;
  readonly git?: GitMode;
  readonly pin?: { readonly commit?: string; readonly push?: string };
  readonly plugins?: string;
  readonly rowsOn?: string;
  readonly rowsOff?: string;

  readonly avatar?: string;
  readonly stateRoot: string;
}

const agentOn = (fake: Fake, spawnOptions: Spawn): boolean =>
  spawnOptions.fakes.includes(fake.word) ||
  (fake === DEFAULT_AGENT && spawnOptions.agent !== false);

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
    const argv = [
      "web",
      dir,
      "--host",
      "127.0.0.1",
      ...(fixedPort === undefined ? [] : ["--port", String(fixedPort)]),

    ];
    const child = spawn(bin, argv, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: isolateEnv(spawnOptions.stateRoot, {
        OLAI_DIE_WITH_PARENT: String(process.pid),
        ...Object.fromEntries(
          FAKES.filter((fake) => fake.adapter !== undefined).map((fake) => [
            fake.adapter!.knob,
            agentOn(fake, spawnOptions) ? fake.adapter!.exe : "",
          ]),
        ),
        OLAI_AGENT_PATH: [
          ...(spawnOptions.agentSearchPath === undefined ? [] : [spawnOptions.agentSearchPath]),
          ...FAKES.filter(
            (fake) => fake.searchPath !== undefined && agentOn(fake, spawnOptions),
          ).map((fake) => fake.searchPath!),
        ].join(path.delimiter),
        PATH: [
          ...(spawnOptions.git === "broken" ? [BROKEN_GIT_DIR] : []),
          ...FAKES.filter((fake) => fake.path !== undefined).map(
            (fake) => fake.path!,
          ),
          process.env.PATH ?? "",
        ].join(path.delimiter),
        ...Object.assign(
          {},
          ...FAKES.filter((fake) => fake.env !== undefined).map((fake) =>
            fake.env!({
              on: agentOn(fake, spawnOptions),
              stored: spawnOptions.stored === true,
              variants: (fake.variants ?? []).filter((variant) => spawnOptions.fakes.includes(variant)),
            })
          ),
        ),
        ...(spawnOptions.padiSocket === undefined
          ? {}
          : { PADI_SOCKET: spawnOptions.padiSocket }),
        ODU_WEB_ORIGIN: spawnOptions.oduOrigin ?? NOTHING_LISTENS,
        [MAIL_DOOR.himalaya]: spawnOptions.himalaya ?? MAIL_HIMALAYA_OFF,
        [MAIL_DOOR.google]: spawnOptions.mailGoogle ?? NOTHING_LISTENS,
        ...(spawnOptions.mailDoors === true
          ? {
              [MAIL_DOOR.client]: DOOR_VALUES.client,
              [MAIL_DOOR.secret]: DOOR_VALUES.secret,
            }
          : {}),

        OLAI_HOSTNAME: BOX_NAME,
      }),
    });
    live.add(child);
    child.once("exit", () => live.delete(child));

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
      child.once("exit", (code, signal) => {
        if (served() === null) {
          lastFailure = `exited early (code ${code}, signal ${signal ?? "none"})`;
          finish(null);
        }
      });
      child.once("error", (cause) => {
        lastFailure = `could not be spawned: ${cause.message}`;
        finish(null);
      });
    });

    if (listening !== null) {
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

export const stopOwnServer = async (world: OlaiWorld): Promise<void> => {
  const refused = restartGate(world.scratchShare);
  if (refused !== undefined) throw refused;
  const child = ownServerOf(world);
  const port = Number(new URL(world.baseUrl).port);
  await reap(child);
  live.delete(child);
  world.ownServer = undefined;
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
    {
      port,
      stored: world.storedSessions,
      fastNodeIdle: world.fastNodeIdle,
      fastSleep: world.fastSleep,
      sleepOff: world.sleepOff,
      remindEvery: world.remindEvery,
      agent: world.hasAgent,
      fakes: world.fakes,
      agentSearchPath: world.agentSearchPath,
      stateRoot: scratchState(world.scratch()),
      ...(world.gitMode === undefined ? {} : { git: world.gitMode }),
      ...(Object.keys(world.gitPolicy).length === 0 ? {} : { pin: world.gitPolicy }),
      ...(world.selectedRows === undefined ? {} : { plugins: world.selectedRows }),
      ...(world.rowsOn === undefined ? {} : { rowsOn: world.rowsOn }),
      ...(world.rowsOff === undefined
        ? {}
        : { rowsOff: world.rowsOff }),
      ...(world.mailHimalaya === undefined
        ? { himalaya: MAIL_HIMALAYA_OFF }
        : { himalaya: world.mailHimalaya.path }),
      ...(world.mailGoogle === undefined
        ? {}
        : { mailGoogle: world.mailGoogle.origin }),
      ...(world.mailDoors ? { mailDoors: true } : {}),
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
  world.serverLog = started.said;
};

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

const serverFor = (corpus: string): Promise<RunningServer> => {
  const cached = servers.get(corpus);
  if (cached) return cached;

  const active = modeOf();
  const root = workerCopyOf(corpus);
  const started =
    active.kind === "reuse"
      ? reusedServer(active.baseUrl, corpus)
      : startServerChild(
          active.bin,
          root,
          `corpus "${corpus}"`,
          { fakes: [], stateRoot: corpusHome(corpus) },
        );

  const entry: Promise<RunningServer> = started.catch((cause: unknown) => {
    if (servers.get(corpus) === entry) servers.delete(corpus);
    throw cause;
  });
  servers.set(corpus, entry);
  return entry;
};

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
    writeFixturePolicy(root, {
      process: { "log-format": "logfmt" },
      commit: spawnOptions.pin?.commit,
      push: spawnOptions.pin?.push, only: spawnOptions.plugins, extra: spawnOptions.rowsOn,
      without: spawnOptions.rowsOff, avatar: spawnOptions.avatar,
      idle: spawnOptions.fastNodeIdle ? FAST_NODE_IDLE_MS : undefined,
      sleep: spawnOptions.fastSleep ? FAST_SLEEP : undefined,
      sleepOff: spawnOptions.sleepOff,
      remindEvery: spawnOptions.remindEvery,
    });
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

const killLive = installReaper(live, () => {
  stopped = true;
});

const forgetShared = async (
  entry: Promise<SharedSlot>,
): Promise<void> => {
  try {
    const slot = await entry;
    await reap(slot.server.child);
    fs.rmSync(slot.server.root, { recursive: true, force: true });
    fs.rmSync(scratchState(slot.server.root), { recursive: true, force: true });
  } catch {
  }
};

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

const slowThisPage = async (world: OlaiWorld): Promise<void> => {
  const asked = process.env.OLAI_TEST_SLOW;
  if (asked === undefined || asked === "") return;
  const rate = Number(asked);
  if (!Number.isFinite(rate) || rate < 1) {
    throw new Error(
      `OLAI_TEST_SLOW is ${JSON.stringify(asked)}; it is the multiplier ` +
        `Chromium slows the renderer by, so it must be a number >= 1 ` +
        `(1 is a browser nobody touched, 20 is the setting that reproduces ` +
        `the scroll-restore race).`,
    );
  }
  if (rate === 1) return;
  const session = await world.context.newCDPSession(world.page);
  await session.send("Emulation.setCPUThrottlingRate", { rate });
};

let fixturesWere: string | null = null;

BeforeAll(async () => {
  modeOf();
  fixturesWere = fixtureStatus();
  browser = await chromium.launch({
    headless: process.env.HEADLESS !== "false",
    args: [...BROWSER_ARGS, LAN_RESOLVER_ARG],
  });
});

AfterAll(async () => {
  await killAll();
  if (browser) await browser.close();
  if (workerState !== undefined) {
    fs.rmSync(workerState, { recursive: true, force: true });
    workerState = undefined;
  }
  console.error(`olai-e2e: worker ${workerId()} spawned ${spawned} servers`);

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

const leaveOtherFeatures = async (uri: string): Promise<void> => {
  const leaving = [...sharedScratches].filter(([key]) => !key.startsWith(`${uri}::`));
  for (const [key] of leaving) sharedScratches.delete(key);
  await Promise.all(leaving.map(([, entry]) => forgetShared(entry)));
};

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
    this.fastNodeIdle = scenario.pickle.tags.some((tag) => tag.name === "@node-idle-fast");
    if (this.fastNodeIdle && asked.mode !== "own") {
      throw new Error(
        "@node-idle-fast changes the server's process lifetime and requires a private " +
          "@scratch:<corpus>; use @own-scratch when the feature shares its scratch.",
      );
    }
    this.fastSleep = scenario.pickle.tags.some((tag) => tag.name === "@sleep-fast");
    if (this.fastSleep && asked.mode !== "own") {
      throw new Error(
        "@sleep-fast shortens the server's sleep spans and requires a private " +
          "@scratch:<corpus>; use @own-scratch when the feature shares its scratch.",
      );
    }
    this.sleepOff = scenario.pickle.tags.some((tag) => tag.name === "@sleep-off");
    if (this.sleepOff && asked.mode !== "own") {
      throw new Error(
        "@sleep-off turns a plugin off in the file before boot and requires a private " +
          "@scratch:<corpus>; use @own-scratch when the feature shares its scratch.",
      );
    }
    const remind = scenario.pickle.tags.find((tag) => tag.name.startsWith(REMIND_TAG));
    this.remindEvery = remind === undefined ? undefined : Number(remind.name.slice(REMIND_TAG.length));
    if (this.remindEvery !== undefined && (!Number.isSafeInteger(this.remindEvery) || this.remindEvery < 0)) {
      throw new Error(`${remind?.name} needs a whole number of messages, like @remind-every:3`);
    }
    if (this.remindEvery !== undefined && asked.mode !== "own") {
      throw new Error(
        `${REMIND_TAG}<n> writes the reminder period into the policy file before boot and requires a private ` +
          "@scratch:<corpus>; use @own-scratch when the feature shares its scratch.",
      );
    }
    this.storedSessions = scenario.pickle.tags.some(
      (tag) => tag.name === STORED_TAG,
    );
    this.hasAgent = !scenario.pickle.tags.some(
      (tag) => tag.name === NO_AGENT_TAG,
    );
    this.voteFakes(fakesOf(scenario.pickle.tags));
    this.padiFleet = scenario.pickle.tags
      .map((tag) => PADI_TAG.exec(tag.name)?.[1])
      .find((fleet): fleet is string => fleet !== undefined);
    this.oduFleet = scenario.pickle.tags
      .map((tag) => ODU_SERVICE_TAG.exec(tag.name)?.[1])
      .find((fleet): fleet is string => fleet !== undefined);
    this.mailHimalayaFleet = scenario.pickle.tags
      .map((tag) => MAIL_HIMALAYA_TAG.exec(tag.name)?.[1])
      .find((name): name is string => name !== undefined);
    this.mailGoogleFleet = scenario.pickle.tags
      .map((tag) => MAIL_GOOGLE_TAG.exec(tag.name)?.[1])
      .find((name): name is string => name !== undefined);
    this.mailDoors = scenario.pickle.tags.some(
      (tag) => tag.name === MAIL_DOORS_TAG,
    );

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
    this.gitPolicy = Object.fromEntries(
      scenario.pickle.tags.flatMap((tag) => {
        const asked = POLICY_TAG.exec(tag.name);
        return asked === null ? [] : [[asked[1]!, asked[2]!] as const];
      }),
    );
    this.selectedRows = scenario.pickle.tags.flatMap((tag) => {
      const asked = ROWS_TAG.exec(tag.name);
      return asked === null ? [] : [asked[1] === "none" ? "" : asked[1]!];
    })[0];
    this.rowsOn = scenario.pickle.tags.flatMap((tag) => {
      const asked = ROWS_ON_TAG.exec(tag.name);
      return asked === null ? [] : [asked[1]!];
    })[0];
    this.rowsOff = scenario.pickle.tags.flatMap((tag) => {
      const asked = ROWS_OFF_TAG.exec(tag.name);
      return asked === null ? [] : [asked[1]!];
    })[0];
    const ownsAgentPath = scenario.pickle.tags.some((tag) =>
      AGENT_PATH_TAG.test(tag.name),
    );
    const pinned = Object.keys(this.gitPolicy).length > 0;
    if (pinned && this.gitMode === undefined) {
      throw new Error(
        "@policy:git. states this server's git policy, so the scenario must say which " +
          "git situation it is in too: add @git:repo (or none/broken).",
      );
    }
    const writes = asked.mode !== "corpus";
    if (this.selectedRows !== undefined && !writes) {
      throw new Error(
        `@rows: decides which rows its server composes, so the scenario must own ` +
          `that server: tag it @scratch:${asked.corpus} rather than @corpus:${asked.corpus}.`,
      );
    }
    if ((this.rowsOn !== undefined || this.rowsOff !== undefined) && !writes) {
      throw new Error(
        `@rows-on: / @rows-off: decide which rows its server composes, so the ` +
          `scenario must own that server: tag it @scratch:${asked.corpus} rather than ` +
          `@corpus:${asked.corpus}.`,
      );
    }
    if (this.gitMode !== undefined && !writes) {
      throw new Error(
        `@git:${this.gitMode} decides what its server commits to, so the scenario must own ` +
          `that server: tag it @scratch:${asked.corpus} rather than @corpus:${asked.corpus}.`,
      );
    }
    if (this.fakes.length > 0 && !writes) {
      throw new Error(
        `an engine tag (${this.fakes.map((word) => `@${word}`).join(", ")}) decides ` +
          `what its server finds, so the scenario must own that server: tag it ` +
          `@scratch:${asked.corpus} rather than @corpus:${asked.corpus}.`,
      );
    }
    if (templated && !writes) {
      throw new Error(
        `${AVATAR_TAG} decides what its server pictures people with, so the ` +
          `scenario must own that server: tag it @scratch:${asked.corpus} ` +
          `rather than @corpus:${asked.corpus}.`,
      );
    }
    if (ownsAgentPath) {
      if (asked.mode !== "own") {
        throw new Error(
          "@agent-path:empty gives a scenario the directory its server looks " +
            `for agents in, and it installs into it mid-scenario, so the copy ` +
            `must be private: tag it @scratch:${asked.corpus} (and @own-scratch ` +
            "when the feature shares its scratch).",
        );
      }
      this.agentSearchPath = fs.mkdtempSync(
        path.join(os.tmpdir(), `olai-agent-path-w${workerId()}-`),
      );
    }

    if (this.padiFleet !== undefined) {
      if (!writes) {
        throw new Error(
          `@padi:${this.padiFleet} points a server at a padi of its own, so the ` +
            "scenario must own that server: tag it @scratch:<corpus> rather than " +
            "@corpus:<corpus>.",
        );
      }
      this.padi = await startPadi(this.padiFleet);
    }

    if (this.oduFleet !== undefined) {
      if (!writes) {
        throw new Error(
          `@odu-service:${this.oduFleet} points a server at an odu of its own, so the ` +
            "scenario must own that server: tag it @scratch:<corpus> rather than " +
            "@corpus:<corpus>.",
        );
      }
      this.odu = await startOduService(this.oduFleet);
    }

    if (this.mailHimalayaFleet !== undefined) {
      if (!writes) {
        throw new Error(
          `@mail-himalaya:${this.mailHimalayaFleet} points a server at a mailbox of its own, ` +
            "so the scenario must own that server: tag it @scratch:<corpus> rather than " +
            "@corpus:<corpus>.",
        );
      }
      this.mailHimalaya = await startFakeHimalaya(this.mailHimalayaFleet);
    }
    if (this.mailGoogleFleet !== undefined) {
      if (!writes) {
        throw new Error(
          `@mail-google:${this.mailGoogleFleet} points a server at a Google of its own, ` +
            "so the scenario must own that server: tag it @scratch:<corpus> rather than " +
            "@corpus:<corpus>.",
        );
      }
      this.mailGoogle = await startFakeGoogle(this.mailGoogleFleet);
    }

    if (writes) {
      const spawnOptions = {
        stored: this.storedSessions,
        fastNodeIdle: this.fastNodeIdle,
        fastSleep: this.fastSleep,
        sleepOff: this.sleepOff,
        remindEvery: this.remindEvery,
        agent: this.hasAgent,
        fakes: this.fakes,
        ...(this.agentSearchPath === undefined
          ? {}
          : { agentSearchPath: this.agentSearchPath }),
        ...(this.padi === undefined ? {} : { padiSocket: this.padi.socket }),
        ...(this.odu === undefined ? {} : { oduOrigin: this.odu.origin }),
        ...(this.mailHimalaya === undefined
          ? { himalaya: "" }
          : { himalaya: this.mailHimalaya.path }),
        ...(this.mailGoogle === undefined
          ? {}
          : { mailGoogle: this.mailGoogle.origin }),
        ...(this.mailDoors ? { mailDoors: true } : {}),
        ...(this.avatarTemplate === undefined
          ? {}
          : { avatar: this.avatarTemplate }),
        ...(this.gitMode === undefined ? {} : { git: this.gitMode }),
        ...(pinned ? { pin: this.gitPolicy } : {}),
        ...(this.selectedRows === undefined ? {} : { plugins: this.selectedRows }),
        ...(this.rowsOn === undefined
          ? {}
          : { rowsOn: this.rowsOn }),
        ...(this.rowsOff === undefined
          ? {}
          : { rowsOff: this.rowsOff }),
      };
      const ownCopy = async (): Promise<void> => {
        const own = await scratchServerFor(asked.corpus, spawnOptions);
        this.baseUrl = own.baseUrl;
        this.served = own.root;
        this.ownServer = own.child;
        this.serverLog = own.said;
      };
      if (asked.mode === "share") {
        await leaveOtherFeatures(scenario.pickle.uri);
        const featureKey = `${scenario.pickle.uri}::${asked.corpus}::${spawnFingerprint(spawnOptions)}`;
        const slot = await sharedScratchFor(featureKey, asked.corpus, spawnOptions);
        if (alreadyShared(slot.seenPickles, scenario.pickle.id)) {
          await ownCopy();
        } else {
          slot.seenPickles.add(scenario.pickle.id);
          this.baseUrl = slot.server.baseUrl;
          this.served = slot.server.root;
          this.ownServer = slot.server.child;
          this.serverLog = slot.server.said;
          this.scratchShare = { key: featureKey };
        }
      } else {
        await ownCopy();
      }
    } else {
      const shared = await serverFor(this.corpus);
      this.baseUrl = shared.baseUrl;
      this.serverLog = shared.said;
    }

    const handheld = scenario.pickle.tags.some((tag) => tag.name === PHONE_TAG);
    const zone = scenario.pickle.tags
      .find((tag) => tag.name.startsWith(ZONE_TAG))
      ?.name.slice(ZONE_TAG.length);
    this.context = await browser.newContext({
      ...(handheld ? PHONE : DESKTOP),
      baseURL: this.baseUrl,
      ...(zone === undefined ? {} : { timezoneId: zone }),
    });
    const granted = scenario.pickle.tags.some((tag) => tag.name === ALERTS_TAG);
    const refused = scenario.pickle.tags.some(
      (tag) => tag.name === ALERTS_DENIED_TAG,
    );
    if (granted || refused) {
      if (granted) {
        await this.context.grantPermissions(["notifications"], {
          origin: this.baseUrl,
        });
      }
      await this.context.addInitScript(recordAlerts, {
        key: ALERTS,
        consent: granted ? ("granted" as const) : ("denied" as const),
      });
    }
    if (scenario.pickle.tags.some((tag) => tag.name === PAINTS_TAG)) {
      await this.context.addInitScript(recordPaints, {
        key: PAINTS,
        illegiblePx: ILLEGIBLE_PX,
        waiting: WAITING,
      });
    }

    this.page = await this.context.newPage();
    await slowThisPage(this);

    this.errors = [];
    this.requests = [];
    this.refused = [];
    this.page.on("request", (request) => {
      this.requests.push(request.url());
    });
    this.page.on("requestfailed", (request) => {
      this.refused.push({
        url: request.url(),
        why: request.failure()?.errorText ?? "no reason given",
      });
    });
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
      this.errors.push(`pageerror: ${error.message}\n${error.stack ?? "(no stack)"}`);
    });
    this.page.on("console", (message) => {
      if (message.type() === "error") {
        this.errors.push(`console.error: ${message.text()}`);
      }
    });
  },
);

After({ timeout: AFTER_SHARE_TIMEOUT }, async function (this: OlaiWorld, scenario) {
  if (scenario.result?.status === Status.FAILED) {
    await keepEvidence(this, scenario).catch((cause: unknown) => {
      process.stderr.write(`olai-e2e-evidence: could not keep this failure's evidence: ${String(cause)}\n`);
    });
  }
  failingStep = undefined;
  if (this.context) await this.context.close();
  await this.closeHeaderProxy();

  if (this.portHold !== undefined) {
    await releasePort(this.portHold);
    this.portHold = undefined;
  }

  this.terminalAgent?.stop();

  this.padi?.stop();
  this.padi = undefined;
  this.odu?.stop();
  this.odu = undefined;
  await this.mailGoogle?.stop();
  this.mailGoogle = undefined;
  await this.mailHimalaya?.stop();
  this.mailHimalaya = undefined;
  const share = this.scratchShare;
  const served = this.served;
  if (share !== undefined && served !== undefined) {
    const slot = await sharedScratches.get(share.key);
    if (slot !== undefined) {
      const left = await restoreShared(
        this.baseUrl,
        served,
        slot.fixture,
        slot.origin,
        SERVER_START_TIMEOUT,
      );
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

  if (this.ownServer) {
    killChild(this.ownServer);
    live.delete(this.ownServer);
  }
  if (this.agentSearchPath !== undefined) {
    fs.rmSync(this.agentSearchPath, { recursive: true, force: true });
    this.agentSearchPath = undefined;
  }
  if (this.served) {
    fs.rmSync(this.served, { recursive: true, force: true });
    fs.rmSync(scratchState(this.served), { recursive: true, force: true });
  }
});

