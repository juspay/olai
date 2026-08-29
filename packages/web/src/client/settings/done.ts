/**
 * Whether this page draws finished work — THIS page, in this browser.
 *
 * What "done" means depends on the page: a roadmap reads as "what is next" and
 * finished rows are clutter between the reader and the open work; a board of
 * the day's lanes reads as "what happened" and the finished rows ARE the
 * content — with one reader-wide switch the board hollows out as the day
 * succeeds. So the preference follows the page's reading intent: each outline
 * carries its own pick, flipped where the pick is read (the Prefs row, scoped
 * to the page in front of you), and remembered per browser as pure view state
 * like a scroll position or a fold — never a board write, never a prop, never
 * in git, never synced.
 *
 * THE DEFAULT IS HIDDEN, on every page (ruled 2026-08-29, human): a page
 * nobody has spoken about is a page hiding. Hiding means exactly what the
 * global switch made it mean (`@olai/format`'s `withoutDone`): a row whose
 * node STORES `done` is not drawn, and its subtree goes with it. This file
 * changes where the choice lives, not what hiding means.
 *
 * WHAT IS STORED is the pages that show, which is the fold memory's own
 * discipline (../fold/memory.ts): the default is a fact about the shape rather
 * than a value to store, so the entry is the set of files this browser has
 * flipped AWAY from the default — and toggling a page back to hidden deletes
 * it, which keeps a directory of forty outlines' entry bounded by what the
 * reader has actually said. One key rather than one key per page, for the
 * fold's reason twice over: two tabs toggling DIFFERENT pages must not lose
 * each other's pick to a last-write-wins, so a write unions the stored entry
 * with what this tab holds (as `setFolded` does) — and forty sub-keys would
 * each need the same answer separately.
 *
 * The identity a pick belongs to is the OUTLINE'S path
 * ({@link pageFileOf}): a zoomed view is the same page, so it reads the
 * pick of the outline its node is canonical in and mints no second one.
 * The circuit is `../preference.ts`; cross-tab follow is the same `storage`
 * event the folds ride, started once from `main.tsx`.
 *
 * THIS PREFERENCE'S ANCESTOR was the panel's reader-wide `olai.done.hidden`
 * row (and, before that, a per-view pill above the outline that reset on every
 * zoom — the stamp `../stamped.ts` retired). The subsumption is deliberate
 * rather than an accident of evolution: kept as a fallback, the global pick
 * would move every page nobody had spoken about — the exact flip-everything
 * gesture this design exists to retire — so the old key is simply orphaned:
 * nothing reads it, nothing chases it down, and `preference.ts`'s standing
 * tolerance for entries this app did not write covers it.
 */

import type { Row, Shown } from "@olai/format"
import { withoutDone } from "@olai/format"

import type { Drawn } from "../page.ts"
import { createPreference, parsedJson } from "../preference.ts"

export const DONE_SHOWN_KEY = "olai.done.shown"

/** The pages this browser shows finished work on — READONLY because every
 *  reader below takes membership, and the one writer goes through the circuit
 *  so what is held and what is stored can never come apart.
 *
 *  A stored value this app did not write — an older olai, something typed into
 *  a console — is not an error to report; it is nothing, and the reader gets
 *  the default (every page hiding), exactly as `parseBool` rules for a stored
 *  boolean. */
export const parseShownPages = (raw: string | null): ReadonlySet<string> => {
  const decoded = parsedJson(raw)
  if (!Array.isArray(decoded)) return new Set()
  return new Set(decoded.filter((one): one is string => typeof one === "string"))
}

/** ...and back, or `null` for "remember nothing", which is a key REMOVED
 *  rather than an empty list left behind — every page hiding IS the default,
 *  and the default is not stored. Sorted, `printFolds`' own reason: a
 *  preference somebody may open a devtools panel on is worth being able to
 *  read, and a stable spelling is what lets a test say what a pick wrote. */
export const printShownPages = (pages: ReadonlySet<string>): string | null => {
  if (pages.size === 0) return null
  return JSON.stringify([...pages].sort())
}

