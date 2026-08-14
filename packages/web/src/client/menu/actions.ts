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
 *     edit goes to the write gate (`../writes.ts`), a copy goes to the
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
 *
 * THE CLIPBOARD IS THE EXCEPTION, and it is one because it is not an echo:
 * there is no file, no collection and no redraw behind it — the destination is
 * OUTSIDE the app, so a copy that landed and a copy that never happened draw
 * exactly the same outline. Both already say so when they FAIL (the menu words
 * the throw), which left the two verbs saying something only in the case that
 * goes wrong; {@link copied} is the other half. Nothing here is guessed at
 * either: the sentence is written after `writeText` has resolved, so it is a
 * report rather than an assumption.
 */

import type { Derived, Row } from "@olai/format"

import { armNode } from "../chat/armed.ts"
import type { Relation } from "../edges/relation.ts"
import type { Said, Undo } from "../edit/undoing.ts"
import { setFolded } from "../fold/memory.ts"
import { type Fold, foldIdOf, foldOf } from "../fold/rows.ts"
import { setChatOpen } from "../layout/prefs.ts"
import { hrefOf, type Route } from "../routes.ts"
import { asText } from "./subtree.ts"
import type { MenuAction } from "./action.ts"
import { subjectOfRow, writeVerbs } from "./verbs.ts"
import { applying } from "../writes.ts"

/**
 * What a copy that LANDED says, in the one place both copies say it.
 *
 * The `aside` tone, which is the mood this client already keeps for "something
 * happened and here is a remark about it" — a nudge from a write, a note from
 * the rollup — as against the `alarm` a refusal is drawn in. So the two
 * answers a clipboard verb can give are the same two moods every other verb
 * has, in the same line beside the `•••` (`./picking.ts`), and a scenario can
 * tell them apart by `data-tone` rather than by reading a colour.
 *
 * ONE spelling for both verbs: "link copied" and "text copied" differ in the
 * word that differs and in nothing else, which is what stops the second copy
 * from growing a sentence of its own the day somebody edits one of them.
 */
const copied = (what: "link" | "text"): Said => ({ tone: "aside", text: `${what} copied` })

/**
 * The verbs this row offers. `go` is the SPA navigator — never
 * `location.assign`, which tears down the wire and the reading.
 *
 * The READS come first and the writes after them, with a rule between the two
 * halves rather than a habit: everything above the divider changes what this
 * tab is looking at, everything below it changes the directory. A person
 * reaching for "Collapse all" and hitting "Move to Trash" is a mistake the
 * ORDER can prevent, so it does.
 */
