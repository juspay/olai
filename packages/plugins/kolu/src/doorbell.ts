/**
 * THE DOORBELL — which terminals a scoped conversation is woken for, what
 * that wake MEANS, and the whole sentence it arrives as.
 *
 * A watcher event says a terminal has been sitting in a state only a person
 * can carry. That is the fleet's fact. Whether anybody in THIS conversation
 * should hear about it is a fact about the VAULT — and joining the two is
 * this module, which is exactly the judgement-about-kolu this package exists
 * to hold ({@link ./index.ts}). `@olai/kolu-client` hands over the event and
 * the live rows; `olai-plugin-chat` takes a string. Nothing in between knows what
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
 * **SETTLED IS THE ONLY SILENCE, and it is not `!== "done"`.** The marks are
 * `done | cancelled | doing | todo` and TWO of them end the wait, so a
 * comparison against `done` alone reads a cancelled step as work somebody still
 * owes. Those two are what stops the walk; nothing else does.
 *
 * ...AND AN UNMARKED NODE IS NOT ONE OF THEM. `Derived.status` is PARTIAL, so a
 * node nobody marked answers `undefined` — which is not a verdict but the
 * absence of one, and the two are decided differently. A LEAF with no mark is a
 * line somebody wrote rather than a task somebody is on, and it claims nothing.
 * A CONTAINER with no mark is judged by what is under it, exactly as its
 * MEANING already is ({@link owning}): a lane whose node was filed before its
 * dispatch, and grew its claim and its steps in a later write, wears no mark of
 * its own and is as live as the `doing` step inside it.
 *
 * The gate used to ask `unfinished` — which folds the unmarked in with the
 * settled and drops both — and that was `doorbell-missing-claim` (P1,
 * 2026-09-01): one lane on a busy day board drew no wake, no nag and no place
 * in the heartbeat's count for 26 minutes with its agent sitting `waiting`,
 * while four lanes beside it in the same conversation rang. One absent field
 * decided it, invisibly, and nothing about the board said that lane differed.
 *
 * ...AND ONE HOLE OF THAT SHAPE IS STILL OPEN, which is said here rather than
 * left to be rediscovered. An unmarked node with NO CHILDREN is not live, so an
 * unmarked LEAF that carries a claim is silent — which is a lane filed as a
 * bullet and given only a terminal, before its steps land, and a one-node lane
 * permanently. It is the P1's own sibling one level down, and it is left
 * standing ON PURPOSE: the leaf rule is a real sentence (a bullet with nothing
 * under it is a line somebody wrote, not work somebody owes), and ringing every
 * unmarked claimed leaf would wake people about rows they jotted.
 *
 * WHAT MAKES IT A DECISION RATHER THAN A COINCIDENCE is that it is pinned and
 * named. `./doorbell.test.ts` holds the mint-then-graft-WITHOUT-children case
 * beside the P1's own, so a future widening is a deliberate change to a stated
 * expectation and not a bug fix that passes because nothing was watching; and
 * the walk says `unmarked-leaf` about it out loud ({@link Why}), so an operator
 * reads the gate instead of reconstructing an absence.
 *
 * A SETTLED NODE ENDS ITS BRANCH WITHOUT ENTERING `reached`, and that is worth
 * one sentence here because it bounds what the diagnostic can say. `done` and
 * `cancelled` end the wait for everything beneath them, so the walk returns at
 * the verdict without descending — and in the ordinary day-board shape, where
 * the file holds a MIRROR of a lane whose steps live in another file entirely,
 * the descent is the only way in. Those steps are then unreachable rather than
 * merely unclaimed. Two format facts keep that from being theoretical:
 * `set_cancelled` is not gated on the branch beneath it, and a git merge can
 * leave unfinished work under a `done` node. {@link Walked} says what the walk
 * therefore refuses to claim about a carrier it never looked at.
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
 * The subject of both is THE TERMINAL'S OWN STEP — the deepest node being
 * worked at or under the record that claims it ({@link workingIn}), never the
 * lane the claim happens to sit in.
 *
 * Claimed, and that step is `doing`: somebody is on that work right now and
 * the terminal has stopped — a report or a block is owed, so WAKE. Claimed,
 * and nothing under the claim is being worked: it is open with nobody on it,
 * so the terminal is lawfully parked and a digest line is the honest weight.
 * Unclaimed: SILENCE, and silence means NO CALL AT ALL — there is no "drift"
 * arm, no warning, no line anywhere. That was ruled out on purpose (the
 * dispatch, 2026-08-31): a doorbell that also reports what it decided not to
 * ring about is a doorbell nobody can leave on.
 *
 * ## AND A FLOOR ON SILENCE, which is not a third meaning
 *
 * The two meanings are the whole of what a fleet event can mean. The
 * HEARTBEAT ({@link makeHeartbeat}) is not one of them and never becomes one:
 * it names no terminal, it is not derived from an event, and nothing about it
 * is a report on the fleet. It exists because the orchestrator's own hand-run
 * fleet watch is retired in this landing, which leaves SILENCE as the only
 * thing supervision has to go on — and quiet-and-fine and quiet-because-broken
 * must never look alike.
 *
 * So a conversation that heard nothing for a whole watch window is told, in
 * evidence rather than in reassurance: which file it is scoped to, how many
 * terminals that file derives right now, when the watcher last saw an event,
 * and how long it has been watching. "Still here" proves nothing; those four
 * are what let a reader tell a live watcher from a wedged one.
 *
 * It is a FLOOR AND NOT A METRONOME — any wake or digest that lands in the
 * window resets it, so a busy day never sees a heartbeat at all — and it is
 * emphatically NOT the thing that reports a fault. A scope whose file has gone
 * is not listed by core's `scopes()` at all, so it is never beaten for; a
 * heartbeat that also said "and by the way your scope is broken" would be two
 * signals in one sentence, and the one a person needs most would arrive
 * dressed as the one they learn to ignore.
 *
 * ## THIS MODULE OWNS NO STANDING SET, and that is a ruling rather than an economy
 *
 * There is no cache of claimed ids here, and nothing watches for changes.
 * Every export is a pure function of the revision it is handed:
 * `derive(scope file, revision) -> the claimed set`, walked per event.
 *
 * The store's parsed, revisioned vault IS the maintained in-memory copy, and a
 * doorbell-private set beside it would be the Monitor's frozen `--ignore` list
 * reborn one floor down — a second copy of the truth, plus the standing duty to
 * catch every source that changes it. That duty is exactly what failed twice in
 * one day and exactly what this PR exists to end; re-acquiring it inside the
 * thing that replaced it would be the whole feature undone quietly.
 *
 * It costs nothing worth counting. Events are rare — a terminal has to go quiet
 * and stay quiet — and the walk is microseconds over an index the derivation
 * already keeps. `server.ts`'s `ring` memoises per FILE for the length of ONE
 * event, because a person with three seats on one board would otherwise pay
 * three identical walks; that map is minted per event and dropped with it,
 * which is the only lifetime any of this has.
 *
 * `./doorbell.test.ts` pins it rather than trusting this paragraph: a claim
 * added between two events is seen by the second, and an older revision handed
 * back answers what IT says.
 *
 * THE ONE `let` IN THIS FILE IS THE HEARTBEAT'S, and it is admissible for a
 * reason that has to be stated rather than assumed. {@link makeHeartbeat}
 * remembers which conversations THIS PROCESS delivered words into since the
 * last beat, and when it last saw an event. Those are facts about ITS OWN
 * ACTIONS — nothing else in the world can contradict them, and no source has to
 * be caught changing them — where the forbidden set was a copy of DERIVED
 * TRUTH, which the vault moves underneath. The rule is not "hold no state", it
 * is "hold no second answer to a question the vault already answers", and the
 * count in a heartbeat's own sentence is derived at send time exactly like
 * every other number here. The ledger is bounded by construction too: it is
 * cleared whole on every beat, so a conversation nobody has scoped since
 * yesterday is not in it.
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
 * ## AND IT SAYS WHAT IT DID, which the first landing did not
 *
 * Every seam here and in {@link ./server.ts} writes one line per moment on the
 * owner's debug channel ({@link ./trace.ts}): the event that arrived, the set
 * one file derived, what that meant to each scoped conversation, what was
 * handed to core and what actually went in, and the beat under all of it.
 *
 * IT IS PART OF THE FEATURE AND NOT INSTRUMENTATION AROUND IT. A doorbell's
 * failure mode is a call that does not happen, which is byte-for-byte identical
 * to its ordinary quiet operation — so a doorbell with no account of itself is
 * one that cannot be told from a broken one, and `doorbell-missing-claim` was
 * diagnosed by counting messages by hand out of a chat transcript because that
 * transcript was the only record there was. Silence stays silence to the
 * CONVERSATION, which was ruled and is not reopened; what changed is that it is
 * no longer silence to the owner.
 *
 * Every claim above is held by `./doorbell.test.ts` over whole vaults through
 * the real parser, rather than by this paragraph.
 */

