/**
 * The mark column beside a node's bullet — what a node IS, drawn as a square.
 *
 * Three readings of one box — empty, half-filled, checked — Workflowy's shape
 * rather than the text glyphs (`☑ ◧ ☐`) that used to stand in for them. The
 * faces are CSS, so every theme paints them from the same tokens and a font
 * change cannot reshape the box.
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
 * crowding it — an hourglass drawn in the mark column, toned with the mark it
 * stands in for, so `doing`-but-waiting and `todo`-but-waiting read as the two
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
 *
 * `data-face` is the contract the browser tests assert on — not the pixels of
 * a glyph, which a restyle is entitled to change. The three status faces and
 * the waiting face each name themselves; a scenario that only cares that a
 * box is present reads `data-status` the same way it always did.
 */

import type { InTheWay, Status } from "@olai/format"
import { Match, Show, Switch } from "solid-js"

import { Link } from "./router.tsx"
import { TESTID } from "./testids.ts"
import { Tip } from "./Tip.tsx"
import { CONTROL, CONTROL_SPACER } from "./touch.ts"

const FACE: Record<Status, { readonly face: string; readonly hint: string; readonly tone: string }> = {
  done: { face: "checked", hint: "done", tone: "text-done" },
  doing: { face: "doing", hint: "doing", tone: "text-doing" },
  todo: { face: "empty", hint: "not started", tone: "text-muted" },
}

/** What a node is waiting on, as the one sentence both the label and the tip
 *  say — in the order `Derived.blocked` promises, which is the node's own
 *  `after` first and what points back at it after that. */
export const blockedBy = (blocked: ReadonlyArray<InTheWay>): string =>
  `blocked by ${blocked.map((one) => one.at.node.title).join(", ")}`

/** Shared box geometry: Workflowy-weight square, sized to the title's cap. */
const BOX =
  "inline-block h-[0.75rem] w-[0.75rem] shrink-0 rounded-[0.1rem] border-[1.5px] border-current box-border"

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
              class={`${CONTROL} select-none ${FACE[status()].tone}`}
              data-testid={TESTID.checkbox}
              data-status={status()}
              data-face={FACE[status()].face}
              title={FACE[status()].hint}
              aria-hidden="true"
            >
              <Face face={FACE[status()].face} />
            </span>
          }
        >
          <Tip text={blockedBy(props.blocked)}>
            <Link
              route={{ kind: "node", id: props.id }}
              class={`${CONTROL} select-none no-underline ${FACE[status()].tone}`}
              testid={TESTID.blocked}
              // NOT `title`: the platform's tooltip is what `Tip` replaces, and
              // two tooltips on one control is one of them written twice.
              label={blockedBy(props.blocked)}
            >
              {/* The mark is still the node's, so it stays in `data-status`
                  where a scenario reads it — the face is what is DRAWN, not a
                  fourth thing to be. */}
              <span
                data-status={status()}
                data-face="waiting"
                data-blocked-by={props.blocked.map((one) => one.at.node.id).join(" ")}
              >
                <Face face="waiting" />
              </span>
            </Link>
          </Tip>
        </Show>
      )}
    </Show>
  )
}

function Face(props: { readonly face: string }) {
  return (
    <Switch>
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
              scales with the box, inherits the done tone. */}
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
