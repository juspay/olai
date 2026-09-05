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
 * **The stack is one PAGE's, and one SESSION's.** It belongs to App, above the plugin providers,
 * and is cleared when the reader opens another outline, because the entries
 * name rows in it — and it holds only what this tab wrote, because "undo my
 * last op" is a promise about the person's own hands. An agent's write is not
 * in it, and neither is another window's.
 *
 * **What it says, it says once.** A refusal is why a key did nothing, so it is
 * drawn ({@link ../SaidLine.tsx}, through {@link ./UndoSaid.tsx}) in the two
 * moods every said-line in this client has ({@link ../saying.ts}) and the entry
 * is dropped; a nudge from a write
 * that landed rides back the same way it does for every other key (#109); and
 * a replay with nothing to say says nothing at all. The error rule is the
 * reason the first of those exists: a ⌘Z that silently failed would be a person
 * believing their outline had gone back and reading one that had not.
 */

import type { Applied, Edit } from "@olai/surface"
import type { OpFailure } from "@olai/format"
import { type Accessor, createContext, createSignal, useContext } from "solid-js"
import { Result } from "effect"

import type { Said } from "../saying.ts"
import { serial } from "./queue.ts"
import { EMPTY, kept, recorded, type Side, type Stack, type Step, taken } from "./undo.ts"

export interface Undo {
  /** A write this tab just made, as what would take it back — the server's
   *  answer, verbatim, `undefined` and all — which write has an inverse is the
   *  server's to say, and the one place that is decided is here rather than at
   *  every call site. */
  // Reserve the entry before awaiting a write so a subsequent Undo waits for
  // its inverse instead of spending an older entry or reporting an empty stack.
  readonly record: (step: Step | undefined | Promise<Step | undefined>) => void
  readonly undo: () => void
  readonly redo: () => void
  /** Another outline is open: the entries name rows in the one that is not. */
  readonly clear: () => void
  readonly said: Accessor<Said | null>
}

/**
 * The context itself, published rather than wrapped in a provider component of
 * its own — which is the one place this module differs from its neighbours
 * (`./editing.tsx`'s `EditorProvider`, `../reading.tsx`), and it differs for a
 * reason worth the inconsistency: a file with JSX in it cannot be imported by
 * a unit test in this repo (no transform in `bun test`), and the rules this
 * module holds — what a new op does to the redo side while a replay is still
 * in flight — are exactly the ones that must not be checkable only by pressing
 * a key in a browser. `<UndoContext.Provider>` is Solid's own spelling and
 * costs the one caller nothing.
 */
export const UndoContext = createContext<Undo>()

/** The stack the page's editor records into and the keyboard spends. A throw
 *  outside the provider, for the reason `useEditor` throws: the provider wraps
 *  the whole app, so a consumer without one is a bug in this app rather than a
 *  state a reader can reach. */
export const useUndo = (): Undo => {
  const undo = useContext(UndoContext)
  if (undo === undefined) throw new Error("an undo consumer outside <UndoProvider>")
  return undo
}

/** How an edit reaches the write gate — an ARGUMENT, for the reason
 *  `@olai/ops`' planner takes its clock and its id minter as arguments:
 *  everything in this module is a value, and a stack rule that can only be
 *  checked by pressing a key in a browser is a rule nothing checks. The one
 *  caller with a wire (App.tsx) passes it; nothing here imports one. */
export type Apply = (edit: Edit) => Promise<Result.Result<Applied, OpFailure>>

export const createUndo = (apply: Apply): Undo => {
  const [stack, setStack] = createSignal<Stack>(EMPTY)
  const [said, setSaid] = createSignal<Said | null>(null)

  /**
   * EVERYTHING THAT TOUCHES THE STACK, one at a time, in the order it
   * happened — the replays, the writes being recorded, and the clearing.
   *
   * The replays need it for the obvious reason: a person leaning on ⌘Z would
   * otherwise have two inverses judged against the same snapshot, both refused
   * or both applied to a row that has since moved.
   *
   * The other two are the subtle half, and they are here because a replay has
   * an AWAIT in the middle of it. It takes an entry off one side, waits for
   * the write, and files what came back on the other — and a `record` landing
   * in that gap is a new op that has already cleared the redo side, only for
   * the replay to finish and put an entry back on it. The reader then presses
   * ⌘⇧Z and re-applies an edit the outline has branched away from, which is
   * the one rule the stack exists to enforce. Ordering them all through one
   * queue is what makes that unrepresentable rather than a thing to remember:
   * the new op waits, and then clears a redo side that has already been
   * written to.
   *
   * The EDITOR's queue is still a different queue, and deliberately so — its
   * writes are derived from each other over a draft, and none of these are.
   * An editor reserves its inverse here before awaiting a commit. If the
   * caret leaves and ⌘Z is pressed while that reply is pending, the replay
   * waits behind it. A later navigation clear waits there too, so a late
   * inverse cannot repopulate the stack of the file the reader left.
   */
  const enqueue = serial()

  /**
   * Replay one entry's edits, in order, stopping at the first refusal.
   *
   * A VALUE out rather than three writes to signals as it goes: what to say is
   * one decision — refused, or a nudge, or nothing at all — and a function
   * that made it in pieces would be reading back what it had just written to
   * find out which case it was in.
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
      const outcome = await apply(edit)
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
    if (back.length === 0) {
      // Nothing would replay it, and since `unarchive` arrived
      // (`parity-unarchive`) that means exactly one thing: the replay was
      // REFUSED, and `said` is the ops layer's own reason. A row taken into
      // the archive used to be the other way here — it landed and no edit
      // brought it back, so this said so instead of leaving a ⌘⇧Z that did
      // nothing. There is a way back out now, so every write that LANDS
      // answers with an inverse and that sentence has nothing left to say.
      setSaid(said)
      return
    }
    setStack((current) => kept(current, side, back))
    if (said !== null) setSaid(said)
  }

  const press = (side: Side) => () => enqueue(() => replay(side))

  return {
    record: (pending) => {
      if (pending === undefined) return
      enqueue(async () => {
        const step = await pending
        if (step === undefined || step.length === 0) return
        setStack((current) => recorded(current, step))
        // And whatever the last ⌘Z had to say goes with it. The sentence was
        // about an edit that is now two edits ago, and a refusal left standing
        // over a page somebody has carried on working in is an alarm about
        // nothing.
        setSaid(null)
      })
    },
    undo: press("done"),
    redo: press("undone"),
    clear: () => {
      enqueue(() => {
        setStack(EMPTY)
        setSaid(null)
      })
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
