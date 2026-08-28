/**
 * WHERE THE FOLDED IDS NOW LIVE — asked of the server, and the memory beside
 * them kept honest with the answer.
 *
 * ## Why this file exists at all
 *
 * `./memory.ts` remembers collapsed node ids grouped by the file each node is
 * defined in, and that memory has to survive a directory that moves under it:
 * a node somebody ARCHIVED is the same node in `_olai/Trash.olai` and keeps its
 * fold, a node somebody DELETED should stop being remembered, and a file that
 * has stopped parsing says nothing at all about its nodes. All three were
 * answered out of one thing — the whole id→file map of the tab's own copy of
 * the set, walked per fold. That copy is what
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md` is taking away (the browser may hold
 * at most the page in front of somebody), so the two facts the rule needs are a
 * question: `nodes.homes`, which answers where a handful of ids are and which
 * of a handful of files this directory has actually read.
 *
 * The RULE stayed where it was. Nothing here decides what a home, an absence or
 * an unheard-of file means — `pruned` does, next door, beside the memory it is
 * about. What is here is when to ask, what to do while the wire is down, and
 * which answer to believe.
 *
 * ## The wire is an argument
 *
 * Nothing in this file imports one ({@link Asking}, handed in by `App.tsx`),
 * which is `../edit/undoing.ts`'s arrangement word for word and for its reason:
 * everything here is a rule about WHEN, and a rule that can only be checked by
 * pressing a triangle in a browser is a rule nothing checks.
 * `./refiling.browsertest.ts` is what that buys — it drives this door with an
 * answer it hands over itself, and it exists because the rule below was got
 * wrong once (#276's review).
 *
 * ## Not a caller of `../settled.ts`
 *
 * That is the receptacle for the same-looking thing — a question the server is
 * asked as somebody types, with the settle and the latest-wins rule named once
 * — and every shortlist door in this client is built on it. This one is not,
 * and the reason is the same one the rule below turns on: what `createSettled`
 * hands back is three ACCESSORS a door DRAWS, over a `createResource` that
 * holds the answer in a signal. Nothing draws this answer. It is applied and
 * forgotten, and holding it in a signal is precisely what let an effect read it
 * and apply it twice. Nor is it a keystroke: the settle here is a hand clicking
 * triangles, which is why it is not that file's `SETTLE_MS`. Two doors, one
 * shape, two different axes — the same distinction `../filter/asking.ts` is
 * held apart by there.
 *
 * ## Nothing on screen is waiting for this
 *
 * That is the fact this file is shaped by, and it is what makes the round trip
 * free. A fold READS as folded off the union of every bucket (`collapsedNodes`),
 * so a fold filed under a file the node left still folds the node; what the
 * filing decides is only which file's silence is later allowed to drop it. So
 * the write is instant and the tidy lands whenever it lands — no triangle waits
 * for a socket, and there is nothing to draw while it is out.
 *
 * Which is also why the failure is not on screen. A call that did not arrive
 * leaves the memory exactly as it was and the reader is looking at the right
 * rows either way, and the ONE thing they could learn from a message — that the
 * server is not answering — is already on screen in the connection pill. It is
 * recorded to the console instead: one line for whoever is looking at a tab
 * whose entry is not being tidied, which is `wire.ts`'s own answer to news with
 * no reader. Nothing is written down as a no: those ids are asked about again
 * by the next fold or the next reload.
 *
 * ## When the question goes
 *
 * WHENEVER THE MEMORY CHANGES, which is the same moment the old walk ran, plus
 * two it could not: a sibling tab's fold arriving through the `storage` event,
 * and the app STARTING with folds already in the entry. A browser that read for
 * an hour without folding anything never tidied at all before this.
 *
 * Deliberately NOT on every published revision. A tidy nobody can see is not
 * worth a question per keystroke anybody makes anywhere in the vault, and
 * nothing goes wrong by being a few minutes late: an id whose node has been
 * deleted is a line in a storage entry, not a row on a page.
 *
 * A re-file that MOVED something is one more question, because the memory it
 * wrote is spelled differently and the effect below cannot tell that change
 * from a fold. That is one small call per actual prune — which is rare, since
 * most answers say everything is where it was — and the alternative is a note
 * of what this door last wrote, which would hold the tidy back exactly when the
 * directory moved twice.
 */

import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"
import { createEffect } from "solid-js"

import type { HomesAnswer, HomesRequest } from "@olai/format"
import type { OpFailure } from "@olai/surface"

import { askingOf, folded, homesOf, type Memory, refiled } from "./memory.ts"

