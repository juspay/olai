import { TESTID } from "olai-plugin-outlines/testids"
import { type JSX, Match, Show, Switch } from "solid-js"

import { foldSays } from "@olai/web/client/hidden.ts"
import type { Hot } from "./hot.ts"
import { ProgressBadge } from "@olai/web/client/ProgressBadge.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"


export function Aside(props: {
  readonly hot: Hot | undefined
  readonly folded?: number
}) {
  const rollup = () =>
    props.hot?.kind === "progress" ? props.hot.progress : undefined
  const fold = () => foldSays(props.folded, rollup())

  return (
    <>
      <Switch>
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
