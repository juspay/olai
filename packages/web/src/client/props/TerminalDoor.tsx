/**
 * THE TERMINAL DOOR — the dot on a `terminal` chip, and the pane it opens.
 *
 * Two rungs and two components, because they sit in two places. Rung 1 is a
 * live status glyph INSIDE the chip, riding the fleet the tab already holds
 * (`./fleet.tsx` — one subscription, however many chips). Rung 2 is one
 * `screen.text` call per open, drawn UNDER THE WHOLE RUN.
 *
 * ## Why the pane is not inside the chip
 *
 * A chip is an inline box in a wrapping line of them; a screenful of terminal
 * output is eighty columns of monospace. Put inside, the pane stretches its
 * chip across the page and shoves the value out beside it — which is not a
 * layout bug so much as a category error: the run is a line of short facts, and
 * a screen is not one of them. So the chip stays a chip and the pane opens
 * beneath the run, which is where `../SaidLine.tsx` already puts a sentence
 * that belongs to one chip.
 *
 * WHICH PANE IS OPEN is therefore the RUN's state, not the chip's
 * (`./PropsDrawer.tsx` holds it) — one at a time, for the reason the editor is
 * one at a time: opening a second means you are done with the first.
 *
 * ## What the pane promises, and what it does not
 *
 * It is a SNAPSHOT and it says so three ways: the dashed border, the age line
 * ("snapshot · just now"), and the refetch button that is the only thing that
 * moves it. Nothing is subscribed — no stream, no poll, no timer. Twelve lanes
 * on a page are twelve dots and zero attached terminals.
 *
 * Closing UNMOUNTS it, which is the promise kept on the way out as well: a pane
 * reopened an hour later reads the screen again rather than showing an
 * hour-old one under a fresh "just now".
 *
 * That restraint is deliberate rather than a gap. The live pane is phase 6
 * (`terminal-stream`) and arrives as a REFCOUNTED stream member with a SOLID
 * border and a `● live` tag — two panes, two borders, and a reader never has to
 * remember which is which.
 */

import { createResource, Match, Show, Switch } from "solid-js"

import type { Snapshot, SnapshotRefused } from "@olai/surface"

import { TESTID } from "../testids.ts"
import { useFleet } from "./fleet.tsx"
import { readingOf, type TerminalReading } from "./terminal.ts"

/** What one `terminal` value reads as — asked by both halves, so the dot and
 *  the pane's header line cannot disagree about the terminal they are on. */
const useReading = (value: () => string): (() => TerminalReading) => {
  const fleet = useFleet()
  return () => readingOf(value(), fleet.link(), fleet.terminal)
}

/**
 * THE DOT — a glyph, or a button where there is a wire behind it.
 *
 * With no `read` on the fleet context it stays a glyph and nothing more, and
 * that is the honest degradation rather than a missing feature: rung 1 is a
 * reading of the fleet this tab already holds, and it does not need rung 2 to
 * be true.
 */
export function TerminalDot(props: {
  /** The property's value — padi's terminal id, verbatim. */
  readonly value: string
  /** Is this chip's pane the one open? */
  readonly open: boolean
  /** Open it, or close it if it is already this one. */
  readonly onToggle: () => void
}) {
  const fleet = useFleet()
  const reading = useReading(() => props.value)
  return (
    <Show when={fleet.read !== undefined} fallback={<Glyph reading={reading()} />}>
      <button
        type="button"
        class="flex cursor-pointer items-center"
        title={`${reading().says} — click for a snapshot`}
        aria-label={`${reading().says} — click for a snapshot`}
        aria-expanded={props.open}
        onClick={(event) => {
          // The row's own line answers a click by opening the title editor, and
          // this one is about the terminal under the pointer — the same stop
          // `./PropsDrawer.tsx`'s key handle makes.
          event.stopPropagation()
          props.onToggle()
        }}
      >
        <Glyph reading={reading()} />
      </button>
    </Show>
  )
}

