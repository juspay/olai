/**
 * A permalink that no longer names a page.
 *
 * Ids survive renames and moves, so a `/n/<id>` that stops working is real
 * news: the node was deleted, or the outline holding it is no longer served.
 * The page says which of the three things happened — nothing declares the id,
 * a mirror chain from it dies on a missing target, or the chain closes on
 * itself — in the same voice as the error view, because they are the same kind
 * of message: what is wrong, and where to look.
 *
 * The sidebar stays. A dead link is not a reason to strand someone.
 */

import type { Zoomed } from "@olai/format"
import { Match, Switch } from "solid-js"

import { TESTID } from "./testids.ts"

export function NotFound(props: { readonly zoomed: Zoomed }) {
  return (
    <section data-testid={TESTID.notFound} data-reason={props.zoomed.kind}>
      <h1 class="m-0 mb-2 text-2xl font-bold text-alarm">No such node</h1>
      <Switch>
        <Match when={props.zoomed.kind === "unknown" ? props.zoomed : undefined}>
          {(zoomed) => (
            <Lede>
              Nothing under the served directory declares the id{" "}
              <Id>{zoomed().id}</Id>. Ids survive renames and moves, so a link
              that used to work means the node was deleted — or the outline it
              lives in is not one of the files being served.
            </Lede>
          )}
        </Match>
        <Match when={props.zoomed.kind === "dangling" ? props.zoomed : undefined}>
          {(zoomed) => (
            <Lede>
              <Id>{zoomed().id}</Id> is a mirror, and the chain from it ends at{" "}
              <Id>{zoomed().missing}</Id>, which no node declares.
            </Lede>
          )}
        </Match>
        <Match when={props.zoomed.kind === "cycle" ? props.zoomed : undefined}>
          {(zoomed) => (
            <Lede>
              <Id>{zoomed().id}</Id> is a mirror whose chain closes on itself at{" "}
              <Id>{zoomed().through}</Id>, so it stands for no node at all.
            </Lede>
          )}
        </Match>
      </Switch>
      <Lede>Pick an outline from the sidebar to carry on reading.</Lede>
    </section>
  )
}

function Lede(props: { readonly children: unknown }) {
  return (
    <p class="mt-0 mb-4 max-w-3xl text-muted">{props.children as never}</p>
  )
}

function Id(props: { readonly children: unknown }) {
  return (
    <code class="font-mono text-[0.8125rem] text-ink">
      {props.children as never}
    </code>
  )
}
