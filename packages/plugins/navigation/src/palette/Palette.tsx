import { actionHref } from "./items.ts"
import { fileClaims } from "../pages.ts"
import type {} from "olai-plugin-search/box"
import { paletteCrumbs, paletteOnly } from "../faces.ts"
import { TESTID } from "olai-plugin-navigation/testids"
import { type Navigation,paletteAdapters } from "../index.ts"
import { readLocation } from "../locations.ts"
import { Key } from "@solid-primitives/keyed"
import {
createEffect,
createMemo,
createSelector,
createSignal,
For,
Match,
on,
onCleanup,
onMount,
Show,
Switch,
untrack,
} from "solid-js"

import { needlesFrom } from "@olai/format"

import type { Edit } from "@olai/surface"
import { Result as Outcome } from "effect"

import { CHORDS,isEditingTarget,listKey,matchChord,matchKey,paneKey } from "@olai/web/client/keys.ts"
import { composing } from "@olai/web/client/composition.ts"
import { enterTopLayer } from "@olai/web/client/layer.ts"
import { only } from "@olai/web/client/narrow.ts"
import { paletteFaces } from "../faces.ts"
import { Refusals } from "@olai/web/client/refusals.tsx"
import { ALARM_BAND,SaidLine } from "@olai/web/client/SaidLine.tsx"
import type { Said } from "@olai/web/client/saying.ts"
import { SearchCount } from "olai-plugin-search/ui/Count.tsx"
import { createCursor } from "@olai/ui-primitives/cursor.ts"
import { createSearch } from "./reading.ts"
import { Result } from "olai-plugin-search/ui/Result.tsx"
import { atOnce,spend } from "@olai/web/client/settled.ts"

import { useToday } from "./clock.ts"
import { topmostWhileOpen } from "@olai/web/client/topmost.ts"
import { claimCloseRequest, lightDismiss } from "@olai/web/client/dismiss.ts"
import { resetSidebarWidth } from "./shell.ts"
import type { Route } from "olai-plugin-navigation/routes"
import { useRouter } from "olai-plugin-navigation/routing"
import { isLone } from "olai-plugin-navigation/workspace"
import { type Asking } from "./asking.ts"
import {
boxOf,
chordsIn,
prefixesIn,
type PalettePrefix,
filterItems,
hitItems,
type PaletteItem,
SHELL_ITEMS,
} from "./items.ts"
import {
askInPalette,
closePalette,
dropQuestion,
type OpenAt,
paletteAsking,
paletteAt,
paletteOpen,
} from "./state.ts"
import { Question } from "./Question.tsx"
import { createLevelOwner, resetLevelMemory } from "./level-owner.ts"
import { LevelView } from "./LevelView.tsx"
import { PALETTE_ROW } from "./row-testids.ts"
import { Shortcuts } from "./Shortcuts.tsx"

const ALERT_ROW = `${ALARM_BAND} px-4`


const memory = {
  query: createSignal(""),
  askError: createSignal<string | null>(null),
  said: createSignal<Said | null>(null),
  sending: createSignal(false),
}
let handledAt: OpenAt | null = null
let queryRevision = 0
let paletteRevision = 0

