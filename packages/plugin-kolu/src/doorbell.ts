/**
 * THE DOORBELL — which terminals a scoped conversation is woken for, what
 * that wake MEANS, and the whole sentence it arrives as.
 *
 * A watcher event says a terminal has been sitting in a state only a person
 * can carry. That is the fleet's fact. Whether anybody in THIS conversation
 * should hear about it is a fact about the VAULT — and joining the two is
 * this module, which is exactly the judgement-about-kolu this package exists
 * to hold ({@link ./index.ts}). `@olai/kolu-client` hands over the event and
 * the live rows; `@olai/chat` takes a string. Nothing in between knows what
 * an outline record is or what a conversation is, and neither of them has to.
 *
 * ## THE FILTER FILE IS THE WHOLE OF THE SCOPE
 *
 * A person picks one `.olai` file per conversation, and the terminals that
 * file's UN-DONE nodes claim are the ones that conversation hears. That makes
 * the day board (`lanes.olai`) the natural filter — it already holds exactly
 * the live lanes — and it makes silence the default: a fresh conversation has
 * no file, so it has no doorbell, and nobody is opted in by a serve.
 *
 * The mute list that used to live in `_olai/Kolu.olai` went in the same
 * landing (2026-08-31), and it is worth being exact about what that was and
 * was not: a mute silenced the events FEED, for everybody, whatever anybody
 * was doing — and the feed has no silence control now, because it says
 * everything it sees. What this file's filter silences is the DOORBELL, per
 * conversation. The two are different surfaces, so this is not a replacement
 * so much as the weaker of two silences going and the useful one arriving:
 * "never, for everybody" was a setting people kept forgetting to un-set, and
 * it was a frozen copy of a list the watcher had to be re-armed against.
 *
 * ## FOUR RULES THE WALK KEEPS, each of them a defect somewhere else
 *
 * **UN-DONE IS NOT `!== "done"`.** The marks are `done | cancelled | doing |
 * todo` and TWO of them end the wait, so a comparison against `done` alone
 * reads a cancelled step as work somebody still owes. And `Derived.status` is
 * PARTIAL — a node with no mark is a bullet, not a todo — so the question is
 * asked with `@olai/format`'s own `unfinished`, which answers both halves.
 *
 * **MIRRORS RESOLVE TO THEIR TARGETS,** which is why this is a SECOND walk
 * and not a mirror arm grown on {@link ./claimants.ts}. That walk skips
 * mirrors on the argument that the target is in the same walk — true of a
 * WHOLE-VAULT walk and false here, where the walk is one file and a lane
 * mirrored onto the board points at a record kept somewhere else. Growing the
 * arm there instead would also change who owns a fleet ROW, because the
 * mirror's claim map is first-writer-wins over document order.
 *
 * **THE VALUE IS FOUND BY LICENCE, never by a key's spelling.** `declaresKind`
 * then `textDeclaredAs`, exactly as {@link ./claimants.ts} asks it: a board
 * whose column is `pty` is heard, and a board that has been using `terminal`
 * for something of its own since before kolu existed is not.
 *
 * **A VALUE IS NOT A KEY.** The board writes eight-character prefixes far
 * more often than whole uuids, so every value is resolved against the LIVE
 * fleet id set through `resolveTerminal` — exact, then unique prefix, else
 * nothing. An AMBIGUOUS value claims nobody, which is the only honest answer
 * and the same one the fleet row's own overlay gives.
 *
 * ## TWO MEANINGS AND A SILENCE, derived and never configured
 *
 * Claimed, and the claiming step is `doing`: a person is working that lane
 * right now and the terminal has stopped — a report or a block is owed, so
 * WAKE. Claimed, and the step is `todo`: the lane is open but nobody is on
 * it, so the terminal is lawfully parked and a digest line is the honest
 * weight. Unclaimed: SILENCE, and silence means NO CALL AT ALL — there is no
 * "drift" arm, no warning, no line anywhere. That was ruled out on purpose
 * (the dispatch, 2026-08-31): a doorbell that also reports what it decided
 * not to ring about is a doorbell nobody can leave on.
 *
 * ## THE BODY IS A FRESH DERIVATION, and that is what makes coalescing safe
 *
 * {@link bodyFor} names every claimed terminal HELD RIGHT NOW under one
 * meaning — read off the live fleet rows, not off any memory this module
 * keeps, because this module keeps none. Core replaces an undelivered body
 * with the next one under the same key, so a second event while the first is
 * still waiting must not LOSE the first: it does not, because the second
 * body was never about one event — it names both terminals, and the third
 * names all three. That is the whole argument for a fixed key per meaning,
 * and it only holds while the body is a derivation of standing state rather
 * than an accumulation of arrivals.
 *
 * It also opens with its OWN attribution and time. Core marks the row it
 * lands in, and a browser draws a face from that mark — but a conversation
 * resumed from the agent's own store rebuilds its rows out of message chunks
 * and the mark is not among them. A sentence that did not say who was
 * speaking would replay as words in the person's mouth.
 *
 * ## Plain text, and no markdown anywhere
 *
 * These bodies are delivered as a message, not rendered. So the ids are in
 * backticks because a person reads backticks as "this is a literal" whether
 * or not anything styles them, the lead-ins are a plain `— ` rather than a
 * list marker, and there is not a `**` in the file.
 *
 * Every claim above is held by `./doorbell.test.ts` over whole vaults through
 * the real parser, rather than by this paragraph.
 */

