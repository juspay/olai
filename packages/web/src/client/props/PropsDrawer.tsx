/**
 * A node's properties, as a RUN OF CHIPS: `key value` pairs on one wrapping
 * line, the key small and muted, the value first-class — a compact byline under
 * a headline, a door wherever the value names something, and, where the surface
 * offers writing, the place the property is edited.
 *
 * It was a two-column grid until the quiet outline, and then a dot-separated
 * run of dim pairs until `props-doors-autoshow`. The grid's problem was that a
 * `dl` with a key column and a value column is a table, and there is nothing
 * table-shaped in this view (human). The RUN's problem was different and it was
 * a weighting one: every pair was set in the same muted ink at the same size,
 * so `agent claude-opus` read as two equally quiet words and the five facts on
 * a lane node read as a wall (https://github.com/juspay/oss.olai/blob/master/olai/brainstorming/props-ui.html, drawn after the
 * wall-of-prose screenshot). What a reader wants from five facts is the VALUES,
 * with the keys as labels — so the key stays mono and muted and one step
 * smaller, the value takes the reading ink, and each pair sits in its own
 * bordered chip so the eye finds where one fact stops and the next begins
 * without a separator glyph doing that work.
 *
 * ## Three faces a value can wear, and none of them is a guess
 *
 * A DOOR, where the value names a thing: a document of this directory, a node
 * the set declares, a day, or somewhere outside the app. WHICH of those is not
 * decided here and is no longer decided in this package at all — the page
 * arrives carrying the answer per value (`@olai/format`'s `meaning.ts`, which
 * argues the whole subject; `../doors.ts` is the table it lands in and
 * `./door.ts` turns one answer into a route). What is THIS file's is that a
 * door looks like a link and nothing else does.
 *
 * A REF CHIP DRAWS ITS TARGET'S TITLE and holds the id underneath, which is the
 * one place a chip does not draw the value verbatim. It is licensed by the
 * DECLARATION rather than by anything visible in the string — a value the vault
 * declared a reference is a thing whose name is not its identity — so the face
 * comes off the answer ({@link Door.face}) and never off a rule spelled here.
 *
 * A DATE BADGE, where the value is a date: the same pill the row already speaks
 * with (`../Pill.tsx`, which `../DateBadge.tsx` is drawn from), because a reader
 * who has learnt what a date looks like on this row should not have to learn it
 * again one line down.
 *
 * A FOLD, where the value is PROSE longer than a fact ({@link FOLDS_PAST}). The
 * mockup's Move 3, and its own sentence about itself: the fold is the safety
 * net, not the goal — under the props-are-facts rule it should almost never
 * appear, and when it does, the wall never comes back. It is here because the
 * run is drawn on a CLOSED row now: a `merge` holding two sentences used to
 * cost nothing until somebody opened the row, and would otherwise cost every
 * row of the board three lines of prose it did not ask for.
 *
 * A LONG DOOR IS NOT PROSE and does not fold — it CLAMPS ({@link Clamped}): one
 * line, ellipsized by the browser, still a link, the whole of it in the
 * tooltip. Length was the whole of the fold rule once, and it swallowed the two
 * door kinds most likely to run past it — a URL and a deep vault path — taking
 * away the link the door rule had just given them (both reviewers, 2026-08-24).
 * A name is one token however long it is.
 *
 * ## Where it is written, which is HERE and nowhere else
 *
 * A chip is edited in place. The gesture is stated once and it is:
 *
 * > **A link goes where it says. Everything else in a chip opens it for
 * > editing** — and the KEY always does, whatever the value is.
 *
 * The KEY is the promise, because it is the one half of a chip that is never
 * anything else: `brief` is a label whether `finishes.md` is a door or a typo,
 * so "press the label to change the fact" is a rule with no exceptions to
 * learn. The VALUE is the second way in wherever it is not a link, because
 * inert text beside an editable label is a dead zone a reader will press first
 * — and where it IS a link it is a link, because a door that sometimes ate the
 * click would be worse than either.
 *
 * Enter commits; Escape cancels; leaving the box commits IF something changed
 * and closes quietly otherwise, which is what stops "open a chip, click away"
 * from being a refusal (`./editor.ts`'s `writes`). CLEARING THE VALUE REMOVES
 * THE PROPERTY, and that is the op's own reading rather than a gesture this
 * face invented — `set_prop` with `""` takes the key off exactly as `null`
 * does.
 *
 * A `+` at the end of the run is the door onto ADDING one. It opens a chip with
 * two boxes, which is the only place a key is ever typed: a rename is two ops,
 * so an existing chip's key is not typeable (`./editor.ts` argues both).
 *
 * THE `•••` MENU'S PROPERTY FAMILY IS GONE, and that is the point of all of the
 * above. It used to grow an `Edit <key>…` and a `Remove <key>` PER PROPERTY, so
 * a node carrying eight facts had sixteen menu entries about them — a menu that
 * got longer every time somebody wrote something down, and a second door onto a
 * write the run is now the first door to. Both are deleted.
 *
 * ONE entry survives and it is the case the `+` cannot reach: a node carrying
 * NO property has no run for a `+` to sit at the end of, and drawing an
 * otherwise-empty run under every row of a tree would cost a line per title —
 * which is exactly the clutter the quiet outline removed. So the menu offers
 * `Add property…` precisely when there are no chips, and the `+` is the door
 * whenever there are. One door at a time, never two: what the entry opens is
 * THIS editor ({@link PropsDrawer.adding}), not a panel of its own.
 *
 * What a surface may write is the CALLER's ({@link PropsDrawer.onSet}): absent
 * is read-only, which is the rule `../NodeBody.tsx`'s `onEdit` and `onUnsee`
 * already follow. A day page and the agenda draw a node they do not offer to
 * change; a document's frontmatter is edited by editing the file.
 *
 * ## When it is drawn, which is not the same in the three places
 *
 * On a ROW: whenever the node carries a custom property, open or not, and the
 * CUSTOM half only. Both halves of that are rulings. AUTO-SHOW is
 * `props-doors-autoshow`'s: a fact behind a fold is a fact nobody reads, and
 * these are short facts by rule — the display's job is to make five of them
 * cost one line, not to hide them. The custom-only half is the row design's
 * standing rule and did not move: the node's own facts are already on screen
 * when you are looking at a row — the mark is the glyph, the date is the badge,
 * the id is where the bullet goes — and two spellings of one fact under one
 * title is the thing this run must not be.
 *
 * WHAT OPENING A ROW ADDS is therefore the NOTE, and the references under it,
 * and nothing else. That is the answer to "does the ¶ duplicate the run": it
 * cannot, because the run is not behind it.
 *
 * On the node's own PAGE: always, and whole. A zoomed node is a page ABOUT that
 * node, the facts are what the page is for, and the id in particular is what
 * every tool call and every `((` reference takes.
 *
 * On a DOCUMENT's own page: the custom half only, off `Face.props`. A `.md`
 * has no system facts with nowhere else to show — the path is already the
 * heading — so inventing an id line would be this drawer inventing a record
 * the file does not have. Empty is not drawn, which is the row's own rule
 * over the same map.
 *
 * ## Read-only above, writable below
 *
 * The system chips carry `data-system`, and they are drawn exactly like the
 * others: same run, same type. Nothing here greys them out, because they are
 * not disabled versions of anything — they are facts, drawn where facts are.
 * What says they cannot be typed over is that their key is not a button: each
 * is a field with a verb of its own (`set_done`, `set_date`) or nothing to
 * write at all (`id`, the stamps), and `set_prop` refuses every one of them by
 * name.
 *
 * They take NO DOORS either, and for the neighbouring reason. Every system chip
 * is a field with a face of its own — `date` is the badge on the line above,
 * `status` is the glyph, and `id` is the address of the page the chip is being
 * drawn on, so a door on it is a link back to itself. A custom value names
 * something ELSE or it names nothing; that is exactly the question `./door.ts`
 * answers, and it is not a question about a field the format already reads.
 *
 * ## What does NOT draw chips
 *
 * A SEARCH HIT (`../search/Result.tsx`). It borrows this file's type vocabulary
 * — mono key, reading value — and deliberately not its shape: a hit is one
 * truncating line inside a popover, and the row IS a link already, so a door
 * inside it would be a link inside a link and an editor inside it would be a
 * write made from a list of search results. One component per surface where a
 * node's facts are READ; a hit list is a list of doors onto nodes.
 */

