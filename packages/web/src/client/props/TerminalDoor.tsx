/**
 * THE TERMINAL DOOR — kolu's own Dock row, drawn where the property is, and
 * the live pane it opens.
 *
 * The BLOCK SEAM's first consumer (`./blocks.ts`). A `terminal` property does
 * not draw as a chip: it draws as the row kolu's Dock draws, so what you see
 * beside a node is literally what you would see in the Dock — the pip and its
 * glyph, the annotation line, the status words, the recency, the repo stripe,
 * the PR badge, the sleeping recede, and the violet wash when an agent is
 * blocked on you.
 *
 * ## Why olai draws none of that itself
 *
 * It used to. There was a `DotFace` vocabulary in `@olai/surface`, a fold in
 * `@olai/kolu-client`, a tone table in a renderer and a `.olai-dot` family in
 * the stylesheet — four files restating, in olai's words, a state machine that
 * is kolu's. The fifth Löwy sitting (`docs/lowy-electricity/
 * debate-2026-08-26.md`, finding 1) retired all of it by DELETION rather than
 * reconciliation, and the human's word was the plainest statement of the rule:
 * "This way we don't have to invent yet another shit in Olai." A second visual
 * vocabulary for one fleet is two surfaces free to disagree about it.
 *
 * ## What olai still says, because kolu cannot
 *
 * Why there is NO row. A terminal that is gone, a value that names three of
 * them, a padi that is absent, a padi this build cannot speak to — none of
 * those are things kolu's row has a face for, because from kolu's side they do
 * not happen. They are `./terminal.ts`'s sentences, and the block draws them in
 * the row's place, in words. That is the half of the old hollow worth keeping:
 * the shape carried nothing, the sentence carried everything.
 *
 * ## The pane belongs to the block
 *
 * Pressing the row opens the pane beneath it — `onSelect`, the row's own verb,
 * which in kolu's Dock focuses the terminal and here WATCHES it. The pane hangs
 * under the block's own row rather than under the whole drawer, which it had to
 * do while the door was a dot inside a chip: a chip is an inline box in a
 * wrapping line and could not carry a screenful of monospace, and a block
 * already owns the width. So the state is the block's, and one attach per open
 * is a fact about a component's lifetime rather than a rule somebody keeps.
 *
 * IT IS A WINDOW NOW, not a photograph (`./LivePane.tsx`). It opened as a
 * snapshot — one read, a dashed border, a refetch button that was the only
 * thing that moved it — and the phase that was going to replace it arrived
 * early, on the human's word. The promise the old file made about that day is
 * kept: the live pane has a SOLID border and a `● live` tag, so two panes are
 * two borders and a reader never has to remember which is which. Closing drops
 * the subscription, which is the same restraint the snapshot had from the other
 * direction — twelve lanes on a page are twelve rows and zero attached
 * terminals until somebody presses one.
 */

import { createResource, createSignal, Match, Show, Switch } from "solid-js"

import { DockRow, DockSection } from "@kolu/solid-dockrow"
import {
  isDockRowBucket,
  isPipGlyphId,
  isPipMotionKind,
  isPipVariant,
  narrowAgentState,
  recencyMode,
} from "@kolu/solid-dockrow/rowValues"
import type { FleetTerminal, Snapshot, SnapshotRefused } from "@olai/surface"
import { TERMINAL_KEY } from "@olai/surface"

import { type BlockContext, registerBlock } from "./blocks.ts"
import { LivePane } from "./LivePane.tsx"
import { useFleet } from "./fleet.tsx"
import { Handle } from "./handle.tsx"
import { createRecencyNow, recencyText } from "./recency.ts"
import { readingOf } from "./terminal.ts"
import { TESTID } from "../testids.ts"

/**
 * THE BLOCK — the fact on one line, and the row beneath it.
 *
 * TWO STATEMENTS, and they are not the same one. The line on top is olai's
 * record — this node names THAT terminal — and the row beneath is kolu's
 * reading of it. A block that drew only the row would hide the id a `set_prop`
 * is written with and a lane is grepped by; a block that drew only the line
 * would be the chip this replaced.
 *
 * The key and the value are both the chip's, unchanged: the key opens the
 * editor (`./handle.tsx`'s promise, which is why it is a shared module now)
 * and so does the value, because the drawer's one gesture is that a link goes
 * where it says and everything else opens for editing.
 */