export const nodeMenuActions = (args: {
  readonly row: Row
  /** The set's indexes, which two verbs need and the ROWS cannot answer: how
   *  much an archive moves is a fact about the records rather than about the
   *  tree this reading happens to be drawing (`./subtree.ts`), and a fold that
   *  is REMEMBERED drops the ids of nodes the set no longer declares as it is
   *  written (`../fold/memory.ts`). */
  readonly derived: Derived | undefined
  readonly collapsed: boolean
  /** Every node under this row that has children — what the two "all" verbs
   *  name. Passed in rather than walked here: the walk is over Row shape, which
   *  is the tree's business (`../fold/rows.ts`), and this catalog is built for
   *  a menu somebody has opened. */
  readonly foldable: ReadonlyArray<Fold>
  /** Same-document navigation — the bullet's verb, not a full reload. */
  readonly go: (route: Route) => void
  /** The undo stack's recorder. A menu write files what would take it back on
   *  the same stack a keystroke does, so ⌘Z does not have two meanings
   *  depending on which hand made the edit. */
  readonly record: Undo["record"]
  /** Open the row's date picker — the one verb whose write is a gesture later,
   *  because a date is a value somebody has to choose (`./verbs.ts`'s `Does`).
   *  The picker belongs to the ROW rather than to this panel: the pill on the
   *  line opens the same one, and the panel is closed by the time either of
   *  them has been chosen. */
  readonly pickDate: () => void
  /** Open the row's edge panel for one relation — the same arrangement
   *  `pickDate` is, for the same reason: a target is a node somebody has to
   *  find, and the panel belongs to the ROW (the `×` on a drawn reference
   *  writes through it too), not to a menu that is closed by the time either is
   *  chosen. */
  readonly pickEdge: (relation: Relation) => void
}): ReadonlyArray<MenuAction> => {
  const id = args.row.at.node.id
  const items: MenuAction[] = [
    {
      id: "zoom",
      label: "Zoom in",
      run: () => args.go({ kind: "node", id }),
    },
    {
      // The composer, armed with this node — a READ, and it sits among the
      // reads for exactly the reason the divider below exists: it changes what
      // this tab is pointed at and writes nothing at all. What happens to the
      // node afterwards is whatever is typed next, through the same tools and
      // the same gate as always.
      //
      // The NODE the row shows rather than the record standing there
      // (`../fold/rows.ts`'s rule, the one a fold and a mark already follow):
      // a mirror is a placement, it has no title of its own, and the thing to
      // ask about is what it is a placement OF.
      id: "ask-agent",
      label: "Ask agent",
      run: () => {
        armNode(foldIdOf(args.row))
        // A chip in a panel nobody can see is a gesture that did nothing. The
        // panel is where the answer to "what did that do" is, so opening it is
        // part of the verb rather than a nicety — the palette's `>` does the
        // same thing for the same reason.
        setChatOpen(true)
      },
    },
  ]
  if (args.row.children.length > 0) {
    items.push({
      id: args.collapsed ? "expand" : "collapse",
      label: args.collapsed ? "Expand" : "Collapse",
      // The NODE this row shows, not the place it sits in — the same fold the
      // triangle beside it presses (`../fold/rows.ts`), sent to the same
      // memory (`../fold/memory.ts`), which is what makes the two controls one
      // switch rather than two that agree.
      run: () => setFolded([foldOf(args.row)], !args.collapsed, args.derived),
    })
    items.push(
      {
        id: "expand-all",
        label: "Expand all",
        run: () => setFolded(args.foldable, false, args.derived),
      },
      {
        id: "collapse-all",
        label: "Collapse all",
        run: () => setFolded(args.foldable, true, args.derived),
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
    // copy that did not happen look exactly like a copy that did. The menu is
    // what words the throw; an action's job is to do the thing or not — and
    // then to say WHICH, since the clipboard is somewhere the page cannot
    // show ({@link copied}).
    run: async () => {
      const url = new URL(hrefOf({ kind: "node", id }), location.href).href
      await navigator.clipboard.writeText(url)
      return copied("link")
    },
  })

  // The verb, with the one field that is not a menu's business — what it does
  // — turned into the running of it. Spread rather than copied field by field:
  // a hand-written list of names here is the list that goes stale the day a
  // verb grows a field, silently, because both shapes still compile.
  const writes: MenuAction[] = writeVerbs(subjectOfRow(args.row), args.derived).map(
    ({ does, ...verb }) => ({
      ...verb,
      // A BLOCK, and the `return` under it is load-bearing: an action answers
      // with what it has to SAY, and anything but `undefined` is drawn as a
      // sentence beside the `•••`. Opening the picker has nothing to say, and
      // an expression body would have handed the panel whatever the opener
      // happened to evaluate to — which is how this shipped an empty box under
      // the menu for a moment (a Solid setter answers with the new value, and
      // `() => void` accepts any return, so nothing but the screen said so).
      // A SWITCH, so the union's guarantee survives the one place that acts on
      // it: `Does` is tagged precisely so an entry with no edit is unspellable
      // (`./verbs.ts`), and a chain of `if`s whose last arm is a fall-through
      // would make the date picker the silent default for a fourth arm nobody
      // had answered here yet.
      //
      // The `return`-less arms are deliberate, and load-bearing: an action
      // answers with what it has to SAY, anything but `undefined` is drawn as a
      // sentence beside the `•••`, and opening a panel has nothing to say. An
      // expression body would hand the panel whatever the opener evaluated to —
      // which is how this shipped an empty box under the menu for a moment (a
      // Solid setter answers with the new value, and `() => void` accepts any
      // return, so nothing but the screen said so).
      run: () => {
        switch (does.kind) {
          case "edit":
            return applying(does.edit, args.record)
          case "pick-edge":
            args.pickEdge(does.relation)
            return
          case "pick-date":
            args.pickDate()
            return
        }
      },
    }),
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
        return copied("text")
      },
    })
  }

  // The rule goes above the first of them, wherever the two halves meet.
  items.push(...writes.map((verb, at) => (at === 0 ? { ...verb, divider: true } : verb)))
  return items
}