import {
  declaresKind,
  type Derived,
  follow,
  type PropDeclarations,
  type Settled,
  type Status,
  textDeclaredAs,
  unfinished,
} from "@olai/format"
import { heldStateOf } from "@olai/kolu-client"
import { type FleetTerminal, type KoluEvent, resolveTerminal } from "@olai/kolu-client/wire"

import { TERMINAL_TYPE } from "./kinds.ts"

/**
 * WHAT A WAKE MEANS, and there are exactly two of them.
 *
 * Not three: the absence of a meaning is `null` at every seam below, and it
 * is spelled that way rather than as a `"silence"` arm so that a caller
 * cannot accidentally deliver one. A silence is a call that does not happen.
 */
export type Meaning = "wake" | "digest"

/** The two marks a claiming step may wear and still be somebody's business —
 *  `@olai/format`'s own exclusion, so a fifth mark cannot arrive here without
 *  arriving there first. */
type Unfinished = Exclude<Status, Settled>

/**
 * ONE CLAIM the filter file makes, as the vault wrote it.
 *
 * `value` is VERBATIM — a full padi id or the prefix a board actually types —
 * because which fleet id it names is a question about the live roster and not
 * about the file, and a walk that resolved as it read would answer it against
 * whatever the fleet was at parse time.
 */
export interface Claim {
  /** The `kolu-terminal` value, verbatim. */
  readonly value: string
  /** The claiming record's title, for the sentence. Blank where the record
   *  has none, which {@link bodyFor} draws around rather than filling in. */
  readonly step: string
  /** Its stored mark — the one thing that decides the meaning. */
  readonly mark: Unfinished
}

/** One claimed terminal that is HELD right now, ready to be a line. */
export interface Standing {
  /** The live fleet id — resolved, never the value the file wrote. */
  readonly terminal: string
  /** Who it is, in kolu's own `repo·label` spelling, or `""` where the row
   *  has neither. */
  readonly who: string
  /** The held bucket, as kolu spells it: `awaiting` or `waiting`. */
  readonly state: string
  /** The claiming record's title, blank where it has none. */
  readonly step: string
  /** Its stored mark, which is what put it under this meaning. */
  readonly mark: Unfinished
}