import { Key } from "@solid-primitives/keyed"
import { createMemo, createSignal, For, Index, Show } from "solid-js"

import type { Entry } from "./drawer.ts"
import { type Door, doorFor } from "./door.ts"

import { type BlockChrome, layOut, registerBlock, TERMINAL_KEY } from "./blocks.ts"
import { Handle } from "./handle.tsx"
import { TerminalBlock } from "@olai/kolu-ui"
import { type ClosedBy, type Editing, leavingCommits, openedOn, sending, writes } from "./editor.ts"
import { Link } from "../router.tsx"
import { useDoors, useNames } from "../reading.tsx"
import type { Said } from "../saying.ts"
import { createSaying } from "../saying.ts"
import { SaidLine } from "../SaidLine.tsx"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"

// THE APP OWNS THE TABLE, and this is the whole of that ownership.
//
// It was a side-effect import: `./blocks.ts` was a table a renderer put ITSELF
// into, and the drawer loaded the module so the key would be in the map. That
// reads fine while everything is one package and stops being true the moment
// the renderer is behind a wall — a self-registrant would put the appliance in
// charge of the app's table, and the import direction would be a lie told by
// an `import "…"` with no binding.
//
// So the renderer is a component and nothing else, and the registration is a
// call the app makes. Against `TERMINAL_KEY` — `@olai/surface`'s exported
// constant — never the string `"terminal"`: the key is the wire's, one
// spelling, and a literal here would be a second one waiting to drift.

/** THE DRAWER'S FURNITURE, minted once — every block gets the same object.
 *
 *  It lives HERE and not in `./blocks.ts` because that module is the seam and
 *  is deliberately JSX-free: its own unit test imports it directly, and pulling
 *  a `.tsx` in through it broke that test the moment the chrome was added
 *  there. A type crosses a seam; a component belongs with the drawer. */
const BLOCK_CHROME: BlockChrome = {
  Handle,
  factId: TESTID.prop,
  valueId: TESTID.propValue,
}

registerBlock(TERMINAL_KEY, TerminalBlock)

/**
 * HOW LONG A VALUE MAY BE before it is drawn folded.
 *
 * A number, and there is no way for it not to be one: "does this fit on a line"
 * is a question about a laid-out box, and a component cannot ask it without
 * measuring after the fact and drawing twice. So the rule is about the VALUE
 * instead, which is what the ruling is actually about — props are short facts,
 * and a value past about half a line is prose that belongs in the note.
 *
 * Chosen against the mockup's own two examples: `the human approves personally`
 * (29 characters) is a fact and is drawn whole, and a verdict paragraph is not.
 * Everything in between is drawn whole too, deliberately — the fold is the
 * safety net, and a net that catches often is a net in the way.
 */
