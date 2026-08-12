/**
 * Undo, as the app holds it: a stack ({@link ./undo.ts}), the two keys that
 * move it, and what the replay had to say.
 *
 * **An undo is a WRITE, and that is the design.** ⌘Z does not restore a
 * picture of the outline from before the edit; it sends the inverse the server
 * recorded when the edit landed, through the same `edit.apply` gate every key
 * goes through, to be judged against the set AS IT IS NOW. The difference is
 * the whole point of the feature: a restore would take everything another
 * writer — the agent, another tab, a `git pull` — has done since and quietly
 * put it back the way it was, and there is no way to spell that as a mistake a
 * person meant to make. A replayed inverse either fits the outline in front of
 * them or is refused naming what moved.
 *
 * **The stack is one PAGE's, and one SESSION's.** It is created beside the
 * open outline and cleared when the reader opens another, because the entries
 * name rows in it — and it holds only what this tab wrote, because "undo my
 * last op" is a promise about the person's own hands. An agent's write is not
 * in it, and neither is another window's.
 *
 * **What it says, it says once.** A refusal is why a key did nothing, so it is
 * drawn ({@link ./UndoSaid.tsx}) and the entry is dropped; a nudge from a write
 * that landed rides back the same way it does for every other key (#109); and
 * a replay with nothing to say says nothing at all. HACKING's rule is the
 * reason the first of those exists: a ⌘Z that silently failed would be a person
 * believing their outline had gone back and reading one that had not.
 */

import type { Edit } from "@olai/surface"
import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  useContext,
} from "solid-js"
import { Result } from "effect"

import { runAsync } from "../run.ts"
import { olai } from "../wire.ts"
import { EMPTY, kept, recorded, type Side, type Stack, type Step, taken } from "./undo.ts"

/** What the last ⌘Z / ⌘⇧Z had to say, in the two moods a write already has:
 *  `alarm` for a refusal, which is why nothing happened, and `aside` for a
 *  remark about something that did. */
export interface Said {
  readonly tone: "alarm" | "aside"
  readonly text: string
}

export interface Undo {
  /** A write this tab just made, as what would take it back — the server's
   *  answer, verbatim. Called by the row editor for every write that has one;
   *  a text edit has none, which is what keeps drafts out of the stack. */
  readonly record: (step: Step) => void
  readonly undo: () => void
  readonly redo: () => void
  /** Another outline is open: the entries name rows in the one that is not. */
  readonly clear: () => void
  readonly said: Accessor<Said | null>
}

const UndoContext = createContext<Undo>()

export function UndoProvider(props: {
  readonly undo: Undo
  readonly children: JSX.Element
}) {
  return (
    <UndoContext.Provider value={props.undo}>
      {props.children}
    </UndoContext.Provider>
  )
}

/** The stack this page's editor records into. `null` outside a provider rather
 *  than a throw: a row can be drawn on a page that has no undo (the app's
 *  shell draws one before a route resolves), and "there is nowhere to record
 *  this" is a state, where "there is no editor" is a bug. */
export const useUndo = (): Undo | undefined => useContext(UndoContext)

export const createUndo = (): Undo => {
  const [stack, setStack] = createSignal<Stack>(EMPTY)
  const [said, setSaid] = createSignal<Said | null>(null)

  /**
   * One replay at a time, in the order the keys were pressed.
   *
   * A person leaning on ⌘Z is what it is for: each entry's inverse is judged
   * against what the one before it did, and run concurrently they would be
   * judged against the same snapshot — both refused, or both applied to a row
   * that has since moved.
   *
   * The editor has a queue of its own and these two are deliberately not one.
   * The editor's exists because its writes are derived FROM EACH OTHER over a
   * draft (`./editing.tsx` says so): the id an `add` answers with, the place a
   * move produced. Nothing here is derived from a draft — an inverse is judged
   * at the gate against the set as it is — so the two never have to be ordered
   * against each other. Where they can genuinely meet is a title commit still
   * in flight when the caret leaves and ⌘Z takes back the row it was on, and
   * that meeting ends the way every other collision at this gate does: the
   * loser is refused, and the reason is shown.
   */
  let gate: Promise<unknown> = Promise.resolve()

  /**
   * Replay one entry's edits, in order, stopping at the first refusal.
   *
   * A VALUE out rather than four writes to signals as it goes: what to say is
   * one decision — refused, or a nudge, or a row that cannot come back, or
   * nothing at all — and a function that made it in pieces would be reading
   * back what it had just written to find out which case it was in.
   */
  const sent = async (
    step: Step,
    side: Side,
  ): Promise<{ readonly back: ReadonlyArray<Edit>; readonly said: Said | null }> => {
    /** What would replay THIS replay — each answer's own inverse, in reverse,
     *  because undoing [a, b] is undone by [b⁻¹, a⁻¹]. */
    const back: Array<Edit> = []
    let note: string | undefined
    for (const edit of step) {
      const outcome = await runAsync(olai.procedures.edit.apply(edit))
      if (Result.isFailure(outcome)) {
        // The entry is already off the stack. What is on screen is what the
        // set says, and the sentence is the ops layer's own — the row moved,
        // the node is gone, somebody else's write got there first. Whatever
        // landed BEFORE the refusal still answers with its inverse, so half an
        // undo is still redoable.
        return { back, said: { tone: "alarm", text: `${REFUSED[side]} ${outcome.failure.message}` } }
      }
      back.unshift(...(outcome.success.undo ?? []))
      note = outcome.success.nudge ?? note
    }
    return { back, said: note === undefined ? null : { tone: "aside", text: note } }
  }

  /**
   * Take the top of one side, replay it, and file what comes back on the
   * other.
   *
   * The entry is off the stack before the first write is sent: an entry that
   * stayed while its write was in flight could be taken twice, and a refused
   * one is dropped rather than retried — pressing ⌘Z again should reach the
   * edit BEFORE the one that will not go, which is what a person means by
   * pressing it again.
   */
  const replay = async (side: Side): Promise<void> => {
    const held = taken(stack(), side)
    if (held === null) {
      setSaid({ tone: "aside", text: NOTHING[side] })
      return
    }
    setStack(held.rest)
    setSaid(null)

    const { back, said } = await sent(held.step, side)
    if (back.length > 0) setStack((current) => kept(current, side, back))
    // Nothing to file and nothing refused: it landed, and no edit would replay
    // it — the only write that answers that way is a row taken back into the
    // archive, which no move brings out (a parent is same-file by the format).
    // Said rather than left as a ⌘⇧Z that does nothing.
    setSaid(said ?? (back.length === 0 ? { tone: "aside", text: GONE } : null))
  }

  const press = (side: Side) => () => {
    const again = () => replay(side)
    gate = gate.then(again, again)
  }

  return {
    record: (step) => {
      if (step.length === 0) return
      setStack((current) => recorded(current, step))
    },
    undo: press("done"),
    redo: press("undone"),
    clear: () => {
      setStack(EMPTY)
      setSaid(null)
    },
    said,
  }
}

/** What a key with nothing to take back says. It says SOMETHING, because a
 *  chord that does nothing at all reads as a chord that is broken — and
 *  because the sentence is where the scope of the stack is explained. */
const NOTHING: Record<Side, string> = {
  done: "nothing to undo — this takes back the edits you made on this outline",
  undone: "nothing to redo",
}

const REFUSED: Record<Side, string> = {
  done: "that edit could not be taken back:",
  undone: "that edit could not be put back:",
}

const GONE =
  "the row is in the archive now, which is not somewhere redo can bring it back from"
