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
 * two copies cannot drift onto different events.
 *
 * The subprocess itself is `@olai/child`'s. What remains here is READINESS:
 * the `serving` line, which is this server's own interface and not a fact
 * about subprocesses. The wait discipline — listeners at spawn, wait on the
 * event, a clock that throws with what the child said — is the socket's
 * default, so these tests stop re-earning it.
 */

import { type Child, start } from "@olai/child"
import { findLogfmt } from "@olai/log/testlib"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

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
  readonly pid: number | undefined
  readonly exitCode: number | null
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
   *  The wait is that line, not a deadline: a late caller is answered from
   *  the box, an early one from the chunk that carries it. Rejects if the
   *  child exits first, or after {@link BOOT_TIMEOUT} — with everything it
   *  said, because "never bound" and "would not boot, and here is why" look
   *  identical from out here otherwise. */
  readonly address: () => Promise<string>
  /** Its exit code, once its pipes have drained. */
  readonly exited: () => Promise<number | null>
  /**
   * The close, or a throw after `ms` with what the child said. The listener
   * is the one `@olai/child` attached at spawn — attaching after kill is the
   * hazard the socket exists to not have.
   */
  readonly wait: (ms: number, why: string) => Promise<number | null>
  readonly kill: (signal?: NodeJS.Signals) => void
  readonly stop: (opts?: {
    readonly graceMs?: number
    readonly signal?: NodeJS.Signals
  }) => Promise<number | null>
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
    // A private runtime directory, so a unit test that starts a server does
    // not drop a lock into the developer's `$XDG_RUNTIME_DIR/olai`. An
    // explicit `env.XDG_RUNTIME_DIR` still wins — lock tests point two
    // children at one directory of their own.
    XDG_RUNTIME_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "olai-child-run-")),
    ...options.env,
  }
  const child: Child = start(
    process.execPath,
    [MAIN, "web", options.root, ...extra],
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      // Both streams: a server says where it bound on stdout and why it
      // would not boot on stderr, and a caller asserting on either wants
      // whichever arrived.
      drain: { stdout: true, stderr: true },
    },
  )

  // Readiness is this file's residue: the `serving` line is olai's interface,
  // not a fact about subprocesses. Waiters sit on these `data` events (the
  // socket already drains them into the box) rather than on a poll, because
  // a wall-clock interval is what load blows through.
  const notice = new Set<() => void>()
  const consider = () => {
    for (const fn of notice) fn()
  }
  child.stdout?.on("data", consider)
  child.stderr?.on("data", consider)

  return {
    get pid() {
      return child.pid
    },
    get exitCode() {
      return child.exitCode
    },
    said: child.said,
    address: () =>
      new Promise<string>((resolve, reject) => {
        const look = () => findLogfmt(child.said(), "serving")?.url
        let settled = false
        const finish = (act: () => void) => {
          if (settled) return
          settled = true
          notice.delete(onChunk)
          clearTimeout(timer)
          act()
        }
        const onChunk = () => {
          const url = look()
          if (url === undefined) return
          finish(() => resolve(url))
        }
        const timer = setTimeout(() => {
          finish(() =>
            reject(new Error(`the server never said where it was serving:\n${child.said()}`)))
        }, BOOT_TIMEOUT)
        void child.closed.then(() => {
          const url = look()
          finish(() => {
            if (url === undefined) {
              reject(new Error(`the server exited before it served:\n${child.said()}`))
            } else resolve(url)
          })
        })
        notice.add(onChunk)
        onChunk()
      }),
    exited: () => child.closed.then((close) => close.code),
    wait: (ms, why) => child.wait(ms, why).then((close) => close.code),
    kill: (signal: NodeJS.Signals = "SIGKILL") => child.kill(signal),
    stop: async (opts) => (await child.stop(opts)).code,
  }
}