const FOLDS_PAST = 56

/** ...and how much of it the summary shows, cut at a word boundary so a fold
 *  never opens on half a word. */
const SUMMARISED_AT = 40

/** WHAT THE CHIP RUN CAN SEND: one property set to one value, at the gate every
 *  other write goes through — a `Said` back is a refusal or a nudge to draw,
 *  nothing back is the ordinary success. An empty value is the REMOVAL; the
 *  caller does not have to know that, because the op already does.
 *
 *  `was` is the snapshot the editor opened on — the value the key held when
 *  the person began, or `null` for one being ADDED, whose condition is the
 *  key's absence. Every commit is conditional, which is the point of the
 *  trip (prop-op-conditional-was): a typed commit can no longer land on top
 *  of an agent's in-flight write with nothing on screen to say so — the op
 *  refuses and its sentence is what the line below is for. */
export type SetProp = (key: string, value: string, was: string | null) => Promise<Said | undefined>

export function PropsDrawer(props: {
  /**
   * The chips to draw, already decided. A ROW hands the custom half, a node's
   * own page hands the system facts then the custom half, a document page
   * hands `Face.props` through `customEntries` — three callers, one run, and
   * none of them can ask this component for a combination the types forbid.
   */
  readonly entries: ReadonlyArray<Entry>
  /**
   * The file these properties were WRITTEN in — the outline holding the record,
   * or the document whose frontmatter this is.
   *
   * Required, and it is what makes a relative path resolvable: `brief
   * briefs/pda.md` on a record of `orchestrator/lanes.olai` names a different
   * file from the same words on a record at the root, exactly as a `doc` field
   * and a relative picture already do (`@olai/format`'s `docOf`). A default
   * would be this component guessing at the one fact only its caller has.
   */
  readonly from: string
  /**
   * Write one property. ABSENT is read-only — no key is a button, no value is,
   * and there is no `+` — which is the rule `../NodeBody.tsx`'s `onEdit`
   * already follows: a day page and the agenda draw a node they do not offer to
   * change, and a document's frontmatter is edited by editing the file.
   */
  readonly onSet?: SetProp
  /**
   * The caller is asking for the ADD editor, open, now — the `•••` menu's one
   * surviving property entry, which a node with no chips needs because there is
   * no run for a `+` to sit at the end of (see the header).
   *
   * A fact rather than a callback so the menu, which is closed by the time
   * anything has been typed, does not have to hold the editor open itself; it
   * is answered with {@link PropsDrawer.onAddingEnd} when the editor closes,
   * however it closes.
   */
  readonly adding?: boolean
  readonly onAddingEnd?: () => void
}) {
  const names = useNames()
  const doors = useDoors()
  /**
   * WHAT THIS VALUE, UNDER THIS KEY, NAMES — the page's own answer, turned
   * into a door.
   *
   * THE KEY IS PART OF THE QUESTION now, which is the seam this whole change
   * is: `worktree` and `brief` hold path-shaped strings and mean different
   * things by them, and the vault is what says so ({@link ../doors.ts}). The
   * FILE is the third part and it is {@link PropsDrawer.from} — the same fact
   * that prop always carried, spent on a lookup instead of on arithmetic.
   */
  const doorOf = (key: string, value: string): Door | null => {
    const opens = doors()(props.from, key, value)
    return opens === undefined ? null : doorFor(opens, value, names())
  }

  /**
   * WHICH CHIP IS OPEN, and it is one per RUN rather than one per chip: opening
   * a second closes the first, which is what a person means by clicking
   * somewhere else. `undefined` is closed; `null` is the state a chip that has
   * no key yet is in, which a value inside `Editing` could not spell.
   *
   * Local to this component because a run is per node, which is exactly the
   * scope the answer has. It used to be a signal on the ROW, held there because
   * the panel it opened was the row's — and the panel is gone.
   */
  const [editing, setEditing] = createSignal<Editing | null | undefined>(undefined)
  /** Is the ADD chip open — this run's own answer, or the caller asking for one
   *  ({@link PropsDrawer.adding}). One reading, so the two doors cannot end up
   *  drawing two boxes. */
  const naming = () => editing() === null || props.adding === true
  /** What the last commit had to say, under the run — a refusal quoted verbatim
   *  or a nudge that rode back on a write that landed (`../writes.ts`). Six
   *  seconds, replaced by the next one, cleared by a commit with nothing to
   *  report (`../saying.ts`). */
  const saying = createSaying()
  /**
   * THE ENTRIES, CUT INTO WHAT DRAWS INLINE AND WHAT OWNS A ROW.
   *
   * `./blocks.ts` decides; this only draws what it is handed. The editor's own
   * key goes in so that a property being TYPED draws as a chip even where it
   * would otherwise be a block — one text box for every property in the vault,
   * which is what stops each new block renderer from growing its own.
   */
  const laid = createMemo(() => layOut(props.entries, editing()?.key))

  /** Shut whichever editor is open, from either door. */
  const close = (): void => {
    setEditing(undefined)
    props.onAddingEnd?.()
  }

  const commit = async (was: Editing | null, key: string, value: string): Promise<void> => {
    close()
    if (!writes(was, key, value)) {
      // Nothing to send, and nothing to say about it: this is a chip somebody
      // opened and left alone, which happens several times a minute.
      saying.say(null)
      return
    }
    const sent = sending(was, key, value)
    saying.say(await props.onSet?.(sent.key, sent.value, sent.was))
  }

  return (
    <>
      <Show when={laid().run.length > 0 || naming()}>
        {/* One line that wraps, not a grid. `items-baseline` because the keys are
            set in the mono face and the values are not, and two faces centred
            against each other sit on two baselines. */}
        <div
          class="mt-0.5 mb-1 flex flex-wrap items-baseline gap-1 text-[0.8125rem] leading-snug"
          data-testid={TESTID.props}
        >
        {/* `<Key>`, not `<For>`, for the reason the tree uses it
            (`../Tree.tsx`): `customEntries` mints fresh entries from a node
            that is itself a fresh object per frame on a ROW, so drawn by
            reference every chip of every row would be rebuilt on every frame
            of the page. Keyed by {@link keyOf}, which is where the one thing
            that could collide is answered. */}
        <Key each={laid().run} by={keyOf}>
          {(entry) => (
            <Chip
              entry={entry()}
              doorOf={doorOf}
              // A chip is open when the editor is open ON IT — asked by the
              // chip's own identity ({@link keyOf}) rather than by its bare
              // key, which is the collision that identity exists to prevent
              // (`./editor.ts`'s `openedOn`).
              open={openedOn(editing(), entry())}
              onOpen={props.onSet === undefined
                ? undefined
                : () => setEditing({ key: entry().key, value: entry().value })}
              // WHAT IT WAS is the SNAPSHOT the editor opened on, handed back by
              // the chip — never the live entry. See {@link Chip.onCommit}.
              onCommit={(was, value) => void commit(was, "", value)}
              onCancel={close}
            />
          )}
        </Key>
        <Show when={naming()}>
          <NewChip
            onCommit={(key, value) => void commit(null, key, value)}
            onCancel={close}
          />
        </Show>
        {/* The `+`, at the end of the run and only where there IS one: a node
            with no chips is offered `Add property…` in its `•••` instead, for
            the reason the header gives. Hidden while the add chip is open,
            because two ways to open one box is one of them doing nothing. */}
        <Show when={props.onSet !== undefined && laid().run.length > 0 && !naming()}>
          <button
            type="button"
            class={`${CHIP} cursor-pointer items-baseline rounded-full text-muted hover:text-accent`}
            data-testid={TESTID.propAdd}
            title="add a property"
            aria-label="add a property"
            onClick={(event) => {
              event.stopPropagation()
              setEditing(null)
            }}
          >
            +
          </button>
        </Show>
        </div>
      </Show>
      {/* THE BLOCKS, under the run and in the file's own key order.
          A property whose renderer OWNS ITS ROW draws here rather than in the
          line above — `./blocks.ts` decides which, and this knows nothing about
          any of them, which is the point: the drawer stopped asking "is this
          the terminal key?" and started asking "does this property have a
          block?". A block's own state (a pane it opens, a thing it expands)
          belongs to the block, because a block already owns the width a chip
          never had. Outside the run's `<Show>` for the said line's reason
          below: a run can be empty of chips and still have blocks in it. */}
      <For each={laid().blocks}>
        {(laid) =>
          laid.block({
            entry: laid.entry,
            onOpen: props.onSet === undefined
              ? undefined
              : () => setEditing({ key: laid.entry.key, value: laid.entry.value }),
            chrome: BLOCK_CHROME,
          })}
      </For>
      {/* THE ANSWER OUTLIVES THE RUN. The line hangs off the drawer's own
          component rather than beside the chips, because one answer needs
          exactly that: a chip whose key was dropped under its open, typed
          editor commits at the gate with its snapshot as `was`, and the
          refusal is the EXPECTED outcome of that gesture (Opus's NIT 2 on
          #401) — where it used to land, inside the run's own `<Show>`, it
          was written into a line that had just gone with the key. The row
          outlives both, and so does this. */}
      <Show when={saying.said()}>
        {(said) => (
          <SaidLine
            said={said()}
            class="mb-1 font-mono text-xs"
            testid={TESTID.propSaid}
          />
        )}
      </Show>
    </>
  )
}

