/**
 * What is waiting, in olai's words — and the two verbs that deal with it.
 *
 * The panel reports on the WHOLE REPOSITORY, in two kinds of row, and the
 * difference between them is what olai can honestly say about a file rather
 * than what it is allowed to commit:
 *
 *   - an OUTLINE it serves gets node-level rows — "marked done", "note
 *     rewritten", "archived" — because both sides parse into records and the
 *     comparison is in hand. Never a text diff: a `.olai` diff is one enormous
 *     line per node with everything on it changing at once;
 *   - EVERY OTHER dirty file gets a path and a status chip. A document, a source
 *     file, an outline outside the served root. The only richer thing available
 *     would be a text diff, and this is an audit-trail recorder rather than a
 *     git client.
 *
 * The SCOPE line says so out loud, and it is new because the scope is new: a
 * `README.md` two directories above the outlines is a row in this list, and a
 * reader who is not told that has to work out why.
 *
 * Every row is TICKED by default, so the ordinary sweep stays one click, and
 * unticking one dims it and recomposes both the message and the button live —
 * through the same `composed` the server would have used, so the two faces
 * cannot word one commit differently. What is left out stays waiting, for its
 * own commit and its own message; olai never touches git's index, so work
 * somebody staged by hand is untouched either way.
 *
 * The LAST COMMIT is at the top, above everything waiting, because the two are
 * one question asked twice: what is waiting does not say whether anything was
 * ever recorded here, and a directory olai has never committed in looks exactly
 * like one it committed a minute ago if you only count what is pending.
 *
 * The MESSAGE is a suggestion and not a decision: it arrives composed from what
 * is ticked, and the moment somebody types in the box it is theirs.
 *
 * Every word on screen comes from `./said.ts`. Nothing here decides what a
 * change is called, which is what keeps the panel's vocabulary and the commit
 * log's from being kept in step by hand.
 */

import { isReady } from "@olai/format"
import { createSignal, Show } from "solid-js"

import { agoOf } from "./ago.ts"
import { type Anchor, styleOf } from "../anchor.ts"
import { LAYER } from "../layer.ts"
import { because, scopeOf, trouble, verbatim, waitingIn, WHO } from "./said.ts"
import { Others } from "./Others.tsx"
import { Outlines } from "./Outlines.tsx"
import { createSelection } from "./selection.ts"
import type { Commit } from "./state.ts"
import { TESTID } from "../testids.ts"
import { Unpushed } from "./Unpushed.tsx"

