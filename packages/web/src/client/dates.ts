/**
 * The directory's DATES, asked — the month's marks and what is owed today.
 *
 * ## Why this file exists at all
 *
 * Two of these three were lines in `./App.tsx`: the tab held every node of
 * every outline, so `datedDays` and `owedOf(agendaOf(…))` ran here, over the
 * local copy, on every published revision. That copy is what
 * `https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/vault-in-browser.md` is taking away — the browser may
 * hold at most the page in front of somebody — and this is its PR 4 (§3's
 * Sidebar row, §6's item 4). The WALKS did not move: they are
 * `@olai/format`'s still, called on the other side of the wire by `@olai/ops`'
 * `Query.dated` / `Query.owed`, which is the same arrangement search landed in
 * one PR earlier (`./filter/asking.ts`).
 *
 * ## Three questions, and the third crosses no wire
 *
 * The calendar draws two marks per day and they are two different KINDS of
 * question, which is why they are answered on two different sides:
 *
 *   - {@link createDated} — which days of the month have a NODE on them. A
 *     question about the vault, so it goes to the server.
 *   - {@link createNoted} — which days a document is NAMED for, that day's own
 *     note. A question about a FILENAME, asked of the key set this tab already
 *     holds and always will: the design keeps the paths in the browser because
 *     they are key-set-sized, which is what the sidebar's file tree costs
 *     anyway.
 *
 * They live here together for exactly that reason — one file where the line
 * between them is drawn, rather than one seam and one prop drilled past it.
 * {@link createOwed} is the third and belongs to the entry above the grid.
 *
 * ## Subscriptions, not asks — and what that buys
 *
 * The two that cross the wire are STANDING views rather than questions somebody
 * opened once. A date set or cleared anywhere in the vault has to light its day
 * and move the count with no reload; that is what the calendar and the agenda's
 * mark have always promised, and two feature files pin it
 * (`journal_and_calendar.feature` — "A dated node written to disk lights its
 * day, with no reload"; `agenda.feature` — "The fire goes down as the work is
 * finished").
 *
 * The wire member for each is a STREAM (`@olai/surface`), which is a cell with
 * an argument: the server reads the answer, re-reads it on every published
 * revision, and sends a frame only when the answer CHANGED BY VALUE. That is
 * the design doc's own mechanism paragraph, and choosing it here rather than a
 * procedure is what keeps this PR self-contained. A procedure would need a
 * GENERATION to re-ask on, and the only generation this tab has is the identity
 * of its own derivation, which is the very thing PR 10 deletes. A subscription
 * needs no token: the server is what knows the directory moved.
 *
 * THE FILTER IS THE THIRD reading on that mechanism now, and it arrived by the
 * long way round — as a procedure carrying exactly the generation this
 * paragraph rules out, re-asked once per page frame, each ask a walk of the
 * whole vault. It is a stream beside the page it narrows since
 * `filter-ask-carries-revision` (`./filter/asking.ts`,
 * https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/filter-rides-the-page.md), which is this paragraph read
 * back at the one door that had not taken it.
 *
 * ## What this hands out is a VALUE
 *
 * Both wire answers are turned into plain values before they leave — a `Set`,
 * and a fresh pair of integers. What a subscription holds is a RECONCILED
 * STORE: its identity survives every frame and its fields move under it, which
 * is exactly right for rendering and exactly wrong for anything that compares
 * two readings by value. A consumer holding the live object would compare it
 * against itself and conclude nothing had changed — which is not hypothetical
 * (`./agenda/owed.ts`, and the shot that caught it). The rule is held once,
 * here, at the seam that owns the wire value, so no reader downstream has to
 * know it.
 *
 * ## What a dead wire does, and why there is nothing here about it
 *
 * Both subscriptions are ENROLLED (`.use()`), so a stream that stops is already
 * a fact the connection readout carries — `degraded`, naming the member — and
 * the pill says so in the app's own words (`./connection/`). That is the whole
 * of the error handling this file needs, and it is the difference from the
 * filter's door: a procedure has no health to enrol, so that file had to grow a
 * failure slot and an offline slot of its own. What is on screen meanwhile is
 * the last frame the server sent, which is exactly what the pill promises. The
 * app-wide answer — an overlay that freezes everything on a dead wire — is
 * §5b's ruling and is drawn now (`./connection/Offline.tsx`); a degraded
 * readout is not one of the states it covers, which is why this file still has
 * the paragraph above.
 */

import { type Accessor, createMemo } from "solid-js"

