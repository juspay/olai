/**
 * A node's properties, as a RUN OF CHIPS: `key value` pairs on one wrapping
 * line, the key small and muted, the value first-class — a compact byline under
 * a headline, and a door wherever the value names something.
 *
 * It was a two-column grid until the quiet outline, and then a dot-separated
 * run of dim pairs until `props-doors-autoshow`. The grid's problem was that a
 * `dl` with a key column and a value column is a table, and there is nothing
 * table-shaped in this view (human). The RUN's problem was different and it was
 * a weighting one: every pair was set in the same muted ink at the same size,
 * so `agent claude-opus` read as two equally quiet words and the five facts on
 * a lane node read as a wall (docs/brainstorming/props-ui.html, drawn after the
 * wall-of-prose screenshot). What a reader wants from five facts is the VALUES,
 * with the keys as labels — so the key stays mono and muted and one step
 * smaller, the value takes the reading ink, and each pair sits in its own
 * bordered chip so the eye finds where one fact stops and the next begins
 * without a separator glyph doing that work.
 *
 * ## Three faces a value can wear, and none of them is a guess
 *
 * A DOOR, where the value names a thing: a document of this directory, a node
 * the set declares, a day, or somewhere outside the app. Which of those — and
 * the refusal that keeps everything else plain text — is `./door.ts`'s whole
 * subject, argued there. What is THIS file's is that a door looks like a link
 * and nothing else does.
 *
 * A DATE BADGE, where the value is a date: the same pill the row already speaks
 * with (`../Pill.tsx`, which `../DateBadge.tsx` is drawn from), because a reader
 * who has learnt what a date looks like on this row should not have to learn it
 * again one line down.
 *
 * A FOLD, where the value is longer than a fact ({@link FOLDS_PAST}). The
 * mockup's Move 3, and its own sentence about itself: the fold is the safety
 * net, not the goal — under the props-are-facts rule it should almost never
 * appear, and when it does, the wall never comes back. It is here because the
 * run is drawn on a CLOSED row now: a `merge` holding two sentences used to
 * cost nothing until somebody opened the row, and would otherwise cost every
 * row of the board three lines of prose it did not ask for.
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
 * What says they cannot be typed over is the `•••` menu, which offers `Edit`
 * and `Remove` for the custom keys and nothing for these (./drawer.ts).
 *
 * They take NO DOORS, and that is the one place the two halves differ here.
 * Every system chip is a field of the record with a face of its own — `date`
 * is the badge on the line above, `status` is the glyph, and `id` is the
 * address of the page the chip is being drawn on, so a door on it is a link
 * back to itself. A custom value names something ELSE or it names nothing;
 * that is exactly the question `./door.ts` answers, and it is not a question
 * about a field the format already reads.
 *
 * ## What does NOT draw chips
 *
 * A SEARCH HIT (`../search/Result.tsx`). It borrows this file's type vocabulary
 * — mono key, reading value — and deliberately not its shape: a hit is one
 * truncating line inside a popover, and the row IS a link already, so a door
 * inside it would be a link inside a link. One component per surface where a
 * node's facts are READ; a hit list is a list of doors onto nodes, and is not
 * one of those surfaces.
 */

import { Key } from "@solid-primitives/keyed"
import { createMemo, Index, Show } from "solid-js"

import type { Entry } from "./drawer.ts"
import { type Door, doorFor } from "./door.ts"
import { Link } from "../router.tsx"
import { useNames } from "../reading.tsx"
import { useServes } from "../served.tsx"
import { TESTID } from "../testids.ts"

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
}) {
  const serves = useServes()
  const names = useNames()
  const doorOf = (value: string): Door | null =>
    doorFor(value, { from: props.from, serves: serves(), names: names() })

  return (
    <Show when={props.entries.length > 0}>
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
        <Key each={props.entries} by={keyOf}>
          {(entry) => <Chip entry={entry()} doorOf={doorOf} />}
        </Key>
      </div>
    </Show>
  )
}

/** What the system half is asked instead — see the comment at its call. */
const NO_DOOR = (): null => null

/** The box one fact sits in. A pill for the ordinary chip; the corners are
 *  eased off when it has a fold in it, because a disclosure opening inside a
 *  `rounded-full` box has its body pinched at both ends. */
const CHIP = "inline-flex min-w-0 max-w-full gap-1.5 border border-rule bg-panel px-2 py-px"

function Chip(props: {
  readonly entry: Entry
  readonly doorOf: (value: string) => Door | null
}) {
  const folds = () => props.entry.value.length > FOLDS_PAST
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
      <span class="shrink-0 font-mono text-[0.6875rem] text-muted">{props.entry.key}</span>
      <Show
        when={folds()}
        fallback={
          <span class="min-w-0 break-words text-ink" data-testid={TESTID.propValue}>
            <Values
              values={props.entry.values}
              // NO DOORS ON THE SYSTEM HALF, which is the row design's
              // no-fact-twice rule reaching one surface further. Every chip
              // there is a field of the record with a face of its own: `date`
              // is the badge on the line above, `status` is the glyph, and
              // `id` is the address of the page the chip is being drawn on —
              // a link back to itself. What is left, the two stamps, would be
              // doors onto days about which the node has already said
              // everything it has to say.
              doorOf={props.entry.system ? NO_DOOR : props.doorOf}
            />
          </span>
        }
      >
        <Folded value={props.entry.value} />
      </Show>
    </span>
  )
}

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
  readonly doorOf: (value: string) => Door | null
}) {
  return (
    <Index each={props.values}>
      {(value, index) => (
        <>
          <Show when={index > 0}>
            <span class="text-muted" aria-hidden="true">, </span>
          </Show>
          <Value value={value()} door={props.doorOf(value())} />
        </>
      )}
    </Index>
  )
}

/** One member: a door, or the text it always was. */
function Value(props: { readonly value: string; readonly door: Door | null }) {
  return (
    <Show when={props.door} fallback={<>{props.value}</>}>
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
                <Face value={props.value} day={door().kind === "day"} />
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
                <Face value={props.value} day={false} />
              </a>
            )}
          </Show>
        </span>
      )}
    </Show>
  )
}

/** The words themselves, in the date badge where the value is a date and bare
 *  everywhere else — the pill's own box (`../Pill.tsx`) in the tone a date that
 *  is nobody's deadline takes. */
function Face(props: { readonly value: string; readonly day: boolean }) {
  return (
    <Show when={props.day} fallback={props.value}>
      <span class="rounded-full bg-pill px-1.5">{props.value}</span>
    </Show>
  )
}

/** A value too long to be a fact: its first words, and the rest one press away.
 *  NO DOOR — a door is for a value that NAMES something, and a value this long
 *  is prose whatever is inside it (`./door.ts`'s "the whole value, exactly"). */
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
