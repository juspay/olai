/**
 * The four things a node's glyph can BE, drawn.
 *
 * One vocabulary, one width: a bullet, an empty box (`todo`), a half-filled box
 * (`doing`), a checked box (`done`) — and the hourglass that stands in for any
 * of the marks when the node cannot start yet. The faces are CSS and SVG rather
 * than the text glyphs (`☑ ◧ ☐ •`) they replaced, so every theme paints them
 * from the same tokens, a font change cannot reshape them, and they all measure
 * the same across.
 *
 * WHAT DRAWS THEM is `./Glyph.tsx` — one column in the gutter, so a reader
 * scanning a tree looks in one place to sort a row rather than at a dot and then
 * at a box beside it. This file is only what each face LOOKS like.
 *
 * The bullet is for a node with NO mark, and the difference between it and the
 * empty box is the whole model: an empty box on every row said every node was a
 * to-do nobody had started, which for a corpus of notes is a claim about every
 * paragraph in it. `todo` says it where someone meant it; everything else is a
 * bullet.
 *
 * BLOCKED IS THE FIFTH FACE, and it belongs in this column rather than beside
 * the title (resolved 2026-08-11, human): what a task cannot start yet is the
 * same KIND of fact as whether it has started, so it is answered where a reader
 * already looks. It replaces the box rather than crowding it, toned with the
 * mark it stands in for, so `doing`-but-waiting and `todo`-but-waiting read as
 * the two different things they are. Only those two can wear it: a done node is
 * waiting on nothing and an unmarked one is not work.
 *
 * ## The tones, and why exactly one of them is a colour
 *
 * `doing` is the only accented glyph (the quiet outline, human). Work in flight
 * is the one thing in a tree worth finding at a glance, so it takes the app's
 * ACCENT and everything else is ink or muted — including `done`, which used to
 * be green and now RECEDES, because a finished row's job is to be legible and
 * out of the way rather than to be found. That is one decision with two halves
 * and the other is `./tone.ts`, which tones the title beside the glyph; the two
 * are written to be read together.
 *
 * `data-face` is the contract the browser tests assert on — not the pixels of a
 * glyph, which a restyle is entitled to change.
 */

import type { InTheWay, Status } from "@olai/format"
import { Match, Switch } from "solid-js"

/** The five faces the glyph column can draw — a closed set so a typo is a
 *  compile error rather than a `Switch` that matches nothing and draws no
 *  glyph. `bullet` is what a node with no mark is. */
export type MarkFace = "bullet" | "checked" | "doing" | "empty" | "waiting"

/** Which face a mark wears, what it is called, and the ink it takes. `doing`
 *  is the one accent in the column; `done` recedes into the muted ink beside
 *  the strike its title carries. */
export const FACE: Record<
  Status,
  { readonly face: Exclude<MarkFace, "waiting" | "bullet">; readonly hint: string; readonly tone: string }
> = {
  done: { face: "checked", hint: "done", tone: "text-muted" },
  doing: { face: "doing", hint: "doing", tone: "text-accent" },
  todo: { face: "empty", hint: "not started", tone: "text-muted" },
}

/** What a node with no mark takes: the ink of the page, because a bullet is not
 *  a state — it is the absence of one, and a toned bullet would be a claim. */
export const BULLET_TONE = "text-ink"

/** What a node waiting on something takes, whatever mark it carries: the mark's
 *  own tone, so `doing`-but-waiting still reads as work in flight. */
export const waitingTone = (status: Status): string => FACE[status].tone

/** What a node is waiting on, as the one sentence both the label and the tip
 *  say — in the order `Derived.blocked` promises, which is the node's own
 *  `after` first and what points back at it after that. */
export const blockedBy = (blocked: ReadonlyArray<InTheWay>): string =>
  `blocked by ${blocked.map((one) => one.at.node.title).join(", ")}`

/** Which face a place wears, from the two facts that decide it. One function
 *  rather than a chain of ternaries at the drawing site, so "waiting replaces
 *  the box" and "no mark is a bullet" are stated once. */
export const faceOf = (
  status: Status | undefined,
  blocked: ReadonlyArray<InTheWay>,
): MarkFace => {
  if (status === undefined) return "bullet"
  return blocked.length > 0 ? "waiting" : FACE[status].face
}

/** The dot itself, at the one size a bullet is. Exported because a row that
 *  does not exist yet draws the same dot HOLLOW (`./edit/NewRow.tsx`), and two
 *  spellings of a bullet's size would be two things to change when it moves. */
export const DOT = "block h-[0.375rem] w-[0.375rem] rounded-full"

/** Shared box geometry: Workflowy-weight square, sized to the title's cap. */
const BOX =
  "inline-block h-[0.75rem] w-[0.75rem] shrink-0 rounded-[0.1rem] border-[1.5px] border-current box-border"

export function Face(props: { readonly face: MarkFace }) {
  return (
    <Switch>
      <Match when={props.face === "bullet"}>
        {/* Workflowy's filled circle, never a text glyph: a `•` is a different
            size and weight in every font, and the gray halo a collapsed parent
            wears has nowhere to sit on a character. */}
        <span class={`${DOT} bg-current`} />
      </Match>
      <Match when={props.face === "empty"}>
        <span class={`${BOX} bg-transparent`} />
      </Match>
      <Match when={props.face === "doing"}>
        {/* Half-filled: left half ink, right half open — Workflowy's "in
            progress" reading, and olai's `doing` mark. */}
        <span
          class={`${BOX} bg-[linear-gradient(to_right,currentColor_49%,transparent_50%)]`}
        />
      </Match>
      <Match when={props.face === "checked"}>
        <span class={`${BOX} relative bg-transparent`}>
          {/* Checkmark as two borders of a rotated square — no SVG dependency,
              scales with the box, inherits the muted tone done now takes. */}
          <span
            class="absolute left-[0.12rem] top-[0.02rem] h-[0.4rem] w-[0.22rem] rotate-45 border-b-[1.5px] border-r-[1.5px] border-current"
            aria-hidden="true"
          />
        </span>
      </Match>
      <Match when={props.face === "waiting"}>
        {/* Hourglass, drawn rather than a Unicode glyph so a font change cannot
            drop it and the tests assert on data-face instead. */}
        <svg
          class="h-[0.75rem] w-[0.75rem]"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 2h10M3 14h10M4 2c0 3.5 2 4.5 4 6-2 1.5-4 2.5-4 6M12 2c0 3.5-2 4.5-4 6 2 1.5 4 2.5 4 6"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </Match>
    </Switch>
  )
}