import {
  countedChildren,
  declaresKind,
  type Derived,
  follow,
  insideSubtree,
  type LocatedRegular,
  type PropDeclarations,
  type Settled,
  settles,
  type Status,
  textDeclaredAs,
} from "@olai/format"
import { heldStateOf } from "olai-plugin-kolu/appliance"
import {
  type FleetTerminal,
  type KoluEvent,
  reminderAccount,
  resolveTerminal,
  whoOf,
} from "olai-plugin-kolu/appliance/wire"
import { nodeRef } from "@olai/plugin-kit/ref"

import { TERMINAL_TYPE } from "./kinds.ts"
import { listed, type Trace } from "./trace.ts"

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
 * DOES THIS MARK END THE WAIT — asked of `Derived.status`'s PARTIAL answer,
 * which is the whole reason this is a function and not `settles` called
 * directly.
 *
 * `settles` takes a `Status`; the index answers `Status | undefined`, and the
 * unmarked case is the one every gate here has to get right. It is NOT
 * `!unfinished(mark)`: those two differ on exactly the unmarked node —
 * `unfinished` reads it as "not work", this reads it as "not finished" — and
 * the difference is the P1 {@link claiming} carries. A row nobody has ruled on
 * has not settled; it has not been ruled on, and what is under it decides.
 *
 * A TYPE GUARD, so the narrowing does the arguing: past a `settled` gate a mark
 * is `Unfinished | undefined` BY TYPE, and a reader downstream never has to
 * re-establish it. {@link claiming} used to re-ask `unfinished` of a mark it had
 * already gated, which is a runtime proof of a compile-time fact — and the one
 * that reads as a live case a reader must think about.
 */
const settled = (mark: Status | undefined): mark is Settled => mark !== undefined && settles(mark)

/**
 * THE TERMINAL THIS NODE CLAIMS, or nothing — the licensed read and the
 * blank-value rule, folded into the one question the walk actually asks.
 *
 * A BLANK IS NOT A CLAIM. A property somebody added and left empty, or cleared
 * without removing, names no terminal — and `resolveTerminal` would answer an
 * empty string as a prefix of every id in the fleet, which is the one value that
 * must never reach it. The walk used to spell this as two locals, `said` and
 * `claimed`, the second restating the first with the rule in between.
 */
const claimedOn = (
  declarations: PropDeclarations,
  at: LocatedRegular,
): string | undefined => {
  const said = textDeclaredAs(declarations, at.node, TERMINAL_TYPE)
  return said !== undefined && said.trim() !== "" ? said : undefined
}

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
  /** The OWNING STEP's title — the deepest node being worked at or under the
   *  record that claims this terminal ({@link workingIn}), which is the word a
   *  person wants and is very often not the claiming record's own. Blank where
   *  that node has no title, which {@link bodyFor} draws around. */
  readonly step: string
  /** The owning step's mark — the one thing that decides the meaning, and read
   *  off THAT node rather than off the claim's own: a lane is marked `doing`
   *  while anybody is anywhere in it, which is not the question. */
  readonly mark: Unfinished
  /** THE NODE THAT CARRIES THE CLAIM — the record the `kolu-terminal` value is
   *  written on, by its own id.
   *
   *  It is here so the sentence can NAME it in backticks and the panel can make
   *  it pressable: the set declares this id, so the transcript's ordinary
   *  id-lookup turns it into a link back to the board row the wake was derived
   *  from. The carrying node and not the owning step, because a person pressing
   *  through wants the row the terminal is written on — the one they would edit
   *  to stop it. */
  readonly node: string
}

/** One claimed terminal that is HELD right now, ready to be a line. */
export interface Standing {
  /** The live fleet id — resolved, never the value the file wrote. */
  readonly terminal: string
  /** Who it is, in kolu's own `repo·label` spelling, or `""` where the row
   *  has neither — `@olai/kolu-client/wire`'s `whoOf`, the one fold both this
   *  sentence and the browser's feed name a row with. */
  readonly who: string
  /** The held bucket, as kolu spells it: `awaiting` or `waiting`. */
  readonly state: string
  /** The owning step's title, blank where that node has none. */
  readonly step: string
  /** The owning step.s mark, which is what put it under this meaning. */
  readonly mark: Unfinished
  /** The claiming record's id, for the pressable reference — see {@link Claim.node}. */
  readonly node: string
  /** The terminal's own label, without the repo — what the plain head names it
   *  by, where {@link Standing.who} is the fuller spelling the account uses. */
  readonly label: string
}


/**
 * WHY A CARRIER IS NOT IN THE RINGING SET — the walk's own verdict on a node
 * that names a terminal and did not become a claim.
 *
 * THREE WORDS AND NOT FOUR, because these are exactly the decisions this walk
 * makes. What it does NOT say is anything about a carrier it never reached:
 * see {@link Walked.excluded} for the one shape that hides in, and why chasing
 * it would cost the gate its whole point.
 */
export type Why =
  /** The carrying node wears `done` or `cancelled`. The wait is over, and it
   *  ended for everything under the node as well. */
  | "settled"
  /** The carrying node has no mark and nothing under it — a bullet somebody
   *  wrote. Named apart from `not-live` although the walk decides them by one
   *  predicate, because it is the ONE residual of `doorbell-missing-claim`
   *  still standing, and a reader who meets it deserves the word rather than a
   *  general answer that happens to cover it ({@link claiming}'s header). */
  | "unmarked-leaf"
  /** The carrying node is unsettled and has children, and every one of them
   *  has settled. The lane is finished without anybody having said so on the
   *  row itself. */
  | "not-live"

/** ONE CARRIER THE WALK LEFT OUT, as it was written and where. */
export interface Excluded {
  /** The `kolu-terminal` value, verbatim — the same spelling {@link Claim}
   *  carries, so a reader joins the two lists by eye. */
  readonly value: string
  /** The node that carries it, by id. */
  readonly node: string
  readonly why: Why
}

/**
 * ONE WALK'S WHOLE ANSWER: what rings, and what was left out of it.
 *
 * ## WHAT `excluded` CANNOT SAY, stated because a diagnostic that overclaims is
 * worse than one that is narrow
 *
 * A carrier under a SETTLED ancestor is never reached, so it is not in this
 * list. {@link claiming} returns at the verdict without descending and without
 * adding the node to `reached` — which is right, because `done` and `cancelled`
 * end the wait for everything beneath them, and it is the whole economy of the
 * gate — but it means the walk cannot name what it did not look at.
 *
 * THAT MATTERS MOST IN THE ORDINARY DAY-BOARD SHAPE, where the file holds a
 * MIRROR of a lane and the lane's steps live in another file entirely. Those
 * steps are not records of the filter file, so the only way in is the descent;
 * stop at the lane and they are unreachable, not merely unclaimed. A terminal
 * in that position reads as `unclaimed` at the classification, and the settled
 * ancestor is in this list saying why the branch ended.
 *
 * Two format facts sharpen it rather than making it a doorbell bug: `set_cancelled`
 * is not gated on the branch beneath it, and a git merge can leave unfinished
 * work under a `done` node. So a settled ancestor over live steps is reachable
 * in practice — and the honest answer, that the walk stopped at a verdict, is
 * exactly what this list gives.
 */
export interface Walked {
  readonly claimed: ReadonlyArray<Claim>
  readonly excluded: ReadonlyArray<Excluded>
}

