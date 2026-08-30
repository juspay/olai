/**
 * ODU'S SERVER HALF — the CI probe, assembled where the judgement about it
 * lives.
 *
 * It is `@olai/plugin-kolu`'s `server.ts` one appliance over, deliberately the
 * same shape and deliberately smaller: one cell, one vault walk, one sweep. That
 * this module and kolu's are the same block with the nouns changed was the
 * phase's own complaint about `runtime.ts`, and the answer is not to make the
 * two files different — it is that neither of them is in a general package any
 * more, and a THIRD tenant writes its own without core growing a line.
 *
 * ## Why the server half is its own door
 *
 * `./wire` is what every listener statically pulls in; the ROOT is the manifest,
 * and this package OWNS its browser faces — the chip, the run matrix, the words
 * beside them — so the manifest's graph carries SolidJS. A server that reached
 * the runtime half through it would pull a UI runtime onto the graph of a
 * process that renders nothing. So the runtime half is HERE, behind a door a
 * browser never opens (`@olai/plugins`' own `./server`, whose closure
 * `packages/plugins/src/fence.test.ts` walks).
 *
 * ## What did NOT move
 *
 * `oduHalf` stays in `@olai/odu-client`, which is still the only package that
 * names `@odu/*`: the socket resolution, the run projection and the sweep are
 * its. What moved is the CALL, and with it {@link ./worktrees.ts} — the walk
 * that asks which nodes name a worktree and whether the vault DECLARED that key
 * a path at all. That walk reads outline records, so it must not be in the
 * appliance; and it decides whether olai dials a socket in somebody's checkout,
 * so it has no business being in core either. Between those two is what this
 * package is.
 */

import type { ImplementSurfaceDeps } from "@kolu/surface/server"
import type { Derived } from "@olai/format"
import { type DialRun, oduHalf } from "@olai/odu-client"

import { surface } from "./wire.ts"
import { worktreesIn } from "./worktrees.ts"

/** The kinds this plugin teaches a vault, reached on this door — see
 *  {@link ./kinds.ts} for the word, and `@olai/plugins`' `server.ts` for why
 *  the table is assembled here rather than off the manifest. */
export { kinds } from "./kinds.ts"

/** The wire half, re-exported for the reason `@olai/plugin-kolu`'s server door
 *  re-exports it: one entry per plugin, and one spelling of the key. */
export { faces, name, surface } from "./wire.ts"

/**
 * WHAT THIS HALF ASKS CORE FOR, out of what core offers every plugin.
 *
 * `env` and `served` are what the repos root is decided from
 * (`@olai/odu-client`'s `resolve.ts`) — a relative `worktree` resolves against
 * the served directory unless `$OLAI_REPOS_DIR` says otherwise, and a test that
 * asserts the resolution has to own both. `now` is deliberately absent: nothing
 * here is stamped with a time, and a parameter is contravariant, so leaving it
 * off is a claim rather than an omission — kolu's half one appliance over asks
 * for it and this one does not.
 *
 * `dial` arrives opaque and is narrowed below, for the reason kolu's is: core
 * cannot type a plugin's own fake coordinator without learning what the plugin
 * talks to.
 */
export interface Services {
  readonly env: Record<string, string | undefined>
  readonly served: string
  readonly say: (line: string) => void
  readonly warn: (line: string) => void
  readonly dial?: unknown
}

/**
 * ONE REVISION OF THE VAULT, as much of it as this half reads — which is the
 * DERIVATION and nothing else.
 *
 * Narrower than kolu's, and the narrowness is the claim: core passes the whole
 * published snapshot and this type names the one field odu touches, so "each
 * plugin takes what it needs" is checked rather than asserted. The walk it feeds
 * asks TWO things of that one reading — the records, and what the vault
 * DECLARES about the key ({@link ./worktrees.ts} argues why the declaration is
 * what LICENCES a probe) — and both are answered off a memo the validator has
 * already paid for.
 */
export interface VaultRevision {
  readonly value: {
    readonly derived: Derived
  }
}

/**
 * THE ODU HALF, assembled — the worktrees it watches and the runs it finds.
 *
 * Made eagerly and started lazily, exactly as kolu's is and for the same two
 * reasons: making it gives the `ci` cell something to answer with before
 * anything has been probed, and STARTING it is the cell's connector, which the
 * framework runs when the surface BINDS — so one server sweeps for CI runs
 * however many tabs are open, and a page that loads mid-sweep reads the rows the
 * watcher already has.
 *
 * There is no `null` arm, and its absence is the composition: a face that wants
 * no CI probe composes no odu sibling at all, so this function is not called and
 * the wire carries no `surface/odu/`. What a machine with nothing running still
 * gets is the honest empty answer — the probe finds no socket and the cell holds
 * `NO_RUNS`, which is what the ORDINARY checkout has always drawn.
 */
export const serve = (services: Services): {
  readonly deps: ImplementSurfaceDeps<typeof surface.spec>
  readonly published: (ctx: unknown) => void
  readonly revision: (revision: VaultRevision) => void
  readonly unloaded: () => void
} => {
  const half = oduHalf<Derived>({
    options: {
      env: services.env,
      served: services.served,
      // The one narrowing in this package, and kolu's `dial` line one appliance
      // over: a fake coordinator on a real unix socket is how the watch is
      // exercised without a CI run on the machine running the suite, and core
      // carries it opaque because typing it would mean knowing what odu is.
      dial: services.dial as DialRun | undefined,
    },
    // THE VAULT WALK, passed in, and this package is now where both sides of it
    // live: which keys this vault DECLARES a `worktree`, and which nodes carry
    // one, are readings of outline records — things the package that dials odu
    // must not learn. What crosses is four strings per node.
    worktrees: worktreesIn,
    // Chatter, at debug: on a machine with no CI running this is a line every
    // few seconds and it is not news — which on this appliance is even more true
    // than on kolu's, because a checkout with no live run is the ORDINARY state
    // of every checkout.
    say: services.say,
    // What the OWNER must read: a dial that failed for a reason that is not
    // absence — a socket somebody IS serving that refused us, a path a broken
    // checkout left behind. Rare by construction, and the one thing here a
    // person can act on.
    warn: services.warn,
  })

  return {
    /** THE ONE MEMBER HANDLER, straight through. The annotation is where this
     *  plugin's agreement with the framework is proved: written against THIS
     *  package's surface, so a cell the appliance re-shaped is a type error in
     *  this file rather than a boot crash in somebody's composition root. */
    deps: half.handlers,
    /** ODU PUBLISHES THROUGH ITS CELL'S CONNECTOR and never through the ctx, so
     *  there is nothing for this half to be handed back — the seam is optional
     *  on purpose, and a plugin that declines it is saying it writes to its
     *  members from inside the framework's own connector. It is spelled as a
     *  no-op rather than omitted so the two tenants read alike at the one place
     *  they genuinely differ. */
    published: () => {},
    /** A VAULT REVISION LANDED. Storing the answer is all it does: dialing is
     *  the sweep's, on its own clock, so a keystroke costs one walk and no
     *  sockets. */
    revision: (revision) => half.revision(revision.value.derived),
    /** The store has NEVER published — a set of CI runs derived from a vault the
     *  server can no longer see is yesterday's reading, so the worktrees reset to
     *  none and the sockets follow on the next sweep. */
    unloaded: () => half.unloaded(),
  }
}
