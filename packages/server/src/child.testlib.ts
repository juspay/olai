/**
 * A real olai as a CHILD PROCESS: how to start one, how to read its address,
 * and how to ask whether it stopped.
 *
 * Two tests in this package cannot use the in-process `withServe`
 * (`./serve.testlib.ts`), because what they are about IS the process boundary:
 * `shutdown.test.ts` (a signal must actually exit it, and name itself on
 * stderr first) and `lock.test.ts` (a SECOND olai over one directory must
 * refuse to boot). What they need of a child is the same three answers —
 * where did it bind, is it gone, and what did it say — and they are here so
 * two copies cannot drift onto different events, which is the fix
 * `stoppedWithin` already is for the first of the three.
 *
 * "Did that process stop?" is a BOOLEAN with a deadline, and the caller asserts
 * on it — which is what puts "it did not stop" in the failure message instead
 * of in the runner's summary. A process that never stops does not fail a test,
 * it hangs it, and the runner's own timeout then reports only that something
 * took too long.
 *
 * What is deliberately NOT here is each test's own bound on stopping:
 * `shutdown.test.ts` is ABOUT how long a stop may take, so that number stays
 * where the sentence explaining it is. How long a BOOT may take is not any
 * caller's subject, so that one is here ({@link BOOT_TIMEOUT}).
 */

import { findLogfmt } from "@olai/log/testlib"
import { type ChildProcess, spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

/**
 * Wait for `child` to be gone, or answer `false` after `ms`.
 *
 * `close` rather than `exit`, and the difference is load-bearing for one of
 * the two callers: `exit` fires when the process is gone, `close` when its
 * stdio has been drained as well, so a test that reads what the child SAID is
 * guaranteed to have all of it. It costs the other caller nothing — a stopped
 * process closes its pipes — and one event is one fewer thing for the two to
 * disagree about.
 *
 * Call it in the same synchronous block as whatever asks the child to stop:
 * the listener is attached here, and an exit that has already happened has no
 * event left to emit.
 */
export const stoppedWithin = (child: ChildProcess, ms: number): Promise<boolean> =>
  Promise.race([
    new Promise<boolean>((resolve) => {
      child.on("close", () => resolve(true))
    }),
    Bun.sleep(ms).then(() => false),
  ])

const MAIN = path.join(import.meta.dirname, "main.ts")

/** A stand-in for the built browser bundle, which the entry point refuses to
 *  start without. One per test process rather than one per child: the content
 *  is a constant and nobody writes to it, and a directory per spawn is a dozen
 *  identical temp directories left behind by a file that starts a dozen
 *  servers. */
let dist: string | undefined
const clientDist = (): string =>
  (dist ??= (() => {
    const made = fs.mkdtempSync(path.join(os.tmpdir(), "olai-child-dist-"))
    fs.writeFileSync(path.join(made, "index.html"), "<!doctype html>\n")
    return made
  })())

/** How long a boot may take before it is a hang rather than a slow machine.
 *  Generous by the same argument as the bounds above: what is being told apart
 *  is "under a second" from "never". */
export const BOOT_TIMEOUT = 10_000

export interface WebChild {
  readonly child: ChildProcess
  /** Everything it has said, both streams, for the life of the process. The
   *  boot wait fills the same box an assertion afterwards reads, so there is no
   *  gap between the two and no second listener to attach. */
  readonly said: () => string
  /** The `url=` field of the `serving` line — read off the child because that
   *  IS the interface: the default port is `0`, so the process is the only
   *  thing that knows which one it got. Read as a FIELD, through the decoder
   *  belonging to the package that owns the format, rather than through a
   *  regex this file would be alone in maintaining.
   *
   *  Rejects if the child exits first, or after {@link BOOT_TIMEOUT} — with
   *  everything it said, because "never bound" and "would not boot, and here is
   *  why" look identical from out here otherwise. */
  readonly address: () => Promise<string>
  /** Its exit code, once its pipes have drained. */
  readonly exited: () => Promise<number | null>
  readonly kill: (signal?: NodeJS.Signals) => void
}

/**
 * `olai web <root> …`, spawned the way a person's shell does — the packaged
 * artefact's own entry point, not this package's modules. No `--port`: the
 * process default is 0 (OS-assigned), and that is a fact these callers
 * rely on rather than re-spell. Pass `--port N` in `extra` to pin one.
 *
 * `--no-commit` is the default extra because most callers are not about git.
 * Pass `extra: []` to take the process default (`manual`), which is the one
 * thing Effect 4 started refusing without a fallback on the boolean flag.
 */
export const startWeb = (options: {
  readonly root: string
  /** Merged over the defaults below. For a test that needs two children to
   *  meet somewhere the environment decides they do — said explicitly rather
   *  than left to what this process happens to have inherited. */
  readonly env?: NodeJS.ProcessEnv
  /** Argv after `web <root>`. Unset includes `--no-commit`. */
  readonly extra?: ReadonlyArray<string>
}): WebChild => {
  const extra = options.extra ?? ["--no-commit"]
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OLAI_DIST_DIR: clientDist(),
    // No agent: none of these tests is about the chat panel, and a real one
    // would make them depend on a model and a network.
    OLAI_ACP_AGENT: "",
    // The address is read as logfmt; do not inherit a developer's
    // OLAI_LOG=pretty.
    OLAI_LOG: "logfmt",
    ...options.env,
  }
  // A worktree's `just run` writes OLAI_PORT_FILE; a child that inherited
  // it would try to rebind that address. An explicit `env.OLAI_PORT_FILE`
  // still wins, because that is a test of the file itself.
  if (options.env?.OLAI_PORT_FILE === undefined) delete env.OLAI_PORT_FILE
  const child = spawn(
    process.execPath,
    [MAIN, "web", options.root, ...extra],
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  // Both streams into one box, for the life of the child: a server says where
  // it bound on stdout and why it would not boot on stderr, and a caller
  // asserting on either wants whichever arrived.
  let said = ""
  child.stdout?.setEncoding("utf8")
  child.stderr?.setEncoding("utf8")
  child.stdout?.on("data", (chunk: string) => {
    said += chunk
  })
  child.stderr?.on("data", (chunk: string) => {
    said += chunk
  })

  // ONE listener for the end of this child, attached at spawn and shared by
  // everything below. Attaching per question is how a caller that asks after
  // the child is already gone waits for an event that will never come again —
  // the hazard `stoppedWithin` has to warn about, and one this shape does not
  // have.
  const closed = new Promise<number | null>((resolve) => {
    child.on("close", (code: number | null) => resolve(code))
  })

  return {
    child,
    said: () => said,
    // Polled rather than driven off the `data` event, so that a caller asking
    // late is answered from the box rather than left waiting for a chunk that
    // has already arrived.
    address: () =>
      new Promise<string>((resolve, reject) => {
        const look = () => findLogfmt(said, "serving")?.url
        const stop = () => {
          clearInterval(poll)
          clearTimeout(timer)
        }
        const poll = setInterval(() => {
          const url = look()
          if (url === undefined) return
          stop()
          resolve(url)
        }, 25)
        const timer = setTimeout(() => {
          stop()
          reject(new Error(`the server never said where it was serving:\n${said}`))
        }, BOOT_TIMEOUT)
        void closed.then(() => {
          const url = look()
          stop()
          if (url === undefined) {
            reject(new Error(`the server exited before it served:\n${said}`))
          } else resolve(url)
        })
      }),
    exited: () => closed,
    kill: (signal: NodeJS.Signals = "SIGKILL") => {
      if (child.exitCode === null) child.kill(signal)
    },
  }
}