/** A file that declares no terminal kind, or holds no records at all. */
const NOTHING_WALKED: Walked = { claimed: [], excluded: [] }
/**
 * EVERY CLAIM ONE FILTER FILE MAKES — the `kolu-terminal` values reachable from
 * its unsettled records, and for each the step that terminal's OWN work is at —
 * AND, beside them, the carriers this walk deliberately left OUT and why.
 *
 * BOTH HALVES COME OFF ONE PASS, and the second exists because the first is a
 * silence. A terminal that is not in the ringing set produces no call and no
 * line, which is byte-for-byte what a terminal nobody scoped produces; the RCA
 * this walk carries was "absent from the set", and the next one of its shape
 * would have been "absent, and I still do not know which gate". {@link Excluded}
 * is that gate, named at the moment the walk decides it — which is the only
 * place the answer exists without asking the vault a second question and
 * risking a second answer.
 *
 * `byFile` rather than a filter over `derived.nodes`, because the derivation
 * already keeps that index in LINE order and the file's own order is the
 * order a person reads the board in — which is the order the sentence's lines
 * come out in, further down.
 *
 * ## THREE THINGS THIS WALK GOT WRONG, all of them the same mistake
 *
 * It used to anchor on the RECORD IN THE FILE: it read the placement's own
 * mark, took the property off whatever `follow` resolved to, and stopped
 * there. The human dogfooded it against a live board on 2026-08-31 and the
 * three failures that came back were one defect seen from three sides — the
 * anchor is not the row in the file, it is the node that CARRIES the terminal.
 *
 * **The subtree was never walked.** A lane that reaches this file as a MIRROR
 * resolves to its target, and the terminals of a split lane are claimed on the
 * target's STEPS — a reviewer per step — not on the target itself. Following
 * the mirror and reading only the record it lands on finds nothing, so a
 * mirrored lane's steps never rang at all. `follow` gets us to the target; the
 * walk has to keep going DOWN from there ({@link Derived.children}).
 *
 * **The meaning read the wrong node's mark.** The ruled table is about the
 * TERMINAL'S OWN step — "its own step is `doing` and it goes quiet" — and the
 * placement's mark is the LANE's. An author whose own steps are all done, in a
 * lane where somebody else's step is still `doing`, is lawfully parked and owes
 * nobody anything; it drew a WAKE saying a report was owed, which is the one
 * arm the human ruled out of the digest.
 *
 * **The step it named was the claim's, not the work's.** A terminal claimed at
 * LANE level is the ordinary shape, and naming the lane back to somebody who is
 * looking at the lane says nothing. What they want is the step the agent is
 * actually on.
 *
 * ## So: the carrying node, and the deepest `doing` under it
 *
 * For each un-done record in the file, `follow` to what it shows and walk that
 * subtree. Every node carrying a declared `kolu-terminal` value is a claim, and
 * ITS OWN subtree decides the claim — the deepest `doing` node in it, or the
 * carrying node itself when nothing under it is doing.
 *
 * That one rule answers all three. A step-level claim under a mirrored lane is
 * found because the walk descends. A parked author reads its own steps and they
 * are done, so it is a digest. A lane-level claim reads the lane's steps and
 * names the one somebody is on. And it degenerates correctly: a claim on a leaf
 * step is its own owning step, which is what the old walk did right.
 *
 * DEEPEST rather than first, because a step with sub-steps is a step whose real
 * work is below it — "implement" being `doing` over "write the test" being
 * `doing` is one fact, and the useful half is the lower one.
 *
 * A LICENCE FIRST, so a vault that declares no terminal key pays one walk of
 * its declarations rather than one per record — {@link ./claimants.ts}'s own
 * economy, and the same door.
 */
export const walkedIn = (
  declarations: PropDeclarations,
  derived: Derived,
  file: string,
): Walked => {
  if (!declaresKind(declarations, TERMINAL_TYPE)) return NOTHING_WALKED
  const inside = derived.byFile.get(file)
  if (inside === undefined) return NOTHING_WALKED
  const claims: Array<Ranked> = []
  const excluded: Array<Excluded> = []
  /**
   * EVERY NODE THIS WALK HAS REACHED, and it is what makes the whole thing one
   * pass instead of N.
   *
   * `byFile` is every record written in the file, not its top-level rows — so a
   * lane, its authors and their steps are all in `inside`, and a descent from
   * each would walk the same subtree once per un-done ancestor above it. One
   * record may also be reached twice honestly: a lane and a mirror of it, or
   * two mirrors of one target. Both are the same question, and the answer for a
   * node does not depend on which way in it was found.
   */
  const reached = new Set<string>()
  for (const located of inside) {
    // NO MARK IS ASKED HERE, and that is the point. Whether a node is silent —
    // settled — and whether its claim counts are ONE rule, and {@link claiming}
    // owns it: this loop's only job is to name the roots to descend from.
    //
    // IT USED TO ASK, and the answer was always the same one `claiming` was
    // about to reach: `Derived.status` resolves a placement to what it SHOWS,
    // so a mirror's mark IS its target's, and the gate here and the gate there
    // could not disagree. What it bought was skipping a `follow` on a settled
    // row; what it cost was one rule spelled in two places, each with its own
    // paragraph about which node it was asked of — and a rule spelled twice is
    // a rule that can be fixed once. That is not a hypothetical here: this gate
    // and its twin were the SAME defect (`doorbell-missing-claim`), and the
    // half-fix that repaired only one of them would have passed every test the
    // other one owns.
    const found = follow(derived, located)
    // A dangling or circular mirror shows no record, so there is nothing to
    // read a property off. It is not an error here — the vault says so
    // loudly enough elsewhere — it is simply a placement claiming nothing.
    if (found.kind !== "found") continue
    if (reached.has(found.shows.node.id)) continue
    claiming(declarations, derived, found.shows, reached, claims, excluded, undefined)
  }
  return {
    // DOCUMENT ORDER RESTORED, which is the order a person reads the board in
    // and therefore the order the sentence's lines come out in.
    claimed: claims.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...claim }) => claim),
    // The exclusions are NOT re-ordered. They are a diagnostic and their order
    // is the walk's, which is the order a reader following the descent expects
    // — where the claims' order is the BOARD's, because it is what a person
    // reads back in a sentence.
    excluded,
  }
}

/**
 * THE RINGING HALF ALONE — what everything but the diagnostic wants.
 *
 * {@link walkedIn}'s claims, and never a second walk: the two answers come off
 * one pass for the reason the module keeps about every other pair here, which
 * is that a second walk is a second chance to disagree.
 */
export const claimedIn = (
  declarations: PropDeclarations,
  derived: Derived,
  file: string,
): ReadonlyArray<Claim> => walkedIn(declarations, derived, file).claimed

/** A claim with the walk's own arrival number on it — see the push below. It
 *  never leaves this module: {@link claimedIn} sorts by it and drops it. */
interface Ranked extends Claim {
  readonly rank: number
}

/**
 * WHAT A NODE ANSWERS ITS PARENT WITH — two facts, because the walk decides two
 * things and they are not the same question.
 */
interface Under {
  /** The deepest node being worked AT OR UNDER this one, or `undefined` where
   *  nobody is on anything here. It is what names a wake's step. */
  readonly deepest: LocatedRegular | undefined
  /**
   * Whether there is unfinished work AT OR UNDER this one — this node's own
   * mark where it has one, or any descendant's where it does not.
   *
   * IT IS NOT "`deepest !== undefined`". A subtree of `todo` steps is live and
   * nobody is on it, which is the digest arm's whole subject; a subtree where
   * every step has settled is finished, and finished is silent. One is about
   * who is working, the other about whether there is work — and collapsing them
   * would make every parked author disappear or every closed lane ring.
   */
  readonly live: boolean
}

/** Nothing here — what a SETTLED node answers with, and the only thing that
 *  does: an already-reached node never reaches this function at all, it is
 *  short-circuited by the descent. */
const NOTHING_UNDER: Under = { deepest: undefined, live: false }

/**
 * ONE POST-ORDER PASS: collect this node's claim, and answer its parent with
 * what is going on at or under it ({@link Under}).
 *
 * ## Why the two questions are one walk
 *
 * The claim and its meaning are asked of the same subtree — what terminal does
 * this node carry, and what work is going on beneath it — so asking them apart
 * meant descending twice: once to find the carrying nodes and again, per
 * carrying node, to find its owning step. Nested claims paid it again per
 * level. Post-order answers both on the way back up: a node learns what is
 * happening below it from the children it has already visited, and hands the
 * same answer to its own parent.
 *
 * `deepest` is "the deepest node being worked AT OR UNDER me", which is exactly
 * what a parent needs and is NOT what this node decides its own claim by — that
 * one is strictly-under, and it is `deepest` before this node adds itself. The
 * distinction is the parked-author rule ({@link Claim.mark}): a node that
 * contains steps is not a step, and a lane is marked `doing` while anybody is
 * anywhere in it.
 *
 * ## WHETHER A CLAIM COUNTS IS `live`, and it used to be the node's own mark
 *
 * A claim is somebody's business while there is unfinished work at or under the
 * node carrying it. For a LEAF that is its own mark and nothing else, which is
 * the ordinary step-level claim and the same answer as before: an unmarked leaf
 * is a line somebody wrote, not a task somebody is on, and it claims nothing.
 * For a CONTAINER it is the subtree, because a container is judged by its
 * children and never by itself — the sentence {@link owning} has always kept
 * about the MEANING, kept here about EXISTENCE too.
 *
 * THE P1 THIS FIXES (`doorbell-missing-claim`, 2026-09-01) is the second half
 * of that sentence going missing. The gate asked the carrying node for an
 * unfinished mark OF ITS OWN, so a lane whose node had been filed as a bullet
 * before its dispatch — the claim and the eleven steps grafted on later, the
 * node's own row never marked — was not in the set at all. It drew no wake, no
 * nag and no place in the heartbeat's count for 26 minutes with an agent
 * sitting `waiting`, while four lanes beside it on the same board, in the same
 * conversation, rang. Nothing about the board said that lane was different; one
 * absent field did, invisibly.
 *
 * WHAT DOES NOT CHANGE is the settling end of it. A `done` or `cancelled` node
 * is silent and stops the walk, exactly as before and for the reason the header
 * gives: two marks end the wait, and a review step folded half an hour ago owes
 * nobody anything. The widening is only over the UNMARKED, which was never a
 * verdict — and it is a widening that a subtree can still refuse, which is what
 * keeps a closed lane closed.
 */
