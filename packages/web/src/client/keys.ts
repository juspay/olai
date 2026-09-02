/**
 * The keyboard map: every key this app answers, decided in one file.
 *
 * It arrived as `palette/keys.ts` with the panel rework (#104), holding the
 * three reserved chords, and it moved up here when keyboard editing needed
 * keys of its own. One registry rather than two matchers in two components is
 * the whole point: a chord and an editing key that both claim `Ctrl+Enter`
 * disagree silently, in a browser, at the moment somebody is typing — and the
 * only place that disagreement is visible is a file that declares them all.
 *
 * FOUR LAYERS, and no two of them are ever live over the same keystroke,
 * which is what makes them safe together:
 *
 *   - {@link matchKey} is the GLOBAL layer — chords with a modifier, listened
 *     for on the window (`palette/Palette.tsx` owns the one listener), and
 *     each says whether it may fire while focus is in a text field.
 *   - {@link editKey} is the ROW layer — the Workflowy keys, matched on the
 *     editor's own element and nowhere else. They are bare keys (`Enter`,
 *     `Tab`, the arrows), so a global listener claiming them would eat every
 *     keystroke in the chat composer and in the palette's own input. An
 *     editor's keys belong to the editor.
 *   - {@link selectKey} is the SELECTION layer — the same bare keys, meaning
 *     the same things, over the rows a multi-select has picked instead of over
 *     the row a caret is in (`select/selection.ts` owns that listener, and it
 *     is the page's). It is live only while something is picked, and picking
 *     rows puts the caret away — so `Tab` has exactly one meaning at any
 *     moment, which is the reason the two layers can share a key rather than
 *     needing a second grammar for bulk.
 *   - {@link listKey} is the LIST layer — what those same bare keys mean while
 *     a SHORTLIST is up over whatever has the caret. Asked FIRST by whoever has
 *     one and only while one is on screen, so a key a person cannot see the
 *     effect of goes on meaning what it always meant. Four surfaces have one,
 *     and each matched these keys privately before this existed.
 *
 * Pure of the DOM beyond the event itself, so all four layers are
 * unit-testable with no window: pass `platform` to pin Apple vs not.
 */

export type KeyAction =
  | "palette"
  | "sidebar"
  | "chat"
  | "undo"
  | "redo"
  | "closePane"
  | "pin"

export interface KeyMatch {
  readonly action: KeyAction
  /** Whether this binding may fire while focus is in an input/textarea. */
  readonly whileEditing: boolean
}

/** Apple platforms where Meta is the primary modifier and Ctrl+K is readline. */
export const isApplePlatform = (
  platform: string = typeof navigator !== "undefined" ? navigator.platform : "",
): boolean => /Mac|iPhone|iPad|iPod/i.test(platform)

const wantsMeta = (): boolean => isApplePlatform()

/**
 * The reserved chords, as a table.
 *
 *   ⌘K / Ctrl+K   — command palette
 *   ⌘\ / Ctrl+\   — toggle sidebar
 *   ⌘J / Ctrl+J   — toggle chat
 *   ⌘Z / Ctrl+Z   — undo the last edit this tab made
 *   ⌘⇧Z / Ctrl+⇧Z — redo it
 *   ⌘⇧P / Ctrl+⇧P — pin the page to the sidebar, or unpin it (a NARROWED page
 *     is asked what to call it first — `pins/naming.ts`)
 *
 * ⌘J / Ctrl+J and Ctrl+K shadow browser chrome defaults (downloads / search
 * bar) — deliberate, so keyboard editing could not claim those combos later,
 * and it has not.
 *
 * ⌘Z is the one chord with a SHIFTED twin, which is why `shift` is a field
 * rather than a blanket "no shift" test in the matcher: undo and redo are one
 * key and a modifier everywhere a person has ever pressed them, and spelling
 * redo as a different letter to keep the matcher simple would be this app
 * inventing a keyboard. Both are `whileEditing: false` — a draft has the
 * platform's own undo in it (an `<input>` brings its own, which is half the
 * argument for the input in `edit/RowEditor.tsx`), and abandoning a draft is
 * Escape's. So the row editor never sees these, and the stack never contains
 * half a typed line.
 *
 * That is a rule about the CARET, and not about text: once a draft has
 * committed, what it produced is an op like any other and ⌘Z takes it back
 * with the row's own text. Reading these two as one thing is what shipped an
 * undo that answered "nothing to undo" to somebody who had just retyped a
 * title (human, 2026-08-12).
 *
 * A table rather than a chain of `if`s because the collision test below reads
 * it: the one invariant this file exists for is checked against THIS list, so
 * a fifth chord is covered by being added rather than by somebody remembering
 * to add it twice.
 */
