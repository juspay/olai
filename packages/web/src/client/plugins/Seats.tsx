/**
 * THE THREE SEATS THE SHELL RESERVES for a plugin's faces — the panel on the
 * right, the sections under the sidebar's own, and the door under a row's
 * property run.
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
 * They are one file because they are one decision said three times: CORE KEEPS
 * THE BOX AND THE PLUGIN BRINGS THE FACE. Where the panel sits, how wide it is
 * and whether it is open; the sidebar's region, its heading's type and its
 * height budget; where under a row the door is drawn — all of that is the
 * shell's, survives whichever plugin is in the seat, and is not something a
 * tenant may be wrong about.
 */

import { createMemo, For, Show } from "solid-js"

import { hung, only } from "./runtime.ts"

/**
 * THE PANEL ON THE RIGHT, and there is one.
 *
 * `only` rather than a walk, because "there is at most one" is the thing that
 * slot exists to say: a second plugin taking the seat is refused at the moment
 * it registers, in the runtime's own words, and lands that plugin `failed` with
 * the first one's panel untouched. So there is nothing to arbitrate here.
 *
 * Nothing at all where nobody has taken it — a serve running no chat draws the
 * outliner alone, which is exactly what `--plugins=` is for and is the state
 * this whole phase exists to make expressible.
 */
export function PluginPanel() {
  const seat = createMemo(() => only("app.panel"))
  return (
    <Show when={seat()}>
      {(taken) => {
        const Face = taken().face
        return <Face />
      }}
    </Show>
  )
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
export function PluginRailEntries() {
  const entries = createMemo(() => hung("sidebar.entry"))
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
