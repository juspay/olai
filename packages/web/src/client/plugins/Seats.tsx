/**
 * THE FOUR SEATS THE SHELL RESERVES for a plugin's faces — the panel on the
 * right, the bar's last chip, the sections under the sidebar's own, and the
 * door under a row's property run.
 *
 * ## Why they are here and not at their call sites
 *
 * `PluginHeaders` and `PluginMounts` next door already made this argument and
 * these three inherit it whole: a walk over a slot is a READ of the runtime's
 * table, and the table moves when a plugin arrives or leaves. Reading it inside
 * a memo is what makes the page follow the roster; reading it once at a call
 * site would pin whichever answer the page happened to be built on, which for a
 * tab that follows the roster is a real state rather than a theoretical one.
 *
 * They are one file because they are one decision said four times: CORE KEEPS
 * THE BOX AND THE PLUGIN BRINGS THE FACE. Where the panel sits, how wide it is
 * and whether it is open; that the viewer's chip is last in the bar and stays
 * there on a phone; the sidebar's region, its heading's type and its height
 * budget; where under a row the door is drawn — all of that is the shell's,
 * survives whichever plugin is in the seat, and is not something a tenant may
 * be wrong about.
 */

import type { SingleSlot } from "@olai/plugin-api"
import { createMemo, For, Show } from "solid-js"

import { hung, only } from "./runtime.ts"

/**
 * ONE FACE OR NONE — what a single-occupancy slot draws, said once.
 *
 * `only` rather than a walk, because "there is at most one" is the thing those
 * slots exist to say: a second plugin taking the seat is refused at the moment
 * it registers, in the runtime's own words, and lands that plugin `failed` with
 * the first one's face untouched. So there is nothing to arbitrate here.
 *
 * Nothing at all where nobody has taken it, which is a state and not a gap: a
 * serve running no chat draws the outliner alone, a serve running no identity
 * row draws no chip. That is what `--plugins=` is for.
 *
 * A HELPER RATHER THAN TWO COPIES, and the two exports below stay two exports:
 * the NAMES are the app's placement vocabulary — `AppHeader.tsx` puts one of
 * them in the bar's last seat and `App.tsx` puts the other in the dock — and
 * what a seat DOES with its occupant is one behaviour, so it is written once.
 * The two would only ever diverge by one of them arbitrating, which is exactly
 * what these slots are keyed to make impossible.
 */
function Seat(props: { readonly slot: SingleSlot }) {
  const taken = createMemo(() => only(props.slot))
  return (
    <Show when={taken()}>
      {(seat) => {
        const Face = seat().face
        return <Face />
      }}
    </Show>
  )
}

/** THE PANEL ON THE RIGHT, and there is one — the dock a conversation lives
 *  in, on a serve that composed a chat row. */
export function PluginPanel() {
  return <Seat slot="app.panel" />
}

/**
 * WHO IS LOOKING — the bar's LAST seat, and there is one.
 *
 * ## Why this is not a seat in the header cluster
 *
 * Because the cluster is drawn under `desktop()` and this is not. The pills
 * beside it are about the app's HEALTH and leave the bar entirely on a phone
 * (WhatsApp's rule, and `on_a_phone.feature` asserts what is left: identity and
 * search). Who is looking is about the READER, it is last on every viewport,
 * and it survives that rule — so the shell places it OUTSIDE the desktop gate,
 * which is a fact about this app's geometry rather than something a plugin
 * should be able to be wrong about.
 *
 * With no identity row composed there is no chip, beside a server on which
 * every request is nobody. The two halves say the same thing, which is what
 * keeps the empty seat readable rather than looking like a chip that failed to
 * load.
 */
export function PluginViewer() {
  return <Seat slot="app.viewer" />
}

/**
 * THE SIDEBAR'S PLUGIN SECTIONS, under the app's own.
 *
 * IN THE BUNDLE'S ORDER, which `hung` already imposes: two plugins with a
 * section are in the order `olai.yml` names them rather than in the order the
 * roster happened to mount them, and a person reading a sidebar twice sees the
 * same one twice.
 *
 * ## The box is the PLUGIN'S to draw, out of the shell's own classes
 *
 * The slot was drafted as a heading and a body, so that core could draw the
 * region and a tenant could not carry core's Tailwind vocabulary around in
 * three byte-identical copies. That argument is answered rather than overruled:
 * the region's classes are reachable now, through this package's own `./client/*`
 * door, so there is ONE copy of them and a plugin imports it. What core would
 * have bought by drawing the box is a heading over an empty section — the agents
 * roster draws NOTHING at all in a directory with no node agent, and only the
 * plugin can know that.
 *
 * So `said` is the section's NAME rather than its heading: what the app has to
 * say whose a section is, in a `data-plugin` a scenario can find it by.
 */
export function PluginSections() {
  const sections = createMemo(() => hung("sidebar.section"))
  return (
    <For each={sections()}>
      {(one) => <div data-plugin={one.plugin}>{one.face.body()}</div>}
    </For>
  )
}

/** Plugin-owned directory doors, in the shell's two ruled placements. */
export function PluginEntries(props: { readonly place: "top" | "bottom" }) {
  const entries = createMemo(() =>
    hung("sidebar.entry").filter((one) => one.face.place === props.place)
  )
  return (
    <For each={entries()}>
      {(one) => <div data-plugin={one.plugin}>{one.face.body()}</div>}
    </For>
  )
}

/** The collapsed drawing that travels with the same directory entry. */
export function PluginRailEntries(props: { readonly place: "top" | "bottom" }) {
  const entries = createMemo(() =>
    hung("sidebar.entry").filter((one) => one.face.place === props.place)
  )
  return (
    <For each={entries()}>
      {(one) => {
        const Rail = one.face.rail
        return Rail === undefined ? null : <Rail />
      }}
    </For>
  )
}

/**
 * THE DOORS UNDER A ROW'S PROPERTY RUN — every registered one, drawn for every
 * row, each answering for the node it is handed.
 *
 * A LIST rather than a lookup by kind, and `@olai/plugin-api`'s own slot table
 * argues it where the slot is declared: a door is drawn per ROW rather than per
 * VALUE, and what decides whether it says anything is a lookup in a table the
 * plugin already subscribes to once for the whole app. Keying it by kind would
 * need the row's licence at a place that does not have one, and would buy
 * nothing — the face's answer is the same map read either way.
 *
 * What it costs a row nobody's door claims is one closure per registered plugin,
 * which on a serve running one chat is one.
 */
export function PluginDoors(props: { readonly node: string }) {
  const doors = createMemo(() => hung("outline.row.door"))
  return (
    <For each={doors()}>
      {(one) => {
        const Face = one.face
        return <Face node={props.node} />
      }}
    </For>
  )
}
