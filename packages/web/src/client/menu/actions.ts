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

import type { Row } from "@olai/format"
import type { Shelf } from "@olai/surface"

import type { Relation } from "../edges/relation.ts"
import type { Said } from "../saying.ts"
import type { Undo } from "../edit/undoing.ts"
import { setFolded } from "../fold/memory.ts"
import { type Fold, foldIdOf, foldOf } from "../fold/rows.ts"
import { hung } from "../plugins/runtime.ts"
import { atNode, hrefOf, type Route } from "../routes.ts"
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
 *
 * ...AND THE PLUGINS' VERBS AFTER BOTH, which is the same argument once more
 * rather than a third half: where a tenant's press sits in this list is core's
 * decision, so it is made in one place — the walk at the end of this function,
 * which is where the reasoning is.
 */
export const nodeMenuActions = (args: {
  readonly row: Row
  /** The shelf as the server answered it, for the ONE verb that is about the
   *  sidebar rather than about the row: whether this node is already a door on
   *  it (`../pins/answered.tsx`). */
  readonly pins: Shelf
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
  /** Open the row's REPEAT picker — `pickDate` one field along, and the same
   *  arrangement for the same reason: which rule is a choice, and the panel
   *  belongs to the ROW (the pill on the line opens the same one), not to a
   *  menu that is closed by the time it has been chosen from. */
  readonly pickRepeat: () => void
  /** Open the row's edge panel for one relation — the same arrangement
   *  `pickDate` is, for the same reason: a target is a node somebody has to
   *  find, and the panel belongs to the ROW (the `×` on a drawn reference
   *  writes through it too), not to a menu that is closed by the time either is
   *  chosen. */
  readonly pickEdge: (relation: Relation) => void
  /** Open the ADD-A-PROPERTY chip in the row's run of chips — the one property
   *  entry the menu still carries, and only on a node whose run is empty
   *  (`./verbs.ts` argues where). It carries nothing, because the run knows
   *  every key and value it draws and a menu that is closed by the time
   *  anything has been typed could not hold one anyway. */
  readonly addProp: () => void
  /** Open the row's MOVE-TO picker — the same arrangement the three above are,
   *  for the same reason: a destination is a node somebody has to find, and the
   *  panel belongs to the ROW (⌘⇧M in its editor opens the same one), not to a
   *  menu that is closed by the time anything has been chosen in it. */
  readonly pickMove: () => void
}): ReadonlyArray<MenuAction> => {
  const id = args.row.at.node.id
  const items: MenuAction[] = [
    {
      id: "zoom",
      label: "Zoom in",
      run: () => args.go(atNode(id)),
    },
  ]
  // `Ask agent` STOOD HERE, second among the reads, and it is gone with the
  // rest of chat: arming a composer is a thing a conversation has, and this
  // catalog is core's. It is `olai-plugin-chat`'s browser half now, hung in
  // `outline.row.action` — and it arrives back on this list at the bottom of
  // this function, through the walk every plugin's verb comes in by.
  if (args.row.children.length > 0) {
    items.push({
      id: args.collapsed ? "expand" : "collapse",
      label: args.collapsed ? "Expand" : "Collapse",
      // The NODE this row shows, not the place it sits in — the same fold the
      // triangle beside it presses (`../fold/rows.ts`), sent to the same
      // memory (`../fold/memory.ts`), which is what makes the two controls one
      // switch rather than two that agree.
      run: () => setFolded([foldOf(args.row)], !args.collapsed),
    })
    items.push(
      {
        id: "expand-all",
        label: "Expand all",
        run: () => setFolded(args.foldable, false),
      },
      {
        id: "collapse-all",
        label: "Collapse all",
        run: () => setFolded(args.foldable, true),
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
      const url = new URL(hrefOf(atNode(id)), location.href).href
      await navigator.clipboard.writeText(url)
      return copied("link")
    },
  })

  // The verb, with the one field that is not a menu's business — what it does
  // — turned into the running of it. Spread rather than copied field by field:
  // a hand-written list of names here is the list that goes stale the day a
  // verb grows a field, silently, because both shapes still compile.
  // HOW MUCH AN ARCHIVE MOVES rides on the row itself: it is a fact about the
  // records rather than about the tree this reading happens to be drawing, so
  // it is counted where the set is and sent with the page
  // (`@olai/format`'s `Row.under`).
  const writes: MenuAction[] = writeVerbs(
    subjectOfRow(args.row),
    args.row.under,
    args.pins,
  ).map(
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
          case "pick-repeat":
            args.pickRepeat()
            return
          case "add-prop":
            args.addProp()
            return
          case "pick-move":
            args.pickMove()
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

  /**
   * ...AND WHAT THE PLUGINS HANG ON A ROW — `outline.row.action`, placed into
   * the half each verb says it belongs in.
   *
   * ## What core keeps
   *
   * The POSITION, and it is a safety property rather than a preference: the rule
   * above separates verbs that change what this tab is looking at from verbs
   * that change the directory, and a person reaching for one and hitting the
   * other is the mistake the ORDER prevents. A plugin's verbs sit at the END of
   * whichever half they belong to — after core's own, in the bundle's order
   * (`../plugins/runtime.ts`'s `hung` imposes it), and one plugin's several stay
   * in the order it registered them.
   *
   * APPENDING AFTER BOTH HALVES was the first shape and it broke exactly the
   * rule it was standing next to: *Ask agent* arms a composer and writes
   * nothing, and it landed under *Move to Trash*. Core cannot tell which a
   * verb is, and a plugin may not be trusted with the position — so `RowAction`
   * carries the one fact that crosses (`writes`) and this is where it is spent.
   *
   * NO DIVIDER and NO CONFIRM, and neither is an omission: `RowAction` has
   * neither field. A rule is core's statement about where the halves meet, and a
   * question asked before a verb runs is prose drawn in core's words — which a
   * plugin's verb is not core's to compose.
   *
   * ## What the plugin brings
   *
   * The words, the press, and which half. The press is handed ONE argument: the
   * node this row SHOWS (`../fold/rows.ts`), never the record standing there.
   * That is the rule a mark, a fold and a pin already follow, and spending it
   * here is what stops a tenant from having to know that a mirror is a placement
   * with no title of its own — `Ask agent` got this right when it lived in this
   * file and a test held it; now nothing on the other side of the slot can get
   * it wrong.
   *
   * THE ID IS COMPOSED, because a plugin's `id` is its own word and two plugins
   * may spell it the same. `<plugin>:<verb>` is unambiguous — a plugin's name
   * carries no colon — and it is what reaches `data-action` on the entry, so a
   * scenario naming a plugin's verb names whose it is.
   */
  for (const { plugin, face } of hung("outline.row.action")) {
    // A READING, ASKED HERE, AND ASKED ABOUT THIS ROW. The face answers the
    // verbs that plugin offers on this node right now — which for the chat panel
    // is one *start* per installed engine on a bare row, one on a row that names
    // an engine, and none at all on a row already talking through a conversation.
    // None of that is knowable when a plugin registers: the roster arrives over a
    // wire the tab dials afterwards, and the row is this walk's own. It is the
    // NODE THE ROW SHOWS, the same id a press is handed, so core's arithmetic
    // over mirrors and folds is spent once and no tenant can get it wrong.
    for (const verb of face(foldIdOf(args.row))) {
      const entry = {
        id: `${plugin}:${verb.id}`,
        label: verb.label,
        run: async () => {
          const refusal = await verb.run(foldIdOf(args.row))
          if (typeof refusal === "string") return { tone: "alarm" as const, text: refusal }
        },
      }
      if (verb.writes) writes.push(entry)
      else items.push(entry)
    }
  }

  // The rule goes above the first of the writes, wherever the two halves meet —
  // AFTER the plugins have added to both, so a serve running a plugin whose only
  // verb writes still draws one rule in the one right place.
  items.push(...writes.map((verb, at) => (at === 0 ? { ...verb, divider: true } : verb)))

  return items
}
