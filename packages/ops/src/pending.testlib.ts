/**
 * BOTH ARMS OVER ONE REPOSITORY, which is what an equivalence about the
 * committed side needs to be asked of.
 *
 * `./committed.testlib.ts` keeps the computation as it was and the counters
 * around it; this is the scaffolding that puts the two side by side — a real
 * repository in a temporary directory, a real store over the served part of it,
 * and TWO {@link Committing} instances differing in exactly one thing, the
 * memory of HEAD's copies.
 *
 * ONE STORE for both, deliberately: the working side of the comparison is the
 * store's own last-good parse, so two stores would be two readings of the disk
 * and a divergence could mean nothing worse than one of them having refreshed
 * first. What is under test is the COMMITTED side.
 *
 * Shared because the differential (`./pending.equivalence.test.ts`) and the
 * bench (`./pending.bench.ts`) are the same setup asked two different
 * questions, and this repository's rule for a perf claim is that both arms and
 * the harness under them stay in the tree — a figure nobody can re-run is a
 * figure nobody can check.
 *
 * Not a suite: `bun test` collects only `*.test.ts`.
 */

import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { NodeServices } from "@effect/platform-node"
import * as Store from "@olai/store"
import { Effect } from "effect"

import { codec } from "./codec.ts"
import { type Counted, counting, forgetful } from "./committed.testlib.ts"
import { remembering } from "./committed.ts"
import type { Store as OutlineStore } from "./deps.ts"
import { GIT_IDENT, GIT_IDENT_KEYS, gitIn, repoAt } from "./fixtures.testlib.ts"
import { type Committing, fixedPolicy, make } from "./pending.ts"

/** One line of an outline, so a corpus and a keystroke are written the same
 *  way. */
export const node = (id: string, title: string): string =>
  `{"id":"${id}","ord":"a0","title":"${title}"}`

export const outline = (...lines: ReadonlyArray<string>): string => `${lines.join("\n")}\n`

/** The repository a script writes to, in the three moves a step ever makes. */
export interface Session {
  readonly root: string
  /** Relative to the REPOSITORY root, so a script can write above the served
   *  directory — which is the case a served subdirectory is here for. */
  readonly write: (file: string, contents: string) => void
  readonly remove: (file: string) => void
  readonly git: (...argv: ReadonlyArray<string>) => string
}

/** Both arms over one repository and one store, with the counters around them
 *  — what a differential steps a script through, and what a bench times. */
export interface Arms {
  readonly session: Session
  /** Re-read the directory, so a change made behind olai's back is part of the
   *  revision the next question is answered against. */
  readonly settle: Effect.Effect<void>
  readonly cached: Committing
  readonly plain: Committing
  readonly cachedSide: Counted
  readonly plainSide: Counted
  /** The sha, or `""` for a branch with no commits yet. */
  readonly head: () => string
  /** Zero both counters, so what is read next is what ONE revision spent. */
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

  /** The sha, or `""` for a branch that has no commits yet — which is a step of
   *  the session like any other rather than a thing to throw about. */
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
    const policy = fixedPolicy({ commit: "manual", push: null })
    const cachedSide = counting(remembering())
    const plainSide = counting(forgetful())
    return yield* use({
      session: {
        root,
        write,
        remove: (file) => fs.rmSync(path.join(root, file), { force: true }),
        git,
      },
      settle: Effect.orDie(store.refresh),
      cached: make({ store, root: served, policy, committed: cachedSide.committed }),
      plain: make({ store, root: served, policy, committed: plainSide.committed }),
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
