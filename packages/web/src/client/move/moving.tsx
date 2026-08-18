/**
 * MOVING one row to a new parent, as one thing a page holds: which row's picker
 * is open, where that row is drawn now, the write it sends, and the line that
 * says what came of it.
 *
 * `../edges/editing.tsx`'s shape — a hook that hands back the verbs a host
 * calls and ONE component to draw — with one difference that is the whole
 * reason this is a page-level primitive rather than a row-level one: the row
 * MOVES. Two things follow.
 *
 * **The key comes from the page and the panel is drawn in a row.** ⌘⇧M is
 * pressed in the row editor, which is the page's one caret (`../edit/
 * editing.tsx`), and the panel hangs under the row that caret was in. Those are
 * two components with no path between them, so the fact they share — which row
 * is being moved — is held here, exactly as the multi-selection the same three
 * keys hand off to is (`../select/selection.ts`). The `•••` menu's `Move to…`
 * is the second door onto the same call.
 *
 * **The panel FOLLOWS its row.** A place is a chain of ids, so the moment the
 * write lands the row's `Row.key` is a different string — and a panel keyed on
 * the old one would vanish, taking the ops layer's `nudge` with it exactly when
 * it has something to say (a subtree of unfinished work landing under a branch
 * somebody ticked off re-opens that branch, and the person who moved it is who
 * that sentence is for). So the row is followed by its RECORD through
 * `../edit/order.ts`'s `refound` — the rule that keeps the caret and a pick in
 * place across a server-authoritative redraw, and this is its third consumer.
 *
 * ONE WRITE AT A TIME, for the reason every other panel in this client holds
 * one: the gate is a round trip, and a second `Enter` while the first is out is
 * two writes for one intention.
 *
 * NOTHING IS ECHOED. The row moves when the file says it moved — the panel
 * below is redrawn from the same snapshot every other reader is drawn from, and
 * a refusal leaves the row exactly where it was with the reason under it.
 */

import type { Row } from "@olai/format"
import { follow } from "@olai/format"
import type { Edit } from "@olai/surface"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  Show,
  useContext,
} from "solid-js"

import { useDerived } from "../derived.tsx"
import { SaidLine } from "../edit/SaidLine.tsx"
import { flatten, refound } from "../edit/order.ts"
import { useUndo } from "../edit/undoing.ts"
import { createSaying } from "../saying.ts"
import { TESTID } from "../testids.ts"
import { applying } from "../writes.ts"
import type { Moved } from "./destination.ts"
import { MovePicker } from "./MovePicker.tsx"

export interface Moving {
  /**
   * Open the picker on a row — ⌘⇧M in its editor, and the `•••` menu's
   * `Move to…`.
   *
   * The two facts it takes are the two a `Row` would have been asked for, and
   * they are taken as themselves for `../search/place.ts`'s reason: one of the
   * two doors has no `Row` at all. `⌘⇧M` is answered by the editor, which holds
   * a DRAFT — the record being typed in and where it is drawn — and a signature
   * spelled `Row` would have made it go looking for the row again in the tree it
   * had just left.
   *
   * `record` is the row's OWN, so a mirror moves as the placement it is and the
   * node it stands for stays where it lives.
   */
  readonly open: (at: { readonly record: string; readonly place: string }) => void
  /**
   * Is there anything for this row to draw — the picker, or the sentence a
   * write left standing under it?
   *
   * ONE question rather than two, which is `../edges/editing.tsx`'s rule and
   * matters most here: a row asks it on every frame, and a host that formed the
   * condition for itself would be a second formula for "is there a panel" —
   * free to lay out an empty box under every row in the outline.
   */
  readonly showing: (key: string) => boolean
  /** The panel and whatever its write had to say, drawn together wherever the
   *  host puts them. */
  readonly Panel: () => JSX.Element
}

/**
 * WHICH ROW this gesture is about, and which half of it is happening — the
 * record (what the write names, and what the panel is re-found by) and where
 * that row is drawn right now.
 *
 * A UNION rather than a record with a flag and a maybe-field, because the two
 * arms know different things and only one of them grounds the second: `under`
 * is where the row WENT, which is a fact that does not exist until a write has
 * landed. Flat, those two fields spell three states this gesture does not have
 * ("picking, and it already went there") and leave the one it does have to a
 * rule nobody enforces.
 */
type Standing =
  /** The picker is up on this row. */
  | { readonly kind: "picking"; readonly record: string; readonly place: string }
  /**
   * The picker is spent: a move landed, and what it SAID is still standing
   * under the row — which is normally the row itself, drawn wherever it went.
   *
   * `under` is the fallback for the one case where following the row is not
   * enough: a destination this page does not DRAW. A collapsed branch is the
   * ordinary one (its children are not among the rows, deliberately —
   * `../edit/order.ts` flattens what is on screen), and done-hidden is the
   * other. The row is genuinely gone from the page, so it has no line of its
   * own to hang the sentence under — and dropping it would lose the ops layer's
   * `nudge` exactly when it has something to say.
   *
   * So the line falls back to the row it landed IN, which is drawn, is the
   * nearest thing on screen to where it went, and — for the nudge this can
   * actually carry — is a row the sentence is about anyway.
   *
   * NOT unfolding that branch instead: this app does not open what a reader has
   * closed on their behalf (`../focus.ts` takes the same position for a chat
   * reference pointing into a collapsed branch, and answers by navigating
   * rather than by unfolding).
   */
  | {
    readonly kind: "landed"
    readonly record: string
    readonly place: string
    readonly under: string
  }

const MovingContext = createContext<Moving>()

/** The page's move picker. A throw outside the provider, for the reason
 *  `useSelection` throws: a row drawn outside an editable page has no picker to
 *  open, rather than one that does nothing. */