const claiming = (
  declarations: PropDeclarations,
  derived: Derived,
  at: LocatedRegular,
  reached: Set<string>,
  claims: Array<Ranked>,
  /** ...and the carriers left OUT, with the verdict that left them there
   *  ({@link Excluded}). Filled on the way down and up exactly as `claims` is:
   *  one pass answers both, because the two are the same decision seen from its
   *  two sides. */
  excluded: Array<Excluded>,
  /** The claim that owns the walk this node is inside — see `owner` below. */
  mine: string | undefined,
): Under => {
  /** THIS NODE'S OWN MARK — `Unfinished | undefined` past the gate below, which
   *  is the whole reason {@link settled} is a type guard: everything downstream
   *  reads this without re-establishing what it is. */
  const own = derived.status.get(at.node.id)
  /** ...AND THE TERMINAL IT NAMES, read BEFORE the settled gate so that a
   *  carrier the gate is about to silence can still say so. That is one map
   *  read per settled node per walk, and it is what buys `why=settled` at the
   *  classification: a lane somebody closed is the commonest honest answer to
   *  "why did this not ring", and the walk is the only place that knows it. */
  const claimed = claimedOn(declarations, at)
  // A SETTLED NODE IS THE END OF THIS BRANCH — no claim of its own, nothing
  // said about what is under it, and no descent. THE ONLY PLACE THIS IS ASKED,
  // for the reason the outer loop states where it used to ask too.
  //
  // The human found it on a live board: a review step folded half an hour
  // earlier still rang, because the lane above it was open and nothing re-asked
  // the step. `done` and `cancelled` both end the wait, and both end it here.
  //
  // AND IT DOES NOT ADD TO `reached`, which is what makes the branch's own
  // descendants unreachable rather than merely unclaimed — {@link Walked} says
  // what that costs a reader and why it is still right.
  if (settled(own)) {
    if (claimed !== undefined) excluded.push({ value: claimed, node: at.node.id, why: "settled" })
    return NOTHING_UNDER
  }
  const rank = reached.size
  reached.add(at.node.id)
  /** WHOSE WORK THIS SUBTREE IS: this node's own claim where it has one, and
   *  otherwise the nearest ancestor's. Read BEFORE the descent, because it is
   *  what the descent is judged against. */
  const owner = claimed ?? mine
  /** The deepest node being worked STRICTLY under this one, once the loop has
   *  run — which is what this node's own claim is judged by. */
  let deepest: LocatedRegular | undefined
  /** ...and whether there is any unfinished work under it at all, which is what
   *  decides whether the claim is anybody's business. Seeded with this node's
   *  OWN mark — which is unfinished or absent and can be nothing else here — so
   *  a leaf answers by itself and a container is answered by the loop below:
   *  the two halves of {@link Under.live}. */
  let live = own !== undefined
  let leaf = true
  for (const child of countedChildren(derived, at.node.id)) {
    leaf = false
    // A CYCLE STOP, and unreachable in a well-formed set: `children` is built
    // from `parent`, so a node has one parent and a descent visits it once.
    // The reach that really happens is across ROOTS — a mirror target that is
    // also a row of this file, or two mirrors of one target — and the outer
    // loop catches that one. This is here so a malformed parent chain ends the
    // walk instead of the process.
    if (reached.has(child.node.id)) continue
    const under = claiming(declarations, derived, child, reached, claims, excluded, owner)
    // LAST ONE WINS ACROSS SIBLINGS, and that is a tie-break rather than a rule
    // about depth. `deepest` is strictly-under, so two siblings both being
    // worked are two answers and this takes the LATER in document order — the
    // lower row on the board, which is the one a person scrolling reads last and
    // the one a lane's own order puts nearest the work in hand. Neither is
    // wrong, and the sentence names one step; what matters is that the pick is
    // STATED rather than emergent, so a reader is not left deducing it from a
    // loop. Depth still beats breadth: a deeper `doing` returned by any child
    // replaces a shallower one, because each child answers with its own deepest.
    if (under.deepest !== undefined) deepest = under.deepest
    // ...AND ANY ONE OF THEM MAKES THIS NODE LIVE. Unlike `deepest` this is an
    // OR and never a pick: the question is whether the subtree holds work, and
    // one unfinished step is the whole answer however many settled ones sit
    // beside it.
    if (under.live) live = true
  }
  // A CLAIM COUNTS WHILE ITS SUBTREE IS LIVE — see the header on this function
  // for the P1 that was, and for why this is not the node's own mark.
  if (claimed !== undefined && live) {
    // RANKED BY WHEN THE WALK REACHED IT, which is document order: `reached`
    // is added to on the way DOWN, and the outer loop feeds it the file's rows
    // in line order. The push cannot be, because a node's own claim is not
    // decided until its children have answered — so the order is recorded here
    // and restored once, at the end.
    //
    // THE STEP-MARK IS DECIDED HERE rather than inside {@link owning}, because
    // this is where `leaf` is known: a node that CONTAINS steps is not itself a
    // step, so it has no mark AS ONE, and `undefined` is that. `owning` used to
    // be handed the whole `Derived` and a boolean so it could re-read a mark
    // this scope already holds — three arguments to reconstruct one fact.
    claims.push({
      rank,
      value: claimed,
      node: at.node.id,
      ...owning(at, deepest, leaf ? own : undefined),
    })
  } else if (claimed !== undefined) {
    // ...AND WHERE IT DOES NOT, THE WALK SAYS SO. Unsettled (the gate above
    // returned) and not live: either a bullet with nothing under it, or a node
    // whose children have all settled.
    //
    // THE TWO ARE ONE PREDICATE AND TWO WORDS, deliberately. `unmarked-leaf` is
    // the residual of `doorbell-missing-claim` still standing — a lane filed as
    // a bullet and given ONLY a terminal, before its steps land, is silent — and
    // a reader who meets it in a log deserves that word rather than a general
    // one that happens to cover it. {@link Why} carries the argument.
    excluded.push({
      value: claimed,
      node: at.node.id,
      why: leaf && own === undefined ? "unmarked-leaf" : "not-live",
    })
  }
  // WHAT THIS NODE HANDS ITS PARENT — `live` unchanged and unconditional, and
  // one of three answers about the STEP. The three used to be three returns,
  // each re-stating `live`; that they never varied it is the fact worth reading
  // off the shape, because it is exactly the asymmetry the fence below turns on.
  return {
    live,
    // ANOTHER TERMINAL'S CLAIMED STEP IS NEVER YOUR OWING STEP, and this arm is
    // the whole of that rule. A node carrying a claim of its own is that
    // terminal's territory, it and everything under it — so it answers its
    // ancestors with no STEP, whatever is going on inside it.
    //
    // IT USED TO ANSWER ANYWAY, and the human found it on a live board: a lane
    // claimed by an author whose own work was done drew a WAKE saying "its step
    // "review: pi" is doing — a report is owed", when that step is the pi
    // REVIEWER'S, carrying the reviewer's own terminal. The author owed nothing;
    // somebody else was working. Excluding a claimed subtree leaves the author
    // with nothing being worked, which is the digest the ruled table asks for.
    //
    // THE FENCE TOUCHES THE STEP AND NEVER `live`, which is why the two are
    // separate fields at all ({@link Under.live}). The fence is about WHOSE
    // WORK a step is; it is not about whether the lane still holds any. An
    // author parked over a reviewer's live step is exactly the digest the ruled
    // table asks for — present, and saying nobody is on it — where a fence that
    // swallowed `live` too would delete it from the set, which is this file's
    // own P1 again one rule down.
    deepest: claimed !== undefined && claimed !== mine
      ? undefined
      // ...OR THE DEEPEST WORK, and this node itself where it is marked
      // `doing` and nothing under it is. UNCHANGED by this pass, deliberately:
      // a CONTAINER marked `doing` hands itself up here, which sits oddly
      // beside the parked-author rule the claim side keeps — but that is a
      // question about the semantics and not about the shape, and a refactor
      // is the wrong place to answer it.
      : deepest ?? (own === "doing" ? at : undefined),
  }
}