export const CHORDS: ReadonlyArray<
  KeyMatch & { readonly key: string; readonly shift?: boolean }
> = [
  { key: "k", action: "palette", whileEditing: true },
  { key: "\\", action: "sidebar", whileEditing: false },
  { key: "j", action: "chat", whileEditing: false },
  { key: "z", action: "undo", whileEditing: false },
  { key: "z", action: "redo", whileEditing: false, shift: true },
  // ⌘⇧P / Ctrl+⇧P — put the page on the shelf, or take it off (`pins/`). With
  // Shift rather than bare, because bare ⌘P is Print and always will be.
  //
  // `whileEditing: true`, and the FILTER BOX is the whole argument: "pin this
  // page, narrowed like this" is a thing a reader means the moment they have
  // finished typing the query, and a chord that went dead in the box would be
  // dead at exactly the moment the gesture is wanted. It claims nothing a text
  // field means — unlike ⌘Z, which a draft has its own answer for — and what
  // it writes is about the PAGE rather than about whatever the caret is in, so
  // a row being typed is left where it is.
  { key: "p", action: "pin", whileEditing: true, shift: true },
  // The browser owns bare ⌘W / Ctrl+W (close the tab). This is the
  // equivalent we can actually receive: the same letter, with Shift, so
  // a pane is not a tab. The close button and the palette row are the
  // pointer faces of the same verb.
  { key: "w", action: "closePane", whileEditing: true, shift: true },
]

/**
 * Which reserved action a keydown is, or `null` if none.
 *
 * Platform: Meta on Apple (where Ctrl+K is kill-to-end-of-line in text
 * fields), Control elsewhere. Accepting both on every platform was wrong for
 * the palette's whileEditing binding.
 *
 * Shift is matched EXACTLY — a chord that does not ask for it is dead with it
 * held — so ⌘Z and ⌘⇧Z are two entries rather than one entry and a caller that
 * reads the event again.
 */
export const matchKey = (
  event: KeyboardEvent,
  platform?: string,
): KeyMatch | null => {
  const apple = platform !== undefined ? isApplePlatform(platform) : wantsMeta()
  const mod = apple
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
  if (!mod || event.altKey) return null
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  return CHORDS.find(
    (chord) => chord.key === key && (chord.shift ?? false) === event.shiftKey,
  ) ?? null
}

/** Is the event target (or its composed path) an editable field? */
export const isEditingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  const el =
    target.closest("input, textarea, select, [contenteditable=true]") ??
    (target instanceof HTMLElement && target.isContentEditable ? target : null)
  return el !== null
}

// ── the row layer ──────────────────────────────────────────────────────