/** What the system half is asked instead of the table — see the header. Takes
 *  the same pair the real lookup does so the two are one type at the call
 *  site, and reads neither. */
const NO_DOOR = (_key: string, _value: string): null => null

/** The box one fact sits in. A pill for the ordinary chip; the corners are
 *  eased off when it has a fold in it, because a disclosure opening inside a
 *  `rounded-full` box has its body pinched at both ends. */
const CHIP = "inline-flex min-w-0 max-w-full gap-1.5 border border-rule bg-panel px-2 py-px"

function Chip(props: {
  readonly entry: Entry
  readonly doorOf: (key: string, value: string) => Door | null
  /** What this chip is being edited AS, or `undefined` when it is not. */
  readonly open?: Editing
  /** Open it. ABSENT wherever the run is read-only, and then no half of this
   *  chip is a button. */
  readonly onOpen?: () => void
  /**
   * Commit what was typed — handed back with the SNAPSHOT the editor opened on.
   *
   * The snapshot rather than the live entry, and it is the difference between
   * refusing and clobbering. `writes` asks whether the box differs from what
   * was opened (`./editor.ts`); asked against the LIVE value instead, a chip
   * opened on `A` while an agent writes `B` reports a change the person never
   * made, and clicking away puts `A` back — silently, against this file's own
   * promise that opening a chip and clicking away writes nothing. The snapshot
   * is the one the chip is already drawn from, so it is handed back from here
   * rather than rebuilt at the call site.
   */
  readonly onCommit: (was: Editing, value: string) => void
  readonly onCancel: () => void
}) {
  /**
   * WHAT EACH MEMBER OF THIS VALUE NAMES — asked once, because two questions
   * depend on it: what the value is DRAWN as, and whether it folds at all.
   *
   * The system half is asked `NO_DOOR` here rather than at the draw, so that
   * "a system chip has no doors" and "a system chip folds like prose" are one
   * decision and cannot come apart.
   */
  const doors = createMemo(() => {
    const ask = props.entry.system ? NO_DOOR : props.doorOf
    return props.entry.values.map((one) => ask(props.entry.key, one))
  })
  /**
   * Does this value fold?
   *
   * LENGTH IS NOT THE WHOLE RULE, and it never should have been. The fold is
   * for PROSE — a value that broke the props-are-short-facts rule — and the
   * defence in {@link FOLDS_PAST} ("a value this long is prose whatever is
   * inside it") is true of sentences and false of the two door kinds most
   * likely to run past 56 characters: a URL and a deep vault path. A value that
   * NAMES something is one token however long it is, and folding it took away
   * the link the door rule had just given it (both reviewers, 2026-08-24).
   *
   * So a value with a door never folds. What it does instead is CLAMP — one
   * line, ellipsized, still a link, the whole of it in the pointer's tooltip
   * ({@link Face}). That is the display folded and the link kept.
   */
  const folds = () =>
    props.entry.value.length > FOLDS_PAST && doors().every((one) => one === null)
  /**
   * WHICH CHIPS OPEN FOR EDITING: every custom one, lists included.
   *
   * A LIST used to be excluded here, on the argument that the editor writes
   * text so a key holding three values would come back as one string with
   * commas in it. That argument covers TYPING OVER one and does not cover
   * CLEARING one — and clearing is exact whatever the key held, which is why
   * the deleted menu offered `Remove <key>` on a list and no `Edit <key>…`.
   * Excluding the chip took the removal with the edit and left `./drawer.ts`
   * saying removal was still offered when it was not (pi, S3).
   *
   * What makes typing over one safe to offer is the no-change guard: the box is
   * seeded with the joined members, and committing it UNCHANGED writes nothing
   * (`./editor.ts`'s `writes`), so a list cannot be flattened by opening a chip
   * and pressing Enter. Flattening now takes deliberately typing over it — and
   * that is an ordinary `set_prop`, which replaces one key's value outright.
   *
   * The SYSTEM half stays out: those are fields with verbs of their own.
   */
  const opens = () => (props.entry.system ? undefined : props.onOpen)
  return (
    <span
      class={CHIP}
      classList={{
        "items-baseline rounded-full": !folds(),
        "items-start rounded-lg": folds(),
      }}
      data-testid={TESTID.prop}
      data-key={props.entry.key}
      data-system={props.entry.system ? "true" : undefined}
    >
      <Handle label={props.entry.key} onOpen={opens()} />
      <Show
        when={props.open}
        fallback={
          <Show
            when={folds()}
            fallback={
              <span class="min-w-0 break-words text-ink" data-testid={TESTID.propValue}>
                <Values
                  values={props.entry.values}
                  doors={doors()}
                  onOpen={opens()}
                />
              </span>
            }
          >
            <Folded value={props.entry.value} />
          </Show>
        }
      >
        {(was) => {
          // READ ONCE, AT THE DRAW, and held — never called back from the
          // commit. It is the right value either way (an open editor's snapshot
          // does not move), and reading the `<Show>` accessor from a handler
          // that fires as the box goes is reading it after this branch has
          // unmounted, which Solid reports as a stale-value error — a blur IS
          // that moment, since committing is what closes the editor.
          const snapshot = was()
          /** ONE OPEN'S ANSWER — minted beside the box, recorded at the two
           *  gestures that CLOSE it (and by the one that then commits, BEFORE
           *  the close: the close is what fires the blur this answers). Never
           *  inside the box's own key handling — `Box`'s `closedBy` argues why.
           *  The `<Show>`'s dispose is the reset: the next open mints `null`.
           *  (`./editor.ts`'s `ClosedBy` states the born-with-the-open law.)
           */
          let answeredBy: ClosedBy = null
          return (
            <Box
              testid={TESTID.propEdit}
              about={props.entry.key}
              value={snapshot.value}
              wide
              focus
              closedBy={() => answeredBy}
              // The snapshot this chip was opened on, which is what the box is
              // drawn from — so what goes back is what a commit has to be
              // judged against. See {@link Chip.onCommit}.
              onCommit={(value) => {
                answeredBy = "enter"
                props.onCommit(snapshot, value)
              }}
              onLeave={(value) => props.onCommit(snapshot, value)}
              onCancel={() => {
                answeredBy = "escape"
                props.onCancel()
              }}
            />
          )
        }}
      </Show>
    </span>
  )
}

