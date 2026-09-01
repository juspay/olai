/**
 * WHAT THE CI CHIP SAYS, and in which ink — the whole of the chip's judgement,
 * as a pure function of the row and a clock.
 *
 * The arithmetic is pure and takes `now` as an argument, for the app's own
 * duration seam's reason: the cases are a table in `./words.test.ts` rather than
 * something you have to start a CI run to see. Only the component touches a
 * clock.
 *
 * IT TAKES THE SPELLER TOO, and that is the extraction showing on a signature.
 * The register a running node's figure is said in is the APP'S — one ladder for
 * the pomodoro pill, the uptime chip and this — and it arrives as furniture
 * (`./app.ts` argues why the app hands its own contracts across rather than
 * being imported for them). So `wordsFor` is handed the spelling rather than
 * reaching for it, which also makes the one thing this module decides plain: it
 * decides the GRAMMAR of the sentence and the ink, never the units.
 *
 * ## The grammar, in three parts and never more
 *
 * `ci · <what> · <count>` — the plan's own shape (`ci · e2e 2m10s · 8/10 ok`),
 * kept literally because a chip in a wrapping run of a dozen facts has about
 * that much room and no more:
 *
 *   - **`<what>`** is the RUNNING NODE while there is one (`e2e 2:10`, the
 *     name and how long it has been going), the run's PHASE while the run is
 *     still claiming a machine (`provisioning`), and the VERDICT once the
 *     socket is gone (`ok`, `red`, or `ended` for a run that stopped without
 *     deciding).
 *   - **`<count>`** is `8/10 ok` — how many nodes came out green over how many
 *     there are — dropped entirely for a run with no nodes yet, because
 *     `0/0 ok` is a sentence about nothing.
 *
 * THE DURATION IS THE APP'S REGISTER, not a third spelling of one. A
 * running node under an hour reads `m:ss` and past it reads `2h 34m`, exactly
 * as the pomodoro pill beside a doing row does — a reader who has learnt what
 * a ticking number looks like in this app should not have to learn it again
 * because the thing ticking is a test suite. (The plan writes `2m10s`; this is
 * the same figure in the register the app already speaks.)
 *
 * ## Red wins the ink before it wins the verdict
 *
 * A live run with a red node in it is ALREADY red to a reader — that is what
 * they need to know, and waiting for the last node to finish before saying so
 * would be the chip withholding the one thing it exists for. The VERDICT keeps
 * the stricter rule (`verdictOf`: `ok` waits for every node); the INK does
 * not, and the two are different questions.
 *
 * ## The counting happens HERE, over the cells the row already carries
 *
 * `tallyOf` and `verdictOf` are `@olai/odu-client`'s own folds, shared through
 * the wire module both sides import — the same two functions the server would
 * run, run where the cells are. Shipping their answers beside the cells would
 * have put a question and its answer on one wire with an unenforced promise
 * that they agree; folding ten nodes on a clock tick costs nothing worth
 * buying that promise with.
 */

import {
  type CiRun,
  identityOf,
  type RunCell,
  type RunTally,
  tallyOf,
  verdictOf,
} from "@olai/odu-client/wire"

/** HOW A RUNNING FIGURE IS SAID — the app's ticking register, handed in. See
 *  the header: this module owns the grammar, never the units. */
export type Ticking = (elapsedMs: number) => string

/** The ink a chip takes — olai's own register names, not odu's hues. `going`
 *  is the app's attention ink (work in flight is the one thing worth finding
 *  at a glance, which is why the doing glyph and this share one colour),
 *  `quiet` is the muted one a settled or undecided run recedes into. */
export type CiTone = "going" | "ok" | "red" | "quiet"

/** What a chip draws: the words, the ink, and the sentence on the hover. */
export interface CiWords {
  readonly text: string
  readonly tone: CiTone
  readonly title: string
}

/** THE NODE A CHIP NAMES — the first one running, in the run's OWN scheduling
 *  order, so two nodes running at once name the earlier and the chip does not
 *  flicker between them as a scheduler's map iterates. `undefined` when
 *  nothing is running, which is every settled run and every run still claiming
 *  a machine. */
