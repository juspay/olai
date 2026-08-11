/**
 * The mark column beside a node's bullet — what a node IS, in one glyph.
 *
 * Three readings of one box — empty, half-filled, checked — the racket
 * original's three (`olai/web/checkbox.rkt`), drawn from the SAME mark the
 * title tones with (`./tone.ts`): a done node is checked, a doing node is
 * half-marked, a `todo` node is an empty box.
 *
 * The empty box is for `todo` and ONLY for it. A node with NO mark draws no
 * box at all, and the difference between those two is the whole model: an
 * empty box on every row said every node was a to-do nobody had started, which
 * for a corpus of notes is a claim about every paragraph in it. `todo` says it
 * where someone meant it. What stays behind on an unmarked row is a blank of
 * the same width — the gutter is arithmetic (`./touch.ts`), and a title that
 * slid left on the rows nobody had marked would take its note's indent with
 * it. The blank carries no testid and no `data-status`: it is a place, not a
 * state.
 *
 * BLOCKED IS THE FOURTH FACE, and it belongs here rather than beside the title
 * (resolved 2026-08-11, human): what a task cannot start yet is the same KIND
 * of fact as whether it has started, so it is answered in the same column,
 * where a reader already looks to sort a row. It replaces the box rather than
 * crowding it — an hourglass in the mark column, toned with the mark it stands
 * in for, so `doing`-but-waiting and `todo`-but-waiting read as the two
 * different things they are. Only those two can wear it: a done node is
 * waiting on nothing and an unmarked one is not work, so the face composes
 * with exactly the marks that can be blocked.
 *
 * The box is display-only — toggling is keyboard-editing's job, and a click
 * handler here would invent a second write path beside the ops layer that is
 * not ready. That is why the blocked face may be a LINK without promising
 * anything false: the click is spent on going to the node's own page, which is
 * where its blockers are named in full (`./Blocked.tsx`). What it is waiting on
 * rides in the `aria-label`, so the answer is not hover-only, and the tip
 * (`./Tip.tsx`) is the same sentence for a pointer.
 */

import type { InTheWay, Status } from "@olai/format"
import { Show } from "solid-js"

import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { Tip } from "./Tip.tsx"
import { CONTROL, CONTROL_SPACER } from "./touch.ts"

const FACE: Record<Status, { readonly mark: string; readonly hint: string; readonly tone: string }> = {
  done: { mark: "☑", hint: "done", tone: "text-done" },
  doing: { mark: "◧", hint: "doing", tone: "text-doing" },
  todo: { mark: "☐", hint: "not started", tone: "text-muted" },
}

/** The blocked glyph: U+29D6, an hourglass. Not a box, because this is not a
 *  fourth answer to "how far along is it" — the mark it replaces is still what
 *  the node is, and it is still the tone. */
const WAITING = "⧖"

/** What a node is waiting on, as the one sentence both the label and the tip
 *  say — in the order `Derived.blocked` promises, which is the node's own
 *  `after` first and what points back at it after that. */
export const blockedBy = (blocked: ReadonlyArray<InTheWay>): string =>
  `blocked by ${blocked.map((one) => one.at.node.title).join(", ")}`

export function Checkbox(props: {
  readonly status: Status | undefined
  /** What holds this node up, and empty when nothing does. */
  readonly blocked: ReadonlyArray<InTheWay>
  /** The record this column belongs to — where the blocked face goes when it
   *  is followed, which is the page that names every blocker. */
  readonly id: string
}) {
  return (
    <Show
      when={props.status}
      fallback={<span class={CONTROL_SPACER} aria-hidden="true" />}
    >
      {(status) => (
        <Show
          when={props.blocked.length > 0}
          fallback={
            <span
              class={`${CONTROL} select-none text-center text-[0.8125rem] leading-none md:text-[0.8125rem] ${
                FACE[status()].tone
              }`}
              data-testid={TESTID.checkbox}
              data-status={status()}
              title={FACE[status()].hint}
              aria-hidden="true"
            >
              {FACE[status()].mark}
            </span>
          }
        >
          <Tip text={blockedBy(props.blocked)}>
            <Link
              route={{ kind: "node", id: props.id }}
              class={`${CONTROL} select-none text-center text-[0.8125rem] leading-none no-underline md:text-[0.8125rem] ${
                FACE[status()].tone
              }`}
              testid={TESTID.blocked}
              // NOT `title`: the platform's tooltip is what `Tip` replaces, and
              // two tooltips on one control is one of them written twice.
              label={blockedBy(props.blocked)}
            >
              {/* The mark is still the node's, so it stays in `data-status`
                  where a scenario reads it — the glyph is what is DRAWN, not a
                  fourth thing to be. */}
              <span
                data-status={status()}
                data-blocked-by={props.blocked.map((one) => one.at.node.id).join(" ")}
              >
                {WAITING}
              </span>
            </Link>
          </Tip>
        </Show>
      )}
    </Show>
  )
}
