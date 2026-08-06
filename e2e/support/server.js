// One `olai serve` per scenario: ephemeral port, temp outline, fake agent.
//
// The port is the server's to pick (`--port 0`) and the server's to report —
// the line it prints on stdout is where the harness learns it. Nothing here
// picks a port, so parallel workers and a developer's own `just serve` never
// collide.
//
// THE AGENT IS ALWAYS THE FAKE ONE (olai/tests/integration/fake-acp-agent.rkt,
// a racket script with a shebang, committed executable). `serve` refuses to
// start without an ACP agent, and an e2e suite that spawned a real Claude Code
// would be a suite that costs money and answers differently every run.

import { spawn } from "node:child_process";
import * as path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..", "..");

const FAKE_AGENT = path.join(
  REPO,
  "olai",
  "tests",
  "integration",
  "fake-acp-agent.rkt",
);

// The binary under test: whatever `just build` put on PATH, unless something
// names another one (the packaged ./result/bin/olai, say). Exported because
// the write commands are the same binary — a step that marks a task done
// (world.olai) must not be testing a different build than the server is.
export const OLAI_BIN = process.env.OLAI_BIN || "olai";

// The fake agent's script is keyed on the prompt TEXT (its keyword table is at
// the top of fake-acp-agent.rkt). Which words those are is this module's
// business, like the agent's path: a feature file saying SLOW would be a
// scenario spelling a protocol it does not otherwise know exists.
export const SLOW_PROMPT = "SLOW down and read it all";

// Racket start-up, the agent's own boot, and a slow CI box — generous, since
// this is a "the server never came up" timeout and not a latency budget. It
// has to stay UNDER the Before hook's step timeout (support/hooks.js) or
// cucumber gives up first and the message below, which carries the server's
// own output, never gets to be the failure.
const BOOT_TIMEOUT_MS = 20_000;

const URL_RX = /(http:\/\/[\d.]+:\d+)/;

/** Boot a server on `dir`. Resolves once it says which port it took.
 *
 *  `env` is what this scenario wants the agent to have woken up to — what the
 *  machine had stored, and nothing else. It is a boot-time fact for the same
 *  reason it is one for a real agent: no step can put a conversation in the
 *  past after the panel has already asked what is there. */
export async function startServer(dir, env = {}) {
  const child = spawn(OLAI_BIN, ["serve", "--port", "0", dir], {
    cwd: dir,
    env: { ...serverEnv(), ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Both pipes are drained for the whole life of the process: a server whose
  // stderr filled up would block mid-scenario, and the log is what a failing
  // step attaches.
  let out = "";
  let log = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (d) => {
    out += d;
  });
  child.stderr.on("data", (d) => {
    log += d;
  });

  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`olai serve did not come up in ${BOOT_TIMEOUT_MS}ms\n${out}${log}`)),
      BOOT_TIMEOUT_MS,
    );
    const settle = () => {
      clearTimeout(timer);
      child.stdout.off("data", onData);
      child.off("exit", onExit);
      child.off("error", onError);
    };
    const onData = () => {
      const m = URL_RX.exec(out);
      if (m) {
        settle();
        resolve(m[1]);
      }
    };
    const onExit = (code) => {
      settle();
      reject(new Error(`olai serve exited with ${code}\n${out}${log}`));
    };
    const onError = (e) => {
      settle();
      reject(e);
    };
    child.stdout.on("data", onData);
    child.on("exit", onExit);
    child.on("error", onError);
    onData();
  });

  return {
    url,
    // What the server said while the scenario ran. Read at teardown, so it
    // holds everything up to the failure.
    log: () => out + log,
    stop: () => stop(child),
  };
}

/** The child's environment, minus everything personal.
 *
 *  OLAI_HOME especially: a developer running the suite has one, `serve` would
 *  never read it (it is given a directory), but a step that shelled out could,
 *  and personal data has no business in a test process. */
function serverEnv() {
  const env = { ...process.env, OLAI_ACP_AGENT: FAKE_AGENT };
  delete env.OLAI_HOME;
  // The fake agent reads this to decide whether the machine has stored
  // conversations; scenarios that want them set it themselves.
  delete env.OLAI_FAKE_ACP_STORED;
  return env;
}

/** SIGINT first: `olai serve` blocks on a break, and its handler is what stops
 *  the watcher and kills the agent it spawned. SIGKILL is the backstop for a
 *  server that ignored it — and would orphan the agent. */
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGINT");
  const killer = setTimeout(() => child.kill("SIGKILL"), 5_000);
  await exited;
  clearTimeout(killer);
}
