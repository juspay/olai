/**
 * ODU'S SERVER HALF — the CI probe and the doorbell it rings, assembled where
 * the judgement about them lives.
 *
 * It is `olai-plugin-kolu`'s `server.ts` one appliance over, deliberately the
 * same shape and deliberately smaller: one cell, one vault walk, one sweep,
 * and the two notices the sweep turns into deliveries ({@link ring}). That
 * this module and kolu's are the same block with the nouns changed was the
 * phase's own complaint about `runtime.ts`, and the answer is not to make the
 * two files different — it is that neither of them is in a general package any
 * more, and a THIRD tenant writes its own without core growing a line.
 *
 * WHAT THE DOORBELL HERE DELIBERATELY LACKS is a heartbeat: kolu's rides its
 * watcher's own beat, and odu's sweep is a poll for ABSENCES — a checkout
 * with no socket is the ordinary state, not evidence of life. There is no
 * third timer and no third knob because there is nothing honest for one to
 * say; the floor under this doorbell's silence is the two fault sentences
 * ({@link ./wake.ts}) and the picker's clear. Everything else is the kolu
 * shape verbatim: same scope mechanism, same thunk rules (a claim gone by
 * delivery is no message; counts read at delivery), same silence for
 * unclaimed subjects.
 *
 * ## Why the server half is its own door
 *
 * `./wire` is what every listener statically pulls in; the ROOT is the manifest,
 * and this package OWNS its browser faces — the chip, the run matrix, the words
 * beside them — so the manifest's graph carries SolidJS. A server that reached
 * the runtime half through it would pull a UI runtime onto the graph of a
 * process that renders nothing. So the runtime half is HERE, behind a door a
 * browser never opens (`@olai/plugin-api`'s own `./server`, whose closure
 * `packages/plugin-api/src/fence.test.ts` walks).
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
import {
  declarationsOf,
  type Derived,
  NO_TYPING,
  type PropDeclarations,
} from "@olai/format"
import { type DialRun, oduHalf, type RunNotice } from "@olai/odu-client"

import { bodyFor, claimedIn, claimingIn, coalesceOf, countsFor } from "./doorbell.ts"
import { ownKinds } from "./kinds.ts"
import { surface } from "./wire.ts"
import { worktreesIn } from "./worktrees.ts"

/** The kinds this plugin teaches a vault, reached on this door — see
 *  {@link ./kinds.ts} for the word, and `@olai/plugin-api`'s `server.ts` for why
 *  the table is assembled here rather than off the manifest. */
export { kinds } from "./kinds.ts"

/** The wire half, re-exported for the reason `olai-plugin-kolu`'s server door
 *  re-exports it: one entry per plugin, and one spelling of the key. */
export { faces, name, surface } from "./wire.ts"

/** IS ODU'S `mcp` HERE, asked per conversation — {@link ./probe.ts}: the
 *  division is odu-supplies-the-evidence / olai-the-judgement, exactly as
 *  kolu's one appliance over, and it is on this door for the same reason: a
 *  probe starts a subprocess, and the manifest is a door the browser opens. */
export { probe } from "./probe.ts"

/**
 * WHAT THE STRIP'S DOORBELL CONTROL SAYS, on this door rather than inside
 * {@link serve} for the reason `olai-plugin-kolu`'s server.ts argues one
 * appliance over: it is DECLARATION and not behaviour — core refuses a scope
 * for a plugin declaring no wake, and asks that question of the enabled
 * halves long before any of them has served anything. {@link ./wake.ts}
 * argues the words themselves, including why odu's half has no heartbeat.
 */
export { wake } from "./wake.ts"

/**
 * WHAT THIS HALF ASKS CORE FOR, out of what core offers every plugin.
 *
 * `env` and `served` are what the repos root is decided from
 * (`@olai/odu-client`'s `resolve.ts`) — a relative `worktree` resolves against
 * the served directory unless `$OLAI_REPOS_DIR` says otherwise, and a test that
 * asserts the resolution has to own both.
 *
 * `dial` arrives opaque and is narrowed below, for the reason kolu's is: core
 * cannot type a plugin's own fake coordinator without learning what the plugin
 * talks to.
 *
 * `now` is asked for where kolu's half one appliance over asks for it too: a
 * wake's attribution carries a stamp, composed at the moment the words go in.
 */
