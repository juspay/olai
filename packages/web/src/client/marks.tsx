import type { InTheWay, Status } from "@olai/format"
import { Match, Switch } from "solid-js"

export type MarkFace =
  | "bullet"
  | "checked"
  | "crossed"
  | "doing"
  | "empty"
  | "waiting"

export const FACE: Record<
  Status,
  { readonly face: Exclude<MarkFace, "waiting" | "bullet">; readonly hint: string; readonly tone: string }
> = {
  done: { face: "checked", hint: "Done", tone: "text-done" },
  cancelled: { face: "crossed", hint: "Cancelled", tone: "text-muted" },
  doing: { face: "doing", hint: "Doing", tone: "text-accent" },
  todo: { face: "empty", hint: "Not started", tone: "text-muted" },
}

export const BULLET_TONE = "text-ink"

export const blockedBy = (blocked: ReadonlyArray<InTheWay>): string =>
  `blocked by ${blocked.map((one) => one.at.node.title).join(", ")}`

export const faceOf = (
  status: Status | undefined,
  blocked: ReadonlyArray<InTheWay>,
): MarkFace => {
  if (status === undefined) return "bullet"
  return blocked.length > 0 ? "waiting" : FACE[status].face
}

export const DOT = "block h-[0.45rem] w-[0.45rem] rounded-full"

const BOX =
  "inline-block h-[0.8125rem] w-[0.8125rem] shrink-0 rounded-[0.2rem] border-[1.5px] border-current box-border"

export function Face(props: { readonly face: MarkFace }) {
  return (
    <Switch>
      <Match when={props.face === "bullet"}>
        <span class={`${DOT} bg-current`} />
      </Match>
      <Match when={props.face === "empty"}>
        <span class={`${BOX} bg-transparent`} />
      </Match>
      <Match when={props.face === "doing"}>
        <span
          class={`${BOX} bg-[linear-gradient(to_right,currentColor_49%,transparent_50%)]`}
        />
      </Match>
      <Match when={props.face === "checked"}>
        <span class={`${BOX} relative bg-transparent`}>
          <span
            class="absolute left-[0.12rem] top-[0.02rem] h-[0.4rem] w-[0.22rem] rotate-45 border-b-[1.5px] border-r-[1.5px] border-current"
            aria-hidden="true"
          />
        </span>
      </Match>
      <Match when={props.face === "crossed"}>
        <span class={`${BOX} relative bg-transparent`}>
          <span
            class="absolute left-1/2 top-1/2 h-[0.5rem] w-[1.5px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current"
            aria-hidden="true"
          />
          <span
            class="absolute left-1/2 top-1/2 h-[0.5rem] w-[1.5px] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current"
            aria-hidden="true"
          />
        </span>
      </Match>
      <Match when={props.face === "waiting"}>
        <svg
          class="h-[0.75rem] w-[0.75rem]"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 2h10M3 14h10M4 2c0 3.5 2 4.5 4 6-2 1.5-4 2.5-4 6M12 2c0 3.5-2 4.5-4 6 2 1.5 4 2.5 4 6"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </Match>
    </Switch>
  )
}
