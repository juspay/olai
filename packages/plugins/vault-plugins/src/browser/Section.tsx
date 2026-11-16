/**
 * **Plugins** — the sidebar's region for what this vault defines.
 *
 * ## It is there before the first plugin, because that is where one is asked for
 *
 * This section used to arrive with the first folder and leave with the last,
 * on the argument that the column is the most expensive surface in the app and
 * a heading over nothing is rent charged for a feature nobody asked for. That
 * argument is right about the column and wrong about this feature, and a
 * person deploying the branch said so in one sentence: *how do I create a
 * plugin? I see nothing in the sidebar.* A vault with no plugins is exactly
 * the vault where somebody is trying to make their first one, and hiding the
 * only visible door until after they have found the invisible one — ⌘K, a row
 * you have to already know the name of — makes the feature undiscoverable to
 * everybody who has not read the docs.
 *
 * So the heading stands whenever this component does, and the empty vault gets
 * ONE quiet row under it that says what you can do: a press that opens the
 * palette at *New plugin*. One row, in the dim ink the off plugins wear, which
 * is the smallest thing that can be a door; it leaves the moment there is a
 * real row to draw and comes back if the last folder is deleted.
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
 * current-page wash, the `+` and the empty row's press: the heading's action
 * opens the palette already drilled to *New plugin*
 * (`PaletteControl.showAt`), and with no palette held there is no `+` at all
 * and the empty row is a plain sentence rather than a button that does
 * nothing.
 */

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
import { definedPlugins, faultSaid, LOOK, MARK_WORD, markOf, stageOf, type Defined } from "./state.ts"

/**
 * WHAT THE EMPTY VAULT IS TOLD, in six words that have to do three jobs: say
 * there is nothing here, say one can be had, and say how — without a noun a
 * person who has never used a plugin would have to look up first. *Ask* is the
 * verb this whole feature is about (you describe it, an agent writes it), and
 * the ellipsis is the app's own promise that a press opens something to fill
 * in rather than making a thing on the spot.
 *
 * One constant because the press and the no-palette sentence must say the
 * same thing, and because the scenario that proves the row asserts these
 * words rather than a test id.
 */
const EMPTY_SAID = "Ask for your first plugin…"

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
      <Show when={rows().length === 0}><Empty /></Show>
    </section>
  )
}

/**
 * NOTHING HERE YET — the one row an empty vault gets, and the only place in
 * the app where the feature introduces itself.
 *
 * It is the SAME gesture as the `+` above it, worded for somebody who has not
 * met it: the plus is a shape you press when you already know what it makes,
 * and this row says what that is. Both open the palette at *New plugin*, so
 * there is one way of asking for a plugin and three doors onto it.
 *
 * With no palette held it is a sentence instead, because the honest answer to
 * *where do I press* on a serve with no palette is that there is nowhere —
 * and a button that does nothing is worse than a line of prose. The words are
 * the same either way, so what a reader is told does not depend on which
 * rows this serve composes.
 */
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
 *
 * `aria-description` carries the README's own first sentence — what this word
 * does, for a person reading a name they chose months ago — and on a folder
 * whose name is not a word it carries the fault instead, which is the one
 * thing a reader can act on there. It is a description and not a `title=`:
 * that attribute is a tooltip a touch screen never shows and a screen reader
 * never reads, and this client sweeps it out of its faces.
 */
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
