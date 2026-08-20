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

import { type Moved, type MovingRequest, type Row, sameMovingRequest } from "@olai/format"
import type { Edit } from "@olai/surface"
import {
  type Accessor,
  batch,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  Show,
  useContext,
} from "solid-js"

import { SaidLine } from "../edit/SaidLine.tsx"
import { flatten, refound } from "../edit/order.ts"
import { useUndo } from "../edit/undoing.ts"
import { sameIds } from "../ids.ts"
import { createSaying } from "../saying.ts"
import { TESTID } from "../testids.ts"
import { olai } from "../wire.ts"
import { applying } from "../writes.ts"
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
  /**
   * WHERE THE CARET GOES when the picker is dismissed — back into the row it
   * was opened on.
   *
   * `⌘⇧M` is the keyboard door, and a keyboard door that leaves focus on
   * `<body>` is a reader who has to reach for the pointer to get back into the
   * outline. It is the rule the `•••` menu already keeps (`menu/Dropdown.tsx`'s
   * `handBack`: a KEY gets the caret back, a pointer does not) and the picker
   * is where it matters most, because there is no trigger element to restore —
   * the row's own editor is where the reader was.
   *
   * Handed in rather than reached for, because the editor is made from this
   * same page one line later (`../edit/Editable.tsx`) and the dependency runs
   * one way: the editor knows the picker, and the picker knows one verb of the
   * editor's. It takes the ROW, because opening a caret is a fact about a row
   * and this module holds the place to find one at.
   */
  back: (row: Row) => void,
): Moving => {
  const undo = useUndo()
  const [standing, setStanding] = createSignal<Standing | null>(null)
  /**
   * THE DESTINATIONS BEING JUDGED — the ids the picker's shortlist is drawing
   * right now.
   *
   * They are the STREAM'S ARGUMENT, which is why they live here rather than
   * inside the panel: one subscription answers both halves of what this gesture
   * needs to know — where the row now is, and which of these hits could take it
   * — out of one revision of one set, so a refusal can never name a file the
   * row has since left (`@olai/format`'s `moving.ts`).
   *
   * WHAT THE PANEL HANDS UP IS THE ACCESSOR, once, and what is here is a
   * DERIVATION of it — not a report pushed on every answer. The push was an
   * effect reading the hits and setting a signal this reads, which is a
   * derivation spelled as a round trip through state: three hops for a value
   * that is a function of one, and the shape that hid the two defects below
   * (the request rebuilt when nothing about it moved). A list is what knows its
   * hits and this is what asks about them; one line between the two, and it is
   * an accessor.
   *
   * TWO NAMES for the two halves, and they are two things rather than one
   * spelled twice: `hitIds` is WHOSE reading this is and `aimed` is WHAT IT
   * SAYS, by value.
   *
   * WHOSE, exactly: {@link NONE} before any list has mounted; the open list's
   * accessor while one is; a SPENT one after it goes, because a shortlist does
   * not hand its list back as it unmounts (`../search/Shortlist.tsx` says why
   * — the door's question would change at the moment the panel closes, which
   * here is a subscription re-opened to say the gesture is over). A spent one
   * is never read, because the request below asks nothing with no row standing
   * — and `open` puts it down before the next row stands, so the panel that
   * follows starts from nothing rather than from the last list's rows.
   */
  const [hitIds, setHitIds] = createSignal<Accessor<ReadonlyArray<string>>>(NONE)
  const aimed = createMemo<ReadonlyArray<string>, undefined>(() => hitIds()(), undefined, {
    // BY VALUE, because the shortlist's hits are a fresh array on every answer
    // and BOTH readers of this want the destinations rather than the array: the
    // request below, whose own equality would then absorb it, and `refusals`,
    // which rebuilds a `Map` per run and is the reader this actually spares.
    equals: sameIds,
  })
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

  /**
   * …and the SPENT gesture, put down when its sentence goes.
   *
   * `landed` is the arm that outlives the panel: the picker is gone, and what
   * stands is a line under the row, wherever the row went. When the line takes
   * itself away (`../saying.ts`'s six seconds) there is nothing left of the
   * gesture at all — and nothing was putting it down. `close` is reachable only
   * from the picker, which is unmounted by then, and the effect above only
   * nulls a record that has LEFT the page.
   *
   * What a `landed` nobody lets go of costs is not on screen, which is why it
   * went unseen: the subscription below stays open FOR EVER with the last
   * move's request, and the effect above goes on flattening the whole visible
   * tree on every frame this page publishes, for a panel nobody can see.
   *
   * BOTH READS ARE TRACKED, so this answers whichever of the two arrives last:
   * a write with a sentence is put down when the sentence expires, and a write
   * with nothing to say — the ops layer answers with `Said | void` — is put
   * down the moment it lands, because there was never a line to wait for.
   */
  createEffect(() => {
    const held = standing()
    if (held?.kind === "landed" && saying.said() === null) setStanding(null)
  })

  /**
   * WHAT THE SET SAYS ABOUT THIS MOVE — the row as it stands, and a verdict per
   * destination.
   *
   * A SUBSCRIPTION rather than a question asked once, which is the same shape
   * the reading of a page is and for the same reason: a panel stands open while
   * anybody writes, and what it judges has to be where the row has actually got
   * to. It was a walk of the tab's own copy of the vault
   * (`docs/brainstorming/vault-in-browser.md`); the rules did not move, the set
   * did (`@olai/format`'s `moving.ts`).
   *
   * A `null` INPUT with no panel open, which is the framework's own way of
   * holding a subscription closed: a row nobody is moving is a question nobody
   * is asking.
   *
   * A MEMO WITH AN EQUALITY, and the equality is the whole of it. A stream's
   * input is not compared — the framework re-subscribes whenever the input
   * NOTIFIES (`@kolu/surface`'s `createReactiveSubscription`) — so an accessor
   * minting a fresh object per run re-asks on every notification of anything it
   * touched. `standing` is such a notification on every frame the row's drawn
   * place moves under it (the effect above re-files it, which is its job), and
   * the question is about the RECORD and the destinations, neither of which
   * moved. Un-guarded, another writer's edit tore this down, blanked the answer
   * for a round trip, and un-dimmed every refused row in the open list before
   * re-dimming it.
   */
  const request = createMemo<MovingRequest | null, undefined>(
    () => {
      const held = standing()
      return held === null ? null : { record: held.record, to: aimed() }
    },
    undefined,
    // The FORMAT's own equivalence over the request, beside the one the server
    // holds its answers by (`@olai/format`'s `sameMovingRequest`) — a
    // hand-written pair of field comparisons here would be the same two fields
    // spelled a second time, free to forget the third.
    {
      equals: (a, b) => a === null || b === null ? a === b : sameMovingRequest(a, b),
    },
  )

  const answer = olai.streams.moving.use(request)

  /**
   * The row being moved — `undefined` for a record the set no longer declares,
   * which is what closes the panel rather than leaving it pointing at nothing.
   *
   * IT HOLDS ACROSS A RE-ASK, which is the difference between the two absences
   * this memo has to tell apart. A subscription's value resets to `undefined`
   * between an input change and the first frame of the new one, and the input
   * changes every time the shortlist answers with different hits — so a memo
   * that read it straight through would take the panel off the screen and put
   * it back on every search, restarting the search that caused it. `null` is
   * the set's own answer that this record is gone, and that one closes it.
   */
  const moved = createMemo<Moved | undefined>((held) => {
    const record = standing()?.record
    if (record === undefined) return undefined
    const said = answer()
    // …and a HELD row is only kept for the row it is about: opening the picker
    // on another row must not draw the last one's title for a frame.
    if (said === undefined) return held?.id === record ? held : undefined
    return said.moved ?? undefined
  })

  /** …and why each destination cannot take it, by id. The answer's verdicts are
   *  IN THE ORDER ASKED, so they are paired back up with the ids that were
   *  sent — and with the ids on the ANSWER's own reading of that request rather
   *  than with whatever the shortlist is showing a frame later. */
  const refusals = createMemo<ReadonlyMap<string, string>>(() => {
    const said = answer()?.refusals ?? []
    const asked = aimed()
    const found = new Map<string, string>()
    asked.forEach((id, at) => {
      const why = said[at]
      if (why !== undefined && why !== null) found.set(id, why)
    })
    return found
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

  /**
   * Put the picker away, and hand the caret back to the row it was opened on.
   *
   * The row is looked up in what is DRAWN now rather than remembered from the
   * open: a panel can stand through another writer's frame, and the row it is
   * about may have been redrawn at a new place since (which is what `refound`
   * above keeps `standing.place` honest through). A row that has left the page
   * altogether takes nothing back — there is nowhere for a caret to go, and
   * putting one somewhere else would be worse than leaving it where it is.
   */
  const close = (): void => {
    const held = standing()
    setStanding(null)
    if (held === null) return
    const row = flatten(page.rows(), page.collapsed()).find((one) => one.key === held.place)
    if (row !== undefined) back(row)
  }

  return {
    open: (at) => {
      // A stale sentence about the LAST move, hanging over a panel somebody has
      // just opened to make another one, is a sentence about nothing they can
      // see.
      saying.say(null)
      // …and neither are the last panel's DESTINATIONS. The shortlist hands its
      // own list up when it mounts, which is after this, so a picker that did
      // not put the old ones down opens by asking the set to judge its row
      // against rows nobody is showing — and then asks again, correctly, when
      // the new list arrives. Opening is the moment the gesture starts, so it
      // is the moment the question does.
      //
      // BATCHED so it is one question and not two: both of these feed the
      // request, and written apart each would open a subscription of its own.
      batch(() => {
        // `() => NONE` and not `NONE`: a function handed to a setter is an
        // updater, so an accessor is set through one that answers with it.
        setHitIds(() => NONE)
        setStanding({ kind: "picking", ...at })
      })
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
                moved={at()}
                refusals={refusals()}
                // The accessor, held as a VALUE — Solid reads a function passed
                // to a setter as an updater, so a signal whose value is a
                // function is set through one that answers with it.
                onAimed={(ids) => setHitIds(() => ids)}
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

/** No destinations, because no list is showing — what {@link createMoving}'s
 *  `hitIds` holds before the first shortlist has handed up its own reading, and
 *  what `open` puts it back to for every panel after that. The array is fresh
 *  per call and that costs nothing: what reads it compares by value
 *  ({@link ../ids.ts}), so an empty list is an empty list. */
const NONE = (): ReadonlyArray<string> => []
