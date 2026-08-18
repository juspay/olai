/**
 * One outline, drawn.
 *
 * The shape of the tree is not decided here. `@olai/format` derives it —
 * sibling order, mirror expansion, the rollup beside a title and the guard
 * that stops a mirror inside its own subtree — and hands back rows, each
 * carrying the mark its node stores; this file turns a row into
 * markup and nothing else. That is the point: the view and the validator agree
 * about what a file means because they are running the same code, not because
 * two implementations were written to the same paragraph.
 *
 * A row's `kind` is what to draw, and each kind carries the answer already —
 * a dangling row knows the id its mirror chain actually died on, a cycle row
 * knows the id it closed on. Recomputing either from the record here would
 * give the FIRST hop, and say something untrue about a mirror three hops long.
 *
 * Every row's bullet is a link to that node's own page (./Glyph.tsx), on the
 * RECORD's id rather than the node it shows: a mirror's id resolves through
 * its chain to the same canonical page, so the two spellings agree and nothing
 * has to resolve anything here.
 *
 * Gutter layout matches Workflowy: on the left, a hover-reveal strip holds the
 * `•••` menu and the collapse triangle; then ONE glyph cell (./Glyph.tsx) that
 * is the bullet, the mark, or the waiting hourglass, wears the gray halo when
 * children are hidden, and is the link into the node. The hover strip is always
 * visible on a phone (no hover there) — see ./touch.ts.
 *
 * The `•••` itself is not drawn below 48rem, where there is no room for it,
 * so a phone reaches the same menu by HOLDING a finger on the row instead
 * (./longPress.ts, ./menu/door.ts). Both doors open one menu with one catalog;
 * neither device gets a verb the other does not.
 *
 * A row that cannot start yet says so twice and quietly: the glyph column draws
 * the waiting hourglass instead of the mark (./marks.tsx), and the row's own
 * line and body dim. The dim is on those two rather than on the `<li>`,
 * because opacity compounds through a subtree — dimming the item would dim
 * every row nested under it, twice over for a blocked row under a blocked
 * row, and what is waiting is this node rather than everything filed beneath
 * it. The glyph reads the same stored done/doing the title tones with, and a
 * row with no mark draws a bullet — a bullet is not a task. It stays
 * display-only in the sense that matters: what ticks a mark is `Ctrl+Enter` in
 * the row's own editor, and what walks it round the other two answers is
 * `Ctrl+Shift+Enter` — which is where every other edit is made too
 * (./edit/editing.tsx).
 *
 * TOP-LEVEL ROWS ARE SECTIONS (the quiet outline, human). A root of the file —
 * or, on a zoomed page, a child of the subject — carries a heavier name, wears
 * its rollup as part of that header rather than as a badge floated to the right,
 * and STICKS to the top of the reading while its own branch scrolls past. It is
 * the same row as any other and none of that is stored: `depth` is handed down
 * this component's own recursion, which is the only thing that knows it.
 *
 * A row is EDITABLE in place. Click its title and the title span is replaced
 * by an input in the same cell — no second layout and no mode — and the keys
 * of the Workflowy loop are that input's (../keys.ts says which, and why they
 * are the editor's rather than the window's). Two more things belong to the
 * same editor and are drawn only while it is here: a note being written as
 * TEXT rather than rendered, and the reason a commit was refused. A row being
 * typed is still not a row that has changed — nothing is echoed, and what the
 * tree draws is the file.
 *
 * A ROW IS ITS TITLE. What hangs under it is the open state — the properties
 * run and the note (./NodeBody.tsx) — and what opens it is the pilcrow beside
 * the title (./note/Mark.tsx), or, at `Cozy`, the clamped line itself. Where an
 * untouched row STARTS is this browser's density preference
 * (./settings/density.ts), which is the third thing this tree answers to
 * alongside what is FOLDED (./fold/memory.ts) and whether done rows are drawn
 * (./settings/done.ts, already applied to the rows handed here). The date badge
 * stays on the title line.
 */

import { isOverdue, type Row, shownRecord } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, createSignal, Match, Show, Switch } from "solid-js"

