/**
 * `/plugins/<word>/app…` — THE PLUGIN'S OWN PAGE, drawn by the plugin.
 *
 * What is drawn is the face the plugin hung in `plugin.page`, handed the rest
 * of the path. A face is hung only while its plugin is mounted, so this page
 * draws plugin code exactly when that code is approved at the version on
 * disk, switched on and not failing — nothing here decides that again.
 *
 * Where there is no face, the address says why in this row's own words — the
 * stage the plugin's approval page heads with — and links to that page, where
 * the one thing a person can do about it is done. It never draws a plugin face
 * at the approval page's own address (`./address.ts`).
 */
import type { BrowserManagement } from "@olai/surface/management"
import { createMemo, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { pluginPageHref } from "./address.ts"
import { ownPageOf } from "./faces.ts"
import { LOOK, pluginNamed, type Stage, stageOf } from "./state.ts"

export function OwnPage(props: {
  readonly word: string
  readonly rest: string
  readonly management: BrowserManagement
}) {
  // Taken once under the owner the pane mounted this in, and released with it.
  const roster = props.management.roster()
  const plugin = createMemo(() => pluginNamed(roster(), props.word))
  const face = createMemo(() => ownPageOf(props.word))
  return (
    <Show when={face()} fallback={<Absent word={props.word} stage={plugin() === undefined ? "missing" : stageOf(plugin()!)} />}>
      {(Face) => {
        const Drawn = Face()
        return <Drawn rest={props.rest} />
      }}
    </Show>
  )
}

function Absent(props: { readonly word: string; readonly stage: Stage | "missing" }) {
  const said = () =>
    props.stage === "missing"
      ? `This vault has no plugin called ${props.word}.`
      : props.stage === "on"
        ? `${props.word} is on, and draws no page of its own.`
        : `${props.word} is not running (${LOOK[props.stage].word.toLowerCase()}), so its page is not drawn.`
  return (
    <section data-testid={TESTID.ownPageAbsent} data-plugin={props.word} data-stage={props.stage} class="p-4">
      <p class="m-0 text-body">{said()}</p>
      <p class="mt-2 text-body">
        <a href={pluginPageHref({ word: props.word })}>Open the plugin {props.word}</a>
      </p>
    </section>
  )
}
