import { parsers } from "./parser.testlib.ts"
import { TEST_CLAIMS } from "@olai/ops/testlib"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { NodeServices } from "@effect/platform-node"
import { NO_KINDS } from "@olai/format"
import * as Store from "@olai/store"
import { Effect } from "effect"

import { codecFor } from "@olai/ops"
import type { Reading, Verdict } from "@olai/format"
import type * as StoreModule from "@olai/store"
import { type Counted, counting, forgetful } from "./committed.testlib.ts"
import { remembering } from "./committed.ts"
import { GIT_IDENT, GIT_IDENT_KEYS, gitIn, repoAt } from "../git/fixtures.testlib.ts"
import { type Committing, make } from "./pending.ts"

type OutlineStore = StoreModule.Store<Reading, Verdict>

const codec = codecFor(NO_KINDS, { current: TEST_CLAIMS })

export const node = (id: string, title: string): string =>
  `{"id":"${id}","ord":"a0","title":"${title}"}`

export const outline = (...lines: ReadonlyArray<string>): string => `${lines.join("\n")}\n`

export interface Session {
  readonly root: string
  readonly write: (file: string, contents: string) => void
  readonly remove: (file: string) => void
  readonly git: (...argv: ReadonlyArray<string>) => string
}

export interface Arms {
  readonly session: Session
  readonly settle: Effect.Effect<void>
  readonly cached: Committing
  readonly plain: Committing
  readonly cachedSide: Counted
  readonly plainSide: Counted
  readonly head: () => string
  readonly reset: () => void
}

export const withArms = <A>(
  files: Readonly<Record<string, string>>,
  options: { readonly serve?: string; readonly seed?: boolean },
  use: (arms: Arms) => Effect.Effect<A>,
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-differential-")))
  const write = (file: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), contents)
  }
  for (const [file, contents] of Object.entries(files)) write(file, contents)

  const saved = Object.fromEntries(GIT_IDENT_KEYS.map((key) => [key, process.env[key]]))
  Object.assign(process.env, GIT_IDENT)

  const git = gitIn(root)
  const served = options.serve === undefined ? root : path.join(root, options.serve)
  fs.mkdirSync(served, { recursive: true })
  repoAt(root, options.seed === false ? { seed: false } : {})

  const headOf = (): string => {
    try {
      return git("rev-parse", "--verify", "--quiet", "HEAD").trim()
    } catch {
      return ""
    }
  }

  return Effect.gen(function*() {
    const store: OutlineStore = yield* Store.make({
      root: served,
      codec,
      watch: false,
      settle: "10 millis",
    })
    const policy = { commit: "manual", push: "off" } as const
    const cachedSide = counting(remembering(parsers))
    const plainSide = counting(forgetful(parsers))
    const at = Effect.map(store.read("cheap"), (s) => s.snapshot?.value ?? null)
    return yield* use({
      session: {
        root,
        write,
        remove: (file) => fs.rmSync(path.join(root, file), { force: true }),
        git,
      },
      settle: Effect.orDie(store.refresh("cheap")),
      cached: make({ ops: parsers, at, root: served, policy: () => policy, committed: cachedSide.committed }),
      plain: make({ ops: parsers, at, root: served, policy: () => policy, committed: plainSide.committed }),
      cachedSide,
      plainSide,
      head: headOf,
      reset: () => {
        cachedSide.reset()
        plainSide.reset()
      },
    })
  }).pipe(
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.runPromise,
  ).finally(() => {
    for (const key of GIT_IDENT_KEYS) {
      const was = saved[key]
      if (was === undefined) delete process.env[key]
      else process.env[key] = was
    }
    fs.rmSync(root, { recursive: true, force: true })
  })
}