/** The KEY half, which is the handle — a button where the run may be written
 *  and the label it always was where it may not. One element either way as far
 *  as the eye is concerned; what differs is whether it answers a press. */

/**
 * The members of a value, comma-separated, each asked the door question on its
 * own — one element for the ordinary value, which is text.
 *
 * The comma rides BETWEEN members rather than after each: unlike the run's old
 * dot it sits inside one chip and cannot start a line.
 *
 * `<Index>` rather than `<Key>` because these are STRINGS and a list may hold
 * the same one twice (`{"reviewer":["pi","pi"]}` is a badly written record, not
 * an impossible one) — one value handed to a keyed helper twice is a crash
 * rather than a wrong draw. Position is the honest identity for a list whose
 * members are its content.
 */
function Values(props: {
  readonly values: ReadonlyArray<string>
  /** What each member names, in the same order — asked ONCE by the chip, which
   *  needs the same answer to decide whether the value folds at all. */
  readonly doors: ReadonlyArray<Door | null>
  readonly onOpen?: () => void
}) {
  return (
    <Index each={props.values}>
      {(value, index) => (
        <>
          <Show when={index > 0}>
            <span class="text-muted" aria-hidden="true">, </span>
          </Show>
          <Value
            value={value()}
            door={props.doors[index] ?? null}
            onOpen={props.onOpen}
          />
        </>
      )}
    </Index>
  )
}

