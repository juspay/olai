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
import { createEffect, createMemo, createSignal, on, Show } from "solid-js"
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
import { tools } from "./index.ts"
import { Tools } from "./Tools.tsx"
import { Uptime } from "./Uptime.tsx"

/** The dot's paint, per tone — theme tokens only. */
const PAINT: Readonly<Record<DotTone, string>> = {
  healthy: "bg-done",
  notice: "bg-doing",
  alarm: "bg-alarm",
}

/** A list of short rows wants less than the 24rem a settings panel is given.
 *  The box is narrowed and its RIGHT edge set on the bar's own right edge (the
 *  last control's, `edge`) — never past the anchor's window margin — so the
 *  popover hangs flush under the dot, the gear and who is looking. */
const ROWS_WIDTH = 320

const narrowed = (at: Anchor, edge: number | undefined): Record<string, string | undefined> => {
  const right = Math.min(at.left + at.width, edge ?? Number.POSITIVE_INFINITY)
  const width = Math.min(at.width, ROWS_WIDTH, right)
  return { ...styleOf(at), left: `${right - width}px`, width: `${width}px` }
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
  let dot: HTMLButtonElement | undefined
  const [open, setOpen] = createSignal(false)
  const popover = createPopover({ held: { open, setOpen } })
  // A door at this popover's foot whose own state says it is up (the plugins
  // panel, held by the inspector's activation) needs its trigger mounted to
  // draw — so the popover opens for it. That is how a panel that was open
  // when the shell was rebuilt comes back with the shell.
  //
  // MOUNTED, NOT SHOWN: while that panel is up the popover keeps its rows in
  // the page (the door's trigger lives there) but is not drawn, so the panel
  // is the one thing on screen rather than a panel over a popover. When the
  // panel goes down the popover goes with it — the person has moved on.
  const doorUp = createMemo(() =>
    props.slots.read(tools).some((entry) => entry.value.desktop === "health" && entry.value.open?.() === true))
  createEffect(on(doorUp, (up, was) => {
    if (up) setOpen(true)
    else if (was === true) setOpen(false)
  }))

  return (
    <>
      <button
        type="button"
        ref={(el) => {
          dot = el
          popover.setTrigger(el)
        }}
        class={`${ICON_BUTTON} size-8 !p-0 border ${
          popover.open() ? "border-accent" : "border-paper/20"
        }`}
        data-testid={TESTID.health}
        data-health={tone()}
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
              class={`${PANEL_BOX} gap-0.5 !p-2 ${doorUp() ? "invisible" : ""}`}
              style={narrowed(at(), dot?.parentElement?.getBoundingClientRect().right)}
              aria-hidden={doorUp() ? "true" : undefined}
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