/**
 * EVERY CLAIM ONE FILTER FILE MAKES — the `kolu-terminal` values on its
 * un-done records, with mirrors followed to the records that carry them.
 *
 * `byFile` rather than a filter over `derived.nodes`, because the derivation
 * already keeps that index in LINE order and the file's own order is the
 * order a person reads the board in — which is the order the sentence's lines
 * come out in, further down.
 *
 * THE MARK IS ASKED OF THE PLACEMENT AND THE VALUE OF THE TARGET, and that
 * split is the mirror rule in one line: `Derived.status` already resolves a
 * mirror to whatever its target stores, so the placement's own id answers the
 * done-ness question; the PROPERTY, though, lives on the target, and a mirror
 * carries none of its own. Asking one record both questions would be wrong in
 * one direction or the other.
 *
 * A LICENCE FIRST, so a vault that declares no terminal key pays one walk of
 * its declarations rather than one per record — {@link ./claimants.ts}'s own
 * economy, and the same door.
 */
export const claimedIn = (
  declarations: PropDeclarations,
  derived: Derived,
  file: string,
): ReadonlyArray<Claim> => {
  if (!declaresKind(declarations, TERMINAL_TYPE)) return []
  const inside = derived.byFile.get(file)
  if (inside === undefined) return []
  const claims: Array<Claim> = []
  for (const located of inside) {
    const mark = derived.status.get(located.node.id)
    // UN-DONE, asked of the list rather than of `done`: a cancelled step is
    // work nobody owes, and an ABSENT mark is a bullet somebody wrote, not a
    // task somebody is on.
    if (!unfinished(mark)) continue
    const found = follow(derived, located)
    // A dangling or circular mirror shows no record, so there is nothing to
    // read a property off. It is not an error here — the vault says so
    // loudly enough elsewhere — it is simply a placement claiming nothing.
    if (found.kind !== "found") continue
    const value = textDeclaredAs(declarations, found.shows.node, TERMINAL_TYPE)
    if (value === undefined || value.trim() === "") continue
    claims.push({ value, step: found.shows.node.title, mark })
  }
  return claims
}

/**
 * THE CLAIMS, JOINED TO THE LIVE FLEET — one entry per fleet id somebody in
 * this file claims.
 *
 * `resolveTerminal` and never a map keyed by the written value: the board
 * writes prefixes, the fleet is keyed by whole uuids, and the two never meet
 * as strings. An AMBIGUOUS value — a prefix naming two live terminals — claims
 * nothing at all, which is the answer the fleet row's own ownership overlay
 * gives and the only one that does not put a lane's name on a terminal it
 * never named.
 *
 * FIRST WRITER WINS, in the file's own line order, for that overlay's reason
 * one package over: two records claiming one terminal is somebody copying a
 * property, not an error, and the sentence has room for one step per line.
 */
export const claimingIn = (
  claims: ReadonlyArray<Claim>,
  fleet: Iterable<string>,
): ReadonlyMap<string, Claim> => {
  // The id set once: every value resolves against all of it.
  const ids = [...fleet]
  const claiming = new Map<string, Claim>()
  for (const claim of claims) {
    const found = resolveTerminal(claim.value, ids)
    if (found.kind !== "one") continue
    if (claiming.has(found.id)) continue
    claiming.set(found.id, claim)
  }
  return claiming
}

/**
 * WHAT THIS EVENT MEANS TO THIS CONVERSATION, or `null` for nothing at all.
 *
 * The event's `row.terminal` is padi's FULL id — the watcher stamped it off a
 * fleet row — so the join is id against id, which is only sound because
 * {@link claimingIn} already resolved the file's prefixes into that same
 * vocabulary. Comparing the event's id against a value the vault wrote is the
 * mistake this whole pair of functions is shaped to make unspellable.
 *
 * A `heartbeat` carries no row and means nothing here: the watcher is alive,
 * which is the pill's news and not a conversation's. A `nag` means exactly
 * what its `transition` meant — the derivation is idempotent and the body is
 * standing state, so a nag costs a walk and rings the same bell, which is
 * what a nag is FOR.
 */
