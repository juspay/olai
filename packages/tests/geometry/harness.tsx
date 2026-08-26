/**
 * THE CHIP-GEOMETRY HARNESS — three ways the Dock row can meet a property chip,
 * photographed side by side so the choice is SEEN rather than argued.
 *
 * Not part of any suite and not shipped: a one-off driver for #405's evidence,
 * in the shape `../doorShots.ts` already established. The human's word was "I
 * need to see these choices, not read words", and this is what that costs.
 *
 * WHAT IS REAL HERE: kolu's own `DockRow` and `StatePip` components, kolu's own
 * three stylesheets, olai's own tokens and chip markup, and the row values
 * folded by kolu's own pure functions (`bindStatePip`, `rowSubline`,
 * `paintDockRow`, `activePr`, `recencyMode`) from a REAL padi record — the
 * `active` arm of `../fixtures/padi/lanes.json`, the same record the e2e's fake
 * padi serves.
 *
 * WHAT IS NOT: `label` and `labelColor`. Their folds (`annotationLine`,
 * `assignColors`) stayed in kolu's app and are not exported — finding 3 to
 * #2217 — so they are placeholders here and the shots say so. The human is
 * choosing GEOMETRY, not hues.
 */
import { render } from "solid-js/web"

import { DockRow } from "@kolu/solid-dockrow"
import {
  bindStatePip,
  displayRecencyAt,
  DOCK_ROW_GAP,
  DOCK_ROW_GRID,
  paintDockRow,
  recencyMode,
  rowSubline,
} from "@kolu/solid-dockrow/rowValues"
import { StatePip } from "@kolu/solid-statepip"
import { activePr } from "@kolu/padi-client/surface"

import RECORDS from "../fixtures/padi/lanes.json"

/** The LOUD row — padi's `active` arm with an agent BLOCKED ON YOU, which is
 *  the one face worth choosing a geometry around: the violet wash and the wait
 *  chip only exist for it. */
const RECORD = (RECORDS as { terminals: Record<string, unknown> })
  .terminals["22222222-2222-4222-8222-222222222222"] as Parameters<typeof rowSubline>[0]

/** The CALM row — an agent thinking away in its own terminal, so a reader sees
 *  what the ordinary case costs in each geometry as well as the loud one. */
const QUIET = (RECORDS as { terminals: Record<string, unknown> })
  .terminals["11111111-1111-4111-8111-111111111111"] as Parameters<typeof rowSubline>[0]

/** padi's attention feeds are mirrored in the real thing; here the class is
 *  handed in, which is what the fold would have produced for a thinking agent. */
const bagFor = (record: Parameters<typeof rowSubline>[0], klass: "asking" | "working") => {
  const pip = bindStatePip({
    meta: record,
    attention: { klass, live: true },
    unread: false,
  })
  const mode = recencyMode(pip)
  const at = displayRecencyAt(mode, record.lastActivityAt ?? null, record.lastActivityAt ?? null)
  return {
    pip,
    bucket: paintDockRow(record, klass),
    agentState: record.state === "active" ? (record.agent?.state ?? undefined) : undefined,
    subline: rowSubline(record),
    pr: activePr(record),
    recency: { mode, text: at === null ? "" : "3m" },
    // PLACEHOLDERS — see the header. `label` is what `annotationLine` would
    // return (intent line 1, else the branch) and the ink is a fixed token.
    label: record.state === "active" ? (record.intent ?? "") : "",
    labelColor: "var(--color-fg-3)",
  }
}

const LOUD = bagFor(RECORD, "asking")
const CALM = bagFor(QUIET, "working")

/** kolu's row, in the container its README requires: the section declares the
 *  subgrid tracks and sets `--repo-color`, or the row has no columns to sit in. */
function Row(props: { readonly bag: ReturnType<typeof bagFor>; readonly id: string }) {
  return (
    <section
      class={`dock-cards-section grid ${DOCK_ROW_GRID} ${DOCK_ROW_GAP} pl-3 pr-3`}
      style={{ "--repo-color": "#7aa2f7" }}
    >
      <DockRow
        id={props.id as never}
        density="desktop"
        pip={props.bag.pip}
        bucket={props.bag.bucket}
        agentState={props.bag.agentState}
        label={props.bag.label}
        labelColor={props.bag.labelColor}
        renderLabel={(md) => md}
        subline={props.bag.subline}
        pr={props.bag.pr}
        recency={props.bag.recency}
        onSelect={() => {}}
      />
    </section>
  )
}

const CHIP = "inline-flex min-w-0 max-w-full gap-1.5 border border-rule bg-panel px-2 py-px"

/** olai's own row: the title line, then the run of property chips under it —
 *  the markup `../../web/src/client/props/PropsDrawer.tsx` emits, verbatim. */