/**
 * What a key does inside a row's editor. Workflowy's set, minus everything
 * deferred to its own roadmap item — there is no delete and no multi-select
 * here, so no key spells one.
 *
 *   - `add` — `Enter`: commit what is typed and open the next row's editor.
 *   - `split` — `Enter` again, with text on BOTH sides of the caret: the row
 *     becomes two. One key with two readings and deliberately not a mode: what
 *     decides is where the caret is in the sentence the person is looking at,
 *     which is how every outliner behaves and what Workflowy trained the hands
 *     that will press it. The caret is a fact about the FIELD rather than about
 *     the event, so it arrives as {@link Caret} — which is also what keeps this
 *     matcher testable with no DOM.
 *   - `merge` — `Backspace` at offset zero with nothing selected: the row joins
 *     the one above it. The one position where `Backspace` has nothing of its
 *     own to delete, which is why it is safe to claim there and nowhere else.
 *   - `in` / `out` — `Tab` / `Shift+Tab`.
 *   - `up` / `down` — `Alt+Shift+↑/↓`, moving among siblings. The four names
 *     are the surface's own `move` verbs, spelled once
 *     ({@link ../../../surface/src/edit.ts}).
 *   - `toggle` — `Ctrl+Enter` (and `⌘+Enter`, which is what Workflowy trains
 *     an Apple reader's hands to reach for; neither collides with the three
 *     reserved chords above, none of which is `Enter`).
 *   - `cancel-mark` — `Alt+Enter` (`⌥Enter`): call this row OFF, or take that
 *     back. The THIRD member of the `Enter` family and the fourth mark's own
 *     door: `Enter` is the row's key and a modifier says which kind of change
 *     it is, so Ctrl finishes, Ctrl+Shift walks, and Alt cancels. It is a
 *     TOGGLE like `Ctrl+Enter` rather than a stop on the walk, and for the
 *     walk's own reason ({@link ../../../server/src/edit.ts} holds the ring and
 *     the argument): `cancelled` stamps an instant and puts the row on a day's
 *     journal page, and neither is a thing to do on the way to somewhere else.
 *     Alt was free on this key — the branch below already refused
 *     `Alt+Enter` outright — and it is the one modifier `Shift+Enter` names as
 *     something it must not see, so the note key is untouched. `Alt+Shift` is
 *     deliberately NOT it: that pair is the app's MOVE modifier on the arrows,
 *     and a chord meaning "move this row" two keys over may not also mean
 *     "call it off". Dead in a note, like the two mark keys it joins.
 *   - `walk` — `Ctrl+Shift+Enter` (`⌘⇧Enter`): the MARK WALK, which is how a
 *     person writes the other two marks and takes one off. `Enter` is the row's
 *     key and a modifier says which kind of change it is, so the mark keys are
 *     one chord apart — and SHIFT is already this app's "the same key, one step
 *     further" (`Shift+Tab` against `Tab`, `⌘⇧Z` against `⌘Z`). Which answer a
 *     step lands on is the server's, over the mark the node actually carries
 *     ({@link ../../../server/src/edit.ts} holds the ring, and the argument for
 *     `done` not being on it).
 *   - `duplicate` — `⌘⇧D` / `Ctrl+⇧D`: copy this row and everything under it,
 *     as the sibling below. Workflowy's own chord for the same verb, and the
 *     SHIFT is what keeps it: bare `⌘D` is the bookmark key in every browser
 *     this app is read in, and a duplicate is not worth stealing it. Dead in a
 *     note, like the mark keys, and it has no twin on the selection layer —
 *     duplicating a PICK is a bulk verb, and this app puts those behind a
 *     button rather than a chord (below).
 *   - `moveTo` — `⌘⇧M` / `Ctrl+⇧M`: open the move-to picker on this row and
 *     search every outline for a new parent (`move/`). Workflowy's own chord
 *     for the same verb, and `duplicate`'s case one letter along in every
 *     other respect: SHIFT is required rather than tolerated, it is dead in a
 *     note, and it has no twin on the selection layer — carrying several rows
 *     somewhere is what the drag already does, with the pick it is holding.
 *     Unlike every other key here it WRITES NOTHING by itself: it opens a
 *     panel, and what lands is chosen in it.
 *   - `note` — `Shift+Enter`: open the note under the row, and close it again
 *     from inside.
 *   - `prev` / `next` — the bare arrows, moving the caret between rows. The
 *     title editor is ONE LINE, so ↑ and ↓ have nothing else they could mean
 *     there, which is why they need no caret-position test.
 *   - `cancel` — `Escape`: abandon the draft.
 *   - `selectUp` / `selectDown` — `Shift+↑/↓`: leave the caret and PICK rows,
 *     which is Workflowy's own gesture. A title editor is one line, so a
 *     shifted arrow has no text meaning in it to take away — the one thing it
 *     could otherwise do is select to the end of the line, which ⌘A already
 *     does in one press.
 *   - `selectAll` — the SECOND `⌘A` in a row: the first is the input's own
 *     select-all (the platform's, untouched), and once the whole line is
 *     already selected the chord means the row rather than its text. Like
 *     `split` and `merge`, it is a question about {@link Caret} — this file has
 *     no DOM, so where the caret is arrives as a value.
 */
export type EditAction =
  | "add"
  | "split"
  | "merge"
  | "in"
  | "out"
  | "up"
  | "down"
  | "toggle"
  | "cancel-mark"
  | "walk"
  | "duplicate"
  | "moveTo"
  | "note"
  | "prev"
  | "next"
  | "cancel"
  | "selectUp"
  | "selectDown"
  | "selectAll"

