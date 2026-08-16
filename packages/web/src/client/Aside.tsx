/**
 * What rides inline after a title, dim, and nothing else does.
 *
 * The quiet outline's ruling in one component: a folded row is its title, plus
 * at most ONE hot fact (`./hot.ts`) — and, when the row is collapsed, the count
 * of finished work it is holding back (`./hidden.ts`). Both are drawn in the
 * same muted voice as the tags beside them, both are `shrink-0` so an
 * ellipsizing title never eats them, and neither is a box, a pill or a column.
 *
 * A component rather than two `<Show>`s at the drawing site, because the RULE is
 * the thing: "one fact, and the fold's own count" is a claim about the row, and
 * two copies of it in a tree and a day page is where a third fact starts
 * appearing on one of them — and because the two are not independent. THE COUNT
 * STANDS DOWN WHERE THE ROLLUP ALREADY SAYS IT (human's ruling, after this
 * shipped drawing `3/4 +3 done` on the same line): `foldSays` is that comparison
 * and argues why it is a comparison rather than a blanket rule. Here, in the one
 * place both values meet, is the only place that decision can be made at all.
 */

import { Match, Show, Switch } from "solid-js"

import { foldSays } from "./hidden.ts"
import type { Hot } from "./hot.ts"
import { ProgressBadge } from "./ProgressBadge.tsx"
import { TESTID } from "./testids.ts"

export function Aside(props: {
  /** The one fact, when there is one. */
  readonly hot: Hot | undefined
  /** How many finished rows this row's fold is hiding — `undefined` on a row
   *  that is not collapsed, and `0` is not drawn either: a branch holding back
   *  nothing finished says nothing. */
  readonly folded?: number
}) {
  /** The rollup this row is already drawing, when the one hot fact is one. */
  const rollup = () =>
    props.hot?.kind === "progress" ? props.hot.progress : undefined
  /** ...and what is left for the fold to say after it. */
  const fold = () => foldSays(props.folded, rollup())

  return (
    <>
      <Switch>
        {/* The rollup is its own label — `3/5` needs no key in front of it —
            so it keeps the badge it has always been. */}
        <Match when={props.hot?.kind === "progress" ? props.hot : undefined}>
          {(hot) => <ProgressBadge progress={hot().progress} />}
        </Match>
        <Match when={props.hot?.kind === "prop" ? props.hot : undefined}>
          {(prop) => (
            <span
              class="shrink-0 text-xs text-muted"
              data-testid={TESTID.hotFact}
              data-key={prop().key}
              title={prop().full}
            >
              <span class="font-mono">{prop().key}</span> {prop().text}
            </span>
          )}
        </Match>
      </Switch>
      <Show when={fold()}>
        {(count) => (
          <span
            class="shrink-0 font-mono text-xs text-muted"
            data-testid={TESTID.foldedDone}
            data-done={String(count())}
            title={`${count()} finished row(s) are folded under this one, and the rollup beside it does not count them`}
          >
            +{count()} done
          </span>
        )}
      </Show>
    </>
  )
}