/**
 * THE STEP A TERMINAL'S WORK IS AT, and the mark that decides its meaning —
 * TWO FACTS READ OFF WHAT THE WALK ALREADY KNOWS, and nothing looked up again.
 *
 * Somebody is on something under this claim: that node, and `doing`. Nobody is:
 * this node, and its mark AS A STEP — which is its own where it is a leaf and
 * nothing where it has children, because a node that CONTAINS steps is not one.
 * The caller decides that (it is where `leaf` is known) and hands it over; this
 * took the whole `Derived` and a boolean to re-read a mark the caller was
 * already holding, which is three arguments spent reconstructing one fact.
 *
 * `todo` for the absent case is the honest mark and the one {@link meaningOf}
 * sends to the digest: open, and nobody on it. An author whose own steps are
 * all done sits under a lane still marked `doing` because a reviewer is going —
 * reading the LANE's mark there says a report is owed, and nobody owes one.
 */
const owning = (
  at: LocatedRegular,
  deepest: LocatedRegular | undefined,
  /** This node's mark as a STEP — see above, and {@link claiming}'s push. */
  step: Unfinished | undefined,
): { readonly step: string; readonly mark: Unfinished } =>
  deepest !== undefined
    ? { step: deepest.node.title, mark: "doing" }
    : { step: at.node.title, mark: step ?? "todo" }

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
 * A `heartbeat` carries no row and means nothing here: alive is the pill's
 * news and not a conversation's. Nothing mints one any more — liveness is
 * the subscription's own stamps now — but a ring served from before the
 * fold can still carry one, and the arm is its home. A `nag` means exactly
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
      who: whoOf(row.repo, row.label),
      state: held.bucket,
      step: claim.step,
      mark: claim.mark,
      node: claim.node,
      label: row.label,
    })
  }
  return standing
}

/**
 * ONE STAMP a person reads, off the caller's clock — for the ACCOUNT, which is
 * where a reader reconstructing an afternoon wants the date as well.
 *
 * The server's clock is what stamped it, and pretending otherwise would be
 * inventing a timezone for a reader whose own is unknown here. A clock this
 * runtime cannot parse passes through VERBATIM: a time in somebody else's
 * spelling beats a wrong one in ours.
 *
 * IT IS NOT IN THE HEAD. The transcript stamps every row it draws, so a clock
 * on the drawn line would be the same fact twice — and the head is the one line
 * a glance gets, which is too little room to spend on a fact already on screen.
 */
const stampOf = (now: string): string => {
  const at = new Date(now)
  if (Number.isNaN(at.getTime())) return now
  return `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

/**
 * ONE STANDING TERMINAL, as its own line of the account — and the one place a
 * person can press through to the board.
 *
 * The CLAIMING NODE'S ID rides here in backticks ({@link Standing.node}). The
 * set declares it, so the transcript's ordinary id-lookup makes it a link to the
 * row the wake was derived from — the row somebody would edit to stop it. That
 * costs no new mechanism and invents no syntax: an id in a code span is the
 * convention every olai tool already writes and the panel already reads.
 *
 * See the header on why the ids are in backticks and the lead-in is a plain em
 * dash rather than a list marker: nothing renders this.
 */
const lineOf = (one: Standing): string => {
  const who = one.who === "" ? "" : ` (${one.who})`
  // NO MARK IS ASSERTED ON THE DIGEST ARM, and that is a correction rather than
  // a wording choice. `Standing.mark` is a DERIVED verdict — a container with
  // nothing being worked under it reads `todo` however the board marked the
  // container itself — so printing it as the step's mark told a person the board
  // said something it did not. The wake arm may still say `doing`, because there
  // the mark is a node's own and was read off it.
  const step = one.mark === "doing"
    ? one.step.trim() === ""
      ? "the node that claims it is `doing`"
      : `its step "${one.step.trim()}" is \`doing\``
    : one.step.trim() === ""
    ? "nothing under the node that claims it is being worked"
    : `nothing under "${one.step.trim()}" is being worked`
  return `— \`${one.terminal}\`${who} is held at \`${one.state}\`; ${step}, on ${nodeRef(one.node)}.`
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
  event?: KoluEvent,
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
  const reminder = reminderOf(event)
  return [
    essenceOf(meaning, standing),
    "",
    `Written by olai's kolu watcher at ${stampOf(now)}, not by a person.`,
    ...(reminder === null ? [] : ["", reminder]),
    "",
    opening,
    "",
    ...standing.map(lineOf),
    "",
    `These are read off the un-done nodes of ${file}, mirrors followed to their targets. It is the whole standing set and not only the terminal that moved just now; clearing the file on this conversation's wake control stops it.`,
  ].join("\n")
}

/**
 * WHICH REMINDER THIS IS, as its own line — and `null` where there is no
 * counting to say.
 *
 * THE FIRST REPORT CARRIES NONE. The event padi counts from is the
 * `transition` (or a re-lead `snapshot`): a cap is a cap on a repetition,
 * and the one the repetition repeats is it. So the count is said from the
 * first REMINDER on, out loud, in the same body the standing set is in —
 * the caller reads it straight off the event's own `nag` field rather than
 * counting anything itself, because the daemon's accounting is the one
 * that survives a restart ({@link ./client/watch.ts}'s header).
 *
 * THE LAST ONE SAYS SO IN WORDS. A capped nag that ends well is
 * indistinguishable from a watcher gone quiet unless this clause says so —
 * and misreading it is precisely the failure the floor under silence is
 * not allowed to hide behind (the heartbeat counts a reminder as speech,
 * so after this one, only a real quiet follows).
 *
 * AND THE CLAUSE NAMES ITS TERMINAL. The body it rides in is about the
 * whole STANDING set — it may list four rows — and a reminder line whose
 * subject stays unspoken pastes one event's count onto every one of them.
 * The id is the event's own: the reader sees exactly which row the count
 * is about.
 */
const reminderOf = (event: KoluEvent | undefined): string | null => {
  // The ACCOUNT is the wire's fold (`reminderAccount`, beside the schema);
  // this is only the body's own wording of it, with the event's own row
  // named as the subject. GATED BY KIND the exact way the drawer's stamp
  // is — the flat schema will still decode a `transition` bearing `nag`,
  // and while translate strips the pairing one hop upstream, no reader of
  // this body may spell a count onto a kind the other face refused.
  const account = reminderAccount(event?.kind === "nag" ? event.nag : undefined)
  if (account === null || event?.row === null || event === undefined) return null
  const id = event.row.terminal
  if (account.total === null) {
    return `This is reminder ${account.index} of an uncapped nag for \`${id}\` — it repeats on this interval while the state holds (a cap is spelled \`nag: 30m/3\` in _olai/Kolu.olai).`
  }
  if (account.last) {
    return `This is reminder ${account.index} of ${account.index} for \`${id}\`, the last — this doorbell goes quiet about that terminal until its state changes.`
  }
  return `This is reminder ${account.index} of ${account.total} for \`${id}\`.`
}

/**
 * THE HEAD — a PLAIN SENTENCE, in words a reader who was not there understands.
 *
 * ## Why the identifiers are not here
 *
 * This is the only line the transcript draws until somebody opens the fold, and
 * the person reading it has just been interrupted. `kolu wake · olai·fdo-residuals
 * author (grok) — trivial pair waiting — a report is owed · 19:38` is a line you
 * have to already know the system to parse: five facts, four middots and no verb.
 * What a person needs first is WHAT HAPPENED. The ids, the marks, the derivation
 * and the standing-set note are all still written — one press away, in the
 * account below — and the AGENT gets the whole thing as the message text either
 * way. Only the drawn head changed.
 *
 * It is the manifest's oldest rule spent where it finally bites: the plugin
 * writes whole sentences, because the four ways a wake could be described have
 * nothing in common but that they are wakes, and core summarising one would be
 * core writing words it cannot write well.
 *
 * ## WHOSE IT IS, and why this line no longer says
 *
 * It opened with `kolu` for one round, on the rule that a body must name its own
 * author because core's `rang` mark does not survive a session replay
 * ({@link ../../surface/src/chat.ts}). THE RULE STANDS AND THE PLACE WAS WRONG:
 * the panel draws a mark and a byline above the row, so a head that also said
 * `kolu` spent the scarcest words in the message — the one line a glance gets —
 * on a question already answered twice above it.
 *
 * The attribution did not go anywhere. It is the line below this one, *Written
 * by olai's kolu watcher at <time>, not by a person*, which is IN THE BODY and
 * therefore in the text a replay rebuilds. A resumed conversation still names the
 * author; a live one no longer says it three times.
 *
 * NO TIME HERE either, and for that economy: the transcript stamps every row it
 * draws, and the full stamp is on that attribution line for a reader
 * reconstructing an afternoon.
 *
 * ## THE HEAD CARRIES THE ONE PRESSABLE REFERENCE
 *
 * The claiming node's id rides here in backticks, not only in the account. The
 * fold is one line until somebody opens it, and pressing through to the board
 * was the thing a person wanted to do FROM that line — an id that only appeared
 * once the fold was open was a link behind the very fold it was the reason to
 * open. The set declares the id, so the transcript's ordinary lookup makes it a
 * link; nothing here knows that, and nothing here has to.
 *
 * THE HEAD LINKS ONLY WHEN IT NAMES ONE THING. Where several terminals stand
 * the head says a count and links nothing, because a head that pressed through
 * to one of five would be picking for the reader — and which one it picked
 * would move with the board. The account below names every one of them, each
 * with its own reference, which is what the fold is for.
 */
