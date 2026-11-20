import { TESTID } from "olai-plugin-outlines/testids"
import { type RegularNode, storedMarker, tookOf } from "@olai/format"
import { Match, Switch } from "solid-js"

import { instantOf } from "@olai/web/client/clock.ts"

import { Tip } from "@olai/web/client/Tip.tsx"
import { createNow, liveOf, liveStoryOf, roundOf, settledStoryOf, tickingOf, wordsOf } from "@olai/web/client/duration.ts"

const CHIP = "shrink-0 rounded-full px-2 tabular-nums text-label"

const SETTLED = `${CHIP} text-muted bg-desk`

const GOING = `${CHIP} text-accent bg-accent/10 tabular-nums`

function GoingChip(props: { readonly started: string; readonly worked: number | undefined }) {
  const now = createNow(() => props.started)
  const banked = () => props.worked ?? 0
  const story = () => liveStoryOf(props.worked, props.started, now()).join("\n")
  return (
    <Tip text={story()} say>
      <span
        class={GOING}
        data-testid={TESTID.took}
        data-status="doing"
        data-started={props.started}
      >
        ⏱ {tickingOf(liveOf(banked(), instantOf(props.started) ?? now(), now()))}
      </span>
    </Tip>
  )
}

export function TookChip(props: {
  readonly node: RegularNode
}) {
  const took = () => {
    const seconds = tookOf(props.node)
    return seconds === undefined ? undefined : { seconds }
  }
  return (
    <Switch>
      <Match
        when={storedMarker(props.node) === "doing" &&
            props.node.started !== undefined &&
            instantOf(props.node.started) !== null
          ? props.node.started
          : undefined}
      >
        {(started) => <GoingChip started={started()} worked={props.node.worked} />}
      </Match>
      <Match when={took()}>
        {(chip) => {
          const story = () => {
            const mark = storedMarker(props.node)
            return settledStoryOf({
              took: chip().seconds,
              banked: props.node.worked,
              round: roundOf(
                props.node.started,
                mark === "done" || mark === "cancelled" ? props.node[mark] : undefined,
              ),
            }).join("\n")
          }
          return (
            <Tip text={story()} say>
              <span
                class={SETTLED}
                data-testid={TESTID.took}
                data-status={storedMarker(props.node)}
                data-took={chip().seconds}
              >
                ⏱ {wordsOf(chip().seconds)}
              </span>
            </Tip>
          )
        }}
      </Match>
    </Switch>
  )
}