export const runningIn = (run: CiRun): RunCell | undefined =>
  run.cells.find((cell) => cell.status === "running")

/** The `<count>` half — dropped for a run with no nodes. */
const countOf = (tally: RunTally): string | undefined =>
  tally.total === 0 ? undefined : `${tally.ok}/${tally.total} ok`

/** What a run is DOING, in a word or two. */
const whatOf = (
  run: CiRun,
  verdict: string | null,
  now: number,
  ticking: Ticking,
): string => {
  if (!run.live) return verdict ?? "ended"
  const running = runningIn(run)
  if (running !== undefined) {
    // A node marked running with no `startedAt` is a frame that arrived
    // between the two writes; the name alone is the honest reading, and the
    // duration appears on the next frame rather than as a `0:00` that would
    // read as a node that has been stuck for a second.
    return running.startedAt === null
      ? running.name
      : `${running.name} ${ticking(now - running.startedAt)}`
  }
  // Nothing running and the run is up: either it has not got a machine yet —
  // odu's own phase word, verbatim, because "what is this run waiting for" is
  // odu's question to answer — or every node has settled and the socket has
  // simply not gone yet.
  if (run.phase !== "lanes") return run.phase
  return verdict ?? "waiting"
}

/** ...and the ink it is said in. */
const toneOf = (run: CiRun, tally: RunTally, verdict: string | null): CiTone => {
  if (tally.red > 0) return "red"
  if (!run.live) return verdict === "ok" ? "ok" : "quiet"
  return "going"
}

/**
 * The hover — the facts the face had no room for, and the ones a reader asks
 * for exactly once: WHICH run this is, and WHERE olai looked.
 *
 * The commit identity is odu's own `<sha7>#<seq>` spelling with `+dirty`
 * beside it, because a verdict that does not say which run it describes is
 * the ambiguity that spelling was introduced to end (juspay/odu#49).
 */
const titleOf = (run: CiRun): string => {
  const which = identityOf(run)
  const lanes = run.lanes.length === 0 ? "" : ` · ${run.lanes.join(" ")}`
  // Prose rather than a word, and deliberately: `@olai/web`'s connection
  // readout owns a closed set that includes the obvious one-word spelling, and
  // a second vocabulary uttering it is exactly the ambiguity `claims.test.ts`
  // sweeps for. What a reader needs here is the sentence anyway.
  const state = run.live ? "the run is up" : "the socket is gone; this is the last reading"
  return `${which}${lanes} · ${state} · ${run.at}`
}

/**
 * The chip's whole answer — and there is always one, because a ROW is what a
 * reader is being told about.
 *
 * IT USED TO DECLINE, and the arm it declined on was wrong in the case grok's
 * review found: a settled row with nothing SETTLED drew nothing, so a run
 * killed while its first node was on screen as `ci · e2e 2:10` vanished
 * without a word. Running is progress; a node that got as far as starting is
 * something to report, and the chip's own header had already said so ("a run
 * that ended without deciding and never RAN a node") while the code asked a
 * narrower question.
 *
 * The fix is not a third arm but the loss of the branch. "Or nothing" — the
 * plan's phrase for a settled run olai has no reading of — is answered ONE
 * layer up and always was: no row, no chip (`./CiChip.tsx`, over
 * `useRuns().runOf`), which is the ordinary state of every checkout on the
 * machine. A row that EXISTS is a run this server watched, and what it saw is
 * worth a word even when the word is `ended · 0/4 ok`.
 *
 * That also settles the edge the same review names one file over: the chip is
 * the only thing that can close the matrix, and a chip that could stop drawing
 * while its pane was open would strand it. Now the two answer one question —
 * is there a row — and they cannot disagree.
 */
export const wordsFor = (
  run: CiRun,
  now: number,
  ticking: Ticking,
): CiWords => {
  const tally = tallyOf(run.cells)
  const verdict = verdictOf(tally)
  const count = countOf(tally)
  return {
    text: `ci · ${whatOf(run, verdict, now, ticking)}${
      count === undefined ? "" : ` · ${count}`
    }`,
    tone: toneOf(run, tally, verdict),
    title: titleOf(run),
  }
}