/**
 * Which field is being edited, because two of these keys mean different things
 * in a note than on a title.
 *
 *   - `line` — the title: one verbatim line, so `Enter` is "next row" and the
 *     arrows are "next row" too.
 *   - `block` — the note: prose, so `Enter` is a newline and the arrows move
 *     the caret. Only `Shift+Enter` (close it) and `Escape` (abandon it) are
 *     this layer's, and everything else is the textarea's own.
 */
export type EditField = "line" | "block"

/**
 * Where the caret is in the field the key was pressed in, and what that field
 * holds — the one thing about the DOM that two of these keys depend on.
 *
 * A VALUE rather than the element, so this file stays pure of the DOM beyond
 * the event and both matchers stay unit-testable with no window. A selection is
 * spelled by `start` and `end` differing, which is what makes "Backspace at the
 * start of a line" and "Backspace deleting a selection that begins at the start
 * of a line" two different answers rather than one.
 *
 * The TEXT rather than its length, because "is there a half here" is not "is
 * there a character here": a half that is nothing but spaces is a title this
 * format cannot hold, and the documented answer for a half it cannot hold is
 * that the key is an `add`. Reading the length alone made `"  hello"` split at
 * offset 2 into a refusal a person then had to read.
 */
export interface Caret {
  readonly start: number
  readonly end: number
  readonly text: string
}

export const editKey = (
  event: KeyboardEvent,
  field: EditField,
  /** Absent when the caller cannot say — and then the THREE caret-dependent
   *  readings are simply not reachable, which is the safe way round: `Enter`
   *  goes on opening the next line, `Backspace` stays the field's own, and
   *  `⌘A` stays the platform's. */
  at?: Caret,
): EditAction | null => {
  // Order matters: every branch below is a more specific reading of a key a
  // later branch also matches, and the modifiers are what tell them apart.
  if (event.key === "Escape") return "cancel"
  // The NOTE is `Shift+Enter` and nothing else on top of it — the bare pair.
  // Adding Ctrl or Meta makes it the mark walk, one branch down, which is why
  // this test names the two modifiers it must not see rather than letting an
  // earlier match swallow the chord. Both mark keys then live in the one
  // `Enter`-with-a-modifier branch, where they are legible as the pair they
  // are, and both are dead in a note for the reason everything below is: a
  // note is prose, and the keys that edit a ROW are the row's.
  if (
    event.key === "Enter" && event.shiftKey && !event.altKey && !event.ctrlKey &&
    !event.metaKey
  ) return "note"
  if (field === "block") return null

  // ⌘⇧D / Ctrl+⇧D — FIRST of the line-only readings, and outside the chain of
  // them: every branch below is a more specific reading of a key a later branch
  // also matches, and this one shares its key with nothing. The letter IS
  // claimed one modifier down, though, which is why Shift is required rather
  // than tolerated — bare ⌘D stays the bookmark it has always been.
  if (
    (event.key === "d" || event.key === "D") && (event.ctrlKey || event.metaKey) &&
    event.shiftKey && !event.altKey
  ) return "duplicate"

  // ⌘⇧M / Ctrl+⇧M — the branch above, one letter along and for its reasons:
  // Workflowy's own chord, outside the chain because it shares its key with
  // nothing, and Shift required rather than tolerated so bare ⌘M stays the
  // platform's (minimize, on an Apple keyboard).
  if (
    (event.key === "m" || event.key === "M") && (event.ctrlKey || event.metaKey) &&
    event.shiftKey && !event.altKey
  ) return "moveTo"

  if (event.key === "Enter") {
    if (event.ctrlKey || event.metaKey) return event.shiftKey ? "walk" : "toggle"
    // ALT alone is the fourth mark's key. It used to return `null` here, which
    // is why there was a modifier left to give it: the three mark gestures are
    // one chord apart on one key, which is what makes them legible as the
    // family they are.
    //
    // ALT WITHOUT SHIFT, and the exclusion is load-bearing rather than tidy:
    // `Alt+Shift` is already this app's MOVE pair on the arrows
    // (`Alt+Shift+↑/↓`), so a chord that reads as "move this row" two keys over
    // must not quietly read as "call it off" here. It stays unclaimed.
    if (event.altKey) return event.shiftKey ? null : "cancel-mark"
    // A TITLE ON BOTH SIDES is the whole test, and each half rules out a case
    // this format cannot hold. Nothing before the caret would leave the row with
    // an empty title, which is not a node the ops layer will write — so `Enter`
    // at the head of a line goes on being the key that opens the next one, and
    // there is no blank row to insert above. Nothing after it is the ordinary
    // end-of-line press. A SELECTION spanning to either end reads the same way,
    // since what a split keeps is what falls outside it. And a half that is
    // nothing but whitespace is one of those cases rather than a split the ops
    // layer would refuse a moment later — the decision is that a half this
    // format cannot hold makes the key an `add`, so it is spelled here.
    return at !== undefined && halves(at) ? "split" : "add"
  }
  // The caret at the very start with nothing selected — the one place a
  // `Backspace` has nothing of its own to delete, which is exactly why it is
  // free to mean something else there and nowhere else.
  if (
    event.key === "Backspace" && !event.shiftKey && !event.altKey && !event.ctrlKey &&
    !event.metaKey && at !== undefined && at.start === 0 && at.end === 0
  ) return "merge"
  if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return event.shiftKey ? "out" : "in"
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    const down = event.key === "ArrowDown"
    // Alt+Shift is the MOVE; the bare arrow is the caret; SHIFT alone leaves
    // the caret and picks rows. Three readings of one key, and the modifiers
    // are the whole grammar — so a reader whose hands are on any of them never
    // has to reach for a mouse to do the others.
    if (event.altKey && event.shiftKey) return down ? "down" : "up"
    if (event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      return down ? "selectDown" : "selectUp"
    }
    if (!event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      return down ? "next" : "prev"
    }
  }
  // The second `⌘A`. The first one is not this layer's at all: it never gets
  // past `whole`, which is false until the platform's own select-all has
  // already run — the same caret value the two keys above read, asked a third
  // question.
  if (
    at !== undefined && whole(at) && !event.shiftKey && !event.altKey &&
    (event.key === "a" || event.key === "A") && (event.ctrlKey || event.metaKey)
  ) return "selectAll"
  return null
}

