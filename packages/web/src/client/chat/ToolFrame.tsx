/**
 * A tool call: one line, foldable.
 *
 * A turn can be a dozen of these, and unfolded they would bury the conversation
 * they belong to. So the default is one line — a status mark and the agent's
 * own title — and the arguments are a click away for the times you want to know
 * exactly what was asked for.
 *
 * Two things escape that fold, because both are about a call that is HAPPENING
 * rather than about one that happened:
 *
 *   - **where it is working** (the protocol's follow-along locations) is drawn
 *     on the line itself, so a reader can see which file an agent is in without
 *     opening anything;
 *   - **what it is saying** (the protocol's incremental content) is drawn
 *     first in the unfolded body, ABOVE the arguments. A call that has been
 *     running for thirty seconds has something to show and its arguments are
 *     not it — until this was read, an unfolded running call showed what was
 *     asked for and then nothing at all until it completed, which is
 *     indistinguishable from one that had hung.
 *
 * And a third escapes it for a different reason: what the call CHANGED. A diff
 * of a file it rewrote ({@link ./Diff.tsx}), or the node-level story of a write
 * it made through the ops layer ({@link ./Wrote.tsx}) — the two vocabularies,
 * one per kind of write, and in practice a call is one or the other. That is
 * not detail:
 * the arguments are what was asked for, and this is what happened to somebody's
 * files. It is trimmed rather than folded, and the trim opens where it stands.
 *
 * A CALL THAT SPAWNED AN AGENT says so on the line as well, in the slot the
 * locations take — because it cannot have any, and because "an agent was sent
 * out" is the fact a reader of a fan-out most needs and the one that used to
 * be nowhere on screen until the agent reported back ({@link ./spawn.ts}).
 * That is the whole of what this component does about a spawn: the live rail
 * under it belongs to the list, which is the thing that has rows to put a rail
 * beside.
 *
 * A CALL THAT ARMED A BACKGROUND TASK says so on that line as well — what the
 * task is watching, and, once the harness has reported it, how the task ENDED
 * ({@link ./background.ts}). The second is the whole reason this feature
 * exists: a monitor's death is the fact a person supervising off one must not
 * miss, and it is not spellable in ACP's four statuses, three of whose endings
 * arrive as the word `failed`.
 *
 * ... and what the harness said about its ENDING escapes the fold, which is
 * the third thing here that does. A task's row is one line for an hour and
 * then one sentence — *Background command "…" failed with exit code 3* — and
 * putting that sentence behind the same click as the arguments would hide the
 * only thing the row was ever going to say. Its ARMING sentence stays folded,
 * and the asymmetry is the point: that one is the harness talking TO THE AGENT
 * (*you will be notified on each event; keep working*), which is six lines of
 * somebody else's instructions above the one line a person came to read.
 *
 * A CALL THAT IS STILL RUNNING says HOW LONG on that line too, once it has been
 * running long enough to be worth saying ({@link ./elapsed.ts}). The status
 * mark is the only other thing here that is about time and it cannot answer
 * this: `·` is what a call announced a quarter of a second ago wears and `·` is
 * what one that has been grepping for four minutes wears, and those are not the
 * same row to somebody watching. Like the spawn's rail, the number is the
 * LIST's answer rather than this row's — a status is sticky, so whether
 * anything is running at all is a fact about the conversation.
 *
 * The row is UPDATED rather than replaced. The transcript keys these by the
 * agent's own call id, so `pending` becoming `completed` is the same row
 * changing.
 *
 * The FOLD is keyed by that same id and kept outside this component
 * ({@link ./folds.ts}). Rendering by stable key keeps this row mounted across a
 * status change, but the drawer being closed and reopened rebuilds the panel
 * regardless — and a fold that shuts under the reader is exactly what somebody
 * unfolded it to avoid.
 */

