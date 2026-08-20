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
 * `docs/brainstorming/vault-in-browser.md` is taking away (the browser may hold
 * at most the page in front of somebody), so the two facts the rule needs are a
 * question: `nodes.homes`, which answers where a handful of ids are and which
 * of a handful of files the set declares anything in.
 *
 * The RULE stayed where it was. Nothing here decides what a home, an absence or
 * an unheard-of file means — `pruned` does, next door, beside the memory it is
 * about. What is here is when to ask, what to do while the wire is down, and
 * which answer to believe.
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
 * The question is the memory as it is SPELLED (`printFolds`), which is what
 * makes "has it changed" one string comparison — and what keeps this from
 * chasing its own tail, since the write the answer causes prints differently
 * exactly when it changed something.
 */

import { debounce } from "@solid-primitives/scheduled"
import { Result } from "effect"
import { createEffect, createMemo } from "solid-js"

import { unreachable } from "../connection/reaching.ts"
import { runAsync } from "../run.ts"
import { connectionReadout, olai } from "../wire.ts"
import { type Folds, foldedByFile, parseFolds, printFolds, refiled } from "./memory.ts"

/**
 * How long a fold waits for the next one before the question goes.
 *
 * Longer than the two boxes settle at (`../search/nodes.ts`'s `SETTLE_MS`,
 * pitched just past an inter-keystroke gap) because it is a different gesture
 * with nothing behind it: shutting four levels of a branch is four clicks of a
 * hand that is reading, and NOBODY IS WAITING for this answer. So the only
 * thing a longer wait costs is an entry tidied a moment later, and what it buys
 * is one question instead of four.
 */
const SETTLE_MS = 750

/** What the question is, on the wire: the ids to place, and the files whose
 *  silence about them would mean anything. Two flat lists, unpaired — which is
 *  the member's own shape, and why (`@olai/surface`). */
const askedOf = (folds: Folds) => ({
  ids: [...folds.values()].flatMap((ids) => [...ids]),
  files: [...folds.keys()],
})

/**
 * Ask, and re-file what comes back.
 *
 * WHICH ANSWER TO BELIEVE is the one piece of bookkeeping here, and the case is
 * real rather than theoretical: undo. A reader folds a branch, deletes it, and
 * undoes the delete — three writes inside one round trip is an ordinary
 * afternoon — and the answer to the question asked in the middle says the id is
 * gone. Applied after the question that followed it, it would drop a fold for a
 * node that is back on screen. So a question that has been overtaken is
 * dropped, exactly as `createResource` drops the answer to a source that moved:
 * the newest question is the one whose answer is about the directory as it now
 * is.
 */
const createAsker = (): ((folds: Folds) => void) => {
  let latest = 0
  return (folds) => {
    const mine = ++latest
    void runAsync(olai.procedures.nodes.homes(askedOf(folds))).then((outcome) => {
      if (mine !== latest) return
      if (Result.isFailure(outcome)) {
        // A record and not a banner — see the header. Nothing is written down
        // as a no, so these ids are asked about again by the next fold.
        console.warn(
          "olai: could not ask where the folded nodes now live, so this browser's fold memory is not being tidied —",
          outcome.failure.message,
        )
        return
      }
      refiled(folds, outcome.success)
    })
  }
}

/**
 * Keep this browser's fold memory filed against the set, for as long as the app
 * is up.
 *
 * Composed from `App.tsx` rather than started from `main.tsx` beside
 * `followFolds`: the following there is a `storage` listener and this is a
 * COMPUTATION, which Solid will only own inside a render. What it tracks is the
 * memory and the connection — so a fold, a sibling tab's fold, and the wire
 * coming back after a drop are each a reason to ask, and none of them is a
 * reason to ask twice.
 */
export const createRefiling = (): void => {
  /** The memory as one canonical string — `null` for a browser holding no folds
   *  at all, which is nothing to ask about. */
  const question = createMemo(() => printFolds(foldedByFile()))
  const ask = createAsker()
  const settle = debounce((printed: string) => ask(parseFolds(printed)), SETTLE_MS)

  createEffect(() => {
    const wanted = question()
    if (wanted === null) {
      settle.clear()
      return
    }
    // NOTHING IS ASKED INTO A DEAD SOCKET and nothing is queued behind the
    // reader — `../filter/asking.ts`'s rule, and this door's for a smaller
    // reason: the memory is not wrong while the wire is down, only untidy.
    // Tracking the readout is what asks again when it comes back.
    if (unreachable(connectionReadout()) !== null) {
      settle.clear()
      return
    }
    settle(wanted)
  })
}