/** One member: a door, or the text it always was — which, where the run may be
 *  written, is a second way into the editor. See the header's one rule: a link
 *  goes where it says, everything else in a chip opens it. */
function Value(props: {
  readonly value: string
  readonly door: Door | null
  readonly onOpen?: () => void
}) {
  /** WHAT THE POINTER IS OWED, which is whichever half the face is not: these
   *  words where the face IS the record's value (every door but one), and what
   *  the door SAYS where it is not — the stored id under a ref chip's title. */
  const says = (door: Door): string | undefined =>
    door.face === props.value ? undefined : door.says
  return (
    <Show when={props.door} fallback={<Plain value={props.value} onOpen={props.onOpen} />}>
      {(door) => (
        // WHAT THIS VALUE TURNED OUT TO NAME, stated in both directions and on
        // the value rather than on the chip: `data-door` is present exactly
        // where there is a door, so a scenario asserts a link without reading a
        // colour, and its ABSENCE is what says a value stayed text.
        <span data-door={door().kind}>
          <Show
            when={awayFrom(door())}
            fallback={
              <Link route={inApp(door())} class={LINKED} title={door().says}>
                {/* THE DOOR'S FACE and not the raw value, which is the whole
                    of the ref-chip half of this change: `agent grok` reads
                    `agent Grok`, because the vault declared the key a
                    reference and a reference's name is not its identity. Every
                    other door's face IS the value, so this is one field read
                    in one place rather than a branch here (`./door.ts`). */}
                <Face
                  value={door().face}
                  day={door().kind === "day"}
                  says={says(door())}
                />
              </Link>
            }
          >
            {(href) => (
              // A link out of the app opens a tab of its own, under the pair a
              // note's own external links take (`../markdown/rewrite.ts`'s
              // `openExternal`): `noopener` so the new tab cannot reach back at
              // this one, `noreferrer` because where somebody's vault points is
              // not this page's to announce to the far end.
              <a
                class={LINKED}
                href={href()}
                target="_blank"
                rel="noopener noreferrer"
                title={door().says}
                onClick={(event) => event.stopPropagation()}
              >
                <Face value={door().face} day={false} says={says(door())} />
              </a>
            )}
          </Show>
        </span>
      )}
    </Show>
  )
}

/** A value that names nothing. Text where the run is read-only, and the second
 *  door into the editor where it is not — the header's rule, and the reason it
 *  is a `<button>` rather than a click handler on a span: what answers a press
 *  answers a key too, and a reader on a keyboard reaches a chip the same way. */
function Plain(props: { readonly value: string; readonly onOpen?: () => void }) {
  return (
    <Show when={props.onOpen} fallback={<>{props.value}</>}>
      {(open) => (
        <button
          type="button"
          class="cursor-text text-left hover:text-accent"
          title="change this"
          onClick={(event) => {
            event.stopPropagation()
            open()()
          }}
        >
          {props.value}
        </button>
      )}
    </Show>
  )
}

/** The words themselves, in the date badge where the value is a date and bare
 *  everywhere else — the pill's own box (`../Pill.tsx`) in the tone a date that
 *  is nobody's deadline takes. */
function Face(props: {
  readonly value: string
  readonly day: boolean
  /** What the pointer is told about these words — see {@link Clamped}. The
   *  words themselves for every face that IS the record's value, which is all
   *  of them but one. */
  readonly says?: string
}) {
  return (
    <Show when={props.day} fallback={<Clamped value={props.value} says={props.says} />}>
      <span class="rounded-full bg-pill px-1.5">{props.value}</span>
    </Show>
  )
}

/**
 * A DOOR'S TEXT, on one line, ellipsized where it runs long — the display
 * folded while the link stays whole.
 *
 * A URL and a deep vault path are the two door kinds most likely to run past
 * {@link FOLDS_PAST}, and they used to be swallowed by the disclosure fold and
 * lose their link (both reviewers, 2026-08-24). They are not prose: a name is
 * one token however long it is, so what a long one wants is to be shorter ON
 * SCREEN, not to be behind a press.
 *
 * CSS rather than {@link shortened}, and that is the point of doing it here: an
 * ellipsis put in by the browser is still the whole string in the DOM, so the
 * href, the copy, the tooltip and a scenario's `innerText` all read the words
 * the chip is drawing. Cutting the text would have made the chip say something
 * the file does not.
 *
 * THE TOOLTIP IS THESE WORDS unless somebody says otherwise, and the one caller
 * that does is the ref chip: its face is the target's TITLE, so what a pointer
 * is owed is the id the file actually holds ({@link Value}). It is said HERE
 * rather than on the anchor above because a `title` on an inner element wins —
 * the anchor's has never been what a clamped face shows.
 *
 * `align-bottom` because an `inline-block` in a baseline row otherwise sits its
 * own descender below the key beside it.
 */
