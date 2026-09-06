import type {} from "./slots.ts"
import { createMemo, For } from "solid-js"
import { hung } from "@olai/web/client/plugins/runtime.ts"
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

