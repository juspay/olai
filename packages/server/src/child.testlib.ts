/**
 * A real olai as a CHILD PROCESS: how to start one, how to read its address,
 * and how to ask whether it stopped.
 *
 * Two tests in this package cannot use the in-process `withServe`
 * (`./serve.testlib.ts`), because what they are about IS the process boundary:
 * `shutdown.test.ts` (a signal must actually exit it) and `lock.test.ts` (a
 * SECOND olai over one directory must refuse to boot). What they need of a
 * child is the same three answers — where did it bind, is it gone, and what did
 * it say — and they are here so two copies cannot drift onto different events,
 * which is the fix `stoppedWithin` already is for the first of the three.
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
   *  IS the interface: the port was asked for as `0`, so the process is the
   *  only thing that knows which one it got. Read as a FIELD, through the
   *  decoder belonging to the package that owns the format, rather than through
   *  a regex this file would be alone in maintaining.
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
 * `olai web <root> --port 0 --no-commit`, spawned the way a person's shell
 * does — the packaged artefact's own entry point, not this package's modules.
 *
 * The `dist` is a stand-in for the built browser bundle, which the entry point
 * refuses to start without. It is made here rather than by each caller because
 * none of them is about the client.
 */
export const startWeb = (options: {
  readonly root: string
  /** Merged over the defaults below. For a test that needs two children to
   *  meet somewhere the environment decides they do. */
  readonly env?: NodeJS.ProcessEnv
}): WebChild => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "olai-child-dist-"))
  fs.writeFileSync(path.join(dist, "index.html"), "<!doctype html>\n")

  const child = spawn(
    process.execPath,
    [MAIN, "web", options.root, "--port", "0", "--no-commit"],
    {
      env: {
        ...process.env,
        OLAI_DIST_DIR: dist,
        // No agent: none of these tests is about the chat panel, and a real one
        // would make them depend on a model and a network.
        OLAI_ACP_AGENT: "",
        // The address is read as logfmt; do not inherit a developer's
        // OLAI_LOG=pretty.
        OLAI_LOG: "logfmt",
        ...options.env,
      },
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

  return {
    child,
    said: () => said,
    // Polled rather than driven off the `data` event, so that a caller asking
    // late is answered from the box rather than left waiting for a chunk that
    // has already arrived.
    address: () =>
      new Promise<string>((resolve, reject) => {
        const look = () => findLogfmt(said, "serving")?.url
        const settle = (finish: () => void) => {
          clearInterval(poll)
          clearTimeout(timer)
          finish()
        }
        const poll = setInterval(() => {
          const url = look()
          if (url !== undefined) settle(() => resolve(url))
        }, 25)
        const timer = setTimeout(
          () =>
            settle(() =>
              reject(new Error(`the server never said where it was serving:\n${said}`))
            ),
          BOOT_TIMEOUT,
        )
        child.once("close", () => {
          const url = look()
          settle(() =>
            url === undefined
              ? reject(new Error(`the server exited before it served:\n${said}`))
              : resolve(url)
          )
        })
      }),
    exited: () =>
      new Promise<number | null>((resolve) => {
        if (child.exitCode !== null) {
          resolve(child.exitCode)
          return
        }
        child.on("close", (code: number | null) => resolve(code))
      }),
    kill: (signal: NodeJS.Signals = "SIGKILL") => {
      if (child.exitCode === null) child.kill(signal)
    },
  }
}
