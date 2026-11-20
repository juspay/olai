import { writeFixturePolicy, type FixturePolicy } from "@olai/bundle/testlib"
import { type Child, start } from "@kolu/child"
import { findLogfmt } from "@olai/log/testlib"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { DIE_WITH_PARENT } from "./dieWithParent.ts"

const MAIN = path.join(import.meta.dirname, "main.ts")

let dist: string | undefined
const clientDist = (): string =>
  (dist ??= (() => {
    const made = fs.mkdtempSync(path.join(os.tmpdir(), "olai-child-dist-"))
    fs.writeFileSync(path.join(made, "index.html"), "<!doctype html>\n")
    return made
  })())

export const BOOT_TIMEOUT = 10_000

export interface WebChild {
  readonly pid: number | undefined
  readonly exitCode: number | null
  readonly said: () => string
  readonly address: () => Promise<string>
  readonly exited: () => Promise<number | null>
  readonly wait: (ms: number, why: string) => Promise<number | null>
  readonly kill: (signal?: NodeJS.Signals) => void
  readonly stop: (opts?: {
    readonly graceMs?: number
    readonly signal?: NodeJS.Signals
  }) => Promise<number | null>
}

export const startWeb = (options: {
  readonly root: string
  readonly env?: NodeJS.ProcessEnv
  readonly extra?: ReadonlyArray<string>
  readonly policy?: FixturePolicy
}): WebChild => {
  const extra = options.extra ?? []
  writeFixturePolicy(options.root, { ...(options.policy ?? { commit: "off" }), process: { ...options.policy?.process, "log-format": "logfmt" } })
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OLAI_DIST_DIR: clientDist(),
    KOLU_ACP_AGENT: "",
    OLAI_ACP_CODEX: "",
    OLAI_ACP_PI: "",
    OLAI_AGENT_PATH: "",
    ODU_WEB_ORIGIN: "http://127.0.0.1:1",
    [DIE_WITH_PARENT]: String(process.pid),
    XDG_RUNTIME_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "olai-child-run-")),
    XDG_STATE_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "olai-child-state-")),
    ...options.env,
  }
  const child: Child = start(
    process.execPath,
    [MAIN, "web", options.root, ...extra],
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      drain: { stdout: true, stderr: true },
    },
  )

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
