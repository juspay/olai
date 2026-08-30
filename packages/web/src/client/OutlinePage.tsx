/**
 * One whole outline: the roots of a file, expanded.
 *
 * The tree it draws is the same `<Tree>` a zoomed node draws, over rows from
 * the same derivation and the same store — a file is just the widest zoom
 * there is.
 *
 * The LANDING (below) is the outline arm of what the markdown face draws for
 * `#heading`: an address like `/house.olai#install` asking this page to arrive
 * at the row it names. The act is the small half the browser cannot do: the
 * row is a place in the tree, not an element id — and the address may name
 * one inside a branch this reader has folded, which the tree answers with its
 * own expand vocabulary (`./fold/landing.ts` argues why expanding beats
 * pointing at the nearest visible ancestor).
 */

import { type Row, shownRecord } from "@olai/format"
import { Result } from "effect"
import { createEffect, createSignal, onCleanup, Show } from "solid-js"

import { setFolded } from "./fold/memory.ts"
import { createFoldReading } from "./fold/reading.ts"
import { aim, missedSays, shutAlong } from "./fold/landing.ts"
import { Editable } from "./edit/Editable.tsx"
import { StartLine } from "./edit/StartLine.tsx"
import { useNarrowed } from "./filter/narrowed.tsx"
import { unfiltered } from "./filter/why.ts"
import { bringOntoScreen, selectNode } from "./focus.ts"
import { useHere, useLanding } from "./router.tsx"
import { runAsync } from "./run.ts"
import { SaidLine } from "./SaidLine.tsx"
import { createSaying } from "./saying.ts"
import { doneHidden } from "./settings/done.ts"
import { TESTID } from "./testids.ts"
import { Tree } from "./Tree.tsx"
import { olai } from "./wire.ts"