const essenceOf = (meaning: Meaning, standing: ReadonlyArray<Standing>): string => {
  const one = standing.length === 1 ? standing[0] : undefined
  if (meaning === "wake") {
    return one === undefined
      ? `${standing.length} terminals are idle: they have finished, or they need you.`
      : `The ${namingOf(one)} is idle on ${nodeRef(one.node)}: it has finished, or it needs you.`
  }
  return one === undefined
    ? `${standing.length} terminals went quiet, and nothing under them is being worked. A note, not a call.`
    : `The ${namingOf(one)} went quiet on ${nodeRef(one.node)}, and nothing under it is being worked. A note, not a call.`
}

/**
 * WHAT TO CALL ONE TERMINAL in a plain sentence — its label and the step it is
 * on, which together read as a thing a person recognises ("the fdo-residuals
 * author").
 *
 * The LABEL rather than {@link Standing.who}'s `repo·label`: the repo is the
 * same one for every row on a board somebody is watching, so it is noise in the
 * head and a fact in the account. Where a row has neither label nor step there
 * is nothing to name it by but its id, and the sentence says so rather than
 * leaving a hole.
 *
 * ## The step joins the name only when it READS as a role
 *
 * "the fdo-residuals author" is how a person says it; "the done-flip-flake
 * reproduce + fix + open PR" is not. A board writes both — a step title is a
 * role on some rows and a whole sentence on others — and the difference is
 * length, so that is what is asked. Three words is the bar, and it is a prose
 * rule with a stated bar rather than a guess: a short title is a name for
 * somebody's job and reads inside a sentence, a long one is already a sentence
 * and would need its own. The long one is not lost — the account names it a
 * press away, which is where every other identifier went.
 */
const ROLE_WORDS = 3

const namingOf = (one: Standing): string => {
  const label = one.label.trim()
  const step = one.step.trim()
  const role = step !== "" && step.split(/\s+/).length <= ROLE_WORDS ? step : ""
  if (label === "") return role === "" ? `\`${one.terminal}\` terminal` : role
  return role === "" ? `${label} terminal` : `${label} ${role}`
}

// ── THE HEARTBEAT — a floor on silence ────────────────────────────────────


/**
 * ONE FILE'S RINGING SET, DERIVED AND SAID OUT LOUD — the seam both drives
 * reach the walk through, and the line that would have ended
 * `doorbell-missing-claim` in one glance.
 *
 * ## Why this lives HERE and not in the serve that calls it
 *
 * It was a closure inside `./server.ts`'s `serve`, which meant the one line
 * this whole logging half exists to emit could not be reached by a test without
 * standing up `koluHalf`, a surface and a ctx. Nothing pinned that `derived`
 * names the set rather than counting it — and an edit that logged
 * `ringing: claiming.size` would have shipped green and left the next P1 of
 * this shape exactly as undiagnosable as this one was.
 *
 * It needs none of that. A `Derived`, a file, the fleet's ids and a channel:
 * every argument is a value, so `./doorbell.test.ts` drives it over a whole
 * vault through the real parser exactly as it drives the walk underneath.
 *
 * ## WHAT IT NAMES is the whole answer and all three of its halves
 *
 * How many claims the file makes; which fleet ids those RESOLVED to, each with
 * the board row that carries it, so a reader goes straight to the row rather
 * than to a uuid; which live claims matched NOBODY; and which carriers the walk
 * left OUT, each with the verdict that left it there.
 *
 * THE ABSENCE IS THE READABLE FACT, which is why `ringing` is a list and not a
 * count. The RCA was "absent from the set", and an absence is only legible
 * against the set it is absent from. `excluded` is the other half of the same
 * lesson: the next RCA of this shape would have been "absent, and I still do
 * not know which gate", and this is the gate.
 */
export const ringingIn = (
  declarations: PropDeclarations,
  derived: Derived,
  file: string,
  fleet: ReadonlyArray<string>,
  trace: Trace,
): Ringing => {
  const { claimed, excluded } = walkedIn(declarations, derived, file)
  const claiming = claimingIn(claimed, fleet)
  // The claims that WON a fleet id, by identity — `claimingIn` hands back the
  // very objects it was given, so this is a pointer set and never a re-walk.
  const matched = new Set(claiming.values())
  const unmatched = claimed.filter((claim) => !matched.has(claim))
  trace("derived", {
    file,
    claims: claimed.length,
    ringing: listed([...claiming].map(([id, claim]) => `${id}@${claim.node}`)),
    unmatched: listed(unmatched.map((claim) => `${claim.value}@${claim.node}`)),
    excluded: listed(excluded.map((one) => `${one.value}@${one.node}:${one.why}`)),
    fleet: fleet.length,
  })
  return { claiming, unmatched, excluded }
}

/** {@link ringingIn}'s answer: who rings, and the two ways somebody does not. */
export interface Ringing {
  readonly claiming: ReadonlyMap<string, Claim>
  /** Live claims whose value named no single fleet id — an ambiguous prefix, a
   *  terminal that has shut, or a second row copying a property the first row
   *  already won. */
  readonly unmatched: ReadonlyArray<Claim>
  readonly excluded: ReadonlyArray<Excluded>
}

/**
 * WHY THIS TERMINAL IS NOT BEING RUNG FOR — the word that goes on a
 * `classified` line when the meaning is silence.
 *
 * SILENCE IS STILL SILENCE TO THE CONVERSATION. This is the owner's channel and
 * changes nothing about what a person is told; what it changes is that the
 * decision stops being invisible. `meaning=none` named the event's terminal and
 * not which gate had dropped it, and "absent from the set" was exactly the RCA
 * that took an afternoon — the next one should be a `grep`.
 *
 * THE VALUE IS MATCHED BY PREFIX, not by equality, because that is how the
 * board writes one: a row saying `11e565c0` is naming a whole uuid it has
 * abbreviated, and `resolveTerminal` is the function that knows it. Asked here
 * of the values that did NOT resolve, which is the one population that function
 * has already refused — so this is a reading of the refusal rather than a second
 * attempt at the join.
 */
export const whyOut = (
  terminal: string,
  ringing: Ringing,
): Why | "unmatched" | "unclaimed" => {
  for (const claim of ringing.unmatched) {
    if (terminal.startsWith(claim.value)) return "unmatched"
  }
  for (const one of ringing.excluded) {
    if (terminal.startsWith(one.value)) return one.why
  }
  // NOTHING IN THIS FILE NAMES IT, as far as the walk reached — and that last
  // clause is the honest one. A carrier under a settled ancestor was never
  // looked at, so it reads as `unclaimed` here while the ancestor sits in
  // `excluded` saying `settled`; {@link Walked} argues why the walk stops there
  // and what it costs. The ordinary case is simply a terminal nobody scoped
  // this file for, which is the doorbell working.
  return "unclaimed"
}

/**
 * HOW MANY TERMINALS ONE FILTER FILE DERIVES RIGHT NOW — the heartbeat's one
 * derived fact, and the only number in it.
 *
 * It is {@link claimedIn} counted, so it moves the moment the board does and
 * cannot disagree with what a wake would name: same walk, same licence, same
 * un-done rule. Two records that copied one value are ONE terminal, which is
 * why the count is over the distinct VALUES rather than over the claims.
 *
 * ## Why it is not joined to the live fleet
 *
 * {@link claimingIn} would resolve those values against the roster and answer
 * how many are actually THERE, and that is deliberately a different question
 * from this one. A heartbeat is a statement about the WATCH — this file, this
 * derivation, this process — and joining it to padi would quietly make it a
 * statement about the link as well: the count would collapse to zero the
 * moment a socket dropped, and the message a person had learned to read as
 * "quiet and fine" would become the message that tells them their fleet is
 * gone. That is the fault signal's sentence and not this one's; the two must
 * never be confusable, which is a boundary kept here by not asking.
 */