export interface Services {
  readonly env: Record<string, string | undefined>
  readonly served: string
  readonly now: () => string
  readonly say: (line: string) => void
  readonly warn: (line: string) => void
  readonly dial?: unknown
  readonly deliveries: Deliveries
}

/**
 * THE DOORBELL'S DOOR, re-declared STRUCTURALLY — `@olai/plugin-api`'s
 * `Deliveries`, spelled here for the cycle reason `olai-plugin-kolu`'s own
 * re-declaration (the file this module is one appliance over from) argues at
 * length: the registry imports THIS package, so an import back would be a
 * shape the manifests could not express, and the registry's `satisfies` is
 * where the two spellings are held to one.
 *
 * TWO MEMBERS, AND ONE OF THEM CANNOT READ: `deliver` puts a sentence INTO a
 * conversation and there is no verb for getting one back out. That is core's
 * fence rather than this plugin's restraint, and re-declaring it faithfully
 * is how this side says it accepts it.
 */
export interface Deliveries {
  /** The conversations somebody scoped to this plugin, each with the file
   *  they picked to filter by. Synchronous, because the caller is a watcher
   *  sink with no Effect around it. Empty forever on a machine nobody scoped,
   *  which is the honest state and needs no failure channel. */
  readonly scopes: () => ReadonlyArray<{
    readonly agent: string
    readonly session: string
    readonly file: string
  }>
  /** One machine-marked message into one conversation. Fire-and-forget, like
   *  {@link Services.say} and {@link Services.warn} beside it and for their
   *  reason. `coalesce` names the slot an UNDELIVERED body may be replaced
   *  in — a slot core files under the PAIR of this plugin and the word. See
   *  {@link ./doorbell.ts} on why the word is per kind AND per run here:
   *  two runs settling through one busy turn are two subjects, and a fresh
   *  derivation is what makes replacement under one key lossless. */
  readonly deliver: (
    to: { readonly agent: string; readonly session: string },
    /** Asked at the moment the words go in, never before — see {@link said}. */
    say: () => string | null,
    options?: { readonly coalesce?: string },
  ) => void
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
  /** THE READING THE DOORBELL JOINS AGAINST, held across revisions.
   *
   *  `undefined` BEFORE THE FIRST ONE is the truth about it and the doorbell's
   *  own first gate: nothing has been read, so no file claims anything, so a
   *  notice arriving before the vault rings nobody. The sweep runs on seconds;
   *  the first revision lands in the boot, which is before any run a person
   *  would start can settle. */
  let derived: Derived | undefined

  /** ...AND WHAT THAT REVISION DECLARES, for {@link ./doorbell.ts}'s licence
   *  — the same `let` kolu's half one appliance over keeps, and
   *  `declarationsOf`'s WeakMap memo is what makes setting it per revision a
   *  pointer read on the revisions the declarations file did not move on. */
  let declaring: PropDeclarations = NO_TYPING

  /**
   * THE WORDS, DERIVED AFRESH AT THE MOMENT THEY ENTER A CONVERSATION.
   *
   * Core holds a delivery through a running turn, or until somebody opens the
   * conversation, and BOTH the vault and the runs move while it waits —
   * `olai-plugin-kolu`'s `said` argues the incident behind the arrangement
   * (a message asserting a world that had closed while it queued), and odu's
   * arm of it is the one {@link ./doorbell.ts}'s header spells: the CLAIM is
   * asked again of the revision in force (a lane finished while its wake
   * queued is a wake nobody owes — `null` drops the delivery), and a
   * first-red's counts are the LIVE row's own where the row is still this
   * run's, never the values the notice's frame closed over. The settle
   * notice's counts are its own final account and are deliberately NOT
   * re-read: the last frame is the story it has to tell.
   */
  const said = (file: string, notice: RunNotice): string | null => {
    const at = derived
    if (at === undefined) return null
    const claim = claimingIn(claimedIn(declaring, at, file)).get(notice.run.id)
    if (claim === undefined) return null
    if (notice.kind === "first-red") {
      return bodyFor(notice, claim, services.now(), countsFor(half.rows(), notice))
    }
    return bodyFor(notice, claim, services.now())
  }

