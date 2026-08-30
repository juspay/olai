/**
 * Whether finished work is drawn: a browser-wide default, and the pages that
 * out-vote it.
 *
 * TWO FACTS, each held the one way:
 *
 *   - THE DEFAULT is the reader's claim — "I do not want to look at finished
 *     work" — kept with the other preferences as `olai.done.hidden`, THE KEY
 *     IT ALWAYS HAD (two bumps ago this file retired it for a show-list; the
 *     design revision put the global row back over it, and readers who set
 *     it then lose nothing now). It starts HIDDEN — CHANGED from master's
 *     visible (the 2026-08-29 ruling, and the one user visible move here
 *     nobody upgrading asked for: a reader who never opened the row finds
 *     finished work gone from every outline until they flip one place
 *     either way).
 *   - THE OUT-VOTE is a page's claim — "house.olai is a story: show me how it
 *     ended; the board owes me nothing" — kept as a per-file OVERRIDE,
 *     `olai.done.overrides`. What is an OVERRIDE rather than a fact the panel
 *     could have been asked for: the page says the word beside its own filter
 *     (`../filter/DoneFlip.tsx`), where "what about here?" is the question
 *     being answered. Stored the folds' way (../fold/memory.ts): the entry is
 *     a sorted JSON OBJECT of `{ "file.olai": "shown" | "hidden" }`, idempotent
 *     under reprint so one render frame cannot write another's bytes; a page
 *     whose pick IS the default holds nothing, so the default is stored
 *     nowhere (no entry is "follow"). Two tabs flipping DIFFERENT pages are
 *     not rival picks but independent answers to one question; a replace would
 *     lose one, so the write starts from the ENTRY unioned with what this tab
 *     holds, and the change goes on LAST. On a key ONE tab has ever spelled
 *     the additions win; on a key BOTH know, the sibling's spelled entry
 *     carries over this tab's stale one — the window is one event loop wide,
 *     and what a union cannot see (a sibling's delete of a key this tab still
 *     holds) is the folds' own trade, taken face-on. An explicit RELEASE —
 *     the mark beside the strip, `../filter/DoneFlip.tsx`'s own gesture —
 *     removes the entry the same way, ranked after everything it was unioned
 *     with, so a page goes back to following the panel.
 *
 * A THIRD projection, and the one that is a READING rather than a fact: THE
 * LANDING'S REVEAL. A landing whose row EXISTS on the page but is hidden by
 * the pick is owed it anyway (`../fold/landing.ts`'s reveal arm — the same
 * courtesy the act pays a collapsed ancestor), so the places on the way to
 * it are kept out of the sweep FOR THE VISIT: one entry per file, in this
 * tab, NEVER STORED. The default and the out-vote are the reader's two
 * standing claims and a landing mints neither — the flip's strip and its `·`
 * stand exactly as the reader left them. A file's reveal is replaced by its
 * next landing and taken down when the page it was owed on leaves its pane —
 * and deliberately NOT on a timer: the row it draws back is the row somebody
 * was SENT, and a marker that expires while the reader is looking at it is
 * `../focus.ts`'s refused place-marker, one abstraction up.
 *
 * The talk page is the archive's `done-over-open-work.md` and the design
 * revision that made this two facts: the panel is still global; the page
 * itself holds the exception.
 */

import { withoutDone } from "@olai/format"
import { type Accessor, createSignal } from "solid-js"

import type { Shown } from "@olai/format"

import type { Drawn } from "../page.ts"
import { boolCodec, createPreference } from "../preference.ts"

export const DONE_HIDDEN_KEY = "olai.done.hidden"
export const DONE_OVERRIDES_KEY = "olai.done.overrides"

/** The pick's two words, in the value space they are stored in: the flip and
 *  the strip on screen say "Visible" / "Hidden" because those are the words the
 *  control has always said (settings/Panel.tsx's DONE_CHOICES), and storage
 *  says `shown` / `hidden` — the file's two states, the way it describes
 *  itself. */
