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

import { DockRow, DockSection, type RowRecency } from "@kolu/solid-dockrow"
import {
  narrowAgentState,
  narrowRowVocab,
  rowRecency,
} from "@kolu/solid-dockrow/rowValues"
import type { FleetTerminal, Snapshot, SnapshotRefused } from "@olai/surface"
import { TERMINAL_KEY } from "@olai/surface"

import type { BlockContext } from "./block.ts"
import { LivePane } from "./LivePane.tsx"
import { useFleet } from "./fleet.tsx"
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
        data-testid={context.chrome.factId}
        data-key={context.entry.key}
      >
        <context.chrome.Handle label={context.entry.key} onOpen={context.onOpen} />
        <Value
          value={context.entry.value}
          onOpen={context.onOpen}
          valueId={context.chrome.valueId}
        />
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
function Value(props: {
  readonly value: string
  readonly onOpen?: () => void
  /** The drawer's contract, handed through rather than respelled — see
   *  `./block.ts`. */
  readonly valueId: string
}) {
  return (
    <Show
      when={props.onOpen}
      fallback={
        <span class="min-w-0 truncate text-[0.8125rem] text-muted" data-testid={props.valueId}>
          {props.value}
        </span>
      }
    >
      {(open) => (
        <button
          type="button"
          class="min-w-0 cursor-pointer truncate text-[0.8125rem] text-muted hover:text-accent"
          data-testid={props.valueId}
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
  // THE CLOCK COMES THROUGH THE SOCKET now — `./KoluUi.tsx` takes it as a pin,
  // because the cadence is olai's judgement about olai's pages rather than
  // anything kolu has an opinion about.
  const now = useFleet().now
  /**
   * THE WIRE'S WORDS, narrowed by KOLU rather than here.
   *
   * This was four hand-picked fallbacks, and one of them was wrong in the way
   * only kolu could have known: motion fell back to `"none"`, which stills the
   * mark on a terminal the same bag calls active. `narrowRowVocab` does not
   * default motion at all — it RE-FOLDS it from the narrowed variant and the
   * bag's own `active`, through the same fold that produced the wire's word
   * server-side. One fewer literal here, and the one that is gone is the one
   * that lied.
   *
   * It takes `{ pip, bucket }` NESTED, which is deliberate on kolu's side: the
   * bucket is the ORDER fold and the pip's variant is the PAINT fold, and they
   * disagree in a case kolu names (a fresh `waiting` agent paints `linger`
   * while the order bucket ranks it `idle`). Flattening them would assert one
   * derives from the other.
   */
  const vocab = () => narrowRowVocab({ pip: props.row.pip, bucket: props.row.bucket })
  const pip = () => vocab().pip
  /**
   * THE RECENCY VALUE, and it is kolu's whole answer rather than olai's
   * assembly of its parts.
   *
   * This was a hand-written branch over `recencyText`, filed as a finding
   * against kolu#2219 because the assembly is the part that drifts — and the
   * amendment took it. `rowRecency` holds three rules that are invisible at a
   * call site: the `hidden` arm carries no text, the two timestamp channels
   * feed different modes, and the two clocks are paired to the mode.
   *
   * THE SAME INSTANT GOES DOWN BOTH CHANNELS, and that is kolu's shape for a
   * row like this rather than a shortcut. The chip shows how long THIS row has
   * awaited you; the `ago` line shows the tile WINDOW's newest activity across
   * a parent and its splits. olai draws one row per `terminal` property in an
   * outline — no tile, no splits — so the window is DEGENERATE, and kolu
   * computes the degenerate case as exactly this: `rankDockRows` seeds the
   * window with `rowRecencyAt(meta)` and folds sub-rows over it, so a row with
   * no sub-rows carries the own instant in both channels, in every unsplit Dock
   * row kolu ships.
   *
   * A previous version passed `null` for the window, reasoning that sending one
   * instant twice would make the two modes agree by accident. That inverted the
   * construction and cost a rendered line: `displayRecencyAt` routes every
   * non-chip mode to the WINDOW channel, so a quiet terminal rendered
   * `agoPhrase(null)` — the empty string — and an idle lane that finished three
   * hours ago stopped saying so. Nothing could see it, because nothing asserted
   * an `ago` string anywhere; the test below is the other half of this fix.
   *
   * THE TWO CLOCKS are one clock here, and deliberately. kolu ticks the chip
   * every second and the `ago` line every minute; this ticks both every minute,
   * for the reason `./recency.ts` gives — forty lanes on a page, each with a
   * terminal, is a re-render storm bought for a digit nobody is watching in a
   * document somebody is reading. Passing readers rather than a `now` is what
   * lets kolu decline to read either one at all: a blocked row with no honest
   * duration renders the dash without touching a clock.
   */
  const recency = (): RowRecency =>
    rowRecency(pip(), { window: props.row.recencyAt, own: props.row.recencyAt }, {
      counting: now,
      glancing: now,
    })
  return (
    <DockSection surface="desktop" repoColor="var(--color-rule)">
      <DockRow
        id={props.row.id as never}
        surface="desktop"
        pip={pip()}
        bucket={vocab().bucket}
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
        recency={recency()}
        onSelect={() => {
          if (props.pressable) props.onSelect()
        }}
        title={props.pressable ? "read this terminal's screen" : undefined}
      />
    </DockSection>
  )
}
