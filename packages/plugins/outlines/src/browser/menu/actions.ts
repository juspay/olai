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
 * TWO SURFACES HANG A `•••` NOW, and they share everything but their own
 * verbs. A tree row (`../Tree.tsx`) is a place in an outline: it folds, it has
 * a subtree to copy, it can be moved from where it stands. A DATED row on a day
 * page or the agenda (`../DatedRow.tsx`) is a node collected from all over the
 * set: it has none of those, and it draws the panels it can host. What is
 * common — zoom, the link, the write verbs, the plugins' verbs and where each
 * half goes — is {@link subjectMenuActions}, asked of a {@link Subject}; the
 * tree row's own verbs are {@link nodeMenuActions}, which hands its extras in.
 * One list with a flag per surface would braid the two together, and the
 * next verb a tree grows would have to remember a page it has never heard of.
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

import type { Row, Shelf } from "@olai/format"

import type { Relation } from "../edges/relation.ts"
import type { Said } from "@olai/web/client/saying.ts"
import type { Undo } from "../edit/undoing.ts"
import { setFolded } from "../fold/memory.ts"
import { type Fold, foldOf } from "../fold/rows.ts"
import { hung } from "../faces.ts"
import { atNode, hrefOfPlain, type Route } from "olai-plugin-navigation/routes"
import type { WorkspaceRouting } from "olai-plugin-navigation/workspace"
import { asText } from "./subtree.ts"
import type { MenuAction } from "./action.ts"
import { type Does, shownIdOf, type Subject, subjectOfRow, writeVerbs } from "./verbs.ts"
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
 * The panels a surface draws under the line its menu hangs off — what the
 * verbs that ask a question first open (`./verbs.ts`'s {@link Does}).
 *
 * EACH ONE OPTIONAL, and an absent one is a verb NOT OFFERED rather than a
 * verb that does nothing: a menu entry whose panel is nowhere on the page is a
 * click that silently goes nowhere, which is the one outcome this menu refuses
 * for every other verb too (`./verbs.ts` does not draw `Clear date` on a row
 * with no date). A tree row draws all five; a dated row draws the ones a node
 * collected from all over the set can host.
 *
 * Each belongs to the ROW rather than to the panel, because the menu is closed
 * by the time anything has been chosen in it:
 *
 *   - `pickDate` — the date picker (the pill on the line opens the same one);
 *   - `pickRepeat` — the repeat picker, `pickDate` one field along;
 *   - `pickEdge` — the edge panel for one relation (the `×` on a drawn
 *     reference writes through it too);
 *   - `addProp` — the ADD-A-PROPERTY chip in the row's run of chips, the one
 *     property entry the menu still carries, on a node whose run is empty;
 *   - `pickMove` — the MOVE-TO picker (⌘⇧M in the row editor opens the same).
 */
export interface Panels {
  readonly pickDate?: () => void
  readonly pickRepeat?: () => void
  readonly pickEdge?: (relation: Relation) => void
  readonly addProp?: () => void
  readonly pickMove?: () => void
}

/** An opener, as a menu entry runs it — or nothing, where the surface has no
 *  such panel. A BLOCK, and the missing `return` inside it is load-bearing: an
 *  action answers with what it has to SAY, anything but `undefined` is drawn as
 *  a sentence beside the `•••`, and opening a panel has nothing to say. An
 *  expression body would hand the panel whatever the opener evaluated to —
 *  which is how this shipped an empty box under the menu for a moment (a Solid
 *  setter answers with the new value, and `() => void` accepts any return, so
 *  nothing but the screen said so). */
const opening = (open: (() => void) | undefined): MenuAction["run"] | undefined =>
  open === undefined
    ? undefined
    : () => {
      open()
    }

/**
 * What choosing a verb RUNS on this surface, or `undefined` where the surface
 * cannot run it ({@link Panels}).
 *
 * A SWITCH, so the union's guarantee survives the one place that acts on it:
 * `Does` is tagged precisely so an entry with no edit is unspellable
 * (`./verbs.ts`), and a chain of `if`s whose last arm is a fall-through would
 * make the date picker the silent default for a sixth arm nobody had answered
 * here yet.
 */
const running = (
  does: Does,
  panels: Panels,
  record: Undo["record"],
): MenuAction["run"] | undefined => {
  switch (does.kind) {
    case "edit":
      return () => applying(does.edit, record)
    case "pick-edge": {
      const open = panels.pickEdge
      return opening(open === undefined ? undefined : () => open(does.relation))
    }
    case "pick-date":
      return opening(panels.pickDate)
    case "pick-repeat":
      return opening(panels.pickRepeat)
    case "add-prop":
      return opening(panels.addProp)
    case "pick-move":
      return opening(panels.pickMove)
  }
}

/**
 * The verbs a NODE offers, wherever its `•••` hangs. `go` is the SPA navigator
 * — never `location.assign`, which tears down the wire and the reading.
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
 *
 * A SURFACE'S OWN VERBS ride in `afterZoom` and `afterWrites`, named for WHERE
 * they go rather than what they are — `Copy as text` is a read that belongs
 * among the writes — and before the plugins' either way: the one decision about
 * where a surface's verb goes is made here, for every surface, rather than by
 * each of them splicing into a list it did not build.
 */
export const subjectMenuActions = (args: {
  /** The app's URL grammar, handed in — the shelf verb asks through it
   *  (`./verbs.ts`), and the caller has it off the router it is drawn inside. */
  readonly routes: WorkspaceRouting
  /** The node the menu is about: the record it was opened at, and what that
   *  record shows (`./verbs.ts`). */
  readonly subject: Subject
  /** How many records hang under the node, IN THE SET — the number the
   *  archive's confirm names. Counted where the set is and carried on the
   *  reading (`@olai/format`'s `Row.under`, `Situated.under`); `undefined`
   *  while no reading has arrived, and the archive is then not offered. */
  readonly under: number | undefined
  /** The shelf as the server answered it, for the ONE verb that is about the
   *  sidebar rather than about the node: whether this node is already a door on
   *  it (`../pins.ts`). */
  readonly pins: Shelf
  /** What a kind licenses on the file the node lives in, for the one property
   *  entry (`./verbs.ts`). */
  readonly placement?: Parameters<typeof writeVerbs>[4]
  /** Same-document navigation — the bullet's verb, not a full reload. */
  readonly go: (route: Route) => void
  /** The undo stack's recorder. A menu write files what would take it back on
   *  the same stack a keystroke does, so ⌘Z does not have two meanings
   *  depending on which hand made the edit. */
  readonly record: Undo["record"]
  /** The panels this surface draws; a verb that would open one it does not is
   *  not offered ({@link Panels}). */
  readonly panels: Panels
  /** This surface's own verbs placed after `Zoom in`, before the link. */
  readonly afterZoom?: ReadonlyArray<MenuAction>
  /** This surface's own verbs placed after core's writes. */
  readonly afterWrites?: ReadonlyArray<MenuAction>
}): ReadonlyArray<MenuAction> => {
  const id = args.subject.record.id
  /** The node the record SHOWS — what a plugin's press is handed. */
  const shown = shownIdOf(args.subject)
  const items: MenuAction[] = [
    {
      id: "zoom",
      label: "Zoom in",
      run: () => args.go(atNode(id)),
    },
    ...(args.afterZoom ?? []),
  ]
  // `Ask agent` STOOD HERE, second among the reads, and it is gone with the
  // rest of chat: arming a composer is a thing a conversation has, and this
  // catalog is core's. It is `olai-plugin-chat`'s browser half now, hung in
  // `outline.row.action` — and it arrives back on this list at the bottom of
  // this function, through the walk every plugin's verb comes in by.
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
      const url = new URL(hrefOfPlain(atNode(id)), location.href).href
      await navigator.clipboard.writeText(url)
      return copied("link")
    },
  })

  // The verb, with the one field that is not a menu's business — what it does
  // — turned into the running of it, and DROPPED where this surface cannot run
  // it ({@link Panels}). Spread rather than copied field by field: a
  // hand-written list of names here is the list that goes stale the day a verb
  // grows a field, silently, because both shapes still compile.
  // HOW MUCH AN ARCHIVE MOVES rides on the reading itself: it is a fact about
  // the records rather than about what this surface happens to be drawing, so
  // it is counted where the set is and sent with the page.
  const writes: MenuAction[] = writeVerbs(
    args.routes,
    args.subject,
    args.under,
    args.pins,
    args.placement,
  ).flatMap(({ does, ...verb }) => {
    const run = running(does, args.panels, args.record)
    return run === undefined ? [] : [{ ...verb, run }]
  })
  writes.push(...(args.afterWrites ?? []))

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
    for (const verb of face(shown)) {
      const entry = {
        id: `${plugin}:${verb.id}`,
        label: verb.label,
        ...(verb.confirm === undefined ? {} : { confirm: verb.confirm }),
        run: async () => {
          const refusal = await verb.run(shown)
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

/**
 * The verbs a TREE ROW offers: every one a node offers
 * ({@link subjectMenuActions}), and the ones only a place in an outline has —
 * its folds, and the text of its subtree. It draws every panel a verb can
 * open, so none of the node's verbs is left out here.
 */
export const nodeMenuActions = (args: {
  /** What a kind licenses on this row's file (`./verbs.ts`). */
  readonly placement?: Parameters<typeof writeVerbs>[4]
  /** The app's URL grammar, handed in. */
  readonly routes: WorkspaceRouting
  readonly row: Row
  /** The shelf as the server answered it (`../pins.ts`). */
  readonly pins: Shelf
  readonly collapsed: boolean
  /** Every node under this row that has children — what the two "all" verbs
   *  name. Passed in rather than walked here: the walk is over Row shape, which
   *  is the tree's business (`../fold/rows.ts`), and this catalog is built for
   *  a menu somebody has opened. */
  readonly foldable: ReadonlyArray<Fold>
  readonly go: (route: Route) => void
  readonly record: Undo["record"]
  /** The five panels a tree row draws, each REQUIRED here: a tree row that
   *  forgot one would quietly lose the verb ({@link Panels}). */
  readonly panels: Required<Panels>
}): ReadonlyArray<MenuAction> => {
  const folds: MenuAction[] = []
  if (args.row.children.length > 0) {
    folds.push(
      {
        id: args.collapsed ? "expand" : "collapse",
        label: args.collapsed ? "Expand" : "Collapse",
        // The NODE this row shows, not the place it sits in — the same fold the
        // triangle beside it presses (`../fold/rows.ts`), sent to the same
        // memory (`../fold/memory.ts`), which is what makes the two controls
        // one switch rather than two that agree.
        run: () => setFolded([foldOf(args.row)], !args.collapsed),
      },
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
  // A pure READ, and the only reason it sits among the writes is that it is
  // about the subtree rather than about this tab: it is the one clipboard verb
  // that answers "what does all of this SAY". Built here rather than in the
  // catalog of values because the text is the whole subtree rendered, and the
  // catalog is rebuilt for every row on every frame the store publishes — a
  // copy nobody asked for is not worth a walk per row. Not offered on a row
  // that draws no node (a mirror whose chain died, one that closed a loop):
  // there is no text under it, and a menu entry that copies an empty string is
  // a click that silently does nothing.
  const text: MenuAction[] = args.row.kind === "node" || args.row.kind === "mirror"
    ? [{
      id: "copy-text",
      label: "Copy as text",
      run: async () => {
        await navigator.clipboard.writeText(asText(args.row))
        return copied("text")
      },
    }]
    : []
  return subjectMenuActions({
    routes: args.routes,
    subject: subjectOfRow(args.row),
    under: args.row.under,
    pins: args.pins,
    placement: args.placement,
    go: args.go,
    record: args.record,
    panels: args.panels,
    afterZoom: folds,
    afterWrites: text,
  })
}