/** The circuit (../preference.ts); the codec is the whole of this file's say
 *  in how it is stored. */
const pref = createPreference(DONE_SHOWN_KEY, {
  parse: parseShownPages,
  print: printShownPages,
})

/** Which OUTLINE this preference is about, for the page being read — the
 *  file's own path for an outline, and for a zoom the file the node is
 *  canonical in: a zoomed view is the same page, and zoom mints no second
 *  pick. `undefined` for the pages hiding has never reached — a day, the
 *  agenda, the trash, a document — which {@link visibleIn} answers the same
 *  way the global switch always did: they are not trees, and this preference
 *  reaches a tree and nothing else. */
export const pageFileOf = (shows: Shown | undefined): string | undefined => {
  if (shows === undefined) return undefined
  if (shows.kind === "outline") return shows.file
  if (shows.kind === "node" && shows.zoomed.kind === "node") {
    return shows.zoomed.shows.file
  }
  return undefined
}

/** Whether this browser hides finished work on the outline at `file` — the
 *  DEFAULT, and every page nobody has spoken about. Reactive: it reads the
 *  signal, so a memo over it moves with a pick made here or in another tab. */
export const doneHiddenOn = (file: string): boolean => !pref.value().has(file)

/**
 * Show or hide finished work on ONE outline, and remember the pick.
 *
 * The write starts from the ENTRY unioned with what this tab holds — the same
 * discipline `setFolded` keeps (../fold/memory.ts), because the race is the
 * same one: two tabs flipping different pages are adding INDEPENDENT facts,
 * and a replace from a stale copy throws one of them away. The change goes on
 * LAST, so an un-flip (hidden again, a removal) cannot be undone by the union
 * either. A pick for a page already at the default writes the same value it
 * read, which `writePreference` is content to settle idempotently.
 */
export const setDoneHidden = (file: string, hidden: boolean): void => {
  const standing = new Set([...pref.stored(), ...pref.value()])
  if (hidden) standing.delete(file)
  else standing.add(file)
  pref.set(standing)
}

/** The rows this page actually draws. The pick and what it does to a tree are
 *  one thing, so every page asks the same question rather than each
 *  re-deciding what "hidden" means — and a page showing finished work is
 *  handed back the very array it was given, THE SAME VALUE: that identity is
 *  what `../filter/narrowing.ts`'s count of held-back matches reads as its
 *  zero, and a fresh wrapper per frame would make it walk the page twice to
 *  prove the answer was nothing. */
export const visible = (
  rows: ReadonlyArray<Row>,
  file: string,
): ReadonlyArray<Row> => (doneHiddenOn(file) ? withoutDone(rows) : rows)

/**
 * The same question asked of a whole PAGE — and the answer to "which pages
 * does this preference reach", which is here rather than at the composition
 * for the reason above: it is a fact about the preference.
 *
 * It reaches a TREE and nothing else, and that is where the reader-wide
 * switch reached too. A day and the agenda answer a date question and the
 * trash is what was put away; hiding finished work inside any of the three
 * would be this pick deciding something none of those pages was asked — a day
 * page is a record of what happened, and half of what happened is work that
 * got finished. THE SAME VALUE COMES BACK for those pages and for a page
 * showing, identity and all, for {@link visible}'s reason: it is what the
 * filter's count line reads as "this preference took nothing off" — and what
 * the label claims is exactly what this function does, and no more
 * (`../filter/count.ts`).
 */
export const visibleIn = (drawn: Drawn, file: string | undefined): Drawn => {
  if (drawn.kind !== "tree" || file === undefined) return drawn
  const rows = visible(drawn.rows, file)
  return rows === drawn.rows ? drawn : { kind: "tree", rows }
}

/** Follow it for as long as this document lives — the same shape as
 *  `followStoredTheme` and `followFolds`, started once from `main.tsx`,
 *  because a preference belongs to the browser and a browser is more than one
 *  tab: a pick made for a page in one tab lands on that page in the others,
 *  and one on a page nobody else is looking at is still this browser's answer
 *  the moment they do. */
export const followDonePages = (): void => {
  pref.follow()
}