/** Is the whole line already selected? What tells the second `⌘A` from the
 *  first, and the reason it is a question about the CARET rather than a flag
 *  beside one: an empty field is not "wholly selected", so `⌘A` in a new row
 *  does nothing rather than picking the row that has not been written yet. */
const whole = (at: Caret): boolean =>
  at.text.length > 0 && at.start === 0 && at.end === at.text.length

// ── the selection layer ────────────────────────────────────────────────

/**
 * What a key does over the rows a multi-select has PICKED.
 *
 * Every one of them is the row layer's key, meaning the row layer's thing, over
 * several rows instead of one — which is the design rather than a coincidence:
 * a person who has learnt `Tab` should not have to learn a second `Tab`. What
 * makes that safe is that the two layers are never live together (a pick puts
 * the caret away, and a caret puts the pick away), so a key has one meaning at
 * any moment.
 *
 * `growUp` / `growDown` and `all` are the only ones with no single-row twin,
 * because they are about the PICK itself rather than about the rows in it:
 * `Shift+↑/↓` takes one more row, `⌘A` widens to the siblings and then to the
 * page. There is deliberately no key here for the put-away — the human's ruling
 * that this app has no delete key (2026-08-11) is exactly a ruling about a
 * chord that takes a branch away, and a bulk one would be that chord at its
 * worst. It is a button behind a confirm (`select/SelectionBar.tsx`).
 */
export type SelectAction =
  | "complete"
  | "in"
  | "out"
  | "up"
  | "down"
  | "growUp"
  | "growDown"
  | "all"
  | "clear"

export const selectKey = (event: KeyboardEvent): SelectAction | null => {
  if (event.key === "Escape") return "clear"
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
    return "complete"
  }
  if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return event.shiftKey ? "out" : "in"
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    const down = event.key === "ArrowDown"
    if (event.altKey && event.shiftKey) return down ? "down" : "up"
    if (event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      return down ? "growDown" : "growUp"
    }
  }
  // ⌘A with rows picked is the next rung of the ladder ⌘A started in the row.
  // Shift is excluded so ⌘⇧A stays free rather than quietly meaning this.
  if (
    !event.shiftKey && !event.altKey && (event.key === "a" || event.key === "A") &&
    (event.ctrlKey || event.metaKey)
  ) return "all"
  return null
}

