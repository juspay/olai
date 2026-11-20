import { Key } from "@solid-primitives/keyed"
import { DOT } from "@olai/web/client/readout.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { CHIP_ALARM, CHIP_QUIET } from "olai-plugin-layout/chip"
import { ENTRY_SHAPE, HEAD_ACTION, REGION, REGION_HEAD, REGION_LABEL, ROW_GAP } from "olai-plugin-layout/entry"
import { WORD } from "@olai/surface"
import type { BrowserManagement } from "@olai/surface/management"
import { createMemo, createSelector, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { palette, router } from "./doors.ts"
import { NEW_PLUGIN_ROW } from "./new-plugin.ts"
import { pluginPage } from "./route.ts"
import { PluginGlyph } from "./glyph.tsx"
import { definedPlugins, faultSaid, LOOK, MARK_WORD, markOf, stageOf, type Defined } from "./state.ts"

/** The press and the no-palette sentence must say the same thing. */
const EMPTY_SAID = "Ask for your first plugin…"

const Glyph = PluginGlyph

export function Section(props: { readonly management: BrowserManagement }) {
  const roster = props.management.roster()
  const rows = createMemo(() => definedPlugins(roster()))
  const current = createSelector(createMemo(() => {
    const lane = router()
    return lane === undefined ? null : pluginPage.value(lane.route())?.word ?? null
  }))
  return (
    <section class={REGION} data-testid={TESTID.section}>
      <div class={REGION_HEAD}>
        <h2 class={REGION_LABEL}>Plugins</h2>
        <Show when={palette()}>
          {(box) => (
            <Tip text="New plugin">
              <button
                type="button"
                class={HEAD_ACTION}
                data-testid={TESTID.sectionNew}
                aria-label="New plugin"
                onClick={() => box().showAt([NEW_PLUGIN_ROW])}
              >
                <svg viewBox="0 0 16 16" class="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M8 3.5v9M3.5 8h9" />
                </svg>
              </button>
            </Tip>
          )}
        </Show>
      </div>
      <ul class="m-0 list-none p-0">
        <Key each={rows()} by="name">
          {(row) => (
            <li>
              <Row plugin={row()} current={current(row().name)} />
            </li>
          )}
        </Key>
      </ul>
      <Show when={rows().length === 0}><Empty /></Show>
    </section>
  )
}

function Empty() {
  return (
    <Show
      when={palette()}
      fallback={<p class={`${ENTRY_SHAPE} ${ROW_GAP} m-0 opacity-60`} data-testid={TESTID.sectionEmpty}>{EMPTY_SAID}</p>}
    >
      {(box) => (
        <button
          type="button"
          class={`${ENTRY_SHAPE} ${ROW_GAP} w-full text-left opacity-60`}
          data-testid={TESTID.sectionEmpty}
          onClick={() => box().showAt([NEW_PLUGIN_ROW])}
        >
          <Glyph />
          <span class="min-w-0 flex-1 truncate">{EMPTY_SAID}</span>
        </button>
      )}
    </Show>
  )
}

function Row(props: { readonly plugin: Defined; readonly current: boolean }) {
  const stage = () => stageOf(props.plugin)
  const mark = () => markOf(stage())
  const addressable = () => WORD.test(props.plugin.name)
  return (
    <a
      href={addressable() ? pluginPage.href({ word: props.plugin.name }) : undefined}
      aria-description={addressable()
        ? (props.plugin.source.description === "" ? undefined : props.plugin.source.description)
        : faultSaid(props.plugin)}
      class={`${ENTRY_SHAPE} ${ROW_GAP} w-full text-left`}
      classList={{ "opacity-60": mark() === "quiet" }}
      data-testid={TESTID.sectionRow}
      data-plugin={props.plugin.name}
      data-stage={stage()}
      data-on={props.plugin.source.on ? "yes" : "no"}
      aria-current={props.current ? "page" : undefined}
    >
      <Glyph />
      <span class="min-w-0 flex-1 truncate">{props.plugin.source.title}</span>
      <Show when={mark() === "working"}>
        <span class={`${DOT} ${LOOK.building.dot}`} role="img" aria-label="Being built" data-testid={TESTID.sectionMark} data-mark="working" />
      </Show>
      <Show when={mark() === "review"}>
        <span class={`${CHIP_QUIET} shrink-0`} data-testid={TESTID.sectionMark} data-mark="review">{MARK_WORD.review}</span>
      </Show>
      <Show when={mark() === "problem"}>
        <span class={`${CHIP_ALARM} shrink-0`} data-testid={TESTID.sectionMark} data-mark="problem">{MARK_WORD.problem}</span>
      </Show>
    </a>
  )
}
