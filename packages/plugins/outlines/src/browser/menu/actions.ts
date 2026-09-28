/**
 * The `•••` menu's catalog: every verb a row offers, in the groups and order
 * it offers them ({@link subjectMenuActions}).
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
import type { Fold } from "../fold/rows.ts"
import { hung } from "../faces.ts"
import { atNode, hrefOfPlain, type Route } from "olai-plugin-navigation/routes"
import type { WorkspaceRouting } from "olai-plugin-navigation/workspace"
import type { RowAction, RowVerb } from "olai-plugin-outlines/slots"
import { asText } from "./subtree.ts"
import type { MenuAction, MenuEntry } from "./action.ts"
import { type Does, type Group, shownIdOf, type Subject, subjectOfRow, writeVerbs } from "./verbs.ts"
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
const copied = (what: "link" | "text"): Said => ({ tone: "aside", text: what === "link" ? "Link copied" : "Text copied" })

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
 * A plugin's contribution, as lines of core's menu: a verb, or a submenu of
 * them (`olai-plugin-outlines/slots`'s `RowChoice`) — COLLAPSED here when it
 * holds one choice, into that choice's press under the entry's own label, and
 * dropped when it holds none, so no plugin has to spell either case.
 *
 * THE ID IS COMPOSED, because a plugin's `id` is its own word and two plugins
 * may spell it the same. `<plugin>:<verb>` is unambiguous — a plugin's name
 * carries no colon — and it is what reaches `data-action` on the entry, so a
 * scenario naming a plugin's verb names whose it is.
 *
 * The press is handed ONE argument: the node this row SHOWS, never the record
 * standing there — the rule a mark, a fold and a pin already follow, spent
 * here so nothing on the other side of the slot can get it wrong.
 */
const pluginEntries = (plugin: string, action: RowAction, shown: string): ReadonlyArray<MenuEntry> => {
  const verb = (one: RowVerb): MenuAction => ({
    id: `${plugin}:${one.id}`,
    label: one.label,
    ...(one.confirm === undefined ? {} : { confirm: one.confirm }),
    run: async () => {
      const refusal = await one.run(shown)
      if (typeof refusal === "string") return { tone: "alarm" as const, text: refusal }
    },
  })
  if (!("choices" in action)) return [verb(action)]
  if (action.choices.length > 1) return [{ id: `${plugin}:${action.id}`, label: action.label, entries: action.choices.map(verb) }]
  return action.choices.map((one) => ({ ...verb(one), label: action.label }))
}