import { dailyNoteDays } from "@olai/format"
import type { Owed } from "@olai/surface"

import { useServed } from "./served.tsx"
import { olai } from "./wire.ts"

/**
 * Which days of the shown month have something on them.
 *
 * A SET, because that is what a grid of thirty-odd cells looks itself up in —
 * the same shape `datedDays` handed back when this was local, so nothing
 * downstream had to learn a new one. Minted per frame, which costs at most
 * thirty-one strings and happens only when the server says the dots moved.
 *
 * EMPTY BEFORE THE FIRST FRAME, and that is the honest drawing rather than a
 * placeholder: a day with nothing on it is INERT — a quiet number, not a link
 * — so an unanswered month is a grid nobody can press yet, which is exactly
 * what it is. The alternative would be dots drawn from the month before.
 *
 * NO "IS THERE A SET" GATE, unlike {@link createOwed}, and it needs none: the
 * grid this belongs to is only ever mounted over a directory that loaded
 * (`./App.tsx` draws the error report instead of a column otherwise), so the
 * gate is where the component is rather than a condition it carries.
 */
export const createDated = (month: Accessor<string>): Accessor<ReadonlySet<string>> => {
  // The MONTH is the input, so paging tears the subscription down and opens a
  // fresh one — the framework's own rule for a reactive input — and the server
  // is watching exactly the month somebody is looking at. A month nobody has
  // scrolled to costs nothing at either end.
  const answer = olai.streams.dated.use(() => ({ month: month() }))
  return createMemo(() => new Set(answer()?.days ?? []))
}

/**
 * Which days of that month a document is NAMED for — the days with a note.
 *
 * The one date question in this file that asks the server nothing, and the
 * header says why: a note is a fact about a FILENAME, and the filenames are the
 * key set this tab holds anyway. So this is the walk it always was, over the
 * paths, per month drawn.
 *
 * It is here rather than left as a prop from the composition so that the
 * calendar asks both of its per-month questions the same way — the difference
 * between them is WHICH SIDE ANSWERS, and that difference belongs in this file
 * rather than in the shape of a component's props.
 */
export const createNoted = (month: Accessor<string>): Accessor<ReadonlySet<string>> => {
  const paths = useServed()
  return createMemo(() => dailyNoteDays(paths(), month()))
}

/**
 * What is owed as of today, or `undefined` for "nothing has been answered yet".
 *
 * The `undefined` is load-bearing and is passed straight through to the mark
 * (`./agenda/owed.ts`, which draws NOTHING rather than a zero): a badge that
 * claimed "nothing is late" out of a directory it has not been told about is
 * the one lie a readout may never tell.
 *
 * TODAY IS THE INPUT, so the subscription re-opens at the reader's own local
 * midnight (`./clock.ts` is what moves it, and moves it for a sleeping tab
 * too). That is the point rather than a cost: the counts are an arithmetic
 * against a particular day, so a new day is a new question — and the frame of
 * quiet between the two is the truth, not a flicker to paper over.
 *
 * AND `undefined` FOR TODAY IS "DO NOT ASK YET", which is the gate the walk
 * this replaced carried in its own first line (`indexes === undefined`). A
 * directory that has never loaded has nothing to be owed FROM — the app draws
 * the error report rather than a column — and the server answers the question
 * with the refusal every reader of an unloaded set gets, so asking it there
 * would put a STOPPED subscription behind the connection pill and amber it over
 * a page where nothing is missing and the wire is fine. (It did: the shot taken
 * for this change over a corpus that does not parse came back "partly live".)
 * The caller says when there is a set (`./App.tsx`); the framework's own `null`
 * input is what holds the subscription closed until there is.
 */
export const createOwed = (
  /** The reader's own today — or `undefined` while there is no set to ask
   *  about, which asks nothing at all. A signal or memo, not a fresh value per
   *  read: the subscription re-opens whenever this NOTIFIES, so a caller
   *  handing over an untracked recomputation would tear the stream down and
   *  reset the badge on frames that changed nothing. */
  today: Accessor<string | undefined>,
): Accessor<Owed | undefined> => {
  const answer = olai.streams.owed.use(() => {
    const day = today()
    return day === undefined ? null : { today: day }
  })
  // …AS A VALUE (the header's rule): a fresh pair per frame, so a reader
  // comparing two readings is comparing two objects rather than the one the
  // wire keeps moving underneath it.
  return createMemo(() => {
    const owed = answer()
    return owed === undefined ? undefined : { overdue: owed.overdue, today: owed.today }
  })
}