export const classify = (
  event: KoluEvent,
  claiming: ReadonlyMap<string, Claim>,
): Meaning | null => {
  if (event.row === null) return null
  const claim = claiming.get(event.row.terminal)
  // UNCLAIMED IS SILENCE, and silence is the absence of a call rather than a
  // quiet one: there is no third arm here and no warning anywhere downstream.
  if (claim === undefined) return null
  return meaningOf(claim)
}

/** THE RULE ITSELF, spelled once: somebody is on this lane right now, or
 *  nobody is. Both {@link classify} and {@link standingIn} ask it, and two
 *  spellings would be two answers — a body that named a terminal the event's
 *  own arm had put in the other meaning. */
const meaningOf = (claim: Claim): Meaning => claim.mark === "doing" ? "wake" : "digest"

/**
 * EVERY CLAIMED TERMINAL HELD RIGHT NOW, under one meaning — the body's whole
 * subject, derived fresh.
 *
 * HELD is read off the LIVE fleet row through `@olai/kolu-client`'s own fold,
 * the same one the watcher's gate asks: a terminal that has gone back to work
 * since the event fired is not standing, and a sentence naming it would be
 * telling somebody about a moment that has passed. That the fold crosses the
 * package wall as a FUNCTION rather than as a vocabulary is argued where it is
 * exported; what matters here is that there is one answer to "is it held" and
 * both ends read it.
 *
 * A row that is not in the fleet at all resolves to nothing upstream, so the
 * only misses here are terminals that moved between the emit and this walk.
 * They fall out silently, which is right: the sentence describes now.
 */
export const standingIn = (
  claiming: ReadonlyMap<string, Claim>,
  rows: ReadonlyMap<string, FleetTerminal>,
  meaning: Meaning,
): ReadonlyArray<Standing> => {
  const standing: Array<Standing> = []
  for (const [terminal, claim] of claiming) {
    if (meaningOf(claim) !== meaning) continue
    const row = rows.get(terminal)
    if (row === undefined) continue
    const held = heldStateOf(row)
    if (held === null) continue
    standing.push({
      terminal,
      who: whoOf(row),
      state: held.bucket,
      step: claim.step,
      mark: claim.mark,
    })
  }
  return standing
}

/**
 * WHO A ROW IS, in kolu's own `repo·branch` spelling — the Dock's own grouping
 * answer, and the one disambiguator that works when three terminals all label
 * themselves `master`.
 *
 * ## Spelled twice, because a package wall stands between the two
 *
 * `@olai/kolu-ui`'s `repoPrefix` (`src/padi/events.ts`) folds this same clause
 * for the events feed, and it is not imported here: that package's doors are
 * the browser socket, its testids and a stylesheet, so reaching the fold would
 * pull SolidJS and an emulator onto the graph of a process that renders
 * nothing — the hazard `@olai/plugin-kolu`'s own `./server` door exists to
 * keep out, and the one `@olai/plugins`' `fence.test.ts` walks each closure
 * for. So there are two spellings of one rule by construction, and what is
 * owed in place of the import is that they answer IDENTICALLY for the same
 * row, which is said in both headers rather than in neither.
 *
 * ## The blank label is where they used to part
 *
 * A terminal with no intent line and no branch carries `label: ""` — the wire
 * types it as a plain string and nothing guarantees a word — and this arm
 * answered `olai` while the browser's answered `olai·`, a name ending in a
 * joiner with nothing joined to it, in a sentence a person reads rather than
 * in a debug dump. Both drop the separator now, and `./doorbell.test.ts` pins
 * this side of it.
 *
 * WHY NOT ONE FUNCTION IN `@olai/kolu-client/wire`, which both ends already
 * import: because that package is the DIAL and the vocabulary, and this is a
 * choice about how olai NAMES a row to a person — the same judgement-about-kolu
 * this whole module is, and kolu's own wire is not where olai's wording goes.
 */
