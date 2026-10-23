/**
 * THE POLICY ON A RUNNING ROW, driven through the plugin rather than through a
 * function it happens to export.
 *
 * What is under test is the half a Settings pick changes: the follower moves the
 * ledger's value, republishes `git` under it, and catches up an unpushed branch
 * when `push` becomes `auto`. The rest of the row — the panel, the pause, the
 * cells — is the same activation throughout, which is why the sibling identity
 * is asserted here: a restarting row would mint a new one.
 *
 * The reader is a fake `ConfigurationSource` offered through the same broker a
 * real serve uses, so a case can also TAKE IT AWAY and bring it back — the
 * absence the old component made visible as a `waiting` row. The repository is
 * real, for `pending.test.ts`'s reason: a fake git would only reproduce what
 * this suite already believes.
 */
import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import { GIT_IDENT, GIT_IDENT_KEYS, gitIn, repoAt } from "./git/fixtures.testlib.ts"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { type GitPolicy, type GitState, type Pending } from "@olai/format"
import { readingOf, setOf } from "@olai/format/testlib"
import type { Configuration } from "@olai/plugin-api/configuration"
import {
  ConfigurationSource,
  definePlugin,
  mountPlugin,
  Offers,
  type Registered,
  standing,
  VaultViews,
} from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"

import git from "./server.ts"

/** A fresh directory nothing else knows about. */
const scratch = (prefix: string): string => mkdtempSync(join(tmpdir(), prefix))

/** The identity every product `git` spawn must inherit, as the format's own
 *  fixtures pin it — an empty `GIT_AUTHOR_NAME` in the ambient env is empty
 *  rather than unset, and a repository-local name does not beat it. */
const withIdent = <A>(run: () => Promise<A>): Promise<A> => {
  const saved = Object.fromEntries(GIT_IDENT_KEYS.map((key) => [key, process.env[key]]))
  Object.assign(process.env, GIT_IDENT)
  return run().finally(() => {
    for (const key of GIT_IDENT_KEYS) {
      const was = saved[key]
      if (was === undefined) delete process.env[key]
      else process.env[key] = was
    }
  })
}

/** Wait for a value the row publishes from its own fiber. */
const eventually = async (check: () => boolean, what: string): Promise<void> => {
  for (let attempt = 0; attempt < 400; attempt++) {
    if (check()) return
    await Bun.sleep(5)
  }
  throw new Error(`timed out waiting for ${what}`)
}

interface Mounted {
  /** The one sibling this row registers, with the same identity for the whole
   *  activation unless something restarted it. */
  readonly sibling: () => Registered
  /** Put a bound face on it — the framework's `published`, handed the two cell
   *  writers the panel reads. A run with no panel never calls it, so a case
   *  that wants to see a republish has to stand one up. */
  readonly bind: (state: { readonly git: GitState[]; readonly pending: Pending[] }) => void
  /** One vault revision, which is what makes the row survey and paint. */
  readonly vault: () => Promise<void>
  /** A new configuration reading from the reader, as a Settings edit would be. */
  readonly publish: (next: GitPolicy) => Promise<void>
  /** The reader withdrawn — the settings row switched off, or no file. */
  readonly withdraw: () => Promise<void>
  /** A reader returning with a value, without a revision of its own. */
  readonly reoffer: (next: GitPolicy) => Promise<void>
}

/** One `git` row over `root`, with a fake settings reader offering the broker a
 *  `ConfigurationSource`. */