export function OutlinePage(props: {
  /** Which file this is — needed by exactly one thing, and it is the one
   *  place a browser names a path: an outline with no rows has no anchor to
   *  put a first one after. */
  readonly file: string
  readonly rows: ReadonlyArray<Row>
}) {
  const narrowed = useNarrowed()
  const folds = createFoldReading()
  const here = useHere()
  const landing = useLanding(() => props.file)

  /**
   * LAND at the row the address named, once there is a page to land in — the
   * outline's half of the act the markdown face performs for headings
   * (`./document/faces.tsx`), with the same rules in the same order:
   *
   *   - an EFFECT rather than a call, because the rows arrive on their own
   *     schedule: the reading can sit a revision behind the navigation that
   *     minted the landing, and re-running is how the arrival eventually
   *     lands — through `props.rows`, which is also the reason a page
   *     REPUBLISHED underfoot does not re-land a reader (the mark below);
   *   - NOTHING FOUND IS NOTHING DONE — but it IS said, which is where this
   *     arm's inheritance of the document arm's sentence ends (the ruling
   *     `./fold/landing.ts`'s header writes down): the file half of a row
   *     address can go stale exactly as a heading's slug can, and a landing
   *     that finds its row on no revision opens a whole page — with ONE
   *     alarm line on it saying what was asked and that nothing by that name
   *     is drawn here ({@link ./fold/landing.ts}'s `missedSays`), so a dead
   *     link no longer looks exactly like a working one. Still kept UNspent:
   *     a page that starts showing the row again — a filter let it back in,
   *     a done it was about vanished — pays the arrival it was owed, and
   *     takes the line down on the way;
   *   - spent ON THE SCROLL rather than on the attempt, for the markdown
   *     face's reason: giving up the first time the row was absent would give
   *     up on the frame before the rows had arrived at all.
   *
   * What changes is the ACT, and it is the emphasis of this page: folding is
   * the reader's own memory — the row is found in the READING regardless
   * (`./fold/landing.ts`, which asks `props.rows`, not the memory-pruned
   * draw), so a collapsed ancestor is unshut with the tree's own expand verb
   * before the row is selected and brought on screen, instead of the reader
   * being left pointing at somewhere they cannot see.
   *
   * The id asked OF THE SET when the rows answer nothing, because a fragment
   * may spell a PLACEMENT: the mirror's own record id, which `read_node`
   * reports in `mirrors` and an agent citing a row naturally spells
   * (`./fold/landing.ts`'s `answer`). A placement the page draws is found
   * with no wire crossed; one it does not keeps its target in a row of some
   * other file, so the act asks the set `nodes.named` — the chat press's own
   * door for the same question, answered once per landing and remembered —
   * and ONLY THEN concludes: the answer re-runs this effect through the
   * `named` signal, and a miss is said once the answer confirms the page
   * really draws nothing by that name, never while the set is still being
   * asked. An id the answer says nothing about, or whose target this page
   * also does not draw, is the certain half: said in the alarm mood, ONCE
   * per owed landing, cleared the way every transient line in this client
   * clears (`./saying.ts`) or the moment the arrival pays after all.
   *
   * The fold half is asked of the READING, not of the memory —
   * `createFoldReading`, the same door the tree, the editor, the selection
   * and the drag ask. They differ on exactly one page: a NARROWED one, where
   * the reading has already suspended every collapse and the memory still
   * names the reader's real ones — so `shut` under a filter comes back
   * empty, and the act writes nothing: a landing that wrote there could
   * un-collapse branches nobody was hiding from it, which is the promise
   * `./fold/reading.ts`'s header is for.
   */
  const saying = createSaying()
  /** What the set has said about the ids landings here have spelled — the
   *  asked id to the node it names, `null` when it names nothing. Remembered
   *  per answer, never per frame: a message's ids are answered once
   *  (`./chat/declared.ts`'s rule), and a landing's id is one message's
   *  worth. */
  const [named, setNamed] = createSignal<ReadonlyMap<string, string | null>>(new Map())
  /** The ids with an answer OUTSTANDING — asked and not yet answered, so a
   *  revision landing mid-question does not ask again. */
  const asking = new Set<string>()
  /** Which owed landing the alarm has already been drawn for — said ONCE per
   *  landing rather than per revision that goes on not drawing the row. */
  let missSaidFor: string | undefined
  let watching: string | undefined
  createEffect(() => {
    const at = landing.owed()
    // A NEW owed landing resets the once-per memory: navigate away and back
    // to the same dead address and the miss is news again.
    if (at !== watching) {
      watching = at
      missSaidFor = undefined
    }
    if (at === undefined) return
    const aimAt = aim(props.rows, at, (asked) => named().get(asked))
    if (aimAt.kind === "ask") {
      if (!asking.has(at)) {
        asking.add(at)
        void runAsync(olai.procedures.nodes.named({ ids: [at] })).then((outcome) => {
          if (Result.isFailure(outcome)) {
            // NOT WRITTEN DOWN AS A NO — a wire that could not answer said
            // nothing about this id (the connection pill is already saying
            // so, `./chat/declared.ts`'s ruling for the same door): the next
            // revision re-asks.
            console.warn(
              "olai: could not ask the set what the landing names, so the arrival is still owed —",
              outcome.failure.message,
            )
            return
          }
          const target = outcome.success.named.find((one) => one.asked === at)?.id ?? null
          setNamed((answered) => new Map(answered).set(at, target))
        }).finally(() => asking.delete(at))
      }
      return
    }
    if (aimAt.kind === "miss") {
      if (missSaidFor !== at) {
        missSaidFor = at
        saying.say({ tone: "alarm", text: missedSays(at) })
      }
      return
    }
    saying.say(null)
    const chain = aimAt.chain
    const shut = shutAlong(chain, folds())
    if (shut.length > 0) setFolded(shut, false)
    const last = chain.at(-1)
    if (last === undefined) return
    // The accent answers for the NODE the row landed on shows, not the id as
    // spelled: the two differ only when the address named a placement, and
    // the row that wears it (`./focus.ts`'s `data-focused` is matched on the
    // shown id) is the mirror row then.
    selectNode(shownRecord(last).node.id)
    const frame = requestAnimationFrame(() => {
      // The landing belongs to THIS pane: the SAME outline can sit in two
      // columns, and the scroll is the pane whose address named the row.
      const root = document.querySelector(
        `[data-testid="${TESTID.pane}"][data-pane="${String(here())}"]`,
      )
      if (root === null) return
      // Aim at the landing's OWN row — the chain's last placement, found by
      // the record id its row wears — not at the accent: the accent is one
      // signal for the whole app and a landing is a fact per pane, so two at
      // once (a shared view naming a row in each of this file's columns)
      // would scroll one pane to the other's row and say its own arrival
      // paid — the wrong-row spend `./landing.ts`'s header was once and
      // forever written against. Rows wear `data-node-id` for exactly this
      // (`./Tree.tsx`), even mirrors — the placement stays put.
      const placement = chain.at(-1)
      if (placement === undefined) return
      // An id is a string somebody typed one day: escaped, because a quote
      // in it would be a selector that throws, and a throw inside the frame
      // is a landing this pane will never spend. (`document/faces.tsx`'s
      // heading half does exactly this, on the same argument.)
      const row = root.querySelector(
        `[data-testid="${TESTID.node}"][data-node-id="${CSS.escape(placement.at.node.id)}"]`,
      )
      if (row === null) return
      bringOntoScreen(row)
      landing.landed(at)
    })
    onCleanup(() => cancelAnimationFrame(frame))
  })

  return (
    // A whole outline is drawn inside nothing, which is the answer rather than
    // the absence of one (`./drag/fields.ts`).
    <Editable rows={() => props.rows} file={props.file} within={[]}>
      {/* WHAT THE LANDING COULD NOT DO, above the tree it could not land in —
          the same placement rule `./document/Hypertext.tsx` states for its
          refused click: the reader's eyes are on the page the address just
          opened, so the line sits at the top of it, where the row they were
          promised would have been. */}
      <Show when={saying.said()}>
        {(said) => (
          <SaidLine
            said={said()}
            class="mb-2 text-[0.8125rem] leading-snug"
            testid={TESTID.landingSaid}
          />
        )}
      </Show>
      <Tree rows={props.rows} />
      {/* An outline that holds nothing still has to be startable, and a tree
          of no rows offers nowhere to press a key. Only when the file really
          is empty: rows can also be missing because this reading is hiding
          what is done — or because a FILTER matched nothing — and "write its
          first line" would be a lie over a tree that is one click from coming
          back. The filter bar says what happened in that case. */}
      <Show
        when={unfiltered(narrowed) && props.rows.length === 0 && !doneHidden()}
      >
        <StartLine
          at={{ kind: "first", file: props.file }}
          label="This outline is empty — write its first line."
        />
      </Show>
    </Editable>
  )
}