import { Aside } from "./Aside.tsx"
import { blockedIds, WAITING_DIM } from "./blocked.ts"
import { Glyph } from "./Glyph.tsx"
import { useDragging } from "./drag/dragging.ts"
import { Handle } from "./drag/Handle.tsx"
import { useSelection } from "./select/selection.ts"
import { DatePicker } from "./date/DatePicker.tsx"
import { RepeatPicker } from "./date/RepeatPicker.tsx"
import { datePick } from "./date/pick.ts"
import { repeatPick } from "./date/repeat.ts"
import { useDerived } from "./derived.tsx"
import { createEdgeEditing } from "./edges/editing.tsx"
import { useEditor } from "./edit/editing.tsx"
import { matchedAttr, useNarrowed } from "./filter/narrowed.tsx"
import { onATag } from "./filter/tag.ts"
import { useUndo } from "./edit/undoing.ts"
import { NewRow } from "./edit/NewRow.tsx"
import { DescEditor, Said, TitleEditor } from "./edit/RowEditor.tsx"
import { keyHandler } from "./keying.ts"
import { setFolded } from "./fold/memory.ts"
import { createFoldReading } from "./fold/reading.ts"
import { foldIdOf, foldOf, foldsUnder } from "./fold/rows.ts"
import { focusedNode } from "./focus.ts"
import { doneUnder } from "./hidden.ts"
import { hotOf } from "./hot.ts"
import { LAYER } from "./layer.ts"
import { NoteMark } from "./note/Mark.tsx"
import { createNoteExpand } from "./note/expand.ts"
import { customEntries } from "./props/drawer.ts"
import type { Editing } from "./props/editor.ts"
import { PropEditor } from "./props/PropEditor.tsx"
import { NodeBody } from "./NodeBody.tsx"
import { NodeLine } from "./NodeLine.tsx"
import { nodeMenuActions } from "./menu/actions.ts"
import { createMenuDoor } from "./menu/door.ts"
import { NodeMenu } from "./menu/NodeMenu.tsx"
import { useGo } from "./router.tsx"
import { density, showsPreview, startsOpen } from "./settings/density.ts"
import { TESTID } from "./testids.ts"
import { useToday } from "./today.tsx"
import {
  CHILD_INDENT,
  GUTTER_GAP,
  HELD,
  HOVER_CELL,
  HOVER_GUTTER,
  HOVER_REVEAL,
  PAST_CONTROLS,
  ROOT_RAIL,
  ROW_TITLE,
} from "./touch.ts"
import { applying } from "./writes.ts"

export function Tree(props: {
  readonly rows: ReadonlyArray<Row>
}) {
  // `data-sweep` below is `./drag/sweeping.ts`'s `SWEEP`: these lists hold rows
  // and never words, so a press that lands on ONE — the gaps between lines, the
  // indent rail beside a branch — is a drag-across rather than a text
  // selection. Spelled as a literal for the reason that constant gives (a JSX
  // spread would put every `data-` fact a row carries on Solid's runtime spread
  // path), and held to the name by ./claims.test.ts.
  //
  // `ROOT_RAIL` is what gives the outline's own list the strip a nested one has
  // by having children indent into it (./touch.ts): without it the only empty
  // space beside a ROOT row is the four pixels between two lines, and a flat
  // inbox is a page whose first rows cannot be swept to (review, 2026-08-14).
  // `my-0` and no `m-0`/`p-0`: the shorthands would be racing `ROOT_RAIL`'s own
  // `-ml-*`/`pl-*` for the same two properties, and which wins is Tailwind's
  // emission order rather than the order they are written in (./touch.ts's
  // `MENU_CELL` is where this app learnt that). What the shorthands were for is
  // the browser's own list defaults — a vertical margin, which `my-0` kills,
  // and a 40px `padding-inline-start`, which the rail's own padding replaces.
  //
  // NO MEASURE ON THE COLUMN: the tree takes the pane it is given. It was capped
  // at 80ch for one build and the human's eye rejected it on sight — a title
  // longer than the cap ellipsized with empty pane beside it, which is text lost
  // for nothing. ./touch.ts keeps the argument, and the 62ch that IS kept, on
  // the note.
  return (
    <ul
      class={`my-0 list-none ${ROOT_RAIL}`}
      data-sweep=""
      data-testid={TESTID.outlineTree}
    >
      {/* `<Key>`, not `<For>`, and `Row.key` is why it can be: the walk mints
          fresh rows on every frame the live store publishes, and `<For>`
          compares by reference — so one character changing in one title on
          disk would tear down and rebuild every row on screen, its DOM, its
          collapse memo and its rendered note with it. A key the format already
          mints per PLACE holds each row across the frame, and only the
          bindings whose values actually moved re-run. */}
      <Key each={props.rows} by="key">
        {(row) => <Branch row={row()} depth={0} />}
      </Key>
    </ul>
  )
}