/**
 * The verbs a NODE offers, wherever its `•••` hangs. `go` is the SPA navigator
 * — never `location.assign`, which tears down the wire and the reading.
 *
 * ## Short, and in groups
 *
 * The menu used to be one list of every verb — twenty to thirty lines on a
 * busy row, five of them per agent engine. It is now at most a dozen, in
 * groups a rule apart, in this order:
 *
 *   1. `Zoom in`, `Mark ›` (the status marks), and any plugin verb that only
 *      READS (`RowAction.writes === false`) — what a reader does most;
 *   2. when and where to find it — the date, the repeat rule, the pin;
 *   3. where it lives — `Move to…`, `Duplicate`;
 *   4. the plugins' WRITES (chat's `Start an agent ›`, `Fresh start`,
 *      `Close the agent`), after core's own, in the bundle's order;
 *   5. `More ›` — the rarely reached: the two copies, the folds, a property,
 *      the edges, retiring a placement, and taking a date or a rule back off;
 *   6. `Move to Trash`, last and alone.
 *
 * The rules are the safety property the old reads/writes divider was: a
 * person reaching for anything else does not land on the verb that takes a
 * subtree away. Where a verb goes is its own `group` (`./verbs.ts`); where a
 * plugin's goes is decided HERE, not by the plugin, which says only whether it
 * writes.
 *
 * A SURFACE'S OWN VERBS ride in `more` — the tree row's folds and `Copy as
 * text` — so the one decision about where a surface's verb goes is made here,
 * for every surface, rather than by each of them splicing into a list it did
 * not build.
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
  /** This surface's own rarely-reached verbs, placed in `More ›` after the
   *  link. */
  readonly more?: ReadonlyArray<MenuAction>
}): ReadonlyArray<MenuEntry> => {
  const id = args.subject.record.id
  /** The node the record SHOWS — what a plugin's press is handed. */
  const shown = shownIdOf(args.subject)
  const zoom: MenuAction = {
    id: "zoom",
    label: "Zoom in",
    run: () => args.go(atNode(id)),
  }
  const copyLink: MenuAction = {
    id: "copy-link",
    label: "Copy link",
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
  }

  // The verb, with the one field that is not a menu's business — what it does
  // — turned into the running of it, and DROPPED where this surface cannot run
  // it ({@link Panels}). Spread rather than copied field by field: a
  // hand-written list of names here is the list that goes stale the day a verb
  // grows a field, silently, because both shapes still compile.
  const verbs = writeVerbs(
    args.routes,
    args.subject,
    args.under,
    args.pins,
    args.placement,
  ).flatMap(({ does, ...verb }) => {
    const run = running(does, args.panels, args.record)
    return run === undefined ? [] : [{ ...verb, run }]
  })
  const of = (group: Group): Array<MenuAction> =>
    verbs.filter((verb) => verb.group === group).map(({ group: _, ...verb }) => verb)

  /**
   * WHAT THE PLUGINS HANG ON A ROW — `outline.row.action`, asked about this
   * row, in the bundle's order (`../plugins/runtime.ts`'s `hung` imposes it).
   *
   * A READING, ASKED HERE: the face answers the verbs that plugin offers on
   * this node right now — which for chat is one `Start an agent` on a bare row
   * (a submenu of engines when there is more than one), and `Fresh start` and
   * `Close the agent` on a row already talking. None of that is knowable when
   * a plugin registers.
   *
   * NO DIVIDER and NO CONFIRM of the plugin's composing: a rule is core's
   * statement about where its groups meet. A plugin's verb may ASK (its
   * `confirm`), and the question is drawn in core's panel.
   */
  const reads: Array<MenuEntry> = []
  const plugins: Array<MenuEntry> = []
  for (const { plugin, face } of hung("outline.row.action")) {
    for (const action of face(shown)) {
      ;(action.writes ? plugins : reads).push(...pluginEntries(plugin, action, shown))
    }
  }

  const marks = of("mark")
  const groups: ReadonlyArray<ReadonlyArray<MenuEntry>> = [
    [
      zoom,
      ...(marks.length === 0 ? [] : [{ id: "mark", label: "Mark", entries: marks }]),
      ...reads,
    ],
    of("plan"),
    of("place"),
    plugins,
    [{ id: "more", label: "More", entries: [copyLink, ...(args.more ?? []), ...of("more")] }],
    of("away"),
  ]

  // A rule above the first entry of every group but the first — AFTER the
  // plugins have added theirs, so a group left empty draws no rule of its own.
  return groups
    .filter((group) => group.length > 0)
    .flatMap((group, at) => group.map((entry, i) => (at > 0 && i === 0 ? { ...entry, divider: true } : entry)))
}

/**
 * The verbs a TREE ROW offers: every one a node offers
 * ({@link subjectMenuActions}), and the ones only a place in an outline has —
 * the folds of its subtree, and its text. Both are rarely reached, so both go
 * in `More ›`. It draws every panel a verb can open, so none of the node's
 * verbs is left out here.
 */
export const nodeMenuActions = (args: {
  /** What a kind licenses on this row's file (`./verbs.ts`). */
  readonly placement?: Parameters<typeof writeVerbs>[4]
  /** The app's URL grammar, handed in. */
  readonly routes: WorkspaceRouting
  readonly row: Row
  /** The shelf as the server answered it (`../pins.ts`). */
  readonly pins: Shelf
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
}): ReadonlyArray<MenuEntry> => {
  // A pure READ: the one clipboard verb that answers "what does all of this
  // SAY". Built here rather than in the catalog of values because the text is
  // the whole subtree rendered, and the catalog is rebuilt for every row on
  // every frame the store publishes — a copy nobody asked for is not worth a
  // walk per row. Not offered on a row that draws no node (a mirror whose chain
  // died, one that closed a loop): there is no text under it, and a menu entry
  // that copies an empty string is a click that silently does nothing.
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
  // THE TWO "ALL" FOLDS, on a row with anything under it. This row's own fold
  // is the triangle beside the `•••` — drawn on every device — so the menu does
  // not repeat it.
  const folds: MenuAction[] = args.row.children.length === 0 ? [] : [
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
  ]
  return subjectMenuActions({
    routes: args.routes,
    subject: subjectOfRow(args.row),
    under: args.row.under,
    pins: args.pins,
    placement: args.placement,
    go: args.go,
    record: args.record,
    panels: args.panels,
    more: [...text, ...folds],
  })
}
