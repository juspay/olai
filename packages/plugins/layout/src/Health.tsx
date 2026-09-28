/**
 * THE BAR'S ONE HEALTH DOT, and the popover it opens.
 *
 * The desktop bar used to stand a row of pills here — the connection, the
 * Commit readout, kolu, odu, mail, spaces, the uptime chip — and two doors
 * (`⧉ plugins`, `⚙ prefs`). Nine things, each always there because a bar of
 * chips cannot be trusted if the healthy ones vanish. The dot keeps that
 * promise with one mark instead of nine: it is ALWAYS drawn, it wears the
 * worst tone among everything standing (`./health.ts`), and when that tone is
 * not healthy its name and tip say what is wrong in the readout's own words,
 * so a dropped connection is heard without opening anything.
 *
 * ## Who draws, who owns
 *
 * Every row in the popover is still its OWNER's face: the connection and the
 * uptime line are this plugin's own; every other row is a `cluster` seat in
 * `app.header`, registered and withdrawn by the plugin that owns it, drawn here
 * by {@link PluginHeaders} exactly as the bar used to draw it — so a row's
 * words and whatever its press opens (the Commit panel, kolu's feed) are the
 * plugin's, untouched. What changed is WHERE: a row of this popover rather
 * than a chip in the bar. The dot's colour comes from the same registrations'
 * `status` accessors, read live off the slot, so a plugin switched off takes
 * its row and its vote with it in the same withdrawal, and one switched back
 * on brings both with a fresh scope.
 *
 * The plugins door is a `layout.tools` entry that asks for this popover's
 * foot (`desktop: "health"`), so this file names no tenant.
 *
 * ## The panel
 *
 * `@olai/web`'s `createPopover` — the same open state, anchor, dismissal
 * (`../dismiss.ts`: a pointer outside, Escape) and one tab cycle every door in
 * the bar uses, with the caret handed back to the dot when a key shut it.
 * A row's own panel (the Commit panel) opens OVER this one and is the topmost
 * layer, so its Escape shuts it first and a second Escape shuts this.
 */
import { TESTID } from "olai-plugin-layout/testids"
import { createMemo, Show } from "solid-js"
import { Portal } from "solid-js/web"

import type { RendererSlots } from "olai-plugin-ui-renderer/contract"
import { type Anchor, styleOf } from "@olai/web/client/anchor.ts"
import { connectionReadout } from "@olai/web/client/wire.ts"
import { createPopover } from "@olai/web/client/popover.ts"
import { ICON_BUTTON, PANEL_BOX } from "@olai/web/client/readout.ts"

import { PluginHeaders } from "./Chrome.tsx"
import { hung } from "./faces.ts"
import { connectionStatus, nameOf, tipOf, worstOf, type DotTone } from "./health.ts"
import { Indicator } from "./Indicator.tsx"
import type { BarStatus } from "./slots.ts"
import { Tools } from "./Tools.tsx"
import { Uptime } from "./Uptime.tsx"

/** The dot's paint, per tone — theme tokens only. */
const PAINT: Readonly<Record<DotTone, string>> = {
  healthy: "bg-done",
  notice: "bg-doing",
  alarm: "bg-alarm",
}

/** A list of short rows wants less than the 24rem a settings panel is given.
 *  The anchor's box is narrowed from its LEFT edge, so its right edge — the
 *  window's margin, under the dot at the bar's right end — stays put. */
const ROWS_WIDTH = 320

const narrowed = (at: Anchor): Record<string, string | undefined> => {
  const width = Math.min(at.width, ROWS_WIDTH)
  return { ...styleOf(at), left: `${at.left + at.width - width}px`, width: `${width}px` }
}

export function Health(props: { readonly slots: RendererSlots }) {
  /** Every status standing now: the connection first, then each cluster
   *  seat's in mount order. A seat with no `status` has no vote. */
  const statuses = createMemo((): ReadonlyArray<BarStatus> => [
    connectionStatus(connectionReadout()),
    ...hung("app.header").flatMap((one) =>
      one.face.place === "cluster" && one.face.status !== undefined ? [one.face.status()] : []),
  ])
  const tone = () => worstOf(statuses())
  const popover = createPopover()

  return (
    <>
      <button
        type="button"
        ref={popover.setTrigger}
        class={`${ICON_BUTTON} size-8 !p-0 border ${
          popover.open() ? "border-accent" : "border-paper/25"
        }`}
        data-testid={TESTID.health}
        data-tone={tone()}
        // The connection's own state rides the dot too: it is the bar's own
        // readout, and "is this page still reading" should not need a click
        // to be asserted or inspected.
        data-connection={connectionReadout().status}
        aria-label={nameOf(statuses())}
        title={tipOf(statuses())}
        aria-expanded={popover.open()}
        aria-haspopup="true"
        onClick={() => popover.toggle()}
      >
        <span
          // A hairline of paper round it: the healthy green is a page-ground
          // token, and on the ink bar it needs an edge to read as a mark.
          class={`inline-block size-3 rounded-full ring-1 ring-paper/60 ${PAINT[tone()]}`}
          aria-hidden="true"
        />
      </button>
      <Show when={popover.open() ? popover.at() : null}>
        {(at) => (
          <Portal>
            <section
              ref={popover.setPanel}
              class={`${PANEL_BOX} gap-0.5 !p-2`}
              style={narrowed(at())}
              tabindex="-1"
              data-testid={TESTID.healthPanel}
              aria-label="status"
            >
              <Indicator readout={connectionReadout()} />
              <PluginHeaders place="cluster" />
              <Uptime />
              <div class="mt-1 border-t border-rule/60 pt-1">
                <Tools slots={props.slots} where="health" />
              </div>
            </section>
          </Portal>
        )}
      </Show>
    </>
  )
}