  /**
   * ONE RUN NOTICE, RUNG THROUGH — the doorbell's whole drive loop.
   *
   * Per notice, per conversation, joined by VALUE: a run's id IS the
   * `worktree` value the board wrote (`@olai/odu-client`'s `CiRun`), so the
   * join needs no roster resolution — the asymmetry with kolu's half one
   * appliance over, which resolves eight-character prefixes against a live
   * fleet. One claims walk per FILE per notice, memoised for the length of
   * this call and dropped with it ({@link ./doorbell.ts}: this module owns no
   * standing set).
   *
   * SILENCE IS NO CALL AT ALL: a run no scoped file's un-done nodes name
   * rings nobody, not even a quieter body.
   *
   * AND IT CANNOT THROW INTO A WATCHER'S SINK: this runs from a hold fiber
   * inside the sweep — an exception escaping here rides a stream's failure
   * channel out, not a caller's catch. The whole walk is caught once, at this
   * package's edge, and said on the owner's channel: a doorbell that failed
   * is worth a line, and it is worth exactly one.
   */
  const ring = (notice: RunNotice): void => {
    const at = derived
    if (at === undefined) return
    try {
      const perFile = new Map<string, ReturnType<typeof claimingIn>>()
      const claimingFor = (file: string) => {
        const held = perFile.get(file)
        if (held !== undefined) return held
        const fresh = claimingIn(claimedIn(declaring, at, file))
        perFile.set(file, fresh)
        return fresh
      }
      for (const scope of services.deliveries.scopes()) {
        if (claimingFor(scope.file).get(notice.run.id) === undefined) continue
        services.deliveries.deliver(
          { agent: scope.agent, session: scope.session },
          // ASKED AGAIN AT THE MOMENT IT GOES IN — see {@link said}.
          () => said(scope.file, notice),
          { coalesce: coalesceOf(notice) },
        )
      }
    } catch (thrown) {
      services.warn(
        `odu: the doorbell could not ring for this run notice — ${String(thrown)}`,
      )
    }
  }

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
    // THE DOORBELL'S TAP, and the same boundary kolu's `rang` keeps one
    // appliance over: what crosses is the watch's own frozen notice, and what
    // this side does with it — join it against the `worktree` values a scoped
    // file's un-done nodes claim — is a walk over outline records that
    // `@olai/odu-client` must not be able to spell.
    rang: ring,
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
    /** A VAULT REVISION LANDED. Holding the answer is all it does: dialing is
     *  the sweep's, on its own clock, so a keystroke costs one walk and no
     *  sockets. Two `let`s ride along, and they are the DOORBELL's ammunition:
     *  the derivation itself, for the claims walk, and its declarations, for
     *  the licence ({@link ring} runs on the watcher's clock, not on this
     *  hook's — a notice arrives between revisions, and the vault it is
     *  joined against has to be the last one that landed). */
    revision: (revision) => {
      declaring = declarationsOf(revision.value.derived, ownKinds)
      derived = revision.value.derived
      half.revision(revision.value.derived)
    },
    /** The store has NEVER published — a set of CI runs derived from a vault the
     *  server can no longer see is yesterday's reading, so the worktrees reset
     *  to none and the sockets follow on the next sweep. The doorbell's two
     *  `let`s go with it: {@link ring} runs on the watcher's clock rather than
     *  on a revision, so a notice arriving after a disown must find the vault
     *  gate shut rather than joining against a disowned reading. */
    unloaded: () => {
      declaring = NO_TYPING
      derived = undefined
      half.unloaded()
    },
  }
}