function Branch(props: {
  readonly row: Row
  /** How far in this row is, counted from the rows this tree was handed — so
   *  depth 0 is a root of the file, or a child of the subject on a zoomed page.
   *  It is not on `Row`, and it should not be: the walk that derives rows has no
   *  view to have a top level OF, and this recursion is the one thing that
   *  knows. It buys exactly one thing, which is what a SECTION is. */
  readonly depth: number
}) {
  // WHAT THIS PAGE IS NARROWED BY (./filter/narrowed.tsx): whether this row was
  // a match rather than an ancestor of one. A fact about the PAGE, not the row,
  // which is why it arrives through a context rather than a thousand props.
  const narrowed = useNarrowed()
  // What is folded FOR THIS READING (./fold/reading.ts), not what this browser
  // has folded. The two differ while a filter is on — a collapse inside a
  // filtered tree would hide the match the query was typed to find — and the
  // editor, the selection and the drag walk the SAME answer
  // (./edit/Editable.tsx), so a second reading here would be a page whose arrow
  // keys walked rows nobody can see.
  //
  // A memo, not a plain accessor: folding one row mints a new Set, and five
  // separate computations in this component read it. Without the memo every
  // row in the tree re-runs all five on every click.
  //
  // Asked of the NODE this row folds by — its target if it is a mirror, so the
  // fold is the node's wherever the node appears (./fold/rows.ts).
  const folded = createFoldReading()
  const collapsed = createMemo(() => folded().has(foldIdOf(props.row)))
  // The RECORD a row shows, file and all — the file is what a note's relative
  // picture and a `doc` are relative to, and for a mirror that is the file the
  // node is DEFINED in rather than the one being read.
  const shown = () => (props.row.kind === "node" || props.row.kind === "mirror")
    ? props.row.shows
    : undefined

  const hasChildren = () => props.row.children.length > 0
  // The nodes expand/collapse all name. NOT a memo, which is the same argument
  // the menu catalog below makes for itself: a memo is eager and `props.row` is
  // a fresh object on every frame the store publishes, so memoising this would
  // walk every row's whole subtree on every frame — the tree squared — to
  // answer a question only an OPEN menu asks.
  const foldable = () => foldsUnder(props.row)
  // SPA navigate for the menu's "Zoom in" — same path as the bullet, never
  // location.assign (which reloads the document and kills the reading).
  const go = useGo()
  // The SET's own indexes, for the one menu verb whose question the rows
  // cannot answer: how much an archive takes with it. These rows are a
  // reading — done-hidden has already dropped branches from them — and the
  // confirm has to name what the write moves (./menu/subtree.ts).
  const derived = useDerived()
  // ⌘Z is one stack for this page, whichever hand wrote: a menu verb files
  // what would take it back exactly as a keystroke does (./writes.ts).
  const undo = useUndo()
  // Whether this row's date has gone by on work nobody has finished. Asked of
  // the node the row SHOWS — a mirror carries neither a date nor a mark — and
  // of the one clock this app reads (./today.tsx).
  const today = useToday()

  // Is this row OPEN — local to this place, not a reading cell. No hover. An
  // untouched row is whatever this browser's density preference says
  // (./settings/density.ts), read live, so a pick in the preferences panel
  // unfolds the page under the reader rather than after a reload.
  const note = createNoteExpand(() => startsOpen(density()))

  /** Is this row a SECTION — a top-level node of what is being read? */
  const section = () => props.depth === 0

  /** Has this row anything to OPEN? Its note, which is what the pilcrow was
   *  asked for — and its custom properties, because they moved into the open
   *  state with it, and a node carrying `stage review` and no note would
   *  otherwise have written a fact into a place with no door. The node's own
   *  facts are not on the list: they are already on screen (the glyph, the date
   *  badge) or on the node's own page. */
  const openable = () => {
    const shows = shown()
    if (shows === undefined) return false
    const desc = shows.node.desc
    return (desc !== undefined && desc !== "") || customEntries(shows.node).length > 0
  }

  /** Both doors to this row's `•••` menu, whether it is open, and the line all
   *  of that is about: the `•••` in the gutter, and — where that is not drawn,
   *  which is every screen under 48rem — a long press on the row, which is
   *  then also what the panel hangs off (./menu/door.ts). Called here, in the
   *  row's own owner, so a press in flight is disposed with the row. */
  const menu = createMenuDoor()

  /** Is this row's date picker open? Local to the ROW rather than to either of
   *  the two things that open it — the pill on the line, and the `•••` menu's
   *  `Set date…` — because it is one picker and the menu panel is closed by the
   *  time it has been chosen from (./date/DatePicker.tsx). */
  const [picking, setPicking] = createSignal(false)
  /** ...and one opener for both of them, so the two triggers cannot drift. */
  const openPicker = (): void => {
    setPicking(true)
  }

  /** Is this row's REPEAT picker open? The date picker's arrangement one field
   *  along, and separate from it on purpose: they are two writes at the gate,
   *  and one signal holding "which panel" would make opening the second an act
   *  that closes the first for a reason nobody asked for. */
  const [repeating, setRepeating] = createSignal(false)
  const openRepeat = (): void => {
    setRepeating(true)
  }

  /** Is this row's property editor open, and on WHAT — a property it carries,
   *  or `null` for one being added? Local to the ROW for the picker's reason:
   *  the `•••` menu that opened it is closed by the time anything has been
   *  typed. `undefined` is closed, which is the third state a `null` inside the
   *  value could not spell (./props/PropEditor.tsx). */
  const [propping, setPropping] = createSignal<Editing | null | undefined>(undefined)

  /** This row's edge editing — which panel is open, the writes its two doors
   *  send, and the line that says what came of them (./edges/editing.tsx). The
   *  same arrangement the date picker above is, and for the same reason: the
   *  panel belongs to the ROW, and the `•••` menu that opened it is closed by
   *  the time anything has been chosen in it. Over the node the row SHOWS,
   *  because edges are facts about a node and a placement carries none. */
  const edges = createEdgeEditing(() => shown()?.node)

  // The editor is one draft for the whole page, and this is the one question a
  // row asks of it: is the caret HERE? Asked of WHERE the caret is rather than
  // of the draft — three primitives that do not move while a person types — so
  // one character typed re-runs nothing in the rows around it. The row that
  // matches then reads the draft for its text, which is the one place that
  // value is wanted.
  //
  // A row being typed is matched by `Row.key`, its PLACE: the same node reached
  // through two mirrors is two rows, and only the one that was clicked has the
  // caret. A row being ADDED is matched by the anchor it named, which is a row
  // on screen — the new line is drawn after the line it will follow.
  const editor = useEditor()
  const typing = (field: "title" | "desc") => {
    const at = editor.where()
    if (at.place !== props.row.key || at.field !== field) return undefined
    const draft = editor.draft()
    return draft?.kind === "row" ? draft : undefined
  }
  const pending = () => {
    if (editor.where().after !== props.row.at.node.id) return undefined
    const draft = editor.draft()
    return draft?.kind === "new" ? draft : undefined
  }
  /** Is the caret in THIS row? What the row draws to say so, and what a
   *  scenario asks. A blinking text cursor at the end of a title was the whole
   *  affordance a walk with `↑`/`↓` had, and in a tree of a hundred rows that
   *  is a pixel nobody finds — so the row is toned while it holds the caret,
   *  and the bullet beside it takes the accent. */
  const editing = () => editor.where().place === props.row.key
  /** Is this row the one a reference in the chat panel just pointed at
   *  (./focus.ts)? Asked of the NODE the row shows, which is the rule a fold
   *  and a mark verb already follow — so every drawing of that node lights up,
   *  wherever it appears, exactly as every mirror of a folded node is folded.
   *
   *  A MEMO, like `collapsed` above and for its reason: two bindings read it,
   *  and one press of a reference would otherwise re-derive it twice in every
   *  row of the tree. */
  const focused = createMemo(() => focusedNode() === foldIdOf(props.row))

  /** Is this row PICKED, and is it in the air? Two facts about the same row and
   *  neither is the caret's: a pick is a set of places
   *  (`./select/selection.ts`), and a row being carried is one the drop is not
   *  offered beside (`./drag/dragging.ts`). Both are read here and drawn as
   *  `data-` facts on the item, which is where `data-editing` already is. */
  const selection = useSelection()
  const dragging = useDragging()
  const picked = () => selection.keys().has(props.row.key)
  const carried = () => dragging.carrying(props.row.key)

  /**
   * A click on the title: the caret, or the pick.
   *
   * Workflowy's modifiers, and the split is the whole of what a modifier means
   * here — a plain click is about the TEXT in this row, and a modified one is
   * about the ROW as a thing to do something to. Shift extends from where the
   * pick was started; ⌘ / Ctrl adds this row or takes it back out.
   *
   * The plain click just OPENS. Putting the pick away is the editor's, in the
   * one place every caret comes from (`./edit/editing.tsx`'s `open`), because a
   * rule spelled at the call sites is a rule the next door forgets — and the
   * note's did.
   */
  const clickTitle = (event: MouseEvent) => {
    // A press on a `#tag` belongs to the tag: it filters the page, and it is
    // answered one level up by the pane's delegated listener (`./filter/
    // tag.ts`). Without this the same press would ALSO drop a caret in the
    // line, because Solid runs a descendant's handler before an ancestor's.
    if (onATag(event)) return
    if (event.shiftKey) {
      selection.extend(props.row.key)
      return
    }
    if (event.metaKey || event.ctrlKey) {
      selection.toggle(props.row.key)
      return
    }
    editor.open(props.row, "title")
  }

  return (
    <li
      class="my-0.5"
      // The item's own box is scaffolding too — the indent strip beside a
      // child list, the margin left of a note — so a press there is a sweep
      // (./drag/sweeping.ts). Everything WITH words in it is a descendant and
      // wears no such mark, which is what keeps the rule an allowlist.
      data-sweep=""
      data-testid={TESTID.node}
      data-node-id={props.row.at.node.id}
      data-status={props.row.status}
      data-collapsed={String(collapsed())}
      data-kind={props.row.kind}
      data-file={props.row.at.file}
      data-line={props.row.at.line}
      data-note-open={note.expanded() ? "true" : "false"}
      data-editing={editing() ? "true" : undefined}
      // Picked, and in the air — the two facts a multi-select and a drag put on
      // a row, said the way `data-editing` beside them is said: as facts, never
      // as the tone they are painted.
      data-picked={picked() ? "true" : undefined}
      data-carried={carried() ? "true" : undefined}
      // Which row the panel is pointing at, as a fact rather than as a colour
      // — the same treatment `data-editing` beside it gets. It is also what
      // ./focus.ts aims its scroll at, which is why the row that wears it is
      // found rather than computed: a mirror of the node wears it too, and
      // either will do.
      data-focused={focused() ? "true" : undefined}
      // The ids this row is waiting on, in the promised order — absent when
      // nothing is in its way. The dim beside it is a styling decision a
      // refactor may change; this is the fact a scenario asks about.
      data-blocked={blockedIds(props.row.blocked)}
      // Whether the filter SELECTED this row or kept it as the context that
      // leads to one. Absent on an unfiltered page, which is the difference
      // between "not a match" and "there is no query" — one spelling for the
      // three surfaces that draw a row now (`./filter/narrowed.tsx`). No memo:
      // a JSX attribute is already its own computation, and this one has no
      // second reader — asked of the node the row SHOWS, which is the rule a
      // fold follows too and the format spells once (`shownRecord`).
      data-match={matchedAttr(narrowed, shownRecord(props.row).node.id)}
    >
      {/* group/row is on the LINE, not the <li>: a parent li also contains
          every nested child, and a named group-hover on the li would reveal
          every descendant's menu and triangle at once. Gap is GUTTER_GAP —
          the same number PAST_CONTROLS is arithmetic over (./touch.ts). */}
      <div
        ref={menu.line}
        // `relative` for the phone's menu root, which is out of the gutter's
        // flow so that a strip with no `•••` in it stays exactly as wide as
        // its triangle (./touch.ts's arithmetic). `HELD` is the other half of
        // what the long press below does about the browser's own gesture, for
        // the platform that raises it without an event to prevent.
        class={`group/row relative flex items-center ${HELD} ${GUTTER_GAP} ${
          WAITING_DIM(props.row.blocked)
        }`}
        // The phone's door to the `•••` menu: hold a finger on the row. Touch
        // only, so a mouse and a pen are untouched — and so is the page, which
        // goes on scrolling under a finger that moves (./longPress.ts).
        //
        // ...except on the BULLET, which is the handle a finger picks the row
        // up by — and that exception is the door's own (./menu/door.ts), not
        // this row's, so what is wired here is still one thing.
        //
        // Named one by one rather than spread: a spread anywhere on an element
        // moves EVERY attribute of it onto Solid's runtime `spread` path,
        // where the `classList` beside them is diffed key by key on every
        // frame the store publishes — for every row in the outline. The two
        // handlers are the whole of `LongPress`.
        onPointerDown={menu.hold.onPointerDown}
        onContextMenu={menu.hold.onContextMenu}
        // Two ways of being THE row, drawn in one accent and told apart by
        // weight: the caret fills its row, a reference outlines the row it
        // points at. One vocabulary, because "this is the one" is one thing to
        // say — and two tones, because a row can be both at once and a reader
        // pointed at a row they are already typing in should not see the
        // highlight simply not appear.
        classList={{
          // A SECTION holds its place at the top of the reading while its own
          // branch scrolls past — `position: sticky` inside this row's own
          // `<li>`, which is exactly the branch it heads, so it lets go the
          // moment the next section arrives. The offset is the app bar's height
          // (the page is what scrolls, `../styles.css`), and the layer is
          // {@link LAYER.row}: over the rows it covers, under every piece of
          // chrome. Overlays that hang off a row (the `•••` menu, the
          // title-cell completions) portal out of this context — a heading
          // left at the same layer as an in-tree menu is the heading that
          // paints through it (`menu-under-headers`).
          [`sticky top-[var(--height-header,3rem)] py-1 ${LAYER.row}`]: section(),
          // ...and an opaque backdrop, or the rows would read through it. NOT
          // when this row is the caret's or is picked: those wear a wash of
          // their own, and two backgrounds on one element is a race between two
          // utilities rather than a decision.
          "bg-paper": section() && !editing() && !picked(),
          "rounded-sm bg-accent/10": editing(),
          "rounded-sm ring-1 ring-accent/50": focused(),
          // A PICKED row wears the same accent wash the caret's row does —
          // "this is one of the ones" is the same thing to say, and a caret and
          // a pick are never on screen together. A row in the air fades, so the
          // eye follows the line that says where it is going rather than the
          // rows it left.
          "rounded-sm bg-accent/15": picked(),
          "opacity-40": carried(),
        }}
        data-testid={TESTID.nodeGutter}
        // What a gesture measures — a drag's gaps, a sweep's crossings. On the
        // LINE and not on the item, because an item's box contains every row
        // nested under it and both are about the lines a reader sees
        // (`./drag/lines.ts`, whose `ROW_KEY` this is; ./claims.test.ts holds
        // the two files that may spell it).
        //
        // Written out rather than spread from that constant, which is the same
        // rule `data-sweep` above follows and matters MOST here: this element
        // carries the `classList` beside it, and a spread anywhere on it puts
        // every attribute — those two toggles included — on Solid's runtime
        // spread path, diffed key by key on every frame the store publishes,
        // for every row in the outline. A static attribute NAME with a dynamic
        // value is compiled to one `setAttribute` effect instead.
        data-row-key={props.row.key}
      >
        {/* Hover strip: triangle always (phone) / hover-reveal (pointer). The
            `•••` is drawn on pointer devices only; below md its root is still
            here but out of the strip's flow, holding the panel a long press
            opens (./menu/NodeMenu.tsx). */}
        <div class={HOVER_GUTTER}>
          {/* The catalog is built where it is READ, which is inside the open
              panel: Solid compiles a dynamic component prop to a getter, so
              this call does not run for the rows nobody has opened a menu on.
              That is load-bearing rather than incidental — one of the verbs
              counts the rows under this one (`menu/subtree.ts`), and a walk
              per row per frame would be the tree squared. */}
          <NodeMenu
            door={menu}
            actions={nodeMenuActions({
              row: props.row,
              derived: derived(),
              collapsed: collapsed(),
              foldable: foldable(),
              go,
              record: undo.record,
              pickDate: openPicker,
              pickRepeat: openRepeat,
              pickEdge: edges.open,
              pickProp: (editing) => setPropping(editing),
            })}
          />
          <Show
            when={hasChildren()}
            fallback={<span class={HOVER_CELL} aria-hidden="true" />}
          >
            <button
              type="button"
              class={`${HOVER_CELL} ${HOVER_REVEAL} cursor-pointer border-0 bg-transparent p-0 text-[0.6rem] leading-none text-muted hover:text-ink`}
              data-testid={TESTID.toggle}
              aria-expanded={!collapsed()}
              aria-label={collapsed() ? "expand" : "collapse"}
              onClick={() => setFolded([foldOf(props.row)], !collapsed(), derived())}
            >
              {/* Small filled triangle — Workflowy's chevron, rotated. */}
              <span
                class="inline-block transition-transform duration-100"
                classList={{ "-rotate-90": collapsed() }}
                aria-hidden="true"
              >
                ▼
              </span>
            </button>
          </Show>
        </div>

        {/* The glyph is the handle, which is Workflowy's own gesture — and it
            is a WRAPPER rather than a prop on the glyph, because the same glyph
            is drawn on a day page where there is nothing to reorder
            (`./drag/Handle.tsx`). ONE cell: what the node is and the way into
            it (./Glyph.tsx). */}
        <Handle row={props.row}>
          <Glyph
            id={props.row.at.node.id}
            status={props.row.status}
            blocked={props.row.blocked}
            collapsed={hasChildren() && collapsed()}
            holding={editing()}
          />
        </Handle>

        <Switch>
          <Match when={props.row.kind === "dangling" ? props.row : undefined}>
            {(row) => (
              <span class={`flex-1 ${ROW_TITLE} text-alarm`} data-testid={TESTID.nodeTitle}>
                a mirror of `{row().missing}`, which no node declares
              </span>
            )}
          </Match>
          {/* The caret, where the title was. One `<Show>` rather than a
              second row: the editor takes the title's own cell, so nothing
              in the gutter moves and the line does not jump under the
              pointer that opened it. */}
          <Match when={typing("title")}>
            {(draft) => (
              <TitleEditor
                text={draft().text}
                caret={draft().caret}
                onInput={editor.type}
                onKey={keyHandler("line", editor.press)}
                onBlur={(left) => editor.blur({ row: props.row.at.node.id, field: "title" }, left)}
              />
            )}
          </Match>
          <Match when={shown()}>
            {(shows) => (
              <NodeLine
                title={shows().node.title}
                from={shows().file}
                status={props.row.status}
                section={section()}
                open={note.expanded()}
                // The one fact a folded row may say (./hot.ts), plus what this
                // row's own fold is holding back (./hidden.ts) — counted only
                // while it is collapsed, because a walk of every subtree on
                // every frame is the tree squared.
                aside={
                  <Aside
                    hot={hotOf(shows().node, props.row.progress, props.row.status)}
                    folded={collapsed() ? doneUnder(props.row) : undefined}
                  />
                }
                mark={
                  <Show when={openable()}>
                    <NoteMark open={note.expanded()} onToggle={note.toggle} ref={note.setTrigger} />
                  </Show>
                }
                says={shows().node.date}
                repeat={shows().node.repeat}
                overdue={isOverdue(shows().node, today())}
                onEdit={clickTitle}
                onPickDate={openPicker}
                onPickRepeat={openRepeat}
              >
                <Show when={props.row.kind !== "node"}>
                  <span class="mr-1 text-muted" title="a mirror of another node">
                    ⇢
                  </span>
                </Show>
              </NodeLine>
            )}
          </Match>
        </Switch>
      </div>

      {/* The date picker, in place under the line it was opened on — from the
          pill on that line, or from the `•••` menu's `Set date…`. Indented
          past the gutter like everything else a row says, and drawn whether
          the row is collapsed or not: it is about THIS node, not about what is
          under it. The id it names is the node the row SHOWS, so a pick at a
          mirror lands on its target, exactly as the mark verbs do. */}
      <Show when={picking() ? shown() : undefined}>
        {(shows) => (
          <div class={PAST_CONTROLS}>
            <DatePicker
              date={shows().node.date}
              onPick={(day) => applying(datePick(shows().node.id, day), undo.record)}
              onClose={() => setPicking(false)}
            />
          </div>
        )}
      </Show>

      {/* The repeat picker, on exactly the terms the date picker above has:
          opened from that row's pill or from the `•••`, drawn under the line,
          about the node the row SHOWS — a placement carries no rule of its own,
          so one chosen at a mirror lands on its target as a mark does. */}
      <Show when={repeating() ? shown() : undefined}>
        {(shows) => (
          <div class={PAST_CONTROLS}>
            <RepeatPicker
              repeat={shows().node.repeat}
              onPick={(rule) => applying(repeatPick(shows().node.id, rule), undo.record)}
              onClose={() => setRepeating(false)}
            />
          </div>
        )}
      </Show>

      {/* The property editor, on the same terms as the picker above: opened
          from the `•••`, drawn under the line it was opened on, about the node
          the row SHOWS — a placement carries no properties of its own, so one
          typed at a mirror lands on its target exactly as a mark does.

          The `when` tests the OPENNESS rather than the value, because `null` is
          a state it is open in: adding a property nobody has named yet. */}
      <Show when={propping() !== undefined ? shown() : undefined}>
        {(shows) => (
          <div class={PAST_CONTROLS}>
            <PropEditor
              editing={propping() ?? null}
              onSet={(key, value) =>
                applying({ verb: "prop", id: shows().node.id, key, value }, undo.record)}
              onClose={() => setPropping(undefined)}
            />
          </div>
        )}
      </Show>

      {/* The edge panel and whatever its writes said, in the same place and on
          the same terms as the picker above: opened from the `•••`, drawn under
          the line it was opened on, about the node the row SHOWS — a placement
          carries no edges of its own, so a `see` chosen at a mirror lands on its
          target exactly as a mark does. */}
      <Show when={edges.showing()}>
        <div class={PAST_CONTROLS}>
          <edges.Panel />
        </div>
      </Show>

      {/* What the last write said about this row — the reason it was refused,
          or the nudge from one that landed. Above the body rather than in it,
          because a COLLAPSED row draws no body and a refusal must be visible
          wherever the caret is. */}
      <Show when={typing("title") ?? typing("desc")}>
        {(draft) => (
          <div class={PAST_CONTROLS}>
            <Said draft={draft()} />
          </div>
        )}
      </Show>

      {/* Indented past the gutter controls — which are wider where a finger is
          what taps them, so the note and the document under it line up with the
          title on either. The note control root is what "click away" uses. */}
      <Show when={!collapsed() && shown()}>
        {(shows) => (
          <div
            class={`${PAST_CONTROLS} ${WAITING_DIM(props.row.blocked)}`}
            ref={note.setRoot}
          >
            {/* The note as TEXT while it is being written, rendered markdown
                the rest of the time — the same swap the title makes, one
                level down. */}
            <Show
              when={typing("desc")}
              fallback={
                <NodeBody
                  shows={shows()}
                  expanded={note.expanded()}
                  // Whether a CLOSED row keeps the clamped line — the density
                  // preference, arriving as the one thing it means here.
                  preview={showsPreview(density())}
                  onToggle={note.toggle}
                  onEdit={() => editor.open(props.row, "desc")}
                  // The `×` on a `see` link the expanded note draws — one op,
                  // `set_see`'s own removal, through the row's own edge editing
                  // so a refusal lands in the same line the panel's writes use.
                  // Handed in beside `onEdit` and for the same reason: a body
                  // drawn where a node is READ ONLY (a day page) passes neither
                  // (./NodeBody.tsx).
                  onUnsee={(target) => edges.drop("see", target)}
                />
              }
            >
              {(draft) => (
                <DescEditor
                  text={draft().text}
                  onInput={editor.type}
                  onKey={keyHandler("block", editor.press)}
                  onBlur={(left) => editor.blur({ row: props.row.at.node.id, field: "desc" }, left)}
                />
              )}
            </Show>
          </div>
        )}
      </Show>

      <Show when={props.row.kind === "cycle" ? props.row : undefined}>
        {(row) => (
          <div class={`${PAST_CONTROLS} text-sm text-alarm`}>
            this mirror is inside the subtree it shows (`{row().through}`) — not
            expanded
          </div>
        )}
      </Show>

      <Show when={!collapsed() && props.row.children.length > 0}>
        <ul class={CHILD_INDENT} data-sweep="">
          <Key each={props.row.children} by="key">
            {(child) => <Branch row={child()} depth={props.depth + 1} />}
          </Key>
        </ul>
      </Show>

      {/* A row being typed that is not a node yet, drawn where it will land:
          INSIDE this item and after its children, which is exactly where the
          next sibling appears in an outline. It is not a row of the tree — no
          `<li>`, no testid a scenario counts nodes with — because nothing has
          been written. */}
      <Show when={pending()}>
        {(draft) => (
          <NewRow
            draft={draft()}
            onInput={editor.type}
            onKey={keyHandler("line", editor.press)}
            onBlur={(left) => editor.blur({ row: props.row.at.node.id, field: "new" }, left)}
          />
        )}
      </Show>
    </li>
  )
}
