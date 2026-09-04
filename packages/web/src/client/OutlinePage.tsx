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
 * pointing at the nearest visible ancestor) — or one hidden by the page's own
 * DONE PICK, which the same act answers with the pick's sweep spared for the
 * places on the way: the reveal (`./settings/done.ts`), spent for the visit
 * and never stored.
 */

import { type Row, shownRecord } from "@olai/format"
import { createEffect, createSignal, onCleanup, Show } from "solid-js"

import { createDeclared } from "./declared.ts"
import { setFolded } from "./fold/memory.ts"
import { createFoldReading } from "./fold/reading.ts"
import { aim, failedSays, missedSays, shutAlong } from "./fold/landing.ts"
import { Editable } from "./edit/Editable.tsx"
import { DeleteFile } from "./file/DeleteFile.tsx"
import { StartLine } from "./edit/StartLine.tsx"
import { useNarrowed } from "./filter/narrowed.tsx"
import { unfiltered } from "./filter/why.ts"
import { bringOntoScreen, selectNode } from "./focus.ts"
import { useHere, useLanding } from "./router.tsx"
import { SaidLine } from "./SaidLine.tsx"
import { createSaying } from "./saying.ts"
import { concealDone, doneHiddenOn, revealDone } from "./settings/done.ts"
import { TESTID } from "./testids.ts"
import { Tree } from "./Tree.tsx"

