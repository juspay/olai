/**
 * WHAT A READ-ONLY ROW IS CALLED — and, where the page has somewhere to send
 * it, the link it is.
 *
 * Two pages draw rows nobody edits: the trash (`trash/TrashPage.tsx`), which is
 * the archive, and the everywhere page (`search/SearchPage.tsx`), which is the
 * whole directory answering one query. Neither mounts an editor, so neither
 * draws `Tree.tsx`'s row — and both were left spelling the SAME four things for
 * themselves: the node's title through `NodeTitle`, and the two sentences a
 * condemned set's degenerate rows say.
 *
 * THOSE SENTENCES ARE THE REASON THIS IS A COMPONENT. They are quoted from the
 * outline tree, and each copy carried a comment saying so — *"a reader who
 * meets the same broken record on two pages should read the same words about
 * it"* — which is a rule enforced by hand across three files the moment there
 * were three. It is one file now; `Tree.tsx` keeps its own because a tree row
 * is an editor with a title inside it rather than a title.
 *
 * WHAT DIFFERS between the two pages is one thing, and it is the parameter: a
 * trash row goes nowhere (the way out of the archive is Put back, which is the
 * row's own control), and a search row goes to the node. So the link is
 * OPTIONAL and carries its own testid — present together, absent together,
 * which is this client's shape for "a door and the way to name it"
 * (`search/Shortlist.tsx`'s `refusing` makes the same argument).
 */

import { Match, Switch } from "solid-js"

import type { Row } from "@olai/format"

import { NodeTitle } from "./NodeTitle.tsx"
import { atNode } from "./routes.ts"
import { Link } from "./router.tsx"

export function RowTitle(props: {
  readonly row: Row
  /** The words the query found this row by, lit in its title — the same fact
   *  every other surface's rows draw (`./filter/lit.ts`). */
  readonly needles?: ReadonlyArray<string>
  /** WHERE THIS ROW GOES, as what a scenario calls the link — absent on a page
   *  whose rows go nowhere. The route is always the node's own page: a row that
   *  linked anywhere else would be a row whose press means something different
   *  depending on which page drew it. */
  readonly opens?: string
}) {
  return (
    <Switch>
      <Match
        when={props.row.kind === "node" || props.row.kind === "mirror"
          ? props.row
          : undefined}
      >
        {(row) => (
          <Switch
            fallback={
              <NodeTitle
                title={row().shows.node.title}
                from={row().shows.file}
                needles={props.needles}
              />
            }
          >
            <Match when={props.opens}>
              {(testid) => (
                <Link
                  route={atNode(row().shows.node.id)}
                  class="text-ink no-underline hover:underline"
                  testid={testid()}
                >
                  <NodeTitle
                    title={row().shows.node.title}
                    from={row().shows.file}
                    needles={props.needles}
                  />
                </Link>
              )}
            </Match>
          </Switch>
        )}
      </Match>
      <Match when={props.row.kind === "dangling" ? props.row : undefined}>
        {(row) => (
          <span class="text-muted">
            a mirror of `{row().missing}`, which no node declares
          </span>
        )}
      </Match>
      <Match when={props.row.kind === "cycle" ? props.row : undefined}>
        {(row) => (
          <span class="text-muted">
            this mirror is inside the subtree it shows (`{row().through}`) — not
            expanded
          </span>
        )}
      </Match>
    </Switch>
  )
}
