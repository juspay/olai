/**
 * What is waiting, in olai's words — and the button that records it.
 *
 * Every row here is a NODE and what changed about it: "marked done", "note
 * rewritten", "archived". There is no text diff and there will not be one — a
 * `.jsonl` diff is one enormous line per node with everything on it changing at
 * once, which is exactly the shape this format bought line-based merges with
 * and exactly the shape nobody can read.
 *
 * Grouped by file because that is the unit git will commit and the unit the
 * sidebar already lists. Ordered as the server derived them, which is the
 * outline's own order.
 *
 * The MESSAGE is a suggestion and not a decision: it arrives composed from what
 * changed, and the moment somebody types in the box it is theirs. A composed
 * message can only ever describe the edits; a person — or an agent, through its
 * own tool — can say why they were made.
 *
 * Every word on screen comes from `./said.ts`. Nothing here decides what a
 * change is called, which is what keeps the panel's vocabulary and the commit
 * log's from being kept in step by hand.
 */

import type { NodeChange } from "@olai/format"
import { createSignal, For, Show } from "solid-js"

import { because, GLYPH, SAID, trouble, verbatim, WHO } from "./said.ts"
import type { Commit } from "./state.ts"
import { TESTID } from "../testids.ts"

export function Panel(props: { readonly commit: Commit }) {
  const pending = () => props.commit.pending()
  const ready = () => pending().repo._tag === "Ready"

  /** The draft, seeded from the composed suggestion and then left alone.
   *
   *  Once, at creation, and this component is created when the panel opens —
   *  so re-opening it picks up a newer suggestion and typing in it is never
   *  overwritten. A box that re-synced would rewrite what somebody was writing
   *  every time the server recomputed what is waiting, which it does on a
   *  timer of its own. */
  const [draft, setDraft] = createSignal(pending().message)

  /** The changes, in file order, as one group per file. */
  const groups = (): ReadonlyArray<
    readonly [string, ReadonlyArray<NodeChange>]
  > => {
    const by = new Map<string, Array<NodeChange>>()
    for (const change of pending().changes) {
      const group = by.get(change.file)
      if (group === undefined) by.set(change.file, [change])
      else group.push(change)
    }
    return [...by]
  }

  return (
    <section
      class="absolute bottom-full left-0 z-50 mb-2 flex max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto rounded-lg border border-rule bg-paper p-3 text-sm shadow-lg"
      data-testid={TESTID.commitPanel}
      data-repo={pending().repo._tag}
      aria-label="uncommitted changes"
    >
      <For each={groups()}>
        {([file, changes]) => (
          <div data-testid={TESTID.commitGroup} data-file={file}>
            <p class="font-mono text-xs text-muted">{file}</p>
            <ul>
              <For each={changes}>
                {(change) => (
                  <li
                    class="flex items-baseline gap-2 py-0.5"
                    data-testid={TESTID.commitChange}
                    data-node-id={change.id}
                    data-sort={change.sort}
                    // The fields behind the word: "moved" is `parent, ord`,
                    // and a row that changed three things says which three
                    // without spending a line on it.
                    title={change.fields.join(", ")}
                  >
                    <span class="w-3 shrink-0 text-muted" aria-hidden="true">
                      {GLYPH[change.sort]}
                    </span>
                    <span class="truncate">{change.title}</span>
                    <span class="ml-auto shrink-0 text-xs text-muted">
                      {SAID[change.sort]}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </div>
        )}
      </For>

      {/* A dirty outline nobody can parse is still going to be committed — the
          bytes are the bytes — but nothing can be said about what changed in
          it, and saying nothing at all would be the panel lying by omission. */}
      <Show when={pending().unreadable.length > 0}>
        <p class="text-xs text-muted" data-testid={TESTID.commitUnreadable}>
          {pending().unreadable.join(", ")} changed, but does not parse — what
          is in it cannot be shown.
        </p>
      </Show>

      {/* Intent, never truth: this is a count the server keeps in memory and
          clears on a commit, so it is empty after a restart and knows nothing
          about an edit made in vim. Absent is a perfectly good answer. */}
      <Show when={pending().wrote.length > 0}>
        <p class="text-xs text-muted" data-testid={TESTID.commitWriters}>
          <For each={pending().wrote}>
            {(wrote, at) => (
              <>
                {at() > 0 ? " · " : ""}
                {WHO[wrote.writer] ?? wrote.writer} {wrote.ops}
              </>
            )}
          </For>
        </p>
      </Show>

      {/* Why the button is disabled — said, rather than left for somebody to
          work out from a control that does nothing. Git's own words are the
          title, because they are what you would paste into a search. */}
      <Show when={!ready()}>
        <p
          class="text-xs text-doing"
          data-testid={TESTID.commitBlocked}
          title={verbatim(pending().repo)}
        >
          ⚠ {because(pending().repo)}
        </p>
      </Show>

      <textarea
        class="min-h-16 w-full resize-y rounded border border-rule bg-paper p-2 font-mono text-xs"
        data-testid={TESTID.commitMessage}
        aria-label="commit message"
        value={draft()}
        onInput={(event) => setDraft(event.currentTarget.value)}
      />

      <Show when={trouble(props.commit.attempt())}>
        {(said) => (
          <p class="text-xs text-alarm" data-testid={TESTID.commitRefused}>
            {said()}
          </p>
        )}
      </Show>

      <button
        type="button"
        class="self-end rounded border border-rule px-3 py-1.5 text-xs hover:text-ink disabled:opacity-50"
        data-testid={TESTID.commitNow}
        disabled={!ready() || props.commit.working()}
        onClick={() => props.commit.commit(draft())}
      >
        {props.commit.working() ? "Committing…" : label(pending().changes.length)}
      </button>
    </section>
  )
}

/** The button says how much it is about to record. Bare "Commit" when the only
 *  thing waiting is a file nothing could be counted in. */
const label = (changes: number): string =>
  changes === 0
    ? "Commit"
    : `Commit ${changes} ${changes === 1 ? "change" : "changes"}`