export function Panel(props: {
  readonly commit: Commit
  readonly now: number
  /** Where to sit, in viewport pixels — see `../anchor.ts` for why this is not
   *  a matter of CSS alone. */
  readonly at: Anchor
  /** Register this surface with the click-away, since it is portalled and so is
   *  not a descendant of the control that opened it. */
  readonly inside: (el: HTMLElement | undefined) => void
}) {
  const pending = () => props.commit.pending()
  const ready = () => isReady(pending().repo)
  const selection = createSelection(pending)

  /**
   * The draft: the composed suggestion until somebody types, and theirs
   * afterwards.
   *
   * `null` is "nobody has typed", which is what lets the box follow the
   * selection — untick a file and the message stops naming it — while never
   * overwriting a sentence a person is in the middle of writing. It used to be
   * seeded once at open, which was the same promise made with less: the box
   * could not recompose, because it had no way to tell a stale seed from an
   * edit.
   */
  const [typed, setTyped] = createSignal<string | null>(null)
  const draft = () => typed() ?? selection.message()

  /**
   * Whether there is anything at all to record.
   *
   * The pill's own count, read as a fence (`waitingIn`, in `./said.ts`), rather
   * than a second sum of its own. They were two sums for a while and they
   * disagreed: a served outline whose bytes moved with no NODE moving was drawn
   * here and counted nowhere, so the pill said `committed` over a panel offering
   * to commit it. `waitingIn` counts the rows this panel draws, so its
   * positivity is this question.
   */
  const anything = () => waitingIn(pending()) > 0

  /** Nothing ticked is a button with nothing to do, and it says so by being
   *  disabled rather than by refusing afterwards: the server would answer
   *  `NothingToCommit`, which is a correct answer to a question nobody meant to
   *  ask. */
  const nothingTicked = () => selection.paths()?.length === 0

  return (
    <section
      ref={props.inside}
      class={`fixed ${LAYER.over} flex flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-lg border border-rule/70 bg-panel p-3 text-sm shadow-lg focus:outline-none`}
      style={styleOf(props.at)}
      // Focusable, never in the tab order — see `settings/Panel.tsx`, and
      // `../popover.ts` for why a portalled panel has to take the caret itself.
      tabindex="-1"
      data-testid={TESTID.commitPanel}
      data-repo={pending().repo._tag}
      aria-label="uncommitted changes"
    >
      {/* What was last recorded, and by whom — the other half of the question
          "is this directory being audited". `null` is not an absence to hide:
          it means olai has never committed here, which is the one thing a
          count of what is pending can never say. */}
      <p class="wrap-anywhere text-xs text-muted" data-testid={TESTID.commitLast}>
        <Show
          when={pending().last}
          fallback={<>olai has not committed in this directory yet</>}
        >
          {(last) => (
            <>
              <span class="text-ink">{last().message}</span>
              {" · "}
              {last().writer === null ? "writer not recorded" : WHO[last().writer!]}
              {" · "}
              {agoOf(last().at, props.now)}
              {" · "}
              <span class="font-mono">{last().sha.slice(0, 7)}</span>
            </>
          )}
        </Show>
      </p>

      <Show when={pending().outlines.length > 0}>
        <Rule>outlines</Rule>
        <Outlines
          outlines={pending().outlines}
          changes={pending().changes}
          served={pending().served}
          selection={selection}
        />
      </Show>

      <Show when={pending().others.length > 0}>
        <Rule>other files</Rule>
        <Others others={pending().others} selection={selection} />
      </Show>

      {/* A dirty outline nobody can parse is still going to be committed — the
          bytes are the bytes — but nothing can be said about what changed in
          it, and saying nothing at all would be the panel lying by omission. */}
      <Show when={pending().unreadable.length > 0}>
        <p class="wrap-anywhere text-xs text-muted" data-testid={TESTID.commitUnreadable}>
          {pending().unreadable.join(", ")} changed, but does not parse — what
          is in it cannot be shown.
        </p>
      </Show>

      {/* What all of that is a list OF. It is drawn whenever there is a list,
          because "why is my README in here" is a question the rows themselves
          cannot answer. */}
      <Show when={anything()}>
        <p class="text-xs text-muted" data-testid={TESTID.commitScope}>
          {scopeOf(pending().served)}
        </p>
      </Show>

      {/* Intent, never truth: this is a count the server keeps in memory and
          clears on a commit, so it is empty after a restart and knows nothing
          about an edit made in vim. Absent is a perfectly good answer. */}
      <Show when={pending().wrote.length > 0}>
        <p class="text-xs text-muted" data-testid={TESTID.commitWriters}>
          {pending().wrote.map((wrote, at) =>
            `${at > 0 ? " · " : ""}${WHO[wrote.writer] ?? wrote.writer} ${wrote.ops}`
          ).join("")}
        </p>
      </Show>

      {/* Why the button is disabled — said, rather than left for somebody to
          work out from a control that does nothing. Git's own words are the
          title, because they are what you would paste into a search.

          Two tones, the same two the pill wears and for the same reason: a
          repository mid-rebase is amber, because it will take a commit once
          that is finished, and a git that FAILED is alarm, because it will not.
          One line painting both the same would be telling a reader that a
          broken git is a thing they are in the middle of. */}
      <Show when={!ready()}>
        <p
          class={`text-xs ${
            pending().repo._tag === "Unusable" ? "text-alarm" : "text-doing"
          }`}
          data-testid={TESTID.commitBlocked}
          title={verbatim(pending().repo)}
        >
          ⚠ {because(pending().repo)}
        </p>
      </Show>

      <Show when={anything()}>
        <textarea
          // Tall enough for a composed message, which is a subject, a blank
          // line and its first detail line: the shorter box cut the detail in
          // half and looked like a rendering fault rather than a scroll.
          class="min-h-24 w-full resize-y rounded border border-rule bg-paper p-2 font-mono text-xs"
          data-testid={TESTID.commitMessage}
          aria-label="commit message"
          value={draft()}
          onInput={(event) => setTyped(event.currentTarget.value)}
        />
      </Show>

      <Show when={trouble(props.commit.attempt())}>
        {(said) => (
          <p class="text-xs text-alarm" data-testid={TESTID.commitRefused}>
            {said()}
          </p>
        )}
      </Show>

      {/* What is recorded and not shared. Below the message because it is about
          commits that already happened, and drawn whether or not anything is
          waiting — a clean tree with three unpushed commits is exactly when a
          person goes looking for this. */}
      <Unpushed commit={props.commit} />

      <Show when={anything()}>
        <button
          type="button"
          class="self-end rounded border border-rule px-3 py-1.5 text-xs hover:text-ink disabled:opacity-50"
          data-testid={TESTID.commitNow}
          disabled={!ready() || props.commit.working() || nothingTicked()}
          onClick={() => props.commit.commit(draft(), selection.paths())}
        >
          {props.commit.working()
            ? "Committing…"
            : label(selection.changes().length, selection.others().length)}
        </button>
      </Show>
    </section>
  )
}

/** A section heading, drawn as a rule with a word on it: the two kinds of row
 *  are two different claims about a file, and a reader scanning the list should
 *  not have to infer where one stops. */
function Rule(props: { readonly children: string }) {
  return (
    <p class="flex items-center gap-2 text-[0.65rem] uppercase tracking-wide text-muted">
      <span class="shrink-0">{props.children}</span>
      <span class="h-px grow bg-rule" aria-hidden="true" />
    </p>
  )
}

/**
 * The button says how much it is about to record, in the two counts a commit
 * now has.
 *
 * Both halves, because a commit can be entirely one or entirely the other: a
 * person who edited two documents by hand and nothing else would otherwise be
 * offered a bare "Commit" for work the panel had just listed. Bare "Commit" is
 * kept for the one case where neither can be counted — a dirty outline nothing
 * could be parsed in.
 */
const label = (changes: number, others: number): string => {
  const parts = [
    ...(changes === 0 ? [] : [`${changes} ${changes === 1 ? "change" : "changes"}`]),
    ...(others === 0 ? [] : [`${others} ${others === 1 ? "file" : "files"}`]),
  ]
  return parts.length === 0 ? "Commit" : `Commit ${parts.join(" · ")}`
}