/** Whether cutting here leaves a TITLE on both sides — which is not the same
 *  question as "is there a character on both sides": a node needs a title, and
 *  a title of spaces is not one. */
const halves = (at: Caret): boolean =>
  at.text.slice(0, at.start).trim() !== "" && at.text.slice(at.end).trim() !== ""

// ── the list layer ─────────────────────────────────────────────────────

/**
 * What a key does while a SHORTLIST is up under the caret — the ⌘K palette's
 * rows, and the three input widgets a row's title opens (`complete/`).
 *
 * A third layer rather than a matcher inside those components, for the reason
 * the two above are in one file: the arrows, `Enter` and `Escape` all mean
 * something else HERE ({@link editKey}) and somewhere else again as chords, and
 * a component matching them privately is exactly the silent disagreement this
 * registry exists to make impossible. What is left to the surface is what each
 * answer MEANS — `take` runs a route in the palette and rewrites a line in a
 * completion — which is why this answers with an intent rather than doing
 * anything.
 *
 * It is asked FIRST by whoever has a list up, and only while one is: a key a
 * person cannot see the effect of must go on meaning what it always meant.
 *
 *   - `next` / `prev` — `↓` / `↑`, walking the rows.
 *   - `take` — a bare `Enter`. Bare only: `⌘Enter` is still the mark and
 *     `Shift+Enter` still the note, and neither stops being itself because a
 *     list is up.
 *   - `dismiss` — `Escape`, which puts the LIST away and leaves everything
 *     under it alone.
 */
export type ListAction = "next" | "prev" | "take" | "dismiss"

/**
 * Focus among panes. Alt+Left / Alt+Right, and nothing else — Alt+Shift
 * is already the row's move, so a shifted arrow is not a focus step.
 */
export type PaneAction = "focusLeft" | "focusRight"

export const paneKey = (event: KeyboardEvent): PaneAction | null => {
  if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
    return null
  }
  if (event.key === "ArrowLeft") return "focusLeft"
  if (event.key === "ArrowRight") return "focusRight"
  return null
}

export const listKey = (event: KeyboardEvent): ListAction | null => {
  if (event.key === "Escape") return "dismiss"
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null
  if (event.key === "ArrowDown") return "next"
  if (event.key === "ArrowUp") return "prev"
  if (event.key === "Enter") return "take"
  return null
}

/**
 * The keys, written down for a PERSON.
 *
 * Beside the two matchers rather than in a document somewhere, for the reason
 * the matchers are beside each other: what a key does and what it is said to
 * do are one fact, and a second home for the sentence is a sentence that goes
 * stale. What draws this is `palette/Shortcuts.tsx`; `keys.test.ts` holds it
 * to covering every {@link EditAction}, so a key added without a sentence
 * fails rather than shipping undocumented.
 *
 * The chords say ⌘ and Ctrl the way {@link matchKey} reads them: Meta on
 * Apple, Control elsewhere. One string with both, because a reference a person
 * reads on one machine is often about the other.
 */
export interface Shortcut {
  readonly keys: string
  readonly what: string
  /** The editing action it is, when it is one — what the test checks the list
   *  against. Absent for the global chords, which are not row actions. */
  readonly action?: EditAction
  /** ...and the same for the list layer, so a key that walks a shortlist is
   *  held to being written down exactly as a row key is. */
  readonly list?: ListAction
}