const mounted = async (root: string, initial: GitPolicy): Promise<Mounted> => {
  const run = standing()
  const plugins = await run(openPlugins({ vars: {}, now: () => "2026-10-23T12:00:00Z", served: root }))
  // The second door the vault row would offer in a serve. Git registers its
  // ledger and matcher through it; a fixture that hands out `Vault` without
  // this leaves those rows waiting forever.
  await run(mountPlugin(plugins.host, definePlugin({
    name: "views",
    needs: [Offers],
    apply: Effect.gen(function*() {
      const offers = yield* Offers
      yield* offers.offer(VaultViews, () => ({ ledger: () => Effect.void, search: () => Effect.void }))
    }),
  })))

  let revision = 0
  const reading = (policy: GitPolicy): Configuration => ({
    revision: ++revision,
    rows: new Map([["git", { config: { ...policy }, values: [] }]]),
  })
  let current = reading(initial)
  let publish: ((next: Configuration) => Effect.Effect<void>) | undefined
  const reader = () => definePlugin({
    name: "settings",
    needs: [Offers],
    apply: Effect.gen(function*() {
      const ref = yield* SubscriptionRef.make(current)
      yield* (yield* Offers).offer(ConfigurationSource, () => ({
        current: () => current,
        changes: SubscriptionRef.changes(ref),
      }))
      publish = (next) => Effect.suspend(() => {
        current = next
        return SubscriptionRef.set(ref, next)
      })
    }),
  })
  let holder = await run(mountPlugin(plugins.host, reader()))
  await run(mountPlugin(plugins.host, git))

  return {
    sibling: () => {
      const one = plugins.composed().find((entry) => entry.name === "git")
      if (one === undefined) throw new Error("git registered no sibling")
      return one
    },
    bind: ({ git: states, pending }) => {
      const one = plugins.composed().find((entry) => entry.name === "git")
      one?.published?.({
        cells: {
          git: { set: (value: GitState) => states.push(value) },
          pending: { set: (value: Pending) => pending.push(value) },
        },
      })
    },
    vault: () => run(plugins.published({ value: readingOf(setOf({})) })),
    publish: (next) => run(publish!(reading(next))),
    withdraw: () => run(holder.dispose),
    reoffer: async (next) => {
      current = reading(next)
      holder = await run(mountPlugin(plugins.host, reader()))
    },
  }
}

test("a pick republishes git under the new policy, on the same sibling", async () => {
  const root = scratch("olai-policy-")
  try {
    await withIdent(async () => {
      const half = await mounted(root, { commit: "manual", push: "off" })
      const states: Array<GitState> = []
      half.bind({ git: states, pending: [] })
      await half.vault()
      await eventually(() => states.at(-1)?.policy.commit === "manual", "the boot policy")
      const first = half.sibling()
      await half.publish({ commit: "auto", push: "off" })
      await eventually(() => states.at(-1)?.policy.commit === "auto", "the pick to republish")
      expect(half.sibling()).toBe(first)
      expect(states.at(-1)?.policy).toEqual({ commit: "auto", push: "off" })
      // ...and a second pick moves the cell again without a new activation.
      await half.publish({ commit: "manual", push: "off" })
      await eventually(() => states.at(-1)?.policy.commit === "manual", "the second pick")
      expect(half.sibling()).toBe(first)
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("a pick moves push to auto and sends the commits already recorded here", async () => {
  const root = scratch("olai-policy-push-")
  const remote = scratch("olai-policy-remote-")
  try {
    writeFileSync(join(root, "notes.md"), "as it was\n")
    repoAt(root)
    gitIn(remote)("init", "--quiet", "--bare", "--initial-branch", "main")
    const git = gitIn(root)
    git("remote", "add", "origin", remote)
    git("push", "--quiet", "--set-upstream", "origin", "main")
    // ONE COMMIT THE UPSTREAM HAS NEVER SEEN, made before the policy moves —
    // the state `push: off → auto` owes a push that a restart used to provide.
    writeFileSync(join(root, "notes.md"), "the herb bed needs splitting again\n")
    git("commit", "--quiet", "-am", "the herb bed needs splitting")
    expect(gitIn(remote)("log", "--format=%s", "main")).not.toContain("the herb bed needs splitting")

    await withIdent(async () => {
      const half = await mounted(root, { commit: "manual", push: "off" })
      await half.publish({ commit: "manual", push: "auto" })
      await eventually(
        () => gitIn(remote)("log", "--format=%s", "main").includes("the herb bed needs splitting"),
        "the catch-up push",
      )
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(remote, { recursive: true, force: true })
  }
})

test("the boot reads the file before its first survey, and a withdrawn reader leaves the policy standing", async () => {
  const root = scratch("olai-policy-off-")
  try {
    await withIdent(async () => {
      const half = await mounted(root, { commit: "off", push: "off" })
      const states: Array<GitState> = []
      half.bind({ git: states, pending: [] })
      await half.vault()
      // `commit: off` from the FILE, on the first survey — not the schema's
      // manual default for one turn before the follower catches up.
      await eventually(() => states.at(-1)?.policy.commit === "off", "the authored boot policy")
      expect(states.at(-1)?.status).toBe("off")

      const before = states.length
      await half.withdraw()
      await half.vault()
      await eventually(() => states.length > before, "a republish with no reader")
      expect(states.at(-1)?.policy.commit).toBe("off")

      // A returning reader lands without any revision of its own.
      await half.reoffer({ commit: "manual", push: "off" })
      await eventually(() => states.at(-1)?.policy.commit === "manual", "the returning reader")
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