/**
 * How long a fold waits for the next one before the question goes.
 *
 * Longer than the two boxes settle at (`../search/nodes.ts`'s `SETTLE_MS`,
 * pitched just past an inter-keystroke gap) because it is a different gesture
 * with nothing behind it: shutting four levels of a branch is four clicks of a
 * hand that is reading, and NOBODY IS WAITING for this answer. So the only
 * thing a longer wait costs is an entry tidied a moment later, and what it buys
 * is one question instead of four.
 *
 * EXPORTED for the test beside this file, which drives the clock past exactly
 * this and would otherwise hold a copy of the number that could stop being it.
 */
export const SETTLE_MS = 750

/** The two things this door needs a wire for, handed in rather than imported —
 *  see the header. */
export interface Asking {
  /** Put the question, and hand back what came of it. */
  readonly ask: (
    request: HomesRequest,
  ) => Promise<Result.Result<HomesAnswer, OpFailure>>
  /** ...and whether it can be put at all right now — `../connection/
   *  reaching.ts`'s one predicate, which is the same bit the freeze is drawn
   *  on. READ REACTIVELY, so the wire coming back is itself a reason to ask. */
  readonly reachable: () => boolean
}

/**
 * Keep this browser's fold memory filed against the set, for as long as the app
 * is up.
 *
 * Composed from `App.tsx` rather than started from `main.tsx` beside
 * `followFolds`: the following there is a `storage` listener and this is a
 * COMPUTATION, which Solid will only own inside a render. What it tracks is the
 * memory and the connection — so a fold, a sibling tab's fold, and the wire
 * coming back after a drop are each a reason to ask.
 */
export const createRefiling = (wire: Asking): void => {
  /**
   * WHICH QUESTION IS THE NEWEST, and therefore whose answer is about the
   * directory as it now is.
   *
   * The case is real rather than theoretical: undo. A reader folds a branch,
   * deletes it, and undoes the delete — three writes inside one round trip is
   * an ordinary afternoon — and the answer to the question asked in the middle
   * says the id is gone. Applied after the question that followed it, it would
   * drop a fold for a node that is back on screen.
   */
  let latest = 0

  /**
   * Ask, and apply what comes back — ONCE, on the call completing, and never
   * again.
   *
   * NOT A `createResource`, and that is the correction #276's review forced.
   * That primitive is for an async value something DRAWS: it holds the answer
   * in a signal so a page can re-render as it arrives, and it is what
   * `../filter/asking.ts` and `../search/nodes.ts` want, because their answers
   * are rows on a screen. Nothing draws this one. Its whole life is *arrive, be
   * applied to a preference, be forgotten* — and putting it in a signal made it
   * something an effect could read, which is exactly what went wrong: `refiled`
   * reads the memory, so the effect that applied the answer subscribed to the
   * memory and re-ran on every later fold, re-applying a verdict it had already
   * applied. Harmless for a home and destructive for a `null` — the set said an
   * id was gone, this dropped it, the node came BACK (undo, unarchive, a `git
   * pull`), the reader folded it again, and the stale verdict re-applied by that
   * very write dropped the fold before the finger was off the triangle.
   *
   * Out here the apply is not in the graph at all, so applying twice is not a
   * thing that can happen; what a resource was giving — drop the answer to a
   * question that has been overtaken — is the counter above, which is where
   * that rule was before and where it costs three lines. (`./refiling.browsertest.ts`
   * pins both.)
   *
   * The failure is a CONSOLE LINE and not a banner — see the header — and it is
   * written down as nothing rather than as a no, so those ids are asked about
   * again by the next fold or the next reload.
   */
  const put = (memory: Memory): void => {
    const mine = ++latest
    void wire.ask(askingOf(memory)).then((outcome) => {
      if (mine !== latest) return
      if (Result.isFailure(outcome)) {
        console.warn(
          "olai: could not ask where the folded nodes now live, so this browser's fold memory is not being tidied —",
          outcome.failure.message,
        )
        return
      }
      refiled(homesOf(memory, outcome.success))
    })
  }

  const settle = debounce(put, SETTLE_MS)

  createEffect(() => {
    const memory = folded()
    // NOTHING IS ASKED INTO A DEAD SOCKET and nothing is queued behind the
    // reader — `../filter/asking.ts`'s rule, and this door's for a smaller
    // reason: the memory is not wrong while the wire is down, only untidy. A
    // browser holding no folds has nothing to ask about either. Tracking the
    // readout is what asks again when the wire comes back, with the memory as
    // it is at that moment.
    if (memory.printed === null || !wire.reachable()) {
      settle.clear()
      return
    }
    settle(memory)
  })
}
