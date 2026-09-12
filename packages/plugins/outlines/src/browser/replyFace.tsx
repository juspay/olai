import { writeIn } from "./reply.ts"
export { fileOf } from "./reply.ts"
import { servedDirectory } from "./vault.ts"
import { Show } from "solid-js"

import { GLYPH, SAID } from "../contracts/changes.ts"
import { renderTitle } from "@olai/markdown-ui/title.ts"
import { TitleHtml } from "@olai/markdown-ui/TitleHtml.tsx"
import { TESTID } from "../testids.ts"

export function story(input: { reply: unknown; show: (id: string) => void }) {
  const wrote = writeIn(input.reply)
  if (wrote === undefined) return null
  const props = { wrote }
  /** A write that changed no record has no honest word for what it did, and
   *  this is what it says instead — the one case the table cannot cover. */
  const said = () => (props.wrote.sort === null ? "nothing changed" : SAID[props.wrote.sort])
  const glyph = () => (props.wrote.sort === null ? "·" : GLYPH[props.wrote.sort])

  return (
    <div
      class="border-t border-rule px-2 py-1 text-xs"
      data-testid={TESTID.outlinesStory}
      data-sort={props.wrote.sort ?? "unchanged"}
    >
      <p class="flex items-baseline gap-2">
        <span class="w-3 shrink-0 text-muted" aria-hidden="true">{glyph()}</span>
        {/* The node itself, and pressing it shows you the row: this is the
            reference a transcript carries most often, because every write the
            agent makes through the ops layer draws one of these. `id` is the
            reply's own — a row that came back without one says the same words
            and simply does not point. */}
        {/* A NODE'S TITLE is drawn as one wherever it appears: its `#tags`
            wear pills in their own hues through the one pipeline
            (`../markdown/title.ts`), here as on a tree row. The pipeline,
            not `../NodeTitle.tsx`: this strip is no page, so a title naming
            an address shows the address as written — and `links` false,
            because the reference arm is a <button>. */}
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
            <button type="button" class="min-w-0 truncate text-accent hover:underline" data-testid={TESTID.outlinesStoryRef} data-node-ref={id()} onClick={event => { event.stopPropagation(); input.show(id()) }}>
              <TitleHtml
                drawing={renderTitle(servedDirectory()?.claims(), props.wrote.title, props.wrote.file ?? "", {
                  links: false,
                })}
              />
            </button>
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