export const SHORTCUTS: ReadonlyArray<{
  readonly group: string
  readonly keys: ReadonlyArray<Shortcut>
}> = [
  {
    group: "Anywhere",
    keys: [
      { keys: "⌘K / Ctrl+K", what: "the command palette" },
      { keys: "⌘\\ / Ctrl+\\", what: "show or hide the directory" },
      { keys: "⌘J / Ctrl+J", what: "show or hide the agent" },
      { keys: "⌘Z / Ctrl+Z", what: "take back your last edit on this outline" },
      { keys: "⌘⇧Z / Ctrl+⇧Z", what: "put it back" },
      {
        keys: "⌘⇧P / Ctrl+⇧P",
        what: "pin this page to the sidebar, or unpin it — a narrowed one asks what to call it",
      },
      { keys: "⌘⇧W / Ctrl+⇧W", what: "close the focused pane" },
    ],
  },
  {
    group: "Among panes",
    keys: [
      { keys: "Alt+← / Alt+→", what: "move focus to the pane on that side" },
      { keys: "Alt+click", what: "open a link in the pane to the right" },
      { keys: "Alt+Shift+click", what: "open it in a new pane to the right" },
    ],
  },
  {
    group: "In a row",
    keys: [
      { keys: "Click a title", what: "put the caret where you clicked" },
      { keys: "Enter", what: "commit, and open the next line", action: "add" },
      { keys: "Enter mid-line", what: "split the row in two there", action: "split" },
      {
        keys: "Backspace at the start",
        what: "join this row onto the one above",
        action: "merge",
      },
      { keys: "Tab", what: "indent under the row above", action: "in" },
      { keys: "Shift+Tab", what: "outdent, after the old parent", action: "out" },
      { keys: "Alt+Shift+↑", what: "move up among its siblings", action: "up" },
      { keys: "Alt+Shift+↓", what: "move down among its siblings", action: "down" },
      { keys: "⌘Enter / Ctrl+Enter", what: "tick it off, or take that back", action: "toggle" },
      {
        keys: "⌥Enter / Alt+Enter",
        what: "call it off, or take that back",
        action: "cancel-mark",
      },
      {
        keys: "⌘⇧Enter / Ctrl+⇧Enter",
        what: "walk the mark on: to do, then doing, then none",
        action: "walk",
      },
      {
        keys: "⌘⇧D / Ctrl+⇧D",
        what: "duplicate the row, and everything under it",
        action: "duplicate",
      },
      {
        keys: "⌘⇧M / Ctrl+⇧M",
        what: "move the row under a node you search for, anywhere in the set",
        action: "moveTo",
      },
      { keys: "Shift+Enter", what: "write the note under it", action: "note" },
      { keys: "↑ / ↓", what: "walk to the row above or below", action: "prev" },
      {
        keys: "Shift+↑ / Shift+↓",
        what: "start picking rows, from this one",
        action: "selectUp",
      },
      {
        keys: "⌘A / Ctrl+A twice",
        what: "the line, then the row and the ones beside it",
        action: "selectAll",
      },
      { keys: "Escape", what: "drop what you were typing", action: "cancel" },
    ],
  },
  {
    // The three input widgets (`complete/`). They are CHARACTERS rather than
    // chords — nothing in `editKey` matches them, and nothing should: what
    // arms one is where the caret is in the line, which is a question about
    // text and is answered in `complete/trigger.ts`. They are listed here
    // because this table is what a person reads to learn what the editor does,
    // and a widget nobody can discover is a widget nobody uses.
    group: "While typing a title",
    keys: [
      { keys: "!", what: "a day, in words — `tomorrow`, `next fri`, `aug 20`" },
      { keys: "# / @", what: "a tag this set already uses" },
      { keys: "((", what: "search for a node, and mirror it here" },
      { keys: "↓", what: "the next row of the list", list: "next" },
      { keys: "↑", what: "the row above it", list: "prev" },
      { keys: "Enter", what: "take the row the list is on", list: "take" },
      { keys: "Escape", what: "put the list away and keep typing", list: "dismiss" },
    ],
  },
  {
    // The bulk half. Every key here is the row key one group up, over the rows
    // that are picked instead of over the row the caret is in — which is why
    // the sentences read the same with a plural in them.
    group: "With rows picked",
    keys: [
      { keys: "Drag a bullet", what: "move the rows, subtrees and all" },
      { keys: "⌘-click / Ctrl-click", what: "add a row to the pick, or take it out" },
      { keys: "Shift-click", what: "pick everything between" },
      { keys: "Shift+↑ / Shift+↓", what: "take one more row, or give one back" },
      { keys: "⌘A / Ctrl+A", what: "widen to the whole page" },
      { keys: "Tab / Shift+Tab", what: "indent them, or take them out again" },
      { keys: "Alt+Shift+↑ / ↓", what: "move them among their siblings" },
      { keys: "⌘Enter / Ctrl+Enter", what: "tick them off, or take that back" },
      { keys: "Escape", what: "put the pick away" },
    ],
  },
  {
    group: "In a note",
    keys: [
      { keys: "Click a note", what: "put the caret in it" },
      { keys: "Enter", what: "a new line — a note is prose" },
      { keys: "Shift+Enter", what: "close it, and render it again" },
      { keys: "Escape", what: "drop what you were typing" },
    ],
  },
]
