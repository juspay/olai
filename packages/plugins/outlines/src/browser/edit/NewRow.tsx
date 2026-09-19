/**
 * A row that does not exist yet.
 *
 * It is drawn where the row WILL be — after the sibling it follows, before
 * the one it was opened above, or on the start line of a page with no rows —
 * with the same gutter arithmetic every
 * other row uses (`../touch.ts`), so the line a person is typing on sits
 * exactly where the line they are making it will sit. The vertical rhythm is
 * that same ruling: `my-0.5` around the whole thing and `py-1` on the line
 * are the `li` and row-line classes from `../Tree.tsx`, and without them an
 * empty line stood 12px shorter than its neighbours — spacing that wobbled
 * wherever a draft was parked. What it deliberately
 * does NOT have is a glyph that goes anywhere or says a mark: those are
 * affordances of a node, and there is no node here until this has a title and
 * gets committed.
 *
 * The bullet has two faces, and they answer the one question a reader who
 * looks away and back asks — where is the caret: the line the caret is IN
 * draws the FILLED dot, in the accent a row holding the caret draws its glyph
 * in, and the line around it wears the wash and ring such a row wears — Tab,
 * Shift+Tab and Alt+Shift+↑/↓ already answer under it, so that line is a
 * row, not a hint — while a PARKED one holds the outline: the sketch left
 * standing on the page, an answer at a glance rather than an area of
 * editing. The chrome is not decoration: this line IS the row for as long as
 * its write is in flight and its frame has not arrived, so what a reader sees
 * when the save lands is nothing at all. Neither says a record exists — there
 * is none until a title commits one — so both spellings of the dot are
 * `marks.tsx`'s: one place a bullet's size is decided.
 */
import { TESTID } from "olai-plugin-outlines/testids"
import { DOT } from "@olai/web/client/marks.tsx"

import { CONTROL, GLYPH_BOX, HOVER_CELL, HOVER_GUTTER, ROW_LINE } from "@olai/ui-primitives/touch.ts"
import { clearNode } from "../focus.ts"
import type { Ghost } from "./draft.ts"
import { DraftSaid, TitleEditor } from "./RowEditor.tsx"