/** The glyph itself. Every fact it carries is an attribute as well as a paint,
 *  so a browser test asserts the STATE rather than a colour — `data-face` is
 *  the closed set, `data-hollow` is the ring. */
function Glyph(props: { readonly reading: TerminalReading }) {
  return (
    <span
      class="olai-dot"
      data-testid={TESTID.terminalDot}
      data-face={props.reading.face}
      data-hollow={String(props.reading.hollow)}
      title={props.reading.says}
      role="img"
      aria-label={props.reading.says}
    />
  )
}

/**
 * THE PANE — dashed, with the age line, the screen, and the two buttons.
 *
 * The read fires on MOUNT and on refetch, and nowhere else: `createResource`
 * over the terminal id is the whole of it, so "one read per open" is a fact
 * about the component's lifetime rather than a rule somebody keeps. Unmounting
 * it forgets the text, which is the snapshot promise kept on the way out.
 */
export function SnapshotPane(props: {
  readonly value: string
  readonly onClose: () => void
}) {
  const fleet = useFleet()
  const reading = useReading(() => props.value)
  const [answer, { refetch }] = createResource(
    () => props.value,
    async (terminal): Promise<Snapshot | SnapshotRefused | undefined> =>
      await fleet.read?.(terminal),
  )
  const row = () => reading().row
  return (
    <div
      class="olai-snapshot mt-1 mb-1 w-full p-2"
      data-testid={TESTID.terminalPane}
      data-terminal={props.value}
    >
      <div class="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[0.6875rem] text-muted">
        {/* WHAT THIS IS, first and always — the border says it and so does
            this. "just now" is the truth at the moment of the read and it does
            not tick: a label that aged in place would be a promise this pane
            cannot keep, since nothing here is watching the terminal. */}
        <span>{answer.loading ? "reading…" : "snapshot · just now"}</span>
        <Show when={row()}>
          {(live) => (
            <>
              <span aria-hidden="true">·</span>
              <span>{live().branch ?? live().repo ?? live().cwd ?? live().id}</span>
            </>
          )}
        </Show>
        <span class="ml-auto flex gap-2">
          <button
            type="button"
            class="cursor-pointer hover:text-accent"
            data-testid={TESTID.terminalRefetch}
            title="read the screen again"
            onClick={(event) => {
              event.stopPropagation()
              void refetch()
            }}
          >
            refetch
          </button>
          <button
            type="button"
            class="cursor-pointer hover:text-accent"
            title="close the snapshot"
            onClick={(event) => {
              event.stopPropagation()
              props.onClose()
            }}
          >
            close
          </button>
        </span>
      </div>
      <Switch>
        <Match when={answer.loading || answer() === undefined}>
          <pre data-testid={TESTID.terminalScreen} data-state="reading" />
        </Match>
        <Match when={refusalIn(answer())}>
          {(refused) => (
            // A REFUSAL IS PROSE, in the reading face rather than monospace: it
            // is olai speaking, not the terminal, and setting it in the
            // screen's own face would read as something the terminal printed.
            <p
              class="text-[0.8125rem] text-muted"
              data-testid={TESTID.terminalScreen}
              data-state="refused"
            >
              {refused().says}
            </p>
          )}
        </Match>
        <Match when={textIn(answer())}>
          {(text) => (
            <pre data-testid={TESTID.terminalScreen} data-state="text">{text()}</pre>
          )}
        </Match>
      </Switch>
    </div>
  )
}

/** The two arms of an answer, narrowed by the field that is only on one of
 *  them. `text` rather than a `_tag` check because the SUCCESS is the shape
 *  this end declared and the refusal is the class — asking about the field
 *  keeps the narrowing on olai's own vocabulary either way. */
const textIn = (answer: Snapshot | SnapshotRefused | undefined): string | undefined =>
  answer !== undefined && "text" in answer ? answer.text : undefined

const refusalIn = (
  answer: Snapshot | SnapshotRefused | undefined,
): SnapshotRefused | undefined =>
  answer !== undefined && !("text" in answer) ? answer : undefined
