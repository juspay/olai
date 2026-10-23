/**
 * THE POLICY DOOR ON A RUNNING ROW, driven through the plugin rather than
 * through a function it happens to export.
 *
 * What is under test is the half a Settings pick changes: `Policy.set` moves the
 * ledger's value, republishes `git` under it, and catches up an unpushed branch
 * when `push` becomes `auto`. The rest of the row — the panel, the pause, the
 * cells — is the same activation throughout, which is why the sibling identity
 * is asserted here: a restarting row would mint a new one.
 *
 * The vault is the explicit test double (`@olai/plugin-api/testlib`) and the
 * repository is real, for `pending.test.ts`'s reason: a fake git would only
 * reproduce what this suite already believes.
 */
import { openTestPlugins as openPlugins } from "@olai/plugin-api/testlib"
import { GIT_IDENT, GIT_IDENT_KEYS, gitIn, repoAt } from "./git/fixtures.testlib.ts"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { GitPolicy, GitState, Pending } from "@olai/format"
import {
  definePlugin,
  mountPlugin,
  Offers,
  type Registered,
  standing,
  VaultViews,
} from "@olai/plugin-api/services"
import { expect, test } from "bun:test"
import { Effect } from "effect"

import git, { Policy } from "./server.ts"

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

interface Mounted {
  /** The one sibling this row registers, with the same identity for the whole
   *  activation unless something restarted it. */
  readonly sibling: () => Registered
  /** Put a bound face on it — the framework's `published`, handed the two cell
   *  writers the panel reads. A run with no panel never calls it, so a case
   *  that wants to see a republish has to stand one up. */
  readonly bind: (state: { readonly git: GitState[]; readonly pending: Pending[] }) => void
  /** The door `components.policy` uses, acquired the way a component does. */
  readonly set: (next: GitPolicy) => Effect.Effect<void>
}

/** One `git` row, mounted over `root`, with a driver whose only job is to hold
 *  the `Policy` tag. */
const mounted = async (root: string): Promise<Mounted> => {
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
  await run(mountPlugin(plugins.host, git))
  let set: ((next: GitPolicy) => Effect.Effect<void>) | undefined
  await run(mountPlugin(plugins.host, definePlugin({
    name: "driver",
    needs: [Policy],
    apply: Effect.gen(function*() {
      set = (yield* Policy).set
    }),
  })))
  if (set === undefined) throw new Error("the policy door was never offered")
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
    set: (next) => set!(next),
  }
}

test("a set republishes git under the new policy, on the same sibling", async () => {
  const root = scratch("olai-policy-")
  try {
    await withIdent(async () => {
      const half = await mounted(root)
      const states: Array<GitState> = []
      half.bind({ git: states, pending: [] })
      const first = half.sibling()
      await Effect.runPromise(half.set({ commit: "auto", push: "off" }))
      expect(half.sibling()).toBe(first)
      expect(states.at(-1)?.policy).toEqual({ commit: "auto", push: "off" })
      // ...and a second set, which is the other half of "live": the cell the
      // panel reads moves again without a new activation.
      await Effect.runPromise(half.set({ commit: "manual", push: "off" }))
      expect(half.sibling()).toBe(first)
      expect(states.at(-1)?.policy).toEqual({ commit: "manual", push: "off" })
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("a set moves push to auto and sends the commits already recorded here", async () => {
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
      const half = await mounted(root)
      await Effect.runPromise(half.set({ commit: "manual", push: "auto" }))
      expect(gitIn(remote)("log", "--format=%s", "main")).toContain("the herb bed needs splitting")
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(remote, { recursive: true, force: true })
  }
})
