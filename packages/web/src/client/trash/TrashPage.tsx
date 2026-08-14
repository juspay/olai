/**
 * The trash: what was put away, kept whole, and the one way back out.
 *
 * This is `Archive.jsonl` made visible — every archive under the directory,
 * drawn as the tree the archive op wrote: the scaffold of ancestor titles,
 * and the subtrees hanging off it exactly as they left. The web calls it
 * TRASH because that is what it is to a person (Workflowy's word, and the
 * confirm's promise); the file keeps its name, the ops vocabulary keeps
 * `archive_node`, and only this human-facing surface renames anything.
 *
 * IT IS NOT A PLACE YOU EDIT, and that is drawn rather than fenced: no
 * editor mounts here, no `•••`, no checkbox, no date pill — a row is its
 * title and the one verb a trash row has, **Put back**, which sends the
 * `unarchive` edit with the id alone. Where the subtree returns is the ops
 * layer's own answer (the recorded chain of ancestor titles, matched back
 * against the live outlines), a refusal comes back in the ops layer's own
 * words under the row, and ⌘Z after a put-back archives it again — the
 * inverse the server records. An agent's `unarchive_node` is the same call,
 * which is what HACKING.md's consistency rule demands of a new verb.
 *
 * An EMPTY trash is a page that says so, not an error: the archive tool
 * re-creates `Archive.jsonl` on first use, so a directory with no archive
 * file and one whose archives hold nothing are the same fact, and both are
 * drawn the same way.
 */

import { isMirror, type Row, rowsOf } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, Match, Show, Switch } from "solid-js"

import { useDerived } from "../derived.tsx"
import { SaidLine } from "../edit/SaidLine.tsx"
import { useUndo } from "../edit/undoing.ts"
import { NodeTitle } from "../NodeTitle.tsx"
import { createSaying } from "../saying.ts"
import { TESTID } from "../testids.ts"
import { applying } from "../writes.ts"

export function TrashPage(props: {
  /** Every archive the directory holds, in path order (`page.ts`). */
  readonly files: ReadonlyArray<string>
}) {
  const derived = useDerived()

  // Only the archives with anything in them: an archive emptied by put-backs
  // draws nothing, exactly like one that never existed — and "the trash is
  // empty" is then simply this list being empty, not a second predicate.
  const groups = createMemo(() => {
    const indexes = derived()
    return indexes === undefined ? [] : props.files
      .map((file) => ({ file, rows: rowsOf(indexes, file) }))
      .filter((group) => group.rows.length > 0)
  })

  return (
    <div data-testid={TESTID.trashPage} class="mx-auto max-w-3xl">
      <header class="mb-4">
        <h1 class="m-0 text-xl font-semibold text-ink">Trash</h1>
        <p class="m-0 mt-1 text-sm text-muted">
          What was archived, kept whole. Put a row back and it returns where it
          came from, everything under it included.
        </p>
      </header>
      <Show
        when={groups().length > 0}
        fallback={
          <p class="text-muted" data-testid={TESTID.trashEmpty}>
            The Trash is empty.
          </p>
        }
      >
        <Key each={groups()} by="file">
          {(group) => (
            <section data-testid={TESTID.trashGroup} data-file={group().file}>
              {/* One archive is the ordinary case and needs no heading; a
                  directory whose subdirectories archive separately gets one
                  per file, the way the day page groups by outline. */}
              <Show when={props.files.length > 1}>
                <h2 class="mb-1 mt-4 text-sm font-medium text-muted">
                  {group().file}
                </h2>
              </Show>
              <Rows rows={group().rows} />
            </section>
          )}
        </Key>
      </Show>
    </div>
  )
}

function Rows(props: {
  readonly rows: ReadonlyArray<Row>
}) {
  return (
    <ul class="m-0 list-none p-0">
      <Key each={props.rows} by="key">
        {(row) => <Branch row={row()} />}
      </Key>
    </ul>
  )
}

function Branch(props: {
  readonly row: Row
}) {
  const undo = useUndo()
  /** The line under this row, and the six seconds it lasts — the same
   *  receptacle the `•••` menu's line rides on (`../saying.ts`), which is
   *  where the three rules around it live now that two surfaces keep them. */
  const { said, say } = createSaying()

  // The id the verb names is the ROW's own record — for the one row that
  // offers it, a regular node, so it is the id `unarchive_node` takes. A
  // placement in the trash draws as the footnote it is and offers nothing:
  // the way to take a mirror out is to put its node back.
  const putBack = async () => {
    const answer = await applying(
      { verb: "unarchive", id: props.row.at.node.id },
      undo.record,
    )
    // A landed put-back removes this row on the next frame, so what lingers
    // here is the half worth reading in place: the refusal, verbatim, or a
    // nudge from a write that happened. Handed straight through — an answer
    // of `undefined` is "nothing to say", which `say` reads as clearing the
    // line rather than as a sentence.
    say(answer)
  }

  return (
    <li data-testid={TESTID.trashRow} data-node-id={props.row.at.node.id}>
      <div class="group flex min-h-6 items-baseline gap-2 py-0.5">
        <span class="select-none text-muted" aria-hidden="true">
          {isMirror(props.row.at.node) ? "⇢" : "•"}
        </span>
        <span
          class="flex-1 text-ink"
          classList={{ "line-through opacity-60": props.row.status === "done" }}
        >
          <Title row={props.row} />
        </span>
        <Show when={props.row.kind === "node" ? props.row : undefined}>
          {(row) => (
            <button
              type="button"
              class="shrink-0 rounded border border-rule/70 bg-panel px-2 py-0.5 text-xs text-muted opacity-0 transition-opacity hover:bg-rule/60 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              data-testid={TESTID.trashPutBack}
              aria-label={`put back “${row().shows.node.title}”`}
              onClick={() => void putBack()}
            >
              Put back
            </button>
          )}
        </Show>
      </div>
      <Show when={said()}>
        {(line) => (
          // The mood is `../edit/SaidLine.tsx`'s, for every surface that says
          // something about a write; where the line sits is this row's.
          <SaidLine
            said={line()}
            class="m-0 mb-1 ml-6 text-sm"
            testid={TESTID.trashSaid}
          />
        )}
      </Show>
      <Show when={props.row.children.length > 0}>
        <div class="ml-5">
          <Rows rows={props.row.children} />
        </div>
      </Show>
    </li>
  )
}

/** What a trash row is called. A node or a mirror says the title of the node
 *  it shows, rendered the one way titles are; the two degenerate kinds a
 *  condemned set could hold say the outline tree's own sentences (`Tree.tsx`,
 *  quoted — a reader who meets the same broken record on two pages should
 *  read the same words about it). */
function Title(props: {
  readonly row: Row
}) {
  return (
    <Switch>
      <Match
        when={props.row.kind === "node" || props.row.kind === "mirror"
          ? props.row
          : undefined}
      >
        {(row) => <NodeTitle title={row().shows.node.title} from={row().shows.file} />}
      </Match>
      <Match when={props.row.kind === "dangling" ? props.row : undefined}>
        {(row) => (
          <span class="text-muted">
            a mirror of `{row().missing}`, which no node declares
          </span>
        )}
      </Match>
      <Match when={props.row.kind === "cycle" ? props.row : undefined}>
        {(row) => (
          <span class="text-muted">
            this mirror is inside the subtree it shows (`{row().through}`) — not
            expanded
          </span>
        )}
      </Match>
    </Switch>
  )
}
