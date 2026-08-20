/**
 * The directory's DATES, asked — the month's dots and what is owed today,
 * answered by the server.
 *
 * ## Why this file exists at all
 *
 * It used to be two lines in `./App.tsx`: the tab held every node of every
 * outline, so `datedDays` and `owedOf(agendaOf(…))` ran here, over the local
 * copy, on every published revision. That copy is what
 * `docs/brainstorming/vault-in-browser.md` is taking away — the browser may
 * hold at most the page in front of somebody — and this is its PR 4 (§3's
 * Sidebar row, §6's item 4). The WALKS did not move: they are
 * `@olai/format`'s still, called on the other side of the wire by `@olai/ops`'
 * `Query.dated` / `Query.owed`, which is the same arrangement search landed in
 * one PR earlier (`./filter/asking.ts`).
 *
 * ## Subscriptions, not asks — and what that buys
 *
 * Both of these are STANDING views rather than questions somebody opened once.
 * A date set or cleared anywhere in the vault has to light its day and move the
 * count with no reload; that is what the calendar and the agenda's mark have
 * always promised, and two feature files pin it (`journal_and_calendar.feature`
 * — "A dated node written to disk lights its day, with no reload";
 * `agenda.feature` — "The fire goes down as the work is finished").
 *
 * The wire member for each is a STREAM (`@olai/surface`), which is a cell with
 * an argument: the server reads the answer, re-reads it on every published
 * revision, and sends a frame only when the answer CHANGED BY VALUE. That is
 * the design doc's own mechanism paragraph, and choosing it here rather than a
 * procedure is what keeps this PR self-contained. A procedure would need a
 * GENERATION to re-ask on — `./filter/asking.ts`'s `Ask.at` — and the only
 * generation this tab has is the identity of its own derivation, which is the
 * very thing PR 10 deletes. A subscription needs no token: the server is what
 * knows the directory moved.
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
 * §5b's ruling and its own PR.
 *
 * ## What is NOT asked here
 *
 * The calendar draws a second mark per day: the days a `.md` is NAMED for, that
 * day's note. That stays local and always will (`dailyNoteDays` over the
 * documents' key set) — a note mark is a question about a FILENAME, and the
 * design keeps the key set in the browser because it is key-set-sized, the same
 * size the sidebar's file tree already costs.
 */

import { type Accessor, createMemo } from "solid-js"

import type { Owed } from "@olai/surface"

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
 * The caller says when there is a set (`./App.tsx`); the framework's own
 * `null` input is what holds the subscription closed until there is.
 */
export const createOwed = (
  /** The reader's own today — or `undefined` while there is no set to ask
   *  about, which asks nothing at all. */
  today: Accessor<string | undefined>,
): Accessor<Owed | undefined> =>
  olai.streams.owed.use(() => {
    const day = today()
    return day === undefined ? null : { today: day }
  })
