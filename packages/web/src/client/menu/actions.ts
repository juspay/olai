/**
 * The `•••` menu's catalog: every verb a row offers, in the order it offers
 * them.
 *
 * One table, so the panel never has to know about zoom routes, fold keys or
 * the write gate — and so the menu's growth is an entry here rather than a
 * branch in a component. Two kinds of thing are in it and the SEAM between
 * them is the point:
 *
 *   - what a verb IS is decided elsewhere and as a value — the view verbs from
 *     the route and the reading, the writes from `./verbs.ts` as {@link Edit}s
 *     over the row;
 *   - what RUNNING one does is here, and it is the only thing here: an
 *     edit goes to the write gate (`./writes.ts`), a copy goes to the
 *     clipboard, a fold goes to the reading.
 *
 * So the file that decides which verbs a row can take is a pure function with
 * a unit test, and this is the wiring under it.
 *
 * NOTHING IS ECHOED, exactly as nothing is echoed for a keystroke: a write
 * that lands changes the file, the file arrives on the collection, and the
 * tree redraws. A menu entry that also crossed the row off locally would be
 * the optimistic UI this whole editor is written against — and the row it
 * crossed off might be one the write was refused for.
 */

import type { Derived, Row } from "@olai/format"

import { hrefOf, type Route } from "../routes.ts"
import type { View } from "../view.ts"
import { asText } from "./subtree.ts"
import type { MenuAction } from "./NodeMenu.tsx"
import { writeVerbs } from "./verbs.ts"
import { applying } from "./writes.ts"

/**
 * The verbs this row offers. `go` is the SPA navigator — never
 * `location.assign`, which tears down the wire and the reading.
 *
 * The READS come first and the writes after them, with a rule between the two
 * halves rather than a habit: everything above the divider changes what this
 * tab is looking at, everything below it changes the directory. A person
 * reaching for "Collapse all" and hitting "Archive" is a mistake the ORDER can
 * prevent, so it does.
 */
export const nodeMenuActions = (args: {
  readonly row: Row
  /** The set's indexes, which one verb needs and the ROWS cannot answer: how
   *  much an archive moves is a fact about the records, not about the tree
   *  this reading happens to be drawing (`./subtree.ts`). */
  readonly derived: Derived | undefined
  readonly collapsed: boolean
  readonly foldable: ReadonlyArray<string>
  readonly view: View
  /** Same-document navigation — the bullet's verb, not a full reload. */
  readonly go: (route: Route) => void
}): ReadonlyArray<MenuAction> => {
  const id = args.row.at.node.id
  const items: MenuAction[] = [
    {
      id: "zoom",
      label: "Zoom in",
      run: () => args.go({ kind: "node", id }),
    },
  ]
  if (args.row.children.length > 0) {
    items.push({
      id: args.collapsed ? "expand" : "collapse",
      label: args.collapsed ? "Expand" : "Collapse",
      run: () => args.view.toggle(args.row.key),
    })
    items.push(
      {
        id: "expand-all",
        label: "Expand all",
        run: () => args.view.expandKeys(args.foldable),
      },
      {
        id: "collapse-all",
        label: "Collapse all",
        run: () => args.view.collapseKeys(args.foldable),
      },
    )
  }
  items.push({
    id: "copy-link",
    label: "Copy link to node",
    // The failure is NOT caught here, and that is the fix: a clipboard write
    // is refused as a matter of course on a page served over plain http to
    // another machine — which is how olai is normally read — so a denial is
    // the ordinary path rather than an exotic one, and swallowing it made a
    // copy that did not happen look exactly like a copy that did. The menu
    // below is what says so; an action's job is to do the thing or not.
    run: async () => {
      const url = new URL(hrefOf({ kind: "node", id }), location.href).href
      await navigator.clipboard.writeText(url)
    },
  })

  // The verb, with the one field that is not a menu's business — the edit —
  // turned into the running of it. Spread rather than copied field by field:
  // a hand-written list of names here is the list that goes stale the day a
  // verb grows a field, silently, because both shapes still compile.
  const writes: MenuAction[] = writeVerbs(args.row, args.derived).map(
    ({ edit, ...verb }) => ({ ...verb, run: () => applying(edit) }),
  )
  // A pure READ, and the only reason it sits among the writes is that it is
  // about the subtree rather than about this tab: it is the one clipboard verb
  // that answers "what does all of this SAY". Built here rather than in the
  // catalog of values because the text is the whole subtree rendered, and the
  // catalog is rebuilt for every row on every frame the store publishes — a
  // copy nobody asked for is not worth a walk per row. Not offered on a row
  // that draws no node (a mirror whose chain died, one that closed a loop):
  // there is no text under it, and a menu entry that copies an empty string is
  // a click that silently does nothing.
  if (args.row.kind === "node" || args.row.kind === "mirror") {
    writes.push({
      id: "copy-text",
      label: "Copy as text",
      run: async () => {
        await navigator.clipboard.writeText(asText(args.row))
      },
    })
  }

  // The rule goes above the first of them, wherever the two halves meet.
  items.push(...writes.map((verb, at) => (at === 0 ? { ...verb, divider: true } : verb)))
  return items
}
