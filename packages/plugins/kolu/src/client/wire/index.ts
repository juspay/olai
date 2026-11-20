export * from "./kolu.ts"
export { type Resolved, resolveTerminal, whoOf } from "./terminals.ts"


import { Schema } from "effect"
import {
  FleetTerminal,
  KOLU_UNDIALED,
  KOLU_UNPULSED,
  KoluEvent,
  KoluLink,
  sameKolu,
  Snapshot,
  SnapshotRefused,
  SnapshotRequest,
  TerminalAttach,
  TerminalFrame,
  WatchPulse,
} from "./kolu.ts"

export const koluMembers = {
  cells: {
    /**
     * WHETHER THERE IS A PADI, and where olai looked — see { ./kolu.ts}.
     *
     * The first member of this surface whose subject is not the vault. It is
     * here because the terminal door hangs off a PROPERTY (phase 1a of
     * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/orchestrator.md`), so an ordinary outline draws a
     * live dot and therefore has to be able to say when it cannot — and a
     * chip that has gone hollow is answering with THIS cell rather than with
     * an empty fleet, which is the one distinction that must not blur.
     *
     * Wire-read-only: what is serving a unix socket is not something a browser
     * could set. `equals` is { ./kolu.ts}'s `sameKolu`, which is what keeps
     * `since` meaning "has been like this since" — a re-dial that found the
     * same padi publishes nothing.
     */
    link: {
      schema: KoluLink,
      default: KOLU_UNDIALED,
      verbs: ["get"],
      equals: sameKolu,
    },
    /**
     * THE PULSE — the watcher's liveness, as a timestamp (see
     * { ./kolu.ts}'s `WatchPulse`): WHEN the heart last beat, and HOW LONG
     * the cadence is allowed to run once it is overdue. The door reads
     * `at` off this one stamp; the pill's answer to "has it gone quiet" is
     * arithmetic it can do itself (`everyMs` is carried beside the stamp,
     * so the browser never guesses the vault's cadence name). Two values,
     * one stamp per beat.
     *
     * Wire-read-only: what is beating is not something a browser could set.
     */
    pulse: {
      schema: Schema.NullOr(WatchPulse),
      default: KOLU_UNPULSED,
      verbs: ["get"],
    },
  },
  collections: {
    /**
     * THE FLEET — every terminal padi is holding, with olai's ownership
     * overlay on it ({ ./kolu.ts}'s `FleetTerminal`).
     *
     * MIRRORED, NOT POLLED, and that is the member's whole economy: one
     * server-side `mirrorRemoteSurface` of padi's `terminals` feeds this,
     * however many tabs are subscribed, and kolu pushes when a record moves.
     * Ten tabs on a lanes outline are ten subscriptions to THIS collection and
     * exactly one connection to padi (`@olai/kolu-client`'s `link.ts`, forked
     * once by the `kolu` cell's connector at BIND — so the invariant is
     * structural rather than a promise, and a test counts it as well).
     *
     * `deltas`, for `heads`' reason one subject over: an entry is a dozen
     * short fields, the set is tens of rows on a busy machine, and what a
     * drawing tab wants is every row at once — a chip looks its terminal up by
     * id in a map it already holds, so a page of twelve chips opens ONE stream
     * and not twelve. A per-key `get` would also be the wrong shape for the
     * question, which is "what is the fleet" and not "watch this one".
     *
     * Read-only on the wire. A browser cannot create, kill or rename a
     * terminal here — those are padi verbs, and the day olai calls them it
     * will be the driver calling them, not a tab (the actions PR).
     */
    fleet: {
      /** padi's terminal id, verbatim — the same string a `terminal` property
       *  holds, which is what makes the chip a lookup and not a search. */
      keySchema: Schema.String,
      schema: FleetTerminal,
      verbs: ["keys", "get", "deltas"],
    },
    /**
     * THE RECENT EVENTS — what the server-side watcher computed, as a ring of
     * the last ~200.
     *
     * The knob set these events came from is `_olai/Settings.olai` in the served
     * directory (the vault owner's, read live); what olai owns is the reading
     * and the math — the mirror's rows folded into transition/hold/nag. The
     * ring is ATTENTION ONLY — liveness is the `pulse` cell above, not a row
     * here. See `@olai/kolu-client`'s `watch.ts` for the semantics and
     * {@link ./kolu.ts}'s `KoluEvent` for the shape.
     *
     * A COLLECTION rather than a stream: the ring is a standing thing every
     * subscriber wants at once — a snapshot of however much of it survives,
     * then deltas — where a stream would ask each tab to assemble its own
     * copy. `deltas`, for `fleet`'s reason one name over: an entry is a dozen
     * short fields, the set is a couple of hundred on a busy day, and a page
     * draws the whole recent ring at once.
     *
     * Read-only on the wire, twice over: a browser neither mints an event nor
     * takes one back. Muting a terminal is an EDIT to the vault's config
     * outline, which reaches this collection through the watcher and no other
     * way.
     */
    events: {
      /** `ev-<seq>` — see {@link KoluEvent}. */
      keySchema: Schema.String,
      schema: KoluEvent,
      verbs: ["keys", "get", "deltas"],
    },
  },
  streams: {
    /**
     * ONE OPEN PANE'S TERMINAL, live.
     *
     * A subscription per open pane and none at all otherwise: this is the one
     * member on olai's whole surface whose cost is a person LOOKING at
     * something. Twelve lanes on a page are twelve rows and zero attached
     * terminals until somebody presses one.
     *
     * THE BROWSER NEVER DIALS PADI, and this member is the whole of why the
     * rule survives a live pane. The server holds padi's `terminalAttach`
     * subscription — one per open pane, on the same one connection the fleet
     * rides — and relays its frames here. A browser that attached for itself
     * would be a second dialer of a unix socket it has no business knowing
     * about. (Ten tabs ARE ten attaches — "one per open pane", above, is the
     * literal count. What the server holds one of is the CONNECTION.)
     *
     * The first frame of every attach is a `snapshot` and the rest are
     * `delta`s ({@link TerminalFrame}) — including after a re-attach, which is
     * what makes a dropped link recoverable without the reader doing anything.
     */
    terminal: {
      inputSchema: TerminalAttach,
      outputSchema: TerminalFrame,
    },
  },
  procedures: {
    /**
     * ONE READ OF ONE TERMINAL'S SCREEN — rung 2 of the terminal door.
     *
     * A PROCEDURE and not a stream, and that is the design rather than a
     * simplification: a click asks a question and gets an answer, the pane
     * says "snapshot" on its face, and nothing anywhere is subscribed. Twelve
     * lanes on a page are twelve dots riding one mirror and ZERO attached
     * terminals. Making the pane live is phase 6 (`terminal-stream`), where it
     * is a refcounted stream member with a different border and a different
     * promise — a separate thing, deliberately, so this one can be cheap.
     *
     * It passes through to padi's `screen.text`. What olai adds is the
     * ergonomic (`lines` counted back from the end rather than a window a
     * caller would need the buffer length to compute) and the two refusals a
     * reader is owed rather than a fault ({ ./kolu.ts}'s
     * `SnapshotRefused`).
     *
     * THE BROWSER'S ALONE. An agent wanting a terminal's screen is an agent
     * that can already reach kolu's own MCP face, and re-serving padi's verbs
     * through olai would be a second door onto somebody else's daemon with
     * olai's credentials on it.
     */
    screen: {
      text: {
        input: SnapshotRequest,
        output: Snapshot,
        error: SnapshotRefused,
      },
    },
  },
} as const
