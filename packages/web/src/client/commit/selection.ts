/**
 * WHICH of the waiting files this commit is going to record.
 *
 * A selection, and never git's index — the server says the same thing at its
 * end (`@olai/ops`' `pending.ts`): olai does not stage, so what is ticked here
 * is added and committed in one breath and anything a person staged by hand is
 * left exactly as they left it. What is unticked stays waiting, for its own
 * commit and its own message.
 *
 * **The state is what is NOT ticked**, which is the whole of why the panel stays
 * one click for the ordinary case. Everything is ticked by default, and a file
 * that arrives while the panel is open — the server recomputes what is waiting
 * on a timer of its own — arrives ticked, because being ticked is the absence of
 * a decision rather than a decision this component made when it happened to
 * open. Held the other way round, every sweep would have had to guess whether a
 * new path was one somebody had already unticked.
 *
 * The unit is a FILE, and for an outline that means its node changes travel
 * together: a partial `.jsonl` write is not a thing that exists, so a half-ticked
 * outline would be an offer olai cannot keep.
 *
 * Keyed by REPO-ROOT-RELATIVE path throughout, which is the one name a file has
 * that cannot collide: an outline `roadmap.jsonl` served out of `docs/` and some
 * other dirty `roadmap.jsonl` at the repository root are two rows and two ticks.
 */

import { composed, type NodeChange, type Other, type Pending } from "@olai/format"
import { type Accessor, createSignal } from "solid-js"

export interface Selection {
  /** Whether this path is going in. */
  readonly ticked: (path: string) => boolean
  readonly toggle: (path: string) => void
  /**
   * The paths to commit, or `undefined` when that is EVERYTHING waiting.
   *
   * The `undefined` is not a shortcut: an omitted selection is what the server
   * reads as a full sweep, which is what clears the per-writer counters — a
   * piecemeal commit deliberately leaves them alone, because nothing can
   * attribute one op to one file.
   */
  readonly paths: Accessor<ReadonlyArray<string> | undefined>
  /** The node changes going in, so the message and the button count what this
   *  commit will actually record rather than what happens to be dirty. */
  readonly changes: Accessor<ReadonlyArray<NodeChange>>
  /** The other files going in. */
  readonly others: Accessor<ReadonlyArray<Other>>
  /** The message for exactly this selection, composed by the same function the
   *  server composes with — so unticking a row rewrites the suggestion live and
   *  the two faces cannot word one commit differently. */
  readonly message: Accessor<string>
}

/**
 * One signal, and everything else derived from it by plain functions rather
 * than by `createMemo`.
 *
 * A memo would be a caching decision on lists whose length is what is dirty in
 * one repository — and it would cost this module its unit test, because Solid
 * resolves to its SERVER build under `bun test`, where a memo never recomputes.
 * Deriving in the open keeps the argument testable, which is the half of it
 * worth protecting: what a commit is about to name is not a thing to find out
 * by pressing the button.
 */
export const createSelection = (pending: Accessor<Pending>): Selection => {
  const [dropped, setDropped] = createSignal<ReadonlySet<string>>(new Set())
  const ticked = (path: string): boolean => !dropped().has(path)

  const toggle = (path: string) => {
    setDropped((was) => {
      const next = new Set(was)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  /** The served outlines going in, by the store's own key — which is what the
   *  node changes are keyed by, and the join the panel would otherwise have to
   *  make twice. */
  const files = (): ReadonlySet<string> => {
    const kept = new Set<string>()
    for (const outline of pending().outlines) {
      if (ticked(outline.path)) kept.add(outline.file)
    }
    return kept
  }

  const changes = () => pending().changes.filter((change) => files().has(change.file))
  const others = () => pending().others.filter((other) => ticked(other.path))

  const paths = (): ReadonlyArray<string> | undefined => {
    const every = [
      ...pending().outlines.map((outline) => outline.path),
      ...pending().others.map((other) => other.path),
    ]
    const kept = every.filter(ticked)
    return kept.length === every.length ? undefined : kept
  }

  return {
    ticked,
    toggle,
    paths,
    changes,
    others,
    message: () => composed(changes(), others()),
  }
}