function Clamped(props: { readonly value: string; readonly says?: string }) {
  return (
    <span
      class="inline-block max-w-[22rem] truncate align-bottom"
      title={props.says ?? props.value}
    >
      {props.value}
    </span>
  )
}

/** A value too long to be a fact: its first words, and the rest one press away.
 *  Prose only — a value that NAMES something never reaches here, because a name
 *  is one token however long and gets {@link Clamped} instead (`Chip`'s
 *  `folds`). The KEY is the way in to editing it, which is exactly why the key
 *  is the gesture that never has an exception; the summary itself is the
 *  disclosure and nothing else, which is why it takes no `onOpen`. */
function Folded(props: { readonly value: string }) {
  const summary = createMemo(() => shortened(props.value))
  return (
    <details class="min-w-0" data-testid={TESTID.propFold}>
      <summary
        class="cursor-pointer list-none break-words text-ink marker:content-none"
        // The row's own line answers a click by opening the title editor, and
        // this one is about the value under the pointer.
        onClick={(event) => event.stopPropagation()}
      >
        <span data-testid={TESTID.propValue}>{summary()}</span>
        <span class="ml-1 text-muted" aria-hidden="true">▾</span>
      </summary>
      <div class="mt-1 break-words text-ink">{props.value}</div>
    </details>
  )
}

/**
 * A property being ADDED: the only place a key is ever typed, drawn as the chip
 * it is about to become — two boxes in a pill, so what is being made looks like
 * what it will be.
 *
 * ENTER IN THE KEY BOX MOVES TO THE VALUE rather than committing, because a key
 * with nothing behind it is not a property (`./editor.ts`: it would be the
 * removal of a key that is not there, the one thing `set_prop` refuses about
 * removals). Tab does the same by the browser's own doing; Enter is spelled
 * because a person typing a fact does not reach for Tab.
 *
 * LEAVING commits, and the leaving is asked of the CHIP rather than of either
 * box — moving from the key to the value is not leaving, and a per-box blur
 * would read it as one and commit half a property.
 */
function NewChip(props: {
  readonly onCommit: (key: string, value: string) => void
  readonly onCancel: () => void
}) {
  const [key, setKey] = createSignal("")
  const [value, setValue] = createSignal("")
  let box: HTMLInputElement | undefined
  /** The chip's own answer to the one law every box here answers to
   *  (`./editor.ts`'s `leavingCommits`): Escape abandons and the value box's
   *  Enter commits, and BOTH close the chip — the focus-out the close fires
   *  must not then send the same property a second time. One gesture, one
   *  outcome. */
  let answeredBy: ClosedBy = null
  const cancel = (): void => {
    answeredBy = "escape"
    props.onCancel()
  }
  return (
    <span
      class={`${CHIP} items-baseline rounded-full`}
      onFocusOut={(event) => {
        // Still inside this chip — the caret moving from the key to the value —
        // is not leaving it.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        if (!leavingCommits(answeredBy)) return
        props.onCommit(key(), value())
      }}
    >
      <Box
        testid={TESTID.propEditKey}
        value=""
        placeholder="key"
        focus
        mono
        onInput={setKey}
        onCommit={() => box?.focus()}
        onCancel={cancel}
      />
      <Box
        testid={TESTID.propEdit}
        value=""
        placeholder="value"
        wide
        ref={(element) => (box = element)}
        onInput={setValue}
        // The value box's Enter is the whole chip answered — its commit closes
        // the chip, and the close owns what the focus-out then has to hear.
        onCommit={(typed) => {
          answeredBy = "enter"
          props.onCommit(key(), typed)
        }}
        onCancel={cancel}
      />
    </span>
  )
}

/**
 * ONE BOX — the styled input every editor here is made of, and the two keys
 * every one of them answers the same way: Enter is the commit, Escape is the
 * way out that writes nothing.
 *
 * BOTH KEYS STOP. The row's own handling reads Escape as "fold this row" and
 * Enter as "make a sibling", and a gesture inside a box must not also be a
 * gesture at the row it is drawn on.
 *
 * ONE GESTURE, ONE OUTCOME: Enter commits and Escape abandons, and both close
 * the box — and closing RE-TAKES the caret, which the browser answers by
 * firing the blur at the very gesture whose close this was. That blur stands
 * down, asked through `./editor.ts`'s `leavingCommits` of the record the
 * CLOSER minted ({@link Box.closedBy}) — never a record the box mints for
 * itself, because a box cannot know whether its `onCommit` closes it: the
 * commit owns the close, or there is no commit — never both, and never twice.
 *
 * WHAT LEAVING MEANS is the CALLER's, and it is the one thing the two editors
 * genuinely differ about: a chip being changed leaves one box, so `onBlur` is
 * enough; a chip being ADDED has two, and the caret moving between them is not
 * leaving — so that one asks the chip instead ({@link NewChip}).
 */