export const terminalsIn = (
  declarations: PropDeclarations,
  derived: Derived,
  file: string,
  under?: string,
): number => {
  const said = new Set(
    claimedIn(declarations, derived, file)
      .filter((claim) => under === undefined || insideSubtree(derived, claim.node, under))
      .map((claim) => claim.value),
  )
  // A PREFIX AND THE ID IT NAMES ARE ONE TERMINAL, not two. The board writes
  // eight characters far more often than a whole uuid, and one file may carry
  // both spellings — a lane row abbreviating what a step row wrote out. Counting
  // the strings would report two terminals where a person can see one, which is
  // the one number in this message somebody might act on.
  //
  // FOLDED WITHIN THE VALUES rather than resolved against the live fleet, which
  // is the same restraint the rest of this function keeps: the count answers
  // "what does this file claim", and a fleet joined here would answer "what is
  // padi holding" — so a dropped link would report a file that had emptied
  // rather than a watcher that had lost its socket. That is the opposite of what
  // a heartbeat is for.
  //
  // An AMBIGUOUS prefix — one that opens two different ids — folds away and
  // leaves both of them counted, which is right twice over: it is two terminals,
  // and the derivation already refuses such a value ownership of either.
  let held = 0
  for (const value of said) {
    let folded = false
    for (const other of said) {
      if (other !== value && other.startsWith(value)) {
        folded = true
        break
      }
    }
    if (!folded) held++
  }
  return held
}

/** ONE CONVERSATION, as core addresses one — the pair `Deliveries.deliver`
 *  takes, spelled here because the ledger below is keyed by it. */
export interface Conversation {
  readonly agent: string
  readonly session: string
}

/** ...and one SCOPED conversation, as core's `scopes()` lists it: the same
 *  pair plus the file the person picked. A scope that has gone — a cleared
 *  control, or a file the watcher can no longer read — is simply absent from
 *  that list, which is the whole of how this module learns to stop. */
export interface Scoped extends Conversation {
  readonly file: string
  readonly under?: string
}

/**
 * THE FOUR FACTS, plus the frame they are read in — everything
 * {@link heartbeatBody} says, gathered at the moment it says it.
 */
export interface Vitals {
  /** Which file this conversation is scoped to, as core listed it NOW. */
  readonly file: string
  /** {@link terminalsIn}, off the current revision. */
  readonly terminals: number
  /** The watcher's own stamp on the last ATTENTION event this doorbell saw,
   *  or `null` for none since the process started watching. */
  readonly lastEvent: string | null
  /** When this process began watching. */
  readonly since: string
  /** The watch window in force — the `heartbeat` knob, as the beat that
   *  woke this carried it. */
  readonly everyMs: number
  /** Now, on the caller's clock, at the moment the words go in. */
  readonly now: string
}

/**
 * THE HEARTBEAT'S OWN SENTENCE — evidence, and deliberately not reassurance.
 *
 * ## Why four facts and not "still here"
 *
 * A watcher that says "still watching" every half hour teaches a person to
 * stop reading it, and it is also the one thing a wedged watcher would go on
 * saying: a timer that still fires proves the interval is armed and nothing
 * else. So the message is the four readings that a person can actually
 * disagree with — the file, the count it derives, the last event, the uptime.
 * A count that has been 0 all afternoon on a board with four live lanes is a
 * scope pointed at the wrong file; a last-event that is older than the uptime
 * is a watcher seeing a fleet that never moves; a "watching since" that resets
 * every window is a process being restarted under somebody. None of those is a
 * sentence this module could write, and all of them are readings a person can
 * take off these four lines.
 *
 * ## Its shape is the wake's, on purpose
 *
 * Same first-line essence, same attribution line, same `— ` lead-ins, same
 * closing exit ({@link bodyFor} argues each of them). A reader who has learned
 * one of these messages has learned all of them, and the differences between
 * them are then differences of CONTENT rather than of layout — which is the
 * only way a person can be expected to notice that this one is not a wake.
 *
 * IT SAYS WHAT IT IS NOT. The closing line states that a heartbeat is never a
 * fault report, because the whole value of a floor on silence is destroyed the
 * day somebody reads a quiet one as an all-clear about their scope. A scope the
 * watcher cannot read is not beaten for at all ({@link makeHeartbeat}), and it
 * says so in words of its own.
 */
export const heartbeatBody = (vitals: Vitals): string => {
  const window = spanOf(vitals.everyMs)
  const claims = vitals.terminals === 1
    ? `the one terminal ${vitals.file} claims`
    : `the ${vitals.terminals} terminals ${vitals.file} claims`
  const head = vitals.terminals === 0
    ? `The kolu watcher is alive: ${window} with nothing to say, and ${vitals.file} claims no terminals at all right now.`
    : `The kolu watcher is alive: ${window} with nothing to say about ${claims}.`
  return [
    head,
    "",
    `Written by olai's kolu watcher at ${stampOf(vitals.now)}, not by a person.`,
    "",
    `No wake and no digest has gone into this conversation for ${window}, which is the whole watch window — so this is the watcher proving it is running, and not a report about anything that happened. These four readings are what tell a live watcher from a wedged one, and every one of them was taken at the moment this message went in:`,
    "",
    `— the filter file: ${vitals.file}.`,
    `— terminals it claims right now: ${vitals.terminals}.`,
    `— last watcher event: ${eventLine(vitals)}`,
    `— watching since ${stampOf(vitals.since)}${suffixed(vitals.since, vitals.now, "so far")}.`,
    "",
    `Quiet is quiet: any wake or digest delivered here resets the window, so a busy one is silent. This is never a fault report — a scope this watcher cannot read says so in its own words — and clearing the file on this conversation's wake control stops it.`,
  ].join("\n")
}

/** The last-event line, which has a NONE arm rather than a blank: "no event
 *  yet" is one of the readings this message exists to carry — a watcher that
 *  has been up for six hours and seen nothing is either a very quiet fleet or
 *  a mirror that never moved, and a person who knows their own afternoon can
 *  tell which. */
const eventLine = (vitals: Vitals): string =>
  vitals.lastEvent === null
    ? "none at all since it started watching."
    : `${stampOf(vitals.lastEvent)}${suffixed(vitals.lastEvent, vitals.now, "ago")}.`

