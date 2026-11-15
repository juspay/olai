/**
 * **Plugins** — the sidebar's region for what this vault defines.
 *
 * ## It arrives with the first plugin and leaves with the last
 *
 * A vault with no plugins has no Plugins heading, exactly as a vault with no
 * conversations has no Chats one. The column is the most expensive surface in
 * the app — it is the one thing on every screen — and a heading over nothing is
 * a permanent cost charged for a feature somebody may never use. So the whole
 * section is behind the one question *does this vault define a plugin*, and the
 * answer is read off the roster the host already publishes rather than off a
 * preference anybody has to keep.
 *
 * ## One row per plugin, and the mark is the only thing on it that argues
 *
 * Glyph, name, and — at the right — a state mark, drawn only for the three
 * states that are asking somebody for something: a working dot while an agent
 * is still writing the folder, `Review` when it is ready to be read, `Problem`
 * when it could not start. A plugin that is simply ON wears nothing, because
 * nothing is wanted; one that is OFF is dimmed, which says *you have one of
 * these and it is not running* without spending a word on it. That is the same
 * discipline the Chats rows keep: a list of things is a list of things, and a
 * badge on every row is a badge nobody reads.
 *
 * ## What it does NOT need
 *
 * Navigation. Every row is an ordinary `<a href>`, so a press works through the
 * app's own link listener whether or not this tab has a router service — the
 * rows keep working with navigation off, which is one of the things this row's
 * components are split for. What navigation DOES buy, where it is there, is the
 * current-page wash and the `+`: the heading's action opens the palette already
 * drilled to *New plugin* (`PaletteControl.showAt`), and with no palette held
 * there is simply no `+` rather than a button that does nothing.
 */

import { Key } from "@solid-primitives/keyed"
import { DOT } from "@olai/web/client/readout.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { CHIP_ALARM, CHIP_QUIET } from "olai-plugin-layout/chip"
import { ENTRY_SHAPE, HEAD_ACTION, REGION, REGION_HEAD, REGION_LABEL, ROW_GAP } from "olai-plugin-layout/entry"
import type { BrowserManagement } from "@olai/surface/management"
import { createMemo, createSelector, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { WORD } from "../source.ts"
import { palette, router } from "./doors.ts"
import { NEW_PLUGIN_ROW } from "./new-plugin.ts"
import { pluginPage } from "./route.ts"
import { definedPlugins, faultSaid, LOOK, MARK_WORD, markOf, stageOf, type Defined } from "./state.ts"

/** The mark a plugin the vault defines wears in the column — the same square
 *  the page heads with, so a row and the page it opens are recognisably one
 *  thing. Decorative: every row says its name in words beside it. */
function Glyph() {
  return (
    <svg viewBox="0 0 16 16" class="size-3.5 shrink-0 text-muted" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <path d="M8 2.5v11" />
      <path d="M2.5 8h5.5" fill="currentColor" />
    </svg>
  )
}

export function Section(props: { readonly management: BrowserManagement }) {
  // THE SUBSCRIPTION IS THIS FACE'S. `roster()` is called once, in the body,
  // under the owner the sidebar mounted this section in — so it is released
  // when the section is withdrawn and not when something above it re-renders.
  const roster = props.management.roster()
  const rows = createMemo(() => definedPlugins(roster()))
  /**
   * WHICH ROW IS THE PAGE IN FRONT, decided once for the whole list and handed
   * to each row through a selector — the rule the Chats list learned: a route
   * read inside every row puts every row on the router's clock and re-runs all
   * of them to move one wash.
   */
  const current = createSelector(createMemo(() => {
    const lane = router()
    return lane === undefined ? null : pluginPage.value(lane.route())?.word ?? null
  }))
  return (
    <Show when={rows().length > 0}>
      <section class={REGION} data-testid={TESTID.section}>
        <div class={REGION_HEAD}>
          <h2 class={REGION_LABEL}>Plugins</h2>
          <Show when={palette()}>
            {(box) => (
              // A TIP, NOT A `title=`. The DOM attribute of that name is a
              // tooltip a touch screen never shows and a screen reader never
              // reads, which is why this client sweeps it out of its faces
              // (`@olai/web`'s `claims.test.ts`); the button's own
              // `aria-label` carries the same words for everyone else.
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
      </section>
    </Show>
  )
}

/**
 * ONE ROW — and the one row that is not a link.
 *
 * A folder under `plugins/` is a plugin whatever it is called, so a folder
 * named `My Plugin!` is on the roster, faulted, saying what is wrong with it
 * (`../source.ts`'s `faultOf`). But its name is not a WORD, so there is no
 * address for it: `/plugins/<that>` does not parse, and navigation reads an
 * address it does not recognise as the default outline — a press would carry
 * the reader off to an unrelated page, which is worse than a press that does
 * nothing.
 *
 * So the row is drawn, wearing its Problem mark, with the fault under the
 * pointer and NO `href`. An `<a>` without one is not focusable and not
 * pressable, which is exactly the behaviour wanted, and it keeps one element
 * and one set of bindings rather than a second subtree swapped in by a
 * condition that never changes for a given folder.
 */
function Row(props: { readonly plugin: Defined; readonly current: boolean }) {
  const stage = () => stageOf(props.plugin)
  const mark = () => markOf(stage())
  const addressable = () => WORD.test(props.plugin.name)
  return (
    <a
      href={addressable() ? pluginPage.href({ word: props.plugin.name }) : undefined}
      aria-description={addressable() ? undefined : faultSaid(props.plugin)}
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
      {/* The mark, named for a reader who cannot see a colour. Nothing at all
          on a plugin that is on or off: those rows have nothing to ask for. */}
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