import { fileKind } from "@olai/format"
import type { ToolEntry, ToolStatus } from "@olai/surface"
import { Key } from "@solid-primitives/keyed"
import { createMemo, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { endedOf, watchOf } from "./background.ts"
import { Diff } from "./Diff.tsx"
import { diffKey, isUnfolded, toggleFold } from "./folds.ts"
import { OutlineDiff } from "./OutlineDiff.tsx"
import { useElapsed } from "./elapsing.tsx"
import { whoOf } from "./spawn.ts"
import { Wrote } from "./Wrote.tsx"

/**
 * What a status LOOKS and SOUNDS like, one row per word.
 *
 * Three columns of one table rather than three tables keyed by the same field:
 * a status that gained a mark without a word is a type error here, not a gap
 * three lists can drift into. The same shape {@link ./Entry.tsx}'s `FACE`
 * takes for a delivery — one fate, one row, read three ways.
 *
 * THE MODULE NEXT DOOR IS NOT THE FOURTH COLUMN. {@link ./running.ts} holds
 * what a status MEANS — which words mean the call has not come back — because
 * two faces outside this component ask that of the same row and must not
 * answer differently. These three are the panel's look, and they move when
 * the panel does rather than when ACP does.
 *
 * THE AGENT'S OWN WORDS, spelled for speech and interpreted no further. The
 * rail under a spawn says *working…* for `pending`, and this deliberately does
 * not: that rail is drawn only while the conversation is live
 * ({@link ./spawn.ts}), and this word is on a row that outlives it. A dead
 * agent leaves its last announced call `pending` forever, and a name that
 * announced it as "running" would be saying out loud the one thing nobody can
 * still promise.
 *
 * The mark is one character because words would wrap the line the frame exists
 * to keep to one.
 */
const LOOK: Record<ToolStatus, { mark: string; tone: string; said: string }> = {
  pending: { mark: "·", tone: "text-muted", said: "pending" },
  in_progress: { mark: "…", tone: "text-doing", said: "in progress" },
  completed: { mark: "✓", tone: "text-done", said: "completed" },
  failed: { mark: "✗", tone: "text-alarm", said: "failed" },
}

export function ToolFrame(props: { readonly entry: ToolEntry }) {
  /** How long this call has been running, or `null` when there is nothing to
   *  say. Reached for rather than handed down ({@link ./elapsing.tsx}), the
   *  same way this frame reaches for its own fold. */
  const elapsed = useElapsed()
  const open = () => isUnfolded(props.entry.id)
  const status = () => props.entry.status
  const look = () => LOOK[status()]
  /**
   * The blocks of change this call reported, each carrying the NAME that
   * identifies it ({@link ./folds.ts}'s `diffKey`).
   *
   * The name is minted HERE, once, and used for both things a block has an
   * identity for: the key the list below is drawn by, and the key its trim is
   * remembered under. Two mintings would be two answers to "which block is
   * this", free to disagree — and the crash this shape exists to prevent was
   * exactly one of them being wrong.
   *
   * It carries the block's PLACE in the report, because a path does not name a
   * block: the adapter reports an `Edit` as one `diff` per hunk of the patch,
   * all under one path, so an edit that landed in three places is three blocks
   * with one name between them. `<Key>` answers a repeated key with the SAME
   * element repeated, which is a thing no list of DOM nodes may contain — the
   * framework's reconciliation walks off the end of the array it is patching
   * and throws mid-draw, taking the page with it.
   *
   * A memo, so the fresh objects are minted when the blocks move and not on
   * every unrelated frame of the call.
   */
  const blocks = createMemo(() =>
    (props.entry.diffs ?? []).map((diff, at) => ({
      key: diffKey(props.entry.id, at, diff.path),
      diff,
    }))
  )
  /** There is something to unfold when there is either half of a body. A frame
   *  with neither is one line and nothing to press. */
  const body = () =>
    props.entry.detail !== undefined
    || (props.entry.armed?.ended === undefined && props.entry.progress !== undefined)

  return (
    <div
      class="min-w-0 rounded-lg border border-rule/70 bg-panel"
      data-testid={TESTID.chatTool}
      data-tool-status={status()}
      data-tool-id={props.entry.id}
      data-unfolded={open()}
    >
      {/* The fold, named — because it is no longer the only control in this
          frame: what the call CHANGED is drawn under it, and the node an olai
          write was about is a button of its own now ({@link ./Reference.tsx}).
          "The button in the tool frame" was a description that happened to be
          unique, and a scenario that reached for it that way found two. */}
      <button
        type="button"
        class="flex w-full items-center gap-2 px-2 py-1 text-left font-mono text-xs text-muted hover:text-ink"
        data-testid={TESTID.chatToolFold}
        aria-expanded={open()}
        disabled={!body()}
        onClick={() => toggleFold(props.entry.id)}
      >
        {/* The status, twice over and in two vocabularies, because the glyph
            is not one: `·` and `…` and `✓` say nothing to a screen reader, so
            the mark is hidden and the WORD is what lands in the button's
            accessible name — which is where a status belongs, since the name
            is the whole of what that reader gets. It went missing the moment
            this row grew a second label: "read every note Explore" announces a
            spawn and a kind and never says whether it finished, which for a
            dead agent's row is the one thing worth hearing. */}
        <span class={look().tone} aria-hidden="true">
          {look().mark}
        </span>
        <span class="sr-only">{look().said}</span>
        <span class="min-w-0 flex-1 truncate">{props.entry.text}</span>
        {/* WHO WAS SENT, on the line, from the moment the spawn is announced —
            which is a good while before the agent has done anything to draw a
            lane out of ({@link ./spawn.ts}). It shares the slot a call's
            locations take, and shares it safely: an `Agent` call works in no
            file and reports none, so the two are never on one row. */}
        <Show when={whoOf(props.entry)}>
          {(who) => (
            <span
              class="flex min-w-0 shrink-0 items-center gap-1 text-muted/70"
              data-testid={TESTID.chatSpawn}
              data-spawn-kind={who()}
            >
              {/* The lane's own glyph, so the marker on the row and the label
                  on the rail under it are visibly the same fact: somebody
                  else is doing this. Without it, a kind sitting where a file
                  path usually sits reads as a file path.

                  A glyph says that to the eye and nothing at all to a screen
                  reader, which would otherwise hear this row's name end in a
                  bare "Explore" — so the word it stands for is spoken in its
                  place, and the name comes out as a sentence. */}
              <span aria-hidden="true">↳</span>
              <span class="sr-only">sent out&#32;</span>
              <span class="min-w-0 truncate">{who()}</span>
            </span>
          )}
        </Show>
        {/* Unfolded: where it is working, on the line, because a reader
            following an agent through a tree wants the file more often than
            the arguments. Truncated rather than wrapped — the frame's whole
            promise is one line. */}
        {/* WHAT IT LEFT RUNNING, on the line, from the moment the task is
            armed — the description it was armed with, which is what a person
            recognises "kolu fleet watch…" by and which the call's own title
            (`Monitor`) is not ({@link ./background.ts}). It shares the slot the
            locations take, and shares it safely for the spawn chip's reason: a
            call that arms a background task reports no file it is working in. */}
        <Show when={watchOf(props.entry)}>
          {(watching) => (
            <span
              class="flex min-w-0 shrink items-center gap-1 text-muted/70"
              data-testid={TESTID.chatArmed}
              data-task={props.entry.armed?.task}
              data-task-kind={props.entry.armed?.kind}
            >
              {/* The glyph a watch wears, spoken for a reader who gets no
                  glyphs: without the word, this row's name ends in a bare
                  description and reads as a file path. */}
              <span aria-hidden="true">◷</span>
              <span class="sr-only">watching&#32;</span>
              <span class="min-w-0 truncate">{watching()}</span>
            </span>
          )}
        </Show>
        {/* ... and HOW IT ENDED, in the harness's own word, once there is one.
            Beside the status mark rather than instead of it: the mark is ACP's
            answer and this is the harness's, and where they differ — a monitor
            somebody STOPPED, drawn `✗` because ACP has no other word for it —
            this is the one that says what happened. */}
        <Show when={endedOf(props.entry)}>
          {(ended) => (
            <span
              class="shrink-0 text-muted"
              data-testid={TESTID.chatArmedEnded}
              data-ended={ended()}
            >
              <span aria-hidden="true">·&#32;</span>
              <span class="sr-only">ended&#32;</span>
              {ended()}
            </span>
          )}
        </Show>
        <Show when={props.entry.locations}>
          {(locations) => (
            <span
              class="min-w-0 max-w-[45%] shrink truncate text-muted/70"
              data-testid={TESTID.chatToolLocations}
              title={locations().join("\n")}
            >
              {locations().join(" ")}
            </span>
          )}
        </Show>
        {/* HOW LONG IT HAS BEEN GOING, for a call the wire still calls running
            in a conversation that is still live ({@link ./elapsed.ts}). The
            mark at the head of this line has said `·` for a quarter of a second
            and `·` for four minutes since there was a panel; this is the line
            saying which.

            At the END of the row, past the locations, because it is the one
            thing here that is about the call rather than about what the call is
            doing — and `shrink-0`, so a long path truncates and the number
            never does. The `·` is a separator and belongs to the reader's eye
            rather than to the name: the words either side of it are two
            readouts, and without it a duration lands against a file path as
            though it were part of one.

            The answer is REACHED FOR rather than handed down: the two things
            it needs — whether a turn is in flight, and the panel's one clock —
            are the list's, and threading them through `Entry`'s six-armed
            switch would make that signature a function of what this one leaf
            draws ({@link ./elapsing.tsx}). The `<Show>` here is what computes
            it, so a row that is not a tool call computes nothing at all.

            NO `aria-live`, deliberately, and this is the one place in the panel
            where that needs saying: the rail under a spawn announces itself
            because it appears once and says one word, and a number that changes
            every second in a live region would be a screen reader counting out
            loud for as long as the build takes. It is in the button's
            accessible NAME instead, where a reader meets it when they ask about
            the row — which is the moment "how long has this been going" is
            actually a question. */}
        <Show when={elapsed(props.entry)}>
          {(said) => (
            <span class="shrink-0 text-doing">
              <span aria-hidden="true">·&#32;</span>
              <span class="sr-only">running for&#32;</span>
              {/* The DURATION alone under the name, with the separator and the
                  spoken words outside it: what a scenario reads back is then
                  the number this rule decided rather than the sentence built
                  around it. */}
              <span data-testid={TESTID.chatToolElapsed}>{said()}</span>
            </span>
          )}
        </Show>
        <Show when={body()}>
          <span aria-hidden="true">{open() ? "▾" : "▸"}</span>
        </Show>
      </button>

      {/* What the call CHANGED, outside the fold — in whichever of the two
          vocabularies applies, which in practice is one of them. A change is
          not detail: the arguments are what was asked for, and this is what
          happened to somebody's files. Folding it away would be putting the
          one thing the row is about behind the same click as the JSON. */}
      <Show when={props.entry.wrote}>
        {(wrote) => <Wrote wrote={wrote()} />}
      </Show>
      {/* WHAT THE HARNESS SAID ABOUT THE TASK'S ENDING, outside the fold —
          where a background shell's EXIT CODE is. It is the same `progress`
          the fold draws for every other call, and it is drawn twice nowhere:
          an ENDED task's row draws it here INSTEAD, because for that row the
          sentence is the whole of what there is to read. While the task is
          still out it stays behind the fold, where the arming blurb belongs. */}
      <Show when={props.entry.armed?.ended !== undefined && props.entry.progress}>
        {(said) => (
          <pre
            class="m-0 max-h-32 overflow-auto whitespace-pre-wrap border-t border-rule px-2 py-1 font-mono text-[0.6875rem] text-ink"
            data-testid={TESTID.chatToolProgress}
          >{said()}</pre>
        )}
      </Show>
      {/* Keyed BY THE BLOCK'S OWN NAME, the way every other list in this app is
          keyed: a call is reported twice, and the second report carries the
          blocks in a fresh array — under `<For>` that is a new object at the
          same index, which remounts the row and throws away what it owns while
          a reader is looking at it. The rule the frame itself follows, one list
          down.

          The name is the call, the place and the path, and it used to be the
          path alone. That read as the same rule and was not: a path names a
          FILE, and one call reports several blocks about one file — so three
          hunks of one edit were three rows answering to one key, and the list
          drew one element three times. See `blocks` above. */}
      <Key each={blocks()} by="key">
        {(block) => (
          /* Which SHAPE a change is drawn in is decided by the FILE and not by
             the tool: an outline is one line per node, so a text diff of one is
             a single enormous line — the rule the Commit panel has always had,
             and it holds for an agent's own `Edit` as much as for an olai
             write. */
          <Show
            when={fileKind(block().diff.path) === "outline"}
            fallback={<Diff id={block().key} diff={block().diff} />}
          >
            <OutlineDiff id={block().key} diff={block().diff} />
          </Show>
        )}
      </Key>

      <Show when={open()}>
        {/* Progress FIRST: it is the live half, and a reader who unfolded a
            running call did it to see this rather than to re-read what was
            asked for. */}
        <Show when={props.entry.armed?.ended === undefined && props.entry.progress}>
          {(progress) => (
            <pre
              class="m-0 max-h-64 overflow-auto whitespace-pre-wrap border-t border-rule px-2 py-1 font-mono text-[0.6875rem] text-ink"
              data-testid={TESTID.chatToolProgress}
            >{progress()}</pre>
          )}
        </Show>
        <Show when={props.entry.detail}>
          {(detail) => (
            <pre
              class="m-0 max-h-64 overflow-auto border-t border-rule px-2 py-1 font-mono text-[0.6875rem] text-muted"
              data-testid={TESTID.chatToolDetail}
            >{detail()}</pre>
          )}
        </Show>
      </Show>
    </div>
  )
}