/** MS in the units a person says them in. */
const SECOND = 1_000
const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`

/** Two units at most, and the smaller dropped when it is zero: "5 hours",
 *  "5 hours 20 minutes", never "5 hours 0 minutes". A third unit is precision
 *  nobody reads in a sentence about how long something has been quiet. */
const pairOf = (
  big: number,
  bigWord: string,
  small: number,
  smallWord: string,
): string => small === 0 ? plural(big, bigWord) : `${plural(big, bigWord)} ${plural(small, smallWord)}`

/**
 * A SPAN OF MS, in words — the one duration spelling in this file, so the
 * window, the age of the last event and the uptime cannot come out in three
 * grammars.
 *
 * A span this runtime cannot make sense of — a negative one, from two stamps
 * taken across a clock that moved — says so vaguely rather than confidently:
 * "less than a second" is wrong by less than the skew that produced it, where
 * "-3 minutes" would be a number a reader tries to interpret.
 */
const spanOf = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < SECOND) return "less than a second"
  if (ms < MINUTE) return plural(Math.floor(ms / SECOND), "second")
  if (ms < HOUR) return plural(Math.floor(ms / MINUTE), "minute")
  if (ms < DAY) return pairOf(Math.floor(ms / HOUR), "hour", Math.floor(ms % HOUR / MINUTE), "minute")
  return pairOf(Math.floor(ms / DAY), "day", Math.floor(ms % DAY / HOUR), "hour")
}

/**
 * THE DISTANCE BETWEEN TWO STAMPS, appended to the earlier one and given the
 * word that says which direction it is read in — `ago` for a moment that
 * passed, `so far` for a clock still running.
 *
 * It appends NOTHING AT ALL where either stamp is a word this runtime cannot
 * read. {@link stampOf} passes such a stamp through verbatim rather than
 * guessing at it, and this keeps the same bargain one clause along: a time in
 * somebody else's spelling beats a confident subtraction of two things that
 * were never both dates.
 */
const suffixed = (from: string, to: string, word: string): string => {
  const at = new Date(from).getTime()
  const now = new Date(to).getTime()
  if (Number.isNaN(at) || Number.isNaN(now)) return ""
  return `, ${spanOf(now - at)} ${word}`
}

/**
 * THE DOORBELL'S HEARTBEAT — the drive loop for a floor on silence.
 *
 * ## What a beat does, in one breath
 *
 * The watcher's tap fires when the SUBSCRIPTION answers — per batch, never
 * on an interval of anybody's ({@link ./client/watch.ts}'s header). This loop
 * rides that tap and owns the cadence the knob promises by itself: the FIRST
 * beat of the process only ARMS the window (the timered watcher's `begun`
 * gate swallowed its boot pulse for the same reason — a floor that dropped
 * seconds after the dial would make the body's "the whole watch window"
 * line a lie told about seconds), and a beat that lands inside the window
 * is COLLAPSED, because the daemon's speech rate is not the vault's cadence.
 * On each accepted beat, every scoped conversation that heard nothing since
 * the previous one is delivered the four facts, and every conversation that
 * heard something is passed over and its window reset. There is no second
 * timer and no second knob — a heartbeat cadence a person could set apart
 * from the one they already set would be two answers to one question, and
 * the second of them would be the one nobody knew about.
 *
 * ## THE WINDOW IS MEASURED IN BEATS, not in milliseconds
 *
 * `delivered` is the whole ledger: a conversation is in {@link spoken} when
 * words of this plugin's actually entered it, and the set is cleared at the
 * end of every accepted beat. So "in the window" means "since the previous
 * accepted beat", which needs no arithmetic past the arm/collapse gate —
 * and it cannot drift against the interval the watcher is actually running,
 * because it IS that interval. See the header on why a ledger of this
 * process's own actions is not the standing set the header forbids.
 *
 * IT IS MARKED WHERE THE WORDS GO IN, not where the delivery was handed over,
 * and that is `./server.ts`'s to call from inside its own thunk. A body that
 * was coalesced away, or that derived to `null` because everything settled
 * while it waited, never reached anybody — and a window it silenced would be a
 * heartbeat lost to a message nobody got.
 *
 * ## What it refuses to beat for
 *
 * A conversation core no longer lists. `scopes()` is asked afresh on every
 * beat AND again inside every thunk, so a cleared control stops the next
 * heartbeat and also kills one already waiting on a turn — and a scope whose
 * FILE has gone is not in that list either, which is how the boundary with the
 * fault signal is kept by construction rather than by a check here. This
 * module has no gone-detection of its own and must never grow one: if
 * `scopes()` lists it, it is watched.
 *
 * A vault that has not been read. `terminals` answers `null` before the first
 * revision and after an `unloaded`, and a heartbeat then would be four facts
 * with a hole where the derived one goes. Asked BEFORE the delivery so a
 * process with no vault costs core no slot, and asked AGAIN in the thunk
 * because the store can stop publishing while a message waits.
 *
 * A count of ZERO is not one of those refusals. A file that claims nothing is
 * a scope pointed at the wrong file or a board somebody emptied, and this
 * message is the only place either of those would ever be said out loud.
 */
export interface Heartbeat {
  /** An ATTENTION event reached the doorbell — the last-seen stamp, and
   *  nothing else. The watcher's own `at` rather than a fresh clock read: it
   *  is the moment the event was stamped, and a second reading of a second
   *  clock would date the same fact twice.
   *
   *  A BEAT IS NOT AN EVENT and must never be stamped here. It comes off the
   *  same timer this loop rides, so a heartbeat that counted its own beat
   *  would report "last event: just now" forever and would be the one fact in
   *  the message that could never fail. */
  readonly saw: (at: string) => void
  /** A wake or a digest's words ENTERED this conversation: its window is
   *  reset, and it is passed over on the next beat. */
  readonly delivered: (to: Conversation) => void
  /** THE WATCHER BEAT, carrying the cadence in force. */
  readonly beat: (everyMs: number) => void
}

export const makeHeartbeat = (deps: {
  /** Core's scoped conversations, asked afresh — never held. */
  readonly scopes: () => ReadonlyArray<Scoped>
  /** Core's delivery door, write-only, taking the words as a THUNK. */
  readonly deliver: (
    to: Conversation,
    say: () => string | null,
    options?: { readonly coalesce?: string },
  ) => void
  /** {@link terminalsIn} against the CURRENT revision, or `null` where there
   *  is no revision to derive off. The caller's closure, because the vault is
   *  the caller's — this module is handed the number and never the store. */
  readonly terminals: (scope: Scoped) => number | null
  readonly now: () => string
  /** The coalesce key, minted by the caller under its own plugin name — ONE
   *  word for every heartbeat, because core files a held slot under the pair
   *  of the plugin and the key per conversation. It is fixed for the two
   *  meanings' own reason: two beats through one busy turn are one message,
   *  and the newest body is a fresh derivation that says everything the one it
   *  replaced would have. */
  readonly coalesce: string
  /**
   * WHAT THE BEAT DID, on the owner's debug channel ({@link ./trace.ts}).
   *
   * The floor under silence needs an account of its own for the reason the
   * floor exists: a conversation hearing nothing is the ordinary case, so
   * "quiet" is never evidence, and a beat that passed everybody over and a beat
   * that never fired are the SAME NOTHING from the outside. These lines are the
   * difference between them.
   */
  readonly trace: Trace
}): Heartbeat => {
  /** WHEN THIS PROCESS BEGAN WATCHING — read once, here, because this
   *  constructor runs in the same breath as the watcher's own
   *  ({@link ./client/index.ts}'s `koluHalf`). A restart re-dates
   *  it, which is exactly the fact a reader wants: an uptime that keeps
   *  resetting is a process somebody keeps killing. */
  const since = deps.now()
  /** The tracer, read once out of the deps — every line below is one call, and
   *  `deps.trace(...)` at each of them would be the only noise in a body whose
   *  whole subject is what it decided. */
  const trace = deps.trace
  let lastEvent: string | null = null
  /** THE LEDGER: conversations this plugin's words entered since the previous
   *  beat. Cleared whole at the end of every beat, which is both the window's
   *  reset and its bound. */
  const spoken = new Set<string>()
  /** THE WINDOW'S OTHER EDGE — the instant of the last ACCEPTED beat, or
   *  `null` before the first. `null` is the arming rule: the first beat of
   *  the process opens the count rather than closing one. */
  let armedAt: number | null = null
  /** The ledger's key. `\0` as an ESCAPE and never as the byte: a literal NUL
   *  makes this file read as BINARY to grep and to review tooling, which is how
   *  a reviewer stops being able to see it at all. `../chat/src/deliveries.ts`
   *  learned that one round earlier and this file re-learned it — the separator
   *  is right, the spelling was not. */
  const keyOf = (to: Conversation): string => `${to.agent}\0${to.session}`
  return {
    saw: (at) => {
      lastEvent = at
    },
    delivered: (to) => {
      spoken.add(keyOf(to))
    },
    beat: (everyMs) => {
      // THE CADENCE IS THE KNOB'S AND NOT THE SUBSCRIPTION'S SPEECH RATE:
      // the tap fires per batch now, and a fleet padi has things to say
      // about can beat several times inside one window. An unreadable
      // clock falls through and behaves as the interval old beats did —
      // a floor married to a broken clock says what it can rather than
      // going silent on a stamp it could not subtract.
      const nowMs = Date.parse(deps.now())
      if (armedAt === null) {
        armedAt = nowMs
        trace("beat-armed", { every: everyMs })
        return
      }
      if (nowMs - armedAt < everyMs) {
        trace("beat-collapsed", { every: everyMs })
        return
      }
      armedAt = nowMs
      const scopes = deps.scopes()
      // THE HEAD OF THE BEAT, before the walk decides anything: the cadence in
      // force, how many conversations core lists, and how many of them this
      // window already spoke into. A heartbeat is the FLOOR under silence, so
      // the one thing a reader cannot otherwise tell is whether a quiet window
      // was a beat that passed everybody over or a beat that never fired — and
      // those are a healthy day and a wedged watcher.
      trace("beat", {
        every: everyMs,
        scopes: scopes.length,
        spoken: spoken.size,
        lastEvent,
      })
      for (const scope of scopes) {
        if (spoken.has(keyOf(scope))) {
          trace("beat-passed", { file: scope.file, agent: scope.agent, why: "spoke-this-window" })
          continue
        }
        if (deps.terminals(scope) === null) {
          trace("beat-passed", { file: scope.file, agent: scope.agent, why: "no-revision" })
          continue
        }
        const to = { agent: scope.agent, session: scope.session }
        trace("beating", { file: scope.file, agent: scope.agent, session: scope.session })
        deps.deliver(
          to,
          // ASKED AT THE MOMENT THE WORDS GO IN, exactly as a wake's body is
          // (`./server.ts`'s `said` argues the whole of it): core holds a
          // delivery through a running turn, and a heartbeat that reported the
          // count as it was when the beat fired would be a message whose one
          // derived fact is the one thing in it that is out of date. The FILE
          // is re-read here too — a person who re-scoped mid-turn gets a
          // heartbeat about the file they are on now, or none at all.
          () => {
            const now = deps.scopes().find((one) => keyOf(one) === keyOf(scope))
            if (now === undefined) {
              trace("beat-dropped", { agent: scope.agent, why: "unscoped-since" })
              return null
            }
            const terminals = deps.terminals(now)
            if (terminals === null) {
              trace("beat-dropped", { file: now.file, agent: scope.agent, why: "no-revision" })
              return null
            }
            trace("beat-said", { file: now.file, agent: scope.agent, terminals })
            return heartbeatBody({
              file: now.file,
              terminals,
              lastEvent,
              since,
              everyMs,
              now: deps.now(),
            })
          },
          { coalesce: deps.coalesce },
        )
      }
      // ONE LINE, AFTER THE WALK: the window closes for everybody at once,
      // which is what makes "since the previous beat" a fact about the beats
      // rather than about each conversation's own arithmetic.
      spoken.clear()
    },
  }
}
