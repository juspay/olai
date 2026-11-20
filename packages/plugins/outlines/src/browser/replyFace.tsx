import { useRouter } from "olai-plugin-navigation/routing"
import { atNode } from "olai-plugin-navigation/routes"
import { writeIn } from "./reply.ts"
export { fileOf } from "./reply.ts"
import { servedDirectory } from "./vault.ts"
import { createMemo, Show } from "solid-js"

import { GLYPH, SAID } from "../contracts/changes.ts"
import { renderTitle } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import { TESTID } from "../testids.ts"

export function story(input: { reply: unknown }) {
  const wrote = createMemo(() => writeIn(input.reply))
  return <Show when={wrote()}>{value => <Story wrote={value()} />}</Show>
}

function Story(props: { readonly wrote: NonNullable<ReturnType<typeof writeIn>> }) {
  const router = useRouter()
  const said = () => (props.wrote.sort === null ? "No change" : SAID[props.wrote.sort])
  const glyph = () => (props.wrote.sort === null ? "·" : GLYPH[props.wrote.sort])

  return (
    <div
      class="border-t border-rule px-2 py-1 text-label"
      data-testid={TESTID.outlinesStory}
      data-sort={props.wrote.sort ?? "unchanged"}
    >
      <p class="flex items-baseline gap-2">
        <span class="w-3 shrink-0 text-muted" aria-hidden="true">{glyph()}</span>
        <Show
          when={props.wrote.id}
          fallback={
            <span class="min-w-0 truncate text-ink">
              <TitleHtml
                drawing={renderTitle(servedDirectory()?.claims(), props.wrote.title, props.wrote.file ?? "", {
                  links: false,
                })}
              />
            </span>
          }
        >
          {(id) => (
            <a href={router.routes.href(atNode(id()))} class="min-w-0 truncate text-accent hover:underline" data-testid={TESTID.outlinesStoryRef}>
              <TitleHtml
                drawing={renderTitle(servedDirectory()?.claims(), props.wrote.title, props.wrote.file ?? "", {
                  links: false,
                })}
              />
            </a>
          )}
        </Show>
        <span class="ml-auto shrink-0 text-muted">{said()}</span>
      </p>
      <Show when={props.wrote.nudge}>
        {(nudge) => (
          <p class="pl-5 text-muted" data-testid={TESTID.outlinesNudge}>{nudge()}</p>
        )}
      </Show>
    </div>
  )
}