export const useMoving = (): Moving => {
  const moving = useContext(MovingContext)
  if (moving === undefined) throw new Error("a move picker outside <Editable>")
  return moving
}

export const MovingProvider = MovingContext.Provider

export const createMoving = (
  /** The rows on screen and what is folded — the same pair the caret and the
   *  pick are found again through, and for the same reason. */
  page: {
    readonly rows: Accessor<ReadonlyArray<Row>>
    readonly collapsed: Accessor<ReadonlySet<string>>
  },
): Moving => {
  const derived = useDerived()
  const undo = useUndo()
  const [standing, setStanding] = createSignal<Standing | null>(null)
  /** How long the line lingers, and what clears it, is the client's ONE
   *  receptacle for that (`../saying.ts`) rather than a fourth timer here. */
  const saying = createSaying()
  const [sending, setSending] = createSignal(false)

  /**
   * The row the panel is under, found again when it has moved.
   *
   * `../edit/order.ts`'s rule, applied to this one place — answered unchanged
   * while the row is still drawn where it was, and `undefined` when the record
   * has left the page altogether (another writer archived it, a filter narrowed
   * it away), which closes the panel rather than leaving it pointing at
   * nothing.
   */
  createEffect(() => {
    // The CHEAP tracked read first, and the walk only behind it — `../edit/
    // editing.tsx`'s `follow` makes the same move for the same two reasons.
    // With nothing open this effect depends on one signal instead of on every
    // frame the store publishes; and it must depend on SOMETHING, or an early
    // return before the first tracked read would leave it with no dependencies
    // at all — an effect that runs once, at creation, and never again.
    const held = standing()
    if (held === null) return
    const drawn = flatten(page.rows(), page.collapsed())
    const moved = refound(drawn, held.record, held.place) ??
      // …or the row it landed in, for a destination this page does not draw —
      // which is a fact the `landed` arm has and the `picking` one does not.
      // `null` for the place it came from, because that is a place the
      // destination row was never at.
      (held.kind === "picking" ? undefined : refound(drawn, held.under, null))
    if (moved === held.place) return
    setStanding(moved === undefined ? null : { ...held, place: moved })
  })

  /** The row being moved, as the SET says it now — re-read per frame rather
   *  than captured at open, so a panel left standing while an agent writes is
   *  judging destinations against where the row has actually got to. */
  const moved = createMemo<{ readonly moved: Moved; readonly title: string } | undefined>(() => {
    const held = standing()
    const indexes = derived()
    if (held === null || indexes === undefined) return undefined
    const located = indexes.byId.get(held.record)
    if (located === undefined) return undefined
    // What the row SHOWS: itself, or what a placement points at — the id the
    // never-inside-itself rule is asked of, and the title the panel names.
    const shown = follow(indexes, located)
    return {
      moved: {
        id: located.node.id,
        file: located.file,
        shows: shown.kind === "found" ? shown.shows.node.id : undefined,
        parent: located.node.parent ?? null,
      },
      title: shown.kind === "found" ? shown.shows.node.title : held.record,
    }
  })

  const write = (edit: Edit): void => {
    if (sending()) return
    setSending(true)
    // WHERE IT IS GOING, remembered before the answer: the verb carries the
    // destination, and after the write lands it is the only thing that can
    // find a row this page has stopped drawing ({@link Standing.landed}).
    const under = edit.verb === "under" ? edit.parent : undefined
    // Cleared BEFORE the attempt rather than after it, which is the menu's own
    // rule: a write that takes a moment would otherwise sit under the last
    // one's sentence, and that reads as this one's answer.
    saying.say(null)
    void applying(edit, undo.record)
      .then((said) => {
        saying.say(said)
        // …and a landed write SPENDS the picker: the row is somewhere else now,
        // so the panel goes rather than offering to move it again from a list
        // answering a question about where it used to be. The gesture becomes
        // its other arm — the sentence, standing under the row, wherever
        // `refound` above finds it.
        if (said?.tone === "alarm" || under === undefined) return
        setStanding((held) =>
          held === null
            ? null
            : { kind: "landed", record: held.record, place: held.place, under }
        )
      })
      .finally(() => setSending(false))
  }

  const close = (): void => {
    setStanding(null)
  }

  return {
    open: (at) => {
      // A stale sentence about the LAST move, hanging over a panel somebody has
      // just opened to make another one, is a sentence about nothing they can
      // see.
      saying.say(null)
      setStanding({ kind: "picking", ...at })
    },
    showing: (key) => {
      const held = standing()
      return held !== null && held.place === key &&
        (held.kind === "picking" || saying.said() !== null)
    },
    Panel: () => (
      <>
        {/* NESTED rather than one `<Show>` over a pair, which is the edge
            panel's own arrangement and for its reason: the picker needs both
            and each is separately absent — a panel nobody opened, and a row
            whose record has left the set. */}
        <Show when={standing()?.kind === "picking"}>
          <Show when={moved()}>
            {(at) => (
              <MovePicker
                moved={at().moved}
                title={at().title}
                onWrite={write}
                onClose={close}
              />
            )}
          </Show>
        </Show>
        <Show when={saying.said()}>
          {(message) => (
            // The mood, its `data-tone` and whether a screen reader is
            // interrupted are `../edit/SaidLine.tsx`'s, for every surface that
            // says something about a write; what is this one's is where the
            // line sits — under the row that moved, which for a refusal is the
            // row that did not.
            <SaidLine
              said={message()}
              class="mt-1 mb-0 text-[0.8125rem] leading-snug"
              testid={TESTID.moveSaid}
            />
          )}
        </Show>
      </>
    ),
  }
}
