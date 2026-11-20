import { TESTID } from "olai-plugin-markdown/testids"
import { Dynamic } from "solid-js/web"
import { BODY_REFUSED } from "@olai/surface"



export function BodyRefused(props: {
  readonly class?: string
  readonly as?: "p" | "span"
}) {
  return <Dynamic component={props.as ?? "p"}
    class={props.class ?? "m-0 italic text-alarm"}
    data-testid={TESTID.bodyRefused} data-tone="alarm" role="alert">{BODY_REFUSED}</Dynamic>
}