type DoneWord = "shown" | "hidden"

/** Hidden, for a browser that has never been asked — and for a value nothing
 *  here ever wrote, which is `boolCodec`'s rule and not this file's. */
const pref = createPreference(DONE_HIDDEN_KEY, boolCodec(true))

/** The overrides circuit: parse all-or-nothing the symmetric codec cannot help
 *  with, print SORTED for idempotency — the `fold/memory.ts` discipline, where
 *  the argument for both lives. */
const overrides = createPreference(DONE_OVERRIDES_KEY, {
  parse: (stored) => {
    if (stored === null) return new Map<string, DoneWord>()
    let parsed: unknown
    try {
      parsed = JSON.parse(stored)
    } catch {
      return new Map<string, DoneWord>()
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return new Map<string, DoneWord>()
    const out = new Map<string, DoneWord>()
    for (const [file, word] of Object.entries(parsed)) {
      if (word === "shown" || word === "hidden") out.set(file, word)
    }
    return out
  },
  print: (map) =>
    map.size === 0
      ? null
      : JSON.stringify(
          Object.fromEntries(
            [...map.entries()].sort(([a], [b]) => a.localeCompare(b)),
          ),
        ),
})

/** Whether this browser hides what is done, where no page has said otherwise. */
export const doneHidden: Accessor<boolean> = pref.value

/** Persist it — `pref.set` writes `olai.done.hidden`. The write is fenced by
 * `preferences.feature`'s stored-key step; the reload scenario fences the boot
 * read, not this setter. */
export const setDoneHidden = (value: boolean): void => pref.set(value)

/** What this page asked for, or NOTHING — and the nothing is a real answer:
 *  "follow the default". There is no stored value for it: a page whose pick
 *  is the panel's holds no entry. */
export const doneOverride = (file: string): DoneWord | undefined =>
  overrides.value().get(file)

/**
 * The pick a PAGE answers to: its own word if it has one, the default's
 * otherwise. Read here rather than at the composition, the way the panel's
 * hint and the flip read the other two — three projections of one fact, which
 * is one module.
 */
export const doneHiddenOn = (file: string): boolean =>
  (overrides.value().get(file) ?? (doneHidden() ? "hidden" : "shown")) ===
  "hidden"

/**
 * Show or hide finished work on ONE page, and remember the pick. Writing the
 * word the DEFAULT already says is still worth a line: the page was asked,
 * and the ask outlives where the default stands today.
 */
export const setDoneFor = (file: string, word: DoneWord): void => {
  // stored() LAST: a key in both places is the SIBLING's fresher answer, and
  // spreads do not delete, so this tab's never-written entries survive
  // either way (the pick trace is in done.test.ts).
  const combined = new Map([...overrides.value(), ...overrides.stored()])
  combined.set(file, word)
  overrides.set(combined)
}

/** Hand a page back to the panel: drop its entry, with the same union
 *  discipline ranked after everything it was unioned with — the removal is
 *  this tab's own say-so, the way `fold/memory.ts`'s clear is. */
export const letDoneFollow = (file: string): void => {
  const combined = new Map([...overrides.value(), ...overrides.stored()])
  combined.delete(file)
  overrides.set(combined)
}

/**
 * THE REVEAL's table: the places a landing asked this page to keep drawn,
 * per file — `visibleIn` reads it the way it reads the pick, so the one door
 * the page composition asks stays one door.
 */
const [revealed, setRevealed] = createSignal<
  ReadonlyMap<string, ReadonlySet<string>>
>(new Map())

/** The places the pick's sweep spares on `file`, or nothing — DELIBERATELY
 *  not exported: what spares a row is a question the sweep answers by
 *  sweeping, and a second door onto the raw table is a second way for the
 *  page and somebody else to disagree about the same row. */
const landingReveal = (file: string): ReadonlySet<string> | undefined =>
  revealed().get(file)

/**
 * The landing's write: keep these places drawn on `file` for the visit —
 * REPLACING the file's last reveal, one outstanding arrival per page the way
 * `../focus.ts` holds one pointed row per app. Nothing is stored: both
 * halves of the pick answer to the reader alone, so this says nothing to
 * them. Same keys, no write: a published revision re-asks the landing, and
 * the answer it already spent must not spend the page's memos again.
 */
export const revealDone = (file: string, keys: ReadonlySet<string>): void => {
  const standing = revealed().get(file)
  if (
    standing !== undefined && standing.size === keys.size &&
    [...keys].every((key) => standing.has(key))
  ) {
    return
  }
  setRevealed((before) => new Map(before).set(file, keys))
}

/**
 * The reveal's release — the page it was owed on leaving its pane, or the
 * file's next landing re-asking. KEYED ON THE VERY SET handed in: a sibling
 * pane that revealed this file after we did keeps its answer, the way the
 * folds' own map keeps a fresher sibling's word.
 */
export const concealDone = (file: string, keys: ReadonlySet<string>): void => {
  if (revealed().get(file) !== keys) return
  setRevealed((before) => {
    const next = new Map(before)
    next.delete(file)
    return next
  })
}

/**
 * WHICH PAGE is the pick about — the flip's label and the guard against the
 * done preference reaching a page it was never about.
 *
 * A PAGE is only about an outline: the Held completion filter owns "is this
 * work that finished" (`../filter/completion.ts`), and `visibleIn` below is
 * what the pick instructs. It does NOT reach the page that does not have
 * one: a day records what happened (and half of what happened is work that
 * finished); the agenda's done lane IS its claim; the trash is what was put
 * away; documents have no marks.
 */
export const pageFileOf = (page: Shown | undefined): string | undefined => {
  if (page === undefined) return undefined
  if (page.kind === "outline") return page.file
  // ZOOM MINTS NO PICK OF ITS OWN: the zoomed page is the outline SHOWN
  // from a place — derived rows are the outline's own nodes SPOKEN FOR —
  // and the file it stands in is the outline's, not the placement's.
  if (page.kind === "node" && page.zoomed.kind === "node") {
    return page.zoomed.shows.file
  }
  return undefined
}

/**
 * The rows this page actually draws — the one door to the pick for the page
 * composition. The pick and what it does to a tree are one thing, so every
 * page asks the same question rather than each re-deciding what "hidden"
 * means — and a page in step with its pick is handed back THE VERY VALUE it
 * was given: that identity is what `../filter/narrowing.ts`'s count of
 * held-back matches reads as its zero, and a fresh wrapper per frame would
 * make it walk the page twice to prove the answer was nothing. An empty zoom
 * wraps there (a tree with no file to be about) and is not pruned: the
 * default the row holds is not the thing such a page says.
 *
 * The LANDING's reveal rides the same sweep as `keep` — places spared rather
 * than rows forgiven: the pick still SAYS what the reader left it saying,
 * and the kept chain is the one spelling of "except this, for the visit"
 * the page knows.
 *
 * THE EDGE IS WHERE THE PAGE SAYS WHAT THE PAGE IS (../filter/narrowing.ts's
 * split of what a page holds from what it draws): here, "which pages is the
 * default answering for"; there, "which rows of the answer show through".
 * Both are the same sentence read from its two ends.
 */
export const visibleIn = (
  drawn: Drawn,
  file: string | undefined,
): Drawn => {
  if (file === undefined || drawn.kind !== "tree") return drawn
  if (doneHiddenOn(file))
    return { ...drawn, rows: withoutDone(drawn.rows, landingReveal(file)) }
  return drawn
}

/** Follow both halves for as long as this document lives — the same shape as
 *  `followFolds` and `followLayout`, started once from `main.tsx`, because a
 *  preference belongs to the browser: the panel writes the default once, and
 *  every page holds the answers to what the default does not say. */
export const followDonePrefs = (): void => {
  pref.follow()
  overrides.follow()
}
