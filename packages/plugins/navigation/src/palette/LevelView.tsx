import { actionHref } from "./items.ts"
import { useRouter } from "../routing.tsx"
import { Key } from "@solid-primitives/keyed"
import { type Accessor, createComputed, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { needlesFrom } from "@olai/format"
import { TESTID } from "olai-plugin-navigation/testids"
import { Result } from "olai-plugin-search/ui/Result.tsx"
import { fileClaims } from "../pages.ts"
import { paletteCrumbs } from "../faces.ts"
import type { PaletteItem } from "./items.ts"
import type { Crumb, Live } from "./level-owner.ts"
import type { PaletteOption } from "./levels.ts"
import { PALETTE_ROW } from "./row-testids.ts"

const createHeadings = (rows: Accessor<ReadonlyArray<{ readonly id: string; readonly section?: string }>>) => {
  const [headings, setHeadings] = createStore<Record<string, string | undefined>>({})
  createComputed(() => {
    const next = new Map<string, string | undefined>()
    let before: string | undefined
    for (const row of rows()) {
      next.set(row.id, row.section !== undefined && row.section !== before ? row.section : undefined)
      before = row.section
    }
    for (const id of Object.keys(headings)) if (!next.has(id) && headings[id] !== undefined) setHeadings(id, undefined)
    for (const [id, heading] of next) if (headings[id] !== heading) setHeadings(id, heading)
  })
  return (id: string) => headings[id]
}

export function LevelView(props: {
  readonly live: Live
  readonly crumb: Crumb
  readonly busy: boolean
  readonly items: ReadonlyArray<PaletteItem>
  readonly lit: (index: number) => boolean
  readonly options: ReadonlyArray<PaletteOption> | undefined
  readonly chosen: (id: string | undefined) => boolean
  readonly needles: ReturnType<typeof needlesFrom>
  readonly onHover: (index: number) => void
  readonly onSelect: (item: PaletteItem) => void
  readonly onNavigate: () => void
  readonly onOption: (option: PaletteOption) => void
  readonly onSubmit: () => void
}) {
  const router = useRouter()
  const rowHeading = createHeadings(() => props.items)
  const optionHeading = createHeadings(() => props.options ?? [])
  const SectionHeading = (heading: { readonly text: string }) => (
    <p
      class="m-0 px-3 pb-0.5 pt-2 text-caption font-semibold uppercase tracking-wider text-muted"
      data-testid={TESTID.paletteSection}
      role="presentation"
    >
      {heading.text}
    </p>
  )
  const busy = () => props.busy
  return (
    <div
      class="flex min-h-0 flex-1 flex-col md:flex-none"
      data-testid={TESTID.paletteLevel}
      data-id={props.crumb.id}
      data-kind={props.live.level.kind}
      data-busy={busy() ? "true" : "false"}
      aria-busy={busy()}
    >
      <Show
        when={props.options}
        fallback={
          <ul
            class="m-0 min-h-0 flex-1 list-none overflow-x-hidden overflow-y-auto p-1 md:max-h-72 md:flex-none"
            data-testid={TESTID.paletteList}
          >
            <Key
              each={props.items}
              by="id"
              fallback={
                <Show when={props.live.level.hint === undefined}>
                  <li class="px-3 py-2 text-label text-muted">No matches</li>
                </Show>
              }
            >
              {(item, index) => (
                <li>
                  <Show when={rowHeading(item().id)}>{(text) => <SectionHeading text={text()} />}</Show>
                  <Result
                    claims={fileClaims()}
                    href={actionHref(router.routes, item().action)}
                    onNavigate={props.onNavigate}
                    label={item().label}
                    from={item().from}
                    needles={props.needles}
                    hint={item().hint ?? (item().action.kind === "level" ? "›" : undefined)}
                    place={item().place}
                    props={item().props}
                    faces={paletteCrumbs()}
                    active={props.lit(index())}
                    testids={PALETTE_ROW}
                    id={item().id}
                    onHover={() => props.onHover(index())}
                    onSelect={() => props.onSelect(item())}
                  />
                </li>
              )}
            </Key>
            <LevelHint text={props.live.level.hint} />
          </ul>
        }
      >
        {(options) => (
          <div
            class="m-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-1 md:max-h-72 md:flex-none"
            role="radiogroup"
            aria-label={props.crumb.label}
            data-testid={TESTID.paletteList}
          >
            <For each={options()}>
              {(option) => (
                <>
                  <Show when={optionHeading(option.id)}>{(text) => <SectionHeading text={text()} />}</Show>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={props.chosen(option.id)}
                    class={`flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-control px-3 py-1.5 text-left text-body text-ink ${
                      props.chosen(option.id) ? "bg-ink/8" : "hover:bg-ink/5"
                    }`}
                    data-testid={TESTID.paletteOption}
                    data-id={option.id}
                    data-chosen={props.chosen(option.id) ? "true" : "false"}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => props.onOption(option)}
                  >
                    <span
                      class={`size-3 shrink-0 rounded-full border-2 ${
                        props.chosen(option.id) ? "border-accent bg-accent" : "border-muted"
                      }`}
                      aria-hidden="true"
                    />
                    <span class="flex min-w-0 flex-1 flex-col">
                      <span class="truncate">{option.label}</span>
                      <Show when={option.place}>
                        {(place) => <span class="truncate text-caption text-muted">{place()}</span>}
                      </Show>
                    </span>
                    <Show when={option.hint}>
                      {(hint) => <span class="shrink-0 text-caption text-muted">{hint()}</span>}
                    </Show>
                  </button>
                </>
              )}
            </For>
            <LevelHint text={props.live.level.hint} tag="p" />
          </div>
        )}
      </Show>
      <div
        class="flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-1 border-t border-rule px-4 py-2 text-caption text-muted"
        data-testid={TESTID.paletteFooter}
      >
        <Show
          when={props.options !== undefined && props.live.level.kind === "value" ? props.live.level : undefined}
          fallback={<span><kbd class="text-ink">↵</kbd> choose</span>}
        >
          {(level) => (
            <>
              <button
                type="button"
                class="cursor-pointer rounded-control bg-pill px-2 py-0.5 font-medium text-ink hover:bg-rule disabled:cursor-default disabled:opacity-60"
                data-testid={TESTID.paletteSubmit}
                disabled={busy()}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => props.onSubmit()}
              >
                <span hidden={busy()}><kbd>↵</kbd> {level().submitLabel ?? "Submit"}</span>
                <span hidden={!busy()}>Working…</span>
              </button>
              <span><kbd class="text-ink">↑↓</kbd> choose</span>
            </>
          )}
        </Show>
        <span><kbd class="text-ink">⌫</kbd> back</span>
      </div>
    </div>
  )
}

function LevelHint(props: { readonly text: string | undefined; readonly tag?: "li" | "p" }) {
  return (
    <Show when={props.text}>
      {(text) => props.tag === "p"
        ? <p class="m-0 px-3 py-2 text-label text-muted" data-testid={TESTID.paletteHint}>{text()}</p>
        : <li class="px-3 py-2 text-label text-muted" data-testid={TESTID.paletteHint}>{text()}</li>}
    </Show>
  )
}

