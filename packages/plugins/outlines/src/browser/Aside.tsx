/**
 * What rides inline after a title, dim, and nothing else does.
 *
 * The quiet outline's ruling in one component: a folded row is its title, plus
 * at most ONE hot fact (`./hot.ts`) — and, when the row is collapsed, the count
 * of finished work it is holding back (`./hidden.ts`). Both are drawn in the
 * muted voice of a byline, both are `shrink-0` so a
 * long title wraps rather than eating them, and neither is a box, a pill or a column.
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
import { TESTID } from "olai-plugin-outlines/testids"
import { type JSX, Match, Show, Switch } from "solid-js"

import { foldSays } from "@olai/web/client/hidden.ts"
import type { Hot } from "./hot.ts"
import { ProgressBadge } from "@olai/web/client/ProgressBadge.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"


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
          {(prop) => {
            const fact = (): JSX.Element => (
              <span
                class="shrink-0 text-label text-muted"
                data-testid={TESTID.hotFact}
                data-key={prop().key}
              >
                <span class="font-mono">{prop().key}</span> {prop().text}
              </span>
            )
            // ONLY WHERE THE WORDS ARE SHORT FOR SOMETHING: `full` is absent
            // when the drawn text IS the value (`./hot.ts`), and a tip that
            // repeated the words under the pointer would be the row read
            // twice. Where it is there, `say` gives the same sentence to
            // everybody else.
            return (
              <Show when={prop().full} fallback={fact()}>
                {(full) => (
                  <Tip text={full()} say>
                    {fact()}
                  </Tip>
                )}
              </Show>
            )
          }}
        </Match>
      </Switch>
      <Show when={fold()}>
        {(count) => {
          const said = (): string =>
            `${count()} finished ${count() === 1 ? "row" : "rows"} folded here`
          return (
            // `+3 done` is a count and a word; what those three stand for —
            // rows, finished, held back by THIS fold — was the tooltip's
            // alone. Same shape as the fact above it.
            <Tip text={said()} say>
              <span
                class="shrink-0 tabular-nums text-label text-muted"
                data-testid={TESTID.foldedDone}
                data-done={String(count())}
              >
                +{count()} done
              </span>
            </Tip>
          )
        }}
      </Show>
    </>
  )
}
