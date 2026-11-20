import { createMemo } from "solid-js"

import { createResource, createSignal, Match, Show, Switch } from "solid-js"

import { DockRow, DockSection, type RowRecency } from "@kolu/solid-dockrow"
import {
  narrowAgentState,
  narrowRowVocab,
  rowRecency,
} from "@kolu/solid-dockrow/rowValues"
import type { FleetTerminal, Snapshot, SnapshotRefused } from "olai-plugin-kolu/appliance/wire"
import { TERMINAL_KEY } from "olai-plugin-kolu/appliance/wire"

import type { BlockContext } from "./block.ts"
import { LivePane } from "./LivePane.tsx"
import { useFleet } from "./fleet.tsx"
import { readingOf } from "./terminal.ts"
import { TESTID } from "../../contracts/appliance-testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

export function TerminalBlock(context: BlockContext) {
  const fleet = useFleet()
  const [openedFor, setOpenedFor] = createSignal<string>()
  const open = () => openedFor() === context.entry.value
  const setOpen = (value: boolean) => setOpenedFor(value ? context.entry.value : undefined)
  const reading = createMemo(() => readingOf(context.entry.value, fleet.link(), fleet.terminals()), undefined,
    { equals: (a, b) => a?.row === b?.row && a?.says === b?.says })
  const resolvedAt = createMemo<{ value: string; row: FleetTerminal | undefined }, undefined>(previous => ({
    value: context.entry.value,
    row: reading().row ?? (previous?.value === context.entry.value ? previous.row : undefined),
  }), undefined, { equals: (a, b) => a?.value === b?.value && a?.row === b?.row })
  const resolved = () => resolvedAt().row
  return (
    <div class="mb-1" data-testid={TESTID.terminalBlock} data-terminal={context.entry.value}>
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
          <p class="text-body text-muted" data-testid={TESTID.terminalSays}>
            {reading().says}
          </p>
        }
      >
        {(row) => (
          <Row
            row={row()}
            pressable={fleet.read !== undefined}
            onSelect={() => setOpen(!open())}
          />
        )}
      </Show>
      <Show when={open() && resolved()}>
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

function Value(props: {
  readonly value: string
  readonly onOpen?: () => void
  readonly valueId: string
}) {
  return (
    <Show
      when={props.onOpen}
      fallback={
        <span class="min-w-0 truncate text-body text-muted" data-testid={props.valueId}>
          {props.value}
        </span>
      }
    >
      {(open) => (
        <Tip text={`Change ${props.value}`}>
          <button
            type="button"
            class="min-w-0 cursor-pointer truncate text-body text-muted hover:text-accent"
            data-testid={props.valueId}
            onClick={(event) => {
              event.stopPropagation()
              open()()
            }}
          >
            {props.value}
          </button>
        </Tip>
      )}
    </Show>
  )
}

function Row(props: {
  readonly row: FleetTerminal
  readonly pressable: boolean
  readonly onSelect: () => void
}) {
  const now = useFleet().now
  const vocab = createMemo(() => narrowRowVocab({ pip: props.row.pip, bucket: props.row.bucket }))
  const pip = () => vocab().pip
  const recency = (): RowRecency =>
    rowRecency(pip(), { window: props.row.recencyAt, own: props.row.recencyAt }, {
      counting: now,
      glancing: now,
    })
  return (
    <DockSection surface="desktop" repoColor="var(--color-rule)">
      <Tip text="Read this terminal's screen" disabled={!props.pressable}>
        <DockRow
          id={props.row.id as never}
          surface="desktop"
          pip={pip()}
          bucket={vocab().bucket}
          agentState={narrowAgentState(props.row.agentState).attr}
          model={undefined}
          label={props.row.label}
          labelColor={props.row.labelColor}
          renderLabel={(markdown) => markdown}
          subline={props.row.subline}
          pr={props.row.pr}
          recency={recency()}
          onSelect={() => {
            if (props.pressable) props.onSelect()
          }}
        />
      </Tip>
    </DockSection>
  )
}