function Box(props: {
  readonly testid: string
  readonly about?: string
  readonly value: string
  readonly placeholder?: string
  /** Take the caret when it is drawn — the box a gesture was aimed at. */
  readonly focus?: boolean
  /** The KEY box, which is set in the face a key is set in. */
  readonly mono?: boolean
  /** The VALUE box, which takes what room the chip has. */
  readonly wide?: boolean
  readonly ref?: (element: HTMLInputElement) => void
  readonly onInput?: (value: string) => void
  readonly onCommit: (value: string) => void
  readonly onCancel: () => void
  /** Leaving this box alone commits it — the single-box editor's rule. Absent
   *  where the chip answers for its boxes together. */
  readonly onLeave?: (value: string) => void
  /** WHICH GESTURE CLOSED THIS OPEN, read at the blur — the CALLER's record,
   *  minted beside the box by the one who closes it (`Chip`'s editor
   *  closure). Never recorded by the box itself: a half-blind `onCommit`
   *  wrapper is the difference between the chip's value box (its Enter
   *  closes) and the add chip's KEY box, whose Enter only moves the caret —
   *  and a record THIS component minted would stand that key box down from
   *  its first Enter forever. ABSENT leaves the blur armed, which is the add
   *  chip's boxes' correct answer: their leaving is asked at the chip, whose
   *  own record the focus-out consults. */
  readonly closedBy?: () => ClosedBy
}) {
  const [held, setHeld] = createSignal(props.value)
  return (
    <input
      type="text"
      class={`${TARGET} md:min-h-0 min-w-0 rounded border border-rule bg-paper px-1 py-0 text-ink`}
      classList={{
        "font-mono text-[0.6875rem] w-16": props.mono === true,
        // `min-w-*` beside the `flex-1`, and it is load-bearing rather than
        // taste: `flex: 1 1 0%` in a SHRINK-TO-FIT box (the chip is an
        // `inline-flex`) resolves to no width at all when the box is empty,
        // because there is no content for the chip to size itself around. An
        // add chip on a 390pt screen drew a key box and a value box nobody
        // could see or type in.
        "flex-1 min-w-28 text-[0.8125rem]": props.wide === true,
      }}
      data-testid={props.testid}
      data-key={props.about}
      placeholder={props.placeholder}
      autocomplete="off"
      spellcheck={false}
      value={props.value}
      ref={(element) => {
        props.ref?.(element)
        // A MACROTASK, and not the `queueMicrotask` every other mount-focus in
        // this client uses (`../menu/Dropdown.tsx`, `../popover.ts`). The
        // difference is who else is reaching for the caret: this editor can be
        // opened FROM THE `•••` MENU, and Kobalte moves focus onto the item
        // that was pressed as that menu closes — after our microtask, so a
        // microtask focus won the race and was taken away one beat later. The
        // chip then saw a focus-out it never asked for. Deferring past the
        // whole microtask queue puts our focus last, which is where the caret
        // should end up: on the box the gesture opened.
        setTimeout(() => {
          if (props.focus === true) {
            element.focus()
            element.select()
          }
        }, 0)
      }}
      onClick={(event) => event.stopPropagation()}
      onInput={(event) => {
        setHeld(event.currentTarget.value)
        props.onInput?.(event.currentTarget.value)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          event.stopPropagation()
          props.onCommit(held())
          return
        }
        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          props.onCancel()
        }
      }}
      onBlur={() => {
        if (!leavingCommits(props.closedBy?.() ?? null)) return
        props.onLeave?.(held())
      }}
    />
  )
}

/** The one class a door wears: dim like everything beside it, the accent under
 *  the pointer — the tags' own rule one line down (`../styles.css`). It used to
 *  be accent ink on sight, which on a node carrying a `pr` made the URL the
 *  loudest thing on the row. */
const LINKED =
  "underline decoration-rule underline-offset-2 hover:text-accent hover:decoration-current"

/** The href of a door that leaves the app, or `undefined` for one that does
 *  not — the narrowing written as a value, so the branch that draws an `<a>`
 *  and the branch that draws a `<Link>` are told apart by the type rather than
 *  by a repeated comparison. */
const awayFrom = (door: Door): string | undefined =>
  door.kind === "away" ? door.href : undefined

/** ...and its other half: where an in-app door goes. The `away` arm is drawn by
 *  the branch above and cannot reach here, which is asserted by a throw rather
 *  than hidden behind a fallback route that would silently open the front
 *  page. */
const inApp = (door: Door) => {
  if (door.kind === "away") throw new Error("an external door asked for an app route")
  return door.route
}

/** The first whole words of a long value, up to {@link SUMMARISED_AT} — cut at
 *  a space so a fold never opens on half a word, and cut hard when the value
 *  has no space near the end at all, which is a path or a hash rather than
 *  prose. */
const shortened = (value: string): string => {
  if (value.length <= SUMMARISED_AT) return value
  const cut = value.slice(0, SUMMARISED_AT)
  const space = cut.lastIndexOf(" ")
  return `${space > SUMMARISED_AT / 2 ? cut.slice(0, space) : cut}…`
}

/**
 * WHAT IDENTIFIES A CHIP, for the key above.
 *
 * The NAMESPACE and then the key, because `custom` is open all the way
 * (`@olai/format`'s custom.ts): nothing stops a node from carrying a custom
 * `date`, and on a page drawing both halves that would be one key over two
 * chips — one element handed to the framework twice, which is a crash rather
 * than a wrong draw (`../edges/named.ts` argues it where it first bit). Within
 * each half the keys are a map's own and unique by construction.
 */
const keyOf = (entry: Entry): string =>
  `${entry.system ? "system" : "custom"}:${entry.key}`