export function NewRow(props: {
  /** The LIVE line this ghost draws — the draft and the address it is typed at
   *  (`./draft.ts`'s `Ghost`), whether it is still a pending or the row it
   *  became one reply ago. What this component draws is a line at a seat, and
   *  the seat is `../Tree.tsx`'s `where().pending`. */
  readonly line: Ghost
  readonly onInput: (text: string) => void
  readonly onKey: (event: KeyboardEvent) => void
  readonly onBlur: (left: boolean) => void
  /** This draft holds the caret. Parked ghosts are inputs too, so they can
   *  be clicked back into; they must not steal focus on mount. Absent is
   *  the live one, which is what a start line and a lone Enter still are. */
  readonly active?: boolean
  /** Clicking a parked ghost puts the caret in it. */
  readonly onActivate?: () => void
  readonly onParkedInput?: (text: string) => void
}) {
  return (
    <div class="my-0.5">
      <div
        // THE LINE THE CARET IS IN WEARS THE CHROME OF THE ROW IT IS BECOMING.
        // A row being typed is toned while it holds the caret, a wash and a
        // ring (`../Tree.tsx`'s `editing` and `focused`) — and this line is
        // that row one reply early, so when the save lands nothing a reader can
        // see changes except the `•••` beside it going live. A PARKED blank
        // keeps the bare outline it always had: it is a sketch left standing,
        // not a row anybody is in.
        //
        // AND IT IS LAID OUT BY THE ROW'S OWN RULE — {@link ROW_LINE}, the same
        // constant `../Tree.tsx` draws a row with. This was `items-center` here
        // and `items-baseline` there, and the bullet dropped six pixels (and the
        // caret changed height) at every landing: a blank is a row one write
        // early, so the two boxes are the same box or the seat they share is
        // only pretending.
        class={`${ROW_LINE} rounded-sm`}
        classList={{ "bg-accent/10 ring-1 ring-accent/50": props.active !== false }}
        // A CARET IN A LINE THAT IS NOT A ROW LIGHTS NO ROW. The ring a
        // selected row wears (`../focus.ts`) has to leave, or the row above
        // goes on claiming to be the one while this line is what is being
        // typed — and it would then lose it at the landing, when the new row's
        // own editor takes the focus and selects it. Nothing would move at
        // that moment if this line already said the whole of it.
        //
        // HERE rather than at the row this line happens to be drawn in: a start
        // line's ghost is inside no row at all (`./StartLine.tsx`), and the
        // fact is the line's own. `../Tree.tsx`'s `onFocusIn` still has to
        // ignore an input's focus — this says why it may.
        onFocusIn={() => clearNode()}
        data-testid={TESTID.newRow}
      >
        {/* The hover strip's PLACE, cell for cell: a row reserves the `•••`
            (pointer devices only, `hidden md:` exactly as the menu hides
            itself) and the collapse triangle, and a draft that reserved one
            cell for the two sat 1.25rem to the left of the siblings it was
            about to join — a line typed at one depth and committed at
            another. The widths are `../touch.ts`'s; what has to match is how
            many cells there are. */}
        <span class={HOVER_GUTTER}>
          <span class={`${HOVER_CELL} hidden md:inline-flex`} aria-hidden="true" />
          <span class={HOVER_CELL} aria-hidden="true" />
        </span>
        {/* The two faces of the same dot: the line the caret is IN draws the
            bullet of the row it will become, in the accent the caret's own row
            draws its glyph in (`./Glyph.tsx`'s `holding`) — Tab, Shift+Tab and
            Alt+Shift+↑/↓ already answer under it, and a place the keys claim
            is a row, not a placeholder — while a PARKED one stays the outline:
            the sketch left standing on the page (the comment above).
            `active` is exactly that line.

            THE CELL IS A ROW'S CELL, box for box: `GLYPH_BOX` is the span a
            tree row wraps its bullet in so the bullet can be picked up
            (`./drag/Handle.tsx`), and `CONTROL` is what both draw inside it —
            an alignment that lived in two files put this dot six pixels away
            from the glyph it becomes. No `data-handle`: a blank is not
            something to pick up. */}
        <span class={GLYPH_BOX} aria-hidden="true">
          <span
            class={CONTROL}
            classList={{ "text-accent": props.active !== false }}
            // WHAT A STEP MEASURES THE BULLET BY (`../e2e/steps/editing_steps.ts`,
            // which asks the same box of the row it becomes): the blank's cell
            // is not the row's `zoom` link, so the two states are two testids —
            // named here, one per state, rather than unioned in the dark.
            data-testid={TESTID.newRowGlyph}
            aria-hidden="true"
          >
            <span
              class={props.active === false ? `${DOT} border-[1.5px] border-muted` : `${DOT} bg-current`}
            />
          </span>
        </span>
        <TitleEditor
          slot={{ row: props.line.slot, field: "new" }}
          text={props.line.draft.text}
          onInput={props.onInput}
          onKey={props.onKey}
          onBlur={props.onBlur}
          active={props.active}
          onActivate={props.onActivate}
          onParkedInput={props.onParkedInput}
          placeholder="a new line — type it, and Enter makes the next one"
          // A ghost IS a line: the box is the rest of it, which is what a
          // person aims at and what the placeholder has to be readable in.
          // A row's title is the other shape (`../NodeLine.tsx`).
          fillsLine
        />
      </div>
      {/* Under the line it belongs to. A new row is the draft most likely to
          be refused (a node needs a title), and on an empty outline it is the
          only thing on the page — so what the write said has to be here
          rather than somewhere the tree would have drawn it. */}
      <DraftSaid draft={props.line.draft} />
    </div>
  )
}