const whoOf = (row: FleetTerminal): string => {
  const label = row.label.trim()
  if (row.repo === null) return label
  return label === "" ? row.repo : `${row.repo}·${label}`
}

/**
 * ONE STAMP a person reads, off the caller's clock.
 *
 * MINUTES AND UTC, spelled out: the server's clock is what stamped it and
 * pretending otherwise would be inventing a timezone for a reader whose own
 * is unknown here. A clock this runtime cannot parse passes through VERBATIM
 * — a sentence in somebody else's spelling beats a sentence with the wrong
 * time in it.
 */
const stampOf = (now: string): string => {
  const at = new Date(now)
  if (Number.isNaN(at.getTime())) return now
  return `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

/** One standing terminal, as its own line. See the header on why the id is in
 *  backticks and the lead-in is a plain em dash: nothing renders this. */
const lineOf = (one: Standing): string => {
  const who = one.who === "" ? "" : ` (${one.who})`
  const step = one.step.trim() === ""
    ? `the node that claims it is \`${one.mark}\``
    : `its step "${one.step.trim()}" is \`${one.mark}\``
  return `— \`${one.terminal}\`${who} is held at \`${one.state}\`; ${step}.`
}

/**
 * THE WHOLE SENTENCE — the plugin's words, every one of them, and core
 * composes none.
 *
 * ITS FIRST LINE IS THE DURABLE ACCOUNT. Core marks the row this lands in and
 * the browser draws a machine face off that mark, but the mark does not
 * survive a session rebuilt from the agent's own store — so who is speaking
 * has to be IN the words, or a replayed transcript puts them in the person's
 * mouth. The time is there for the same reason: a held body may sit through
 * a whole turn and arrive at a boundary, and "when" is not recoverable from
 * where it landed.
 *
 * THE STANDING SET, NOT THE EVENT. The lines name every claimed terminal
 * currently held under this meaning, which is what makes core's
 * replace-in-place lossless (see the header) — and it is also the more useful
 * sentence: an agent reading it learns the shape of the board rather than one
 * arrival, and does not have to hold the previous four messages in mind.
 *
 * THE CLOSING LINE IS PROVENANCE AND AN EXIT. Where the names came from, that
 * this is the whole standing set rather than one arrival, and how to make it
 * stop — because a machine-sent message that cannot be switched off from
 * inside its own text is a message a person resents.
 *
 * Callers pass a non-empty `standing`; an empty one would be a sentence about
 * nobody, and the caller drops that case rather than delivering it.
 */
export const bodyFor = (
  meaning: Meaning,
  standing: ReadonlyArray<Standing>,
  file: string,
  now: string,
): string => {
  const many = standing.length !== 1
  const subject = many ? `${standing.length} terminals` : "One terminal"
  const claimed = many ? "are" : "is"
  const opening = meaning === "wake"
    ? `${subject} claimed by ${file} ${claimed} waiting on a person, and the step that claims ${
      many ? "each" : "it"
    } is doing — a report or a block is owed:`
    : `${subject} claimed by ${file} ${claimed} waiting on a person, and no step of ${
      many ? "any of them" : "it"
    } is doing — ${
      many ? "they are" : "it is"
    } lawfully parked, so this is a note and not a call:`
  return [
    `olai · kolu · ${
      meaning === "wake" ? "wake on terminal activity" : "terminal activity, for the record"
    } · ${stampOf(now)}`,
    "Written by olai's kolu watcher, not by a person.",
    "",
    opening,
    "",
    ...standing.map(lineOf),
    "",
    `These are read off the un-done nodes of ${file}, mirrors followed to their targets. It is the whole standing set and not only the terminal that moved just now; clearing the file on this conversation's wake control stops it.`,
  ].join("\n")
}