function NodeRow(props: {
  readonly title: string
  readonly agent: string
  readonly terminalChip: () => unknown
  readonly under?: () => unknown
}) {
  return (
    <div class="py-1">
      <div class="flex items-baseline gap-2">
        <span class="text-muted">▸</span>
        <span>{props.title}</span>
      </div>
      <div class="mt-0.5 mb-1 flex flex-wrap items-baseline gap-1 text-[0.8125rem] leading-snug pl-6">
        <span class={CHIP}>
          <span class="font-mono text-muted">agent</span>
          <span>{props.agent}</span>
        </span>
        {props.terminalChip() as never}
        <span class={CHIP}>
          <span class="font-mono text-muted">pr</span>
          <span>juspay/olai#405</span>
        </span>
      </div>
      <div class="pl-6">{(props.under?.() ?? null) as never}</div>
    </div>
  )
}

/** The chip as it is TODAY, one glyph over: kolu's pip where olai's dot was. */
const PipChip = (bag: ReturnType<typeof bagFor>, value: string) => (
  <span class={`${CHIP} items-baseline`}>
    <span class="font-mono text-muted">terminal</span>
    <span class="inline-flex items-center gap-1">
      <StatePip {...bag.pip} />
      <span>{value}</span>
    </span>
  </span>
)

function Variant(props: {
  readonly letter: string
  readonly title: string
  readonly says: string
  readonly children: unknown
}) {
  return (
    <div class="mb-6 border border-rule">
      <div class="flex items-baseline gap-3 border-b border-rule bg-panel px-3 py-2">
        <span class="font-mono text-lg">{props.letter}</span>
        <span class="font-medium">{props.title}</span>
        <span class="text-[0.8125rem] text-muted">{props.says}</span>
      </div>
      <div class="px-3 py-3">{props.children as never}</div>
    </div>
  )
}

function App() {
  const variant = new URLSearchParams(location.search).get("v") ?? "A"
  return (
    <div class="mx-auto max-w-[52rem] p-6 text-ink">
      {variant === "A" && (
        <Variant
          letter="A"
          title="pip in the chip, full row in the snapshot pane"
          says="the chip keeps its size; the row appears only when you open one"
        >
          <NodeRow
            title="review: grok"
            agent="grok"
            terminalChip={() => PipChip(LOUD, "22222222")}
            under={() => (
              <div class="olai-snapshot mt-1 mb-1 w-full p-2">
                <div class="mb-1 -mx-2 -mt-2 border-b border-rule pb-1">
                  <Row bag={LOUD} id="22222222-2222-4222-8222-222222222222" />
                </div>
                <div class="mb-1 font-mono text-[0.6875rem] text-muted">
                  snapshot · just now
                </div>
                <pre class="text-[0.75rem]">{"$ bun test\n  4113 pass, 0 fail\n$ "}</pre>
              </div>
            )}
          />
          <NodeRow title="implement + open PR" agent="claude" terminalChip={() => PipChip(CALM, "11111111")} />
        </Variant>
      )}
      {variant === "B" && (
        <Variant
          letter="B"
          title="the full row IS the terminal property"
          says="the row replaces the chip — two lines per terminal, always"
        >
          <div class="py-1">
            <div class="flex items-baseline gap-2">
              <span class="text-muted">▸</span>
              <span>review: grok</span>
            </div>
            <div class="mt-0.5 mb-1 flex flex-wrap items-baseline gap-1 pl-6 text-[0.8125rem] leading-snug">
              <span class={CHIP}>
                <span class="font-mono text-muted">agent</span>
                <span>grok</span>
              </span>
              <span class={CHIP}>
                <span class="font-mono text-muted">pr</span>
                <span>juspay/olai#405</span>
              </span>
            </div>
            <div class="mb-1 pl-6">
              <Row bag={LOUD} id="22222222-2222-4222-8222-222222222222" />
            </div>
          </div>
          <div class="py-1">
            <div class="flex items-baseline gap-2">
              <span class="text-muted">▸</span>
              <span>implement + open PR</span>
            </div>
            <div class="mb-1 pl-6">
              <Row bag={CALM} id="11111111-1111-4111-8111-111111111111" />
            </div>
          </div>
        </Variant>
      )}
      {variant === "C" && (
        <Variant
          letter="C"
          title="pip in the chip, full row on hover"
          says="the chip keeps its size; the row floats over the outline"
        >
          <NodeRow title="review: grok"
            agent="grok"
            terminalChip={() => PipChip(LOUD, "22222222")} />
          {/* The overlay, drawn open — a screenshot cannot hover. */}
          <div class="relative pl-6">
            <div class="absolute top-1 left-[6rem] z-10 w-[32rem] border border-rule bg-panel shadow-lg">
              <Row bag={LOUD} id="22222222-2222-4222-8222-222222222222" />
            </div>
          </div>
          <div class="mt-24">
            <NodeRow title="implement + open PR" agent="claude" terminalChip={() => PipChip(CALM, "11111111")} />
          </div>
        </Variant>
      )}
    </div>
  )
}

const root = document.getElementById("root")
if (root === null) throw new Error("no #root in the harness shell")
render(() => <App />, root)