export function OutlinePage(props: {
  /** Which file this is — needed by exactly one thing, and it is the one
   *  place a browser names a path: an outline with no rows has no anchor to
   *  put a first one after. */
  readonly file: string
  readonly rows: ReadonlyArray<Row>
  /** The rows the outline HOLDS before this page's pick — and any filter —
   *  prunes any. TWO answers ask this one value: whether the file really IS
   *  empty ({@link props.rows} cannot say it, since hidden finished work and
   *  a filter both take rows out, and `hidden` is the DEFAULT now, so an
   *  empty file and a fully-hidden one were about to be indistinguishable),
   *  and the landing's reveal question: the row an address named is findable
   *  in the reading the pick prunes, and nowhere else. */
  readonly held: ReadonlyArray<Row>
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
   * other file, so the act asks the set what the id names — through
   * `./declared.ts`, the tab's one door for the question (`nodes.named`
   * itself is queried by NOBODY but that module): asked once per landing
   * and remembered, never asked into a dead socket and asked again when it
   * returns. And ONLY THEN concludes: the answer re-runs this effect through
   * the door's known-map, and a miss is said once the answer confirms the
   * page really draws nothing by that name, never while the set is still
   * being asked — the third state `./declared.ts`'s `told` keeps for
   * exactly this scope. An id the answer says nothing about, or whose target
   * this page also does not draw, is the certain half — in two honestly
   * different degrees of it, the name nothing declares and the name this
   * page only does not draw ({@link ./fold/landing.ts}'s `missedSays` says
   * which, because a hidden live row is not a dead link either). Said in
   * the alarm mood, ONCE per owed landing, cleared the way every transient
   * line in this client clears (`./saying.ts`) or the moment the arrival
   * pays after all.
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
  /** The ids whose ASK the wire lost: the call said the socket was up and
   *  then did not arrive, so the set was never told them — remembered so
   *  the ask arm can SAY the failure in the line's own voice instead of
   *  hiding it behind a connected pill (the head's alarm-line ruling).
   *  Per id rather than per call, exactly as `declared`'s own map is: the
   *  landing re-asks from each revision, and the old fact is as fresh as
   *  ever until an answer lands. */
  const [lost, setLost] = createSignal<ReadonlySet<string>>(new Set())
  /** ONE SCOPE of the set's door for "what does this id name" —
   *  `./declared.ts`, the module that asks it for the chat panel's
   *  spans and, as of the landing, for a page's missed row too: the
   *  batching, the ask-once-and-remember, the dead-socket ruling and the
   *  ask-again-when-it-returns are THEIRS, kept whole rather than copied
   *  here, and this page is just one more scope the same batches answer.
   *  The failure ear keeps the landing's own word of a call that did not
   *  arrive: the arrival is owed still, the console hears why, and the
   *  reader hears why — the line (`{@link failedSays}`), not the console
   *  alone, because a connected pill cannot speak for an ask it lost. */
  const declared = createDeclared((message, ids) => {
    console.warn(
      "olai: could not ask the set what the landing names, so the arrival is still owed —",
      message,
    )
    setLost((before) => {
      const next = new Set(before)
      for (const id of ids) next.add(id)
      return next
    })
  })
  /** THE STRETCH OF OWING this page is in, and whether the alarm for it has
   *  been drawn — ONE place, because the two halves are one fact: an alarm
   *  belongs to a stretch of contiguous owing of the same id on the same
   *  FILE, the stretch ends whenever what is owed changes (paying the
   *  landing is one of those changes), and nothing else about one may be
   *  remembered across the other — not even the LINE it drew: this site
   *  does not remount across outline-to-outline navigation, so a stretch
   *  that is not taken down would hang its line over the next page's tree
   *  for the rest of its six seconds, attributed to a page nobody asked.
   *  Said once per stretch, never once per revision going on not drawing
   *  the row: navigate away and back to the same dead address and the miss
   *  is news again, and a busy page does not spend the six seconds twice. */
  let owing: {
    readonly file: string | undefined
    readonly id: string | undefined
    said: undefined | "failure" | "miss"
  } = { file: undefined, id: undefined, said: undefined }
  /** THE REVEAL this page's landing minted and that still stands: the SCOPE
   *  is the answer `revealDone` answered with — the pane, the file and THE
   *  VERY SET the table was asked to spare — keyed so the release reaches
   *  exactly the entry the table still holds (`./settings/done.ts`). OUTSIDE
   *  the stretch record on purpose: a PAID landing's reveal belongs to the
   *  page the reader is READING, not to the arrival that put it there — it
   *  outlives `owed` and dies with the page. */
  let minted:
    | { readonly file: string; readonly pane: number; readonly keys: ReadonlySet<string> }
    | undefined
  const conceal = (): void => {
    if (minted !== undefined) {
      concealDone(minted.file, minted.pane, minted.keys)
      minted = undefined
    }
  }
  onCleanup(conceal)
  // The reveal's GATES are its law while it stands, not only when it mints:
  // `aim` asks for the whole page only where BOTH hold, so neither a filter
  // typed after the landing nor the reader's own flip of the pick may leave
  // the courtesy running against the reader's words — the answer is taken
  // down the moment the answer would have stopped existing.
  createEffect(() => {
    if (!(unfiltered(narrowed) && doneHiddenOn(props.file))) conceal()
  })
  createEffect(() => {
    const at = landing.owed()
    if (at !== owing.id || props.file !== owing.file) {
      // The line belongs to the stretch that said it: the boundary takes
      // it down, wherever that stretch's six seconds stand. The REVEAL goes
      // with its page, or with the page being re-asked for a landing — and
      // stays at a PAID landing's boundary (`at` then undefined the
      // honourable way): the row somebody was brought to must not snap shut
      // the moment they start reading it.
      if (owing.said !== undefined) saying.say(null)
      if (props.file !== owing.file || at !== undefined) conceal()
      owing = { file: props.file, id: at, said: undefined }
    }
    if (at === undefined) return
    // WHERE THE REVEAL MAY BE ASKED: the pick prunes this page, and nothing
    // typed does — a filter on the page is the reader's own question, and
    // the act writes nothing over it (the fold half's own discipline,
    // `./fold/reading.ts`).
    const whole = unfiltered(narrowed) && doneHiddenOn(props.file) ? props.held : undefined
    const aimAt = aim(props.rows, at, declared.told, whole)
    if (aimAt.kind === "ask") {
      // ASK, and only then: a page that answers the id by itself never has
      // the `told` read — `aim` short-circuits on the chain before the set
      // is spoken to at all.
      declared.want([at])
      // The ask may never arrive even on a live socket — and then the
      // pre-landing silence comes back exactly where the sentence promises
      // it cannot: the failure is said in the voice too, once per stretch.
      // It is NOT the miss: nothing has ruled the id out.
      //
      // And the `want` above is NOT a retry of it: a want ridden on the
      // very failure finds the id still inside the door's own `asking` —
      // cleared only after the promise settles — so the re-ask that
      // happens is the next revision's, incidental as the spans',
      // (`./declared.ts` rules its own span re-asks no sooner). A
      // REAL retry policy would be the door's to grow, for every scope at
      // once — this page's contract is only that the ask's loss never goes
      // untold, which the line above pays in full.
      if (lost().has(at) && owing.said !== "failure") {
        owing.said = "failure"
        saying.say({ tone: "alarm", text: failedSays(at) })
      }
      return
    }
    if (aimAt.kind === "miss") {
      if (owing.said !== "miss") {
        owing.said = "miss"
        saying.say({ tone: "alarm", text: missedSays(at, aimAt.target) })
      }
      return
    }
    if (aimAt.kind === "reveal") {
      // The courtesy, spent: the row EXISTS here and the pick is what hides
      // it — so the places on the way to it are kept out of the sweep, and
      // the pick's two standing answers never hear about it. Said NOTHING:
      // the row coming back IS the sentence — and the next pass of this
      // effect finds the chain the ordinary way and pays the landing. And
      // the token the release asks for is THE SET THE TABLE NOW HOLDS, so it
      // is the write's answer that `minted` remembers, never the local copy.
      const keys = new Set(aimAt.chain.map((row) => row.key))
      minted = {
        file: props.file,
        pane: here(),
        keys: revealDone(props.file, here(), keys),
      }
      return
    }
    saying.say(null)
    const chain = aimAt.chain
    const shut = shutAlong(chain, folds())
    if (shut.length > 0) setFolded(shut, false)
    // The rows carry the same value twice over the frame — the chain's last
    // placement is the row both the accent and the scroll answer for — so
    // it is named ONCE: `last`, inside the frame too.
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
      //
      // An id is a string somebody typed one day: `CSS.escape`, because a
      // quote in it would be a selector that throws, and a throw inside the
      // frame is a landing this pane will never spend. (`document/faces.tsx`'s
      // heading half does exactly this, on the same argument.)
      const row = root.querySelector(
        `[data-testid="${TESTID.node}"][data-node-id="${CSS.escape(last.at.node.id)}"]`,
      )
      if (row === null) return
      bringOntoScreen(row)
      landing.landed(at)
    })
    onCleanup(() => cancelAnimationFrame(frame))
  })

  return (
    <>
      {/* WHAT THE LANDING COULD NOT DO, above the tree it could not land in —
          the same placement rule `./document/Hypertext.tsx` states for its
          refused click: the reader's eyes are on the page the address just
          opened, so the line sits at the top of it, where the row they were
          promised would have been — and OUTSIDE `Editable`'s sweep surface
          (`./edit/Editable.tsx`'s `data-sweep`), which would otherwise read
          a press on the line as a begun sweep, the one thing the reader's
          waiting eyes on this sentence can receive as an answer. */}
      <Show when={saying.said()}>
        {(said) => (
          <SaidLine
            said={said()}
            class="mb-2 text-[0.8125rem] leading-snug"
            testid={TESTID.landingSaid}
          />
        )}
      </Show>
      {/* A whole outline is drawn inside nothing, which is the answer rather
          than the absence of one (`./drag/fields.ts`). */}
      <Editable rows={() => props.rows} file={props.file} within={[]}>
        <Tree rows={props.rows} />
        {/* An outline that holds nothing still has to be startable, and a
            tree of no rows offers nowhere to press a key. Asked of the FILE
            rather than of the reading (`held`, above): rows can also be
            missing because this page is hiding what is done — or because a
            FILTER matched nothing — and "write its first line" would be a
            lie over a tree that is one pick from coming back. The filter bar
            says what happened in that case. */}
        <Show when={unfiltered(narrowed) && props.held.length === 0}>
          <StartLine
            at={{ kind: "first", file: props.file }}
            label="This outline is empty — write its first line."
          />
          {/* …OR RETIRE IT. The same emptiness that offers a first line is
              the only condition under which the op may take the FILE — an
              outline with records has no delete affordance anywhere in this
              app, by design (`./file/DeleteFile.tsx` argues the door's
              rule), so the two branches of one truth sit on one page: where
              an arrow would suggest one, the other is one press away. */}
          <div class="mt-2">
            <DeleteFile file={props.file} />
          </div>
        </Show>
      </Editable>
    </>
  )
}
