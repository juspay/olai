/**
 * A permalink that no longer names a page.
 *
 * Ids survive renames and moves, so a `/#<id>` that stops working is real
 * news: the node was deleted, or the outline holding it is no longer served.
 * The page says which of the three things happened — nothing declares the id,
 * a mirror chain from it dies on a missing target, or the chain closes on
 * itself — in the same voice as the error view, because they are the same kind
 * of message: what is wrong, and where to look.
 *
 * The sidebar stays. A dead link is not a reason to strand someone.
 */
import { TESTID } from "olai-plugin-outlines/testids"
import type { Zoomed } from "@olai/format"
import { Match, Switch } from "solid-js"

import { Lede } from "@olai/web/client/errors/Lede.tsx"
import { PAGE_TITLE } from "@olai/web/client/look.ts"
import { only } from "@olai/web/client/narrow.ts"


export function NotFound(props: { readonly zoomed: Zoomed }) {
  return (
    <section data-testid={TESTID.notFound} data-reason={props.zoomed.kind}>
      <h1 class={`${PAGE_TITLE} mb-2 italic text-alarm`}>Not found</h1>
      <Switch>
        <Match when={only(props.zoomed, "unknown")}>
          {(zoomed) => (
            <Lede>
              Nothing in your notes has the id <Id>{zoomed().id}</Id>. Links
              survive renames and moves, so the row was probably deleted, or
              its outline is no longer in this folder.
            </Lede>
          )}
        </Match>
        <Match when={only(props.zoomed, "dangling")}>
          {(zoomed) => (
            <Lede>
              <Id>{zoomed().id}</Id> mirrors <Id>{zoomed().missing}</Id>, which
              no longer exists.
            </Lede>
          )}
        </Match>
        <Match when={only(props.zoomed, "cycle")}>
          {(zoomed) => (
            <Lede>
              <Id>{zoomed().id}</Id> mirrors itself through{" "}
              <Id>{zoomed().through}</Id>, so there is nothing to show.
            </Lede>
          )}
        </Match>
      </Switch>
      <Lede>Choose an outline from the sidebar.</Lede>
    </section>
  )
}

function Id(props: { readonly children: string }) {
  return <code class="font-mono text-body text-ink">{props.children}</code>
}