export function TerminalBlock(context: BlockContext) {
  const fleet = useFleet()
  const [open, setOpen] = createSignal(false)
  const reading = () => readingOf(context.entry.value, fleet.link(), fleet.terminals())
  return (
    <div class="mb-1" data-testid={TESTID.terminalBlock} data-terminal={context.entry.value}>
      {/* MUTED and small, deliberately: the value is a fact ABOUT the row, not
          a competitor to the words inside it. The row says what the terminal is
          doing; eight characters of id have no business being the loudest thing
          in a lane.
          IT WEARS THE RUN'S OWN CONTRACT — `prop` and `data-key` — because it IS
          this property's drawing, and every step and stylesheet that reaches a
          property by key must reach this one too. A block that took the chip's
          place and not its handles would be a property the rest of the app had
          quietly lost track of: the typed-properties suite writes a `terminal`
          holding a sentence, through exactly these attributes, and it found
          this the day the block landed. */}
      <div
        class="flex items-baseline gap-1.5"
        data-testid={TESTID.prop}
        data-key={context.entry.key}
      >
        <Handle label={context.entry.key} onOpen={context.onOpen} />
        <Value value={context.entry.value} onOpen={context.onOpen} />
      </div>
      <Show
        when={reading().row}
        fallback={
          // THE WORDS, in the reading face rather than the row's: this is olai
          // speaking about why there is nothing to draw, and setting it in the
          // row's own face would read as a row that had somehow come back
          // empty.
          <p class="text-[0.8125rem] text-muted" data-testid={TESTID.terminalSays}>
            {reading().says}
          </p>
        }
      >
        {(row) => (
          <Row
            row={row()}
            pressable={fleet.read !== undefined}
            onSelect={() => setOpen((was) => !was)}
          />
        )}
      </Show>
      <Show when={open() && reading().row}>
        {(row) => (
          <LivePane
            value={row().id}
            themeName={row().themeName}
            onClose={() => setOpen(false)}
          />
        )}
      </Show>
    </div>
  )
}

/** The stored value, drawn exactly as the record holds it and pressable for the
 *  same reason every other value in the run is: the drawer's one gesture is
 *  "a link goes where it says, everything else opens it for editing", and a
 *  terminal id is not a link. Not a door either way — `./door.ts` answers what
 *  a value NAMES, and padi's ids are not addresses this app can spell. */
function Value(props: { readonly value: string; readonly onOpen?: () => void }) {
  return (
    <Show
      when={props.onOpen}
      fallback={
        <span class="min-w-0 truncate text-[0.8125rem] text-muted" data-testid={TESTID.propValue}>
          {props.value}
        </span>
      }
    >
      {(open) => (
        <button
          type="button"
          class="min-w-0 cursor-pointer truncate text-[0.8125rem] text-muted hover:text-accent"
          data-testid={TESTID.propValue}
          title={`change ${props.value}`}
          onClick={(event) => {
            // The row's own line answers a click by opening the title editor.
            event.stopPropagation()
            open()()
          }}
        >
          {props.value}
        </button>
      )}
    </Show>
  )
}

registerBlock(TERMINAL_KEY, TerminalBlock)

/**
 * KOLU'S ROW, filled from olai's wire.
 *
 * Every narrowing here goes through the row package's OWN guards
 * (`@kolu/solid-dockrow/rowValues`), which is the fifth sitting's ratified
 * arrangement: olai's wire carries kolu's closed sets as plain strings so an
 * outline spec never compiles kolu's per-agent schema graph, and the one home
 * of the vocabulary narrows them back. An unrecognised word is not normalised
 * onto a neighbour and not dropped — `narrowAgentState` keeps it, the row
 * prints it, and a reader sees a strange state rather than a blank or a lie.
 *
 * THE CONTAINER IS A COMPONENT, not a class name this file spells. It was a
 * class name for a day, and that day is the argument: every wash, the active
 * highlight and the row dividers are scoped to
 * `:is(.dock-cards-section, .dock-needs-you-strip) > [data-dock-row]`, so a row
 * rendered in a consumer's own `<div>` is structurally correct,
 * attribute-complete, and has no "blocked on you" wash at all — with nothing
 * failing anywhere. olai hand-spelled that class and got the wash by knowing a
 * string; `<DockSection>` is kolu's answer to a consumer having to know it
 * (filed from here as finding 4, landed as a component), and the difference
 * between the two is whether the next reader of this file has to.
 */
function Row(props: {
  readonly row: FleetTerminal
  readonly pressable: boolean
  readonly onSelect: () => void
}) {
  const now = createRecencyNow()
  const pip = () => {
    const bag = props.row.pip
    return {
      ...bag,
      // The three pip fields the wire carries as text. A word this build does
      // not know falls back to the quiet rendering rather than throwing: the
      // row is a status readout, and a status readout that crashes the page it
      // is on is worse than one that under-reports for a release.
      variant: isPipVariant(bag.variant) ? bag.variant : "idle",
      glyph: isPipGlyphId(bag.glyph) ? bag.glyph : "shell",
      motion: isPipMotionKind(bag.motion) ? bag.motion : "none",
    }
  }
  const mode = () => recencyMode(pip())
  return (
    <DockSection surface="desktop" repoColor="var(--color-rule)">
      <DockRow
        id={props.row.id as never}
        surface="desktop"
        pip={pip()}
        bucket={isDockRowBucket(props.row.bucket) ? props.row.bucket : "idle"}
        agentState={narrowAgentState(props.row.agentState).attr}
        label={props.row.label}
        labelColor={props.row.labelColor}
        // PLAIN TEXT, and it is a decision rather than a stub. The annotation
        // line is markdown and the package requires a renderer be injected
        // rather than defaulted, precisely so the choice is visible: olai's own
        // markdown pipeline is a dynamic chunk a page waits on, and an intent
        // line inside an outline row is not worth making forty rows wait for
        // it. The day the pipeline is already loaded on these pages, this is
        // one argument.
        renderLabel={(markdown) => markdown}
        subline={props.row.subline}
        pr={props.row.pr}
        recency={{ mode: mode(), text: recencyText(props.row.recencyAt, now()) }}
        onSelect={() => {
          if (props.pressable) props.onSelect()
        }}
        title={props.pressable ? "read this terminal's screen" : undefined}
      />
    </DockSection>
  )
}