export function Palette(props: {
  readonly go: (route: Route) => void
  readonly toggleDirectory: () => void
}) {
  const adapters = () => readLocation(paletteAdapters).map(entry=>entry.value) ?? []
  const router = useRouter()
  const [keys, setKeys] = createSignal(false)
  const [query, writeQuery] = memory.query
  const resuming = paletteOpen()
  const setQuery = (value: string) => {
    queryRevision++
    writeQuery(value)
  }
  const setBoxText = (value: string) => {
    if (untrack(inLevel)) levels.type(value)
    else setQuery(value)
  }
  const currentInteraction = () => {
    const opened = paletteRevision
    const submitted = queryRevision
    return () => paletteRevision === opened && queryRevision === submitted
  }
  const today = useToday()
  const needles = createMemo(() => needlesFrom(query(), today()))
  const cursor = createCursor(() => items().length)
  const [chosen, setChosen] = createSignal(false)
  const lit = createSelector(() => (chosen() ? cursor.at() : -1))
  const [askError, setAskError] = memory.askError
  const [said, setSaid] = memory.said
  const [sending, setSending] = memory.sending
  let input: HTMLInputElement | undefined
  let modal: HTMLDialogElement | undefined
  onCleanup(() => { if (modal?.open === true) modal.close() })

  const prefixes = createMemo(() => prefixesIn(readLocation(paletteAdapters).flatMap(entry =>
    entry.value.prefix ? [{ owner: entry.owner, value: entry.value.prefix }] : [])))
  const chords = createMemo(() => chordsIn(paletteFaces("app.keys"), CHORDS))

  const levels = createLevelOwner({
    adapters,
    touched: () => { queryRevision++ },
    leaveRoot: () => writeQuery(""),
    relist: (lit) => {
      cursor.top()
      setChosen(lit)
    },
    hush: () => {
      setAskError(null)
      setSaid(null)
    },
    say: (line) => setSaid(line),
    refuse: (sentence) => setAskError(sentence),
    close: () => close(),
    focus: () => input?.focus(),
  })
  const { top, valueTop, crumbs } = levels
  const chosenOption = createSelector(() => levels.chosenId())
  const depth = levels.depth

  const box = createMemo(() => boxOf(query(), paletteAsking(), prefixes(), depth() > 0))
  const inLevel = () => box().kind === "level"
  const boxText = () => {
    const at = top()
    return inLevel() && at !== undefined ? at.step.text : query()
  }
  const listing = () => box().kind === "filter"

  const boxSays = () => {
    const it = box()
    if (it.kind === "level") {
      const level = levels.topLive()?.level
      return level?.placeholder ?? (level?.kind === "value" ? "Type…" : "Filter…")
    }
    if (it.kind === "answering" && it.question.kind === "line") {
      return it.question.placeholder
    }
    return ["Jump", "toggle", ...prefixes().map(prefix => `${prefix.value} ${prefix.label}`)].join(", ") + "…"
  }

  const asked = () => (paletteOpen() && listing() ? query() : null)


  const below = () => paletteOnly("search.box.below")?.face
  const nodes = createSearch(asked, () => below()?.pick())
  const opRows = createMemo(() => paletteOpen() ? adapters().flatMap(adapter=>adapter.available?.() === false ? [] : adapter.items?.()??[]) : [])

  const items = createMemo(() => {
    // It is the first line for the reason `opRows` above is guarded:
    // everything below reads values that move on their own.
    if (!paletteOpen()) return [] as ReadonlyArray<PaletteItem>
    if (box().kind === "level") {
      const live = levels.topLive()
      return live?.level.kind === "group" ? live.rows() : []
    }
    if (!listing()) return [] as ReadonlyArray<PaletteItem>
    const commands = [
      ...opRows(),
      ...SHELL_ITEMS,
      ...paletteFaces("app.palette").map(({ face }) => ({
        id: face.id,
        label: face.label,
        ...(face.hint === undefined ? {} : { hint: face.hint }),
        action: { kind: "route" as const, route: router.routes.routeOf(face.href) },
        taking: atOnce,
        search: face.search,
      })),
    ]
    // A block that arrives late must not push the rows a reader is already
    // walking down the list under their cursor, so the local block sits above
    // it and the list only ever grows at the bottom.
    return [
      ...filterItems(query(), commands),
      ...hitItems(nodes),
    ]
  })

  const blank = (text = "") => {
    paletteRevision++
    levels.pop(0, false)
    setQuery(text)
    cursor.top()
    setChosen(false)
    setAskError(null)
    setSaid(null)
  }

  const close = closePalette
  let invoker: HTMLElement | null = null
  let cameFrom: string | undefined
  let moved = false
  let wantKeys = false
  const whereabouts = (): string => router.routes.href(router.route())
  const handBack = (): void => {
    const left = invoker
    invoker = null
    const went = moved || whereabouts() !== cameFrom
    moved = false
    if (went || left === null || !left.isConnected) return
    if (document.activeElement !== null && document.activeElement !== document.body) return
    left.focus()
  }
  const navigated = () => { moved = true; close() }
  createEffect(on(paletteOpen, (opened) => {
    if (opened) return
    blank()
  }, {defer:true}))

  const prime = (prefix: string) => {
    setQuery(prefix)
    cursor.top()
    setChosen(false)
    input?.focus()
  }

  const openAt = (at: OpenAt) => {
    blank(at.path.length === 0 ? at.text : undefined)
    levels.openAt(at)
  }

  let firstOpening = true
  createEffect(() => {
    if (!paletteOpen()) {
      if (modal?.open === true) modal.close()
      return
    }
    const at = untrack(paletteAt)
    if (firstOpening && resuming) untrack(levels.restore)
    else if (at === null) blank()
    else if (at !== handledAt) {
      handledAt = at
      untrack(() => openAt(at))
    }
    firstOpening = false
    queueMicrotask(() => {
      if (!paletteOpen() || modal === undefined) return
      if (modal.open !== true) {
        const had = document.activeElement
        invoker = had instanceof HTMLElement ? had : null
        invoker?.blur()
        cameFrom = whereabouts()
        moved = false
      }
      enterTopLayer(modal)
      if (paletteAsking() === null) input?.focus()
    })
  })

  createEffect(on(paletteAt, (at) => {
    if (at === null || at === handledAt || !untrack(paletteOpen)) return
    handledAt = at
    untrack(() => openAt(at))
  }))

  let firstQuestion = true
  createEffect(
    on(paletteAsking, (question) => {
      const retained = firstQuestion && resuming
      firstQuestion = false
      if (retained || question?.kind !== "line") return
      blank(question.initial)
    }),
  )

  const runItem = (item: PaletteItem) => {
    const action = item.action
    if (action.kind === "edit") {
      if (action.confirm === undefined) {
        sendEdit(action.edit)
        return
      }
      setSaid(null)
      askInPalette({
        kind: "confirm",
        label: item.label,
        question: action.confirm,
        edit: action.edit,
      })
      return
    }
    if (action.kind === "prefix") {
      levels.pop(0, false)
      setSaid(null)
      prime(action.prefix)
      return
    }
    if (action.kind === "level") {
      levels.drill(item, action.level)
      return
    }
    if (action.kind === "run") {
      const current=currentInteraction(); setSending(true)
      void action.run().then(result=>{setSending(false); if(!current())return;
        if(result.said) setSaid(result.said); else if(!result.keepOpen)close()
      })
      return
    }
    if (action.kind === "route") {
      moved = true
      props.go(action.route)
    }
    else if (action.kind === "shortcuts") wantKeys = true
    else if (action.kind === "toggle-sidebar") props.toggleDirectory()
    else if (action.kind === "reset-sidebar-width") resetSidebarWidth()
    else if (action.kind === "close-pane") router.close()
    close()
  }

  const sendEdit = (edit: Edit) => {
    if (sending()) return
    const adapter = adapters().find(adapter=>adapter.accepts?.(edit))
    if (adapter?.available?.() === false) {
      setSaid({ tone: "aside", text: (router as Navigation).focused()?.failure ?? "Loading…" })
      return
    }
    const current = currentInteraction()
    setSending(true)
    setSaid(null)
    void (adapter?.write?.(edit) ?? Promise.resolve({tone:"alarm" as const,text:"Nothing here can do that right now."})).then((line) => {
      setSending(false)
      if (!current()) return
      if (line === undefined) {
        close()
        return
      }
      setSaid(line)
    })
  }

  const flipDone = (): void => { for(const adapter of adapters()) if (adapter.available?.() !== false) adapter.key?.("done") }



  const answer = (question: Asking) => {
    if (question.kind === "confirm") {
      dropQuestion()
      sendEdit(question.edit)
      return
    }
    const outcome = question.resolve(query())
    if (Outcome.isFailure(outcome)) {
      setSaid({ tone: "alarm", text: outcome.failure })
      return
    }
    sendEdit(outcome.success)
  }

  const sendPrefix = (prefix: PalettePrefix, text: string) => {
    if (sending() || !prefixes().includes(prefix)) return
    const submitted = queryRevision, opened = paletteRevision
    setSending(true)
    setSaid(null)
    void prefix.run(text).then(line => {
      setSending(false)
      if (paletteRevision !== opened || !prefixes().includes(prefix)) return
      if (line.tone !== "alarm" || queryRevision === submitted) setSaid(line)
      if (queryRevision === submitted && line.tone !== "alarm") prime(prefix.after)
    }, failure => {
      setSending(false)
      if (paletteRevision !== opened || queryRevision !== submitted || !prefixes().includes(prefix)) return
      console.error("Palette prefix action failed", failure)
      setSaid({ tone: "alarm", text: "That didn't work. Try again." })
    })
  }

  const confirm = () => {
    const it = box()
    if (it.kind === "answering") {
      answer(it.question)
      return
    }
    if (it.kind === "level" && untrack(valueTop) !== undefined) {
      levels.submit()
      return
    }
    if (it.kind === "prefix") {
      sendPrefix(it.prefix, it.text)
      return
    }
    if (!chosen()) return
    spend(items()[cursor.at()], runItem)
  }

  const walk = (by: 1 | -1) => {
    if (inLevel() && valueTop() !== undefined) {
      levels.move(by)
      return
    }
    const many = items().length
    if (many === 0) return
    if (!chosen()) {
      setChosen(true)
      cursor.to(by === 1 ? 0 : many - 1)
      return
    }
    cursor.step(by)
  }

  topmostWhileOpen(paletteOpen)

  const escape = () => {
    const question = paletteAsking()
    if (question === null) {
      close()
      return
    }
    dropQuestion()
    if (question.kind === "line") setQuery("")
    input?.focus()
  }

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      const pane = paneKey(event, isEditingTarget(event.target))
      if (pane !== null && !isLone(router.workspace())) {
        event.preventDefault()
        router.stepFocus(pane === "focusLeft" ? -1 : 1)
        return
      }
      const match = matchKey(event)
      const chord = match === null ? matchChord(event, chords()) : null
      if (chord !== null) {
        if (!chord.whileEditing && isEditingTarget(event.target)) return
        event.preventDefault()
        chord.press()
        return
      }
      if (match === null) return
      if (!match.whileEditing && isEditingTarget(event.target)) return
      event.preventDefault()
      if (match.action === "palette") return
      if (match.action === "sidebar") props.toggleDirectory()
      if (match.action === "undo") (router as Navigation).focused()?.history?.undo()
      if (match.action === "redo") (router as Navigation).focused()?.history?.redo()
      if (match.action === "closePane") router.close()
      if (match.action === "done") flipDone()
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  return (
    <>
    <Shortcuts open={keys()} onClose={() => setKeys(false)} more={chords()} />
    <dialog
      class="fixed inset-x-3 top-[calc(var(--height-header)+0.5rem)] bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] mx-auto my-0 h-auto max-h-none w-auto max-w-xl rounded-surface border border-rule bg-panel p-0 text-ink shadow-overlay backdrop:bg-ink/40 md:inset-x-4 md:bottom-auto md:top-[min(20vh,8rem)]"
      aria-label="Command palette"
      // Safari has no `closedby`, so `lightDismiss` does the outside press on
      // the pointer's own position (`../../../../web/src/client/dismiss.ts`).
      ref={(element) => {
        modal = element
        lightDismiss(element)
        claimCloseRequest(element)
        if (paletteOpen()) queueMicrotask(() => { if (paletteOpen()) enterTopLayer(element) })
      }}
      onCancel={(event) => {
        if (paletteAsking() !== null) {
          event.preventDefault()
          escape()
          return
        }
        close()
      }}
      onClose={() => {
        if (modal?.open === true) return
        if (modal !== undefined && !modal.isConnected) return
        close()
        handBack()
        if (wantKeys) { wantKeys = false; setKeys(true) }
      }}
    >
      <Show when={paletteOpen()}>
        <div
          class="flex h-full min-h-0 w-full flex-col md:h-auto"
          data-testid={TESTID.palette}
        >
          <div class="flex w-full shrink-0 flex-wrap items-center gap-1.5 border-b border-rule px-4 py-3">
            <Show when={inLevel()}>
              <For each={crumbs()}>
                {(crumb, index) => (
                  <button
                    type="button"
                    class="max-w-full shrink-0 cursor-pointer truncate rounded-control bg-pill px-2 py-0.5 text-caption font-medium text-ink hover:bg-rule"
                    data-testid={TESTID.paletteCrumb}
                    data-id={crumb.id}
                    aria-label={`Back from ${crumb.label}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => levels.pop(index())}
                  >
                    {crumb.label} ›
                  </button>
                )}
              </For>
            </Show>
          <input
            ref={input}
            type="text"
            // A dialog with no `autofocus` focuses the dialog itself.
            autofocus
            class="min-w-[8rem] flex-1 bg-transparent font-sans text-title text-ink outline-none placeholder:text-muted"
            data-testid={TESTID.paletteInput}
            data-depth={inLevel() ? depth() : 0}
            aria-label={inLevel() ? crumbs().map((crumb) => crumb.label).join(" › ") : undefined}
            placeholder={boxSays()}
            value={boxText()}
            onInput={(e) => {
              setBoxText(e.currentTarget.value)
              if (valueTop() !== undefined && inLevel()) {
                setAskError(null)
                return
              }
              cursor.top()
              setChosen(inLevel() || e.currentTarget.value.trim() !== "")
              setAskError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !composing(e) && inLevel() && e.currentTarget.value === "") {
                e.preventDefault()
                levels.pop(depth() - 1)
                return
              }
              const action = listKey(e, true)
              if (action === "cycle") {
                const face = listing() ? below() : undefined
                if (face !== undefined) { e.preventDefault(); e.stopPropagation(); face.cycle() }
                return
              }
              if (action === null || action === "dismiss") return
              e.preventDefault()
              if (action === "next") walk(1)
              if (action === "prev") walk(-1)
              if (action === "take") confirm()
            }}
          />
          </div>
          <p class="sr-only" role="status" aria-live="polite" data-testid={TESTID.paletteLevelStatus}>
            {levels.announced()}
          </p>
          <Show when={askError()}>
            {(err) => (
              <SaidLine
                said={{ tone: "alarm", text: err() }}
                class={ALERT_ROW}
                testid={TESTID.paletteAskError}
              />
            )}
          </Show>
          <Show when={nodes.refusals().length === 0 && nodes.failure()}>
            {(err) => (
              <SaidLine
                said={{ tone: "alarm", text: err() }}
                class={ALERT_ROW}
                testid={TESTID.paletteSearchError}
              />
            )}
          </Show>
          <Show when={listing() ? below() : undefined}>{face => face().body({ search: nodes })}</Show>
        <Refusals
            of={nodes.refusals()}
            class={ALERT_ROW}
            testid={TESTID.searchRefusal}
          />
          <Show when={said()}>
            {(message) => (
              <SaidLine
                said={message()}
                class="m-0 border-b border-rule px-4 py-2 text-label"
                testid={TESTID.paletteSaid}
              />
            )}
          </Show>
          <Switch
            fallback={
              <>
                <Show when={(router as Navigation).focused()?.pending}>
                  <p class="m-0 px-3 py-2 text-label text-muted" role="status">
                    {(router as Navigation).focused()?.failure ?? "Loading…"}
                  </p>
                </Show>
                <ul
                  class="m-0 min-h-0 flex-1 list-none overflow-x-hidden overflow-y-auto p-1 md:max-h-72 md:flex-none"
                  data-testid={TESTID.paletteList}
                  data-asked={nodes.answering() ?? undefined}
                >
                  <Key
                    each={items()}
                    by="id"
                    fallback={
                      <li class="px-3 py-2 text-label text-muted">
                        No matches
                      </li>
                    }
                  >
                    {(item, index) => (
                      <li>
                        <Result
                          claims={fileClaims()}
                          href={actionHref(router.routes, item().action)}
                          onNavigate={navigated}
                          label={item().label}
                          mark={item().mark}

                          from={item().from}
                          needles={needles()}
                          hint={item().hint ?? (item().action.kind === "level" ? "›" : undefined)}
                          place={item().place}
                          props={item().props}
                          faces={paletteCrumbs()}
                          active={lit(index())}
                          testids={PALETTE_ROW}
                          id={item().id}
                          onHover={() => {
                            setChosen(true)
                            cursor.to(index())
                          }}
                          onSelect={() => runItem(item())}
                        />
                      </li>
                    )}
                  </Key>
                </ul>
                <SearchCount
                  of={nodes}
                  empty={nodes.answering() !== null}
                  class="m-0 shrink-0 border-t border-rule px-4 py-2 text-label text-muted"
                />
              </>
            }
          >
            <Match when={inLevel() ? levels.topLive() : undefined}>
              {(live) => (
                <LevelView
                  live={live()}
                  crumb={crumbs().at(-1)!}
                  busy={levels.busy()}
                  items={items()}
                  lit={lit}
                  options={levels.options()}
                  chosen={chosenOption}
                  needles={needles()}
                  onHover={(index) => {
                    setChosen(true)
                    cursor.to(index)
                  }}
                  onSelect={runItem}
                  onNavigate={navigated}
                  onOption={(option) => {
                    levels.choose(option)
                    levels.submit()
                  }}
                  onSubmit={levels.submit}
                />
              )}
            </Match>
            <Match when={only(box(), "answering")}>
              {(it) => (
                <Question
                  asking={it().question}
                  onGo={() => answer(it().question)}
                  onCancel={escape}
                />
              )}
            </Match>
            <Match when={only(box(), "prefix")}>
              {(box) => (
                <Composing
                  text={box().text}
                  lead={box().prefix.label}
                  empty={box().prefix.empty}
                  testid={box().prefix.testid}
                />
              )}
            </Match>
          </Switch>
        </div>
      </Show>
    </dialog>
    </>
  )
}

function Composing(props: {
  readonly text: string
  readonly lead: string
  readonly empty: string
  readonly testid: string
}) {
  return (
    <div class="px-4 py-3 text-label text-muted" data-testid={props.testid}>
      <Show when={props.text.trim() !== ""} fallback={<span>{props.empty}</span>}>
        <span>
          {props.lead}: <span class="text-ink">{props.text}</span>
        </span>
      </Show>
    </div>
  )
}

export function resetPaletteMemory():void {
 queryRevision++;paletteRevision++
 memory.query[1]("");memory.askError[1](null);memory.said[1](null);memory.sending[1](false)
 resetLevelMemory();handledAt=null
 closePalette()
}
