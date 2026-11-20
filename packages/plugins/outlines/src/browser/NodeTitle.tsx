import { servedDirectory } from "./vault.ts"
import { createMemo, Show } from "solid-js"

import { shownIn } from "olai-plugin-navigation/address/address.ts"
import { targetIn, targetFace } from "./routing.ts"
import { Face } from "olai-plugin-navigation/address/Face.tsx"
import { useNames } from "./reading.tsx"
import { renderTitle, sameDrawing } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"

export function NodeTitle(props: {
  readonly title: string
  readonly from: string
  readonly links?: boolean
  readonly wrap?: boolean
  readonly needles?: ReadonlyArray<string>
}) {
  const names = useNames()
  const address = createMemo(() => targetIn(props.title))
  const drawing = createMemo(
    () =>
      renderTitle(servedDirectory()?.claims(), props.title, props.from, {
        links: props.links,
        needles: props.needles,
      }),
    undefined,
    { equals: sameDrawing },
  )
  return (
    <Show when={address()} fallback={<TitleHtml drawing={drawing()} />}>
      {(target) => {
        const face = createMemo(() =>
          targetFace(props.title, target(), route => shownIn(names(), route))
        )
        return (
          <span class="flex min-w-0 flex-1 items-center gap-1.5">
            <Face
              target={target()}
              name={face().name}
              wrap={props.wrap}
              pressable={face().written && props.links !== false}
            />
          </span>
        )
      }}
    </Show>
  )
}
