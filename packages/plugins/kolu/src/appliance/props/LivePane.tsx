import { useShown } from "olai-plugin-navigation/routing"

import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js"

import type { FitAddon } from "@xterm/addon-fit"
import type { Terminal } from "@xterm/xterm"

import { gridsEqual } from "@kolu/terminal-vocab/schema"
import { DEFAULT_FONT_SIZE, FONT_FAMILY, getThemeByName } from "terminal-themes"
import { Effect, Fiber, Stream } from "effect"
import { Tip } from "@olai/web/client/Tip.tsx"

import { TESTID } from "../../contracts/appliance-testids.ts"
import {
  again,
  type Attaching,
  FIRST_FRAME_MS,
  onEnd,
  onFrame,
  onSilence,
  opening,
  REATTACH_MS,
  spent,
} from "./attaching.ts"
import { useFleet } from "./fleet.tsx"
import { mountLater } from "./mounting.ts"

export function LivePane(props: {
  readonly value: string
  readonly themeName: string | null
  readonly onClose: () => void
}) {
  const shown = useShown()
  const fleet = useFleet()
  /**
   * The pane's scrollbar is xterm's own overlay slider, painted from
   * `theme.scrollbarSliderBackground`, which defaults to the terminal's
   * foreground at 20%. It is set through the theme rather than CSS because
   * xterm injects its own stylesheet at runtime, after this app's: on
   * `background-color` the two rules tie on specificity and the later one wins.
   */
  const themeName = createMemo(() => props.themeName)
  const theme = createMemo(() => {
    const base = getThemeByName(themeName() ?? undefined)
    const edge = base.brightBlack ?? base.foreground
    if (edge === undefined) return base
    return {
      ...base,
      scrollbarSliderBackground: withAlpha(edge, 0.85),
      scrollbarSliderHoverBackground: edge,
      scrollbarSliderActiveBackground: edge,
    }
  })
  const [says, setSays] = createSignal<string>()
  const [generation, setGeneration] = createSignal(0)
  let host!: HTMLDivElement
  let term: Terminal | undefined
  let fit: FitAddon | undefined

  mountLater(
    () => Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]),
    ([{ Terminal }, { FitAddon }]) => {
      let created: Terminal | undefined
      let observer: ResizeObserver | undefined
      const undo = (): void => {
        observer?.disconnect()
        created?.dispose()
        term = undefined
        fit = undefined
      }
      try {
        created = new Terminal({
        disableStdin: true,
        theme: theme(),
        fontFamily: FONT_FAMILY,
        fontSize: DEFAULT_FONT_SIZE,
        convertEol: true,
        cursorBlink: true,
        cursorInactiveStyle: "block",
        reflowCursorLine: true,
        scrollback: 1_000,
        })
        const fitted = new FitAddon()
        created.loadAddon(fitted)
        created.open(host)
        if (shown() && host.clientWidth > 0 && host.clientHeight > 0) fitted.fit()
        term = created
        fit = fitted
        observer = new ResizeObserver(() => {
        if (!shown() || !host || host.clientWidth === 0 || host.clientHeight === 0) return
        const was = term === undefined ? undefined : { cols: term.cols, rows: term.rows }
        fit?.fit()
        const now = term === undefined ? undefined : { cols: term.cols, rows: term.rows }
        if (was === undefined || now === undefined) return
        if (generation() === 0 || !gridsEqual(was, now)) setGeneration((g) => g + 1)
        })
        observer.observe(host)
        if (shown() && host.clientWidth > 0 && host.clientHeight > 0) setGeneration(g => g + 1)
        return undo
      } catch (reason) {
        undo()
        throw reason
      }
    },
    () => { setSays("Couldn't load the terminal viewer. Check your connection and open it again.") },
  )

  createEffect(on(shown, visible => {
    if (!visible) return
    const frame = requestAnimationFrame(() => {
      if (!shown() || !term || !host || host.clientWidth === 0 || host.clientHeight === 0) return
      const before = { cols: term.cols, rows: term.rows }
      fit?.fit()
      if (generation() === 0 || !gridsEqual(before, term)) setGeneration(g => g + 1)
    })
    onCleanup(() => cancelAnimationFrame(frame))
  }))

  createEffect(() => {
    const palette = theme()
    if (term !== undefined) term.options.theme = palette
  })

  createEffect(
    on(generation, (g) => {
      if (g === 0 || term === undefined) return
      const watch = fleet.watch
      if (watch === undefined) {
        setSays("kolu isn't set up, so there's no terminal to show.")
        return
      }
      const measured = term === undefined ? undefined : { cols: term.cols, rows: term.rows }
      const asked = measured !== undefined && measured.cols > 0 && measured.rows > 0
        ? measured
        : undefined
      if (carried !== undefined && spent(carried)) {
        halted = true
        setSays("This terminal stopped responding. It probably closed.")
        return
      }
      let state: Attaching = g === 1 ? opening() : again(carried ?? opening())
      carried = state
      setSays(undefined)

      const deadline = setTimeout(() => {
        act(onSilence(state))
      }, FIRST_FRAME_MS)

      let reattach: ReturnType<typeof setTimeout> | undefined

      const act = (next: ReturnType<typeof onFrame>["next"]): void => {
        if (halted) return
        switch (next.kind) {
          case "write":
            if (next.grid !== undefined && term !== undefined) {
              if (!gridsEqual(term, next.grid)) {
                term.resize(next.grid.cols, next.grid.rows)
              }
            }
            if (next.reset) term?.reset()
            term?.write(next.data)
            return
          case "reattach":
            reattach = setTimeout(() => setGeneration((was) => was + 1), REATTACH_MS)
            return
          case "stop":
            halted = true
            setSays(next.says)
            return
          case "idle":
            return
        }
      }

      const fiber = Effect.runFork(
        Stream.runForEach(watch({ terminal: props.value, grid: asked }), (frame) => {
          clearTimeout(deadline)
          const stepped = onFrame(state, frame)
          state = stepped.state
          carried = state
          act(stepped.next)
          return Effect.void
        }).pipe(
          Effect.andThen(
            Effect.sync(() => {
              clearTimeout(deadline)
              act(onEnd(state))
            }),
          ),
          Effect.catchCause(() =>
            Effect.sync(() => {
              clearTimeout(deadline)
              act(onEnd(state))
            })
          ),
        ),
      )

      onCleanup(() => {
        clearTimeout(deadline)
        clearTimeout(reattach)
        void Effect.runPromise(Fiber.interrupt(fiber))
      })
    }),
  )

  let carried: Attaching | undefined
  let halted = false

  return (
    <div
      class="olai-live mt-1 mb-1 w-full p-2"
      data-testid={TESTID.terminalPane}
      data-terminal={props.value}
    >
      <div class="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-caption text-muted">
        <span data-testid={TESTID.terminalLive}>● Live</span>
        <span class="ml-auto flex gap-2">
          <Tip text="Stop watching">
            <button
              type="button"
              class="cursor-pointer hover:text-accent"
              onClick={(event) => {
                event.stopPropagation()
                props.onClose()
              }}
            >
              Close<span class="sr-only"> — stop watching this terminal</span>
            </button>
          </Tip>
        </span>
      </div>
      <div ref={host} class="olai-live-screen" style={{
        display: says() ? "none" : undefined,
        "background-color": theme().background ?? "transparent",
      }} data-testid={says() ? undefined : TESTID.terminalScreen} data-state="attached" />
      <Show when={says()}>
        {(said) => (
          <p
            class="text-body text-muted"
            data-testid={TESTID.terminalScreen}
            data-state="refused"
          >
            {said()}
          </p>
        )}
      </Show>
    </div>
  )
}

const withAlpha = (color: string, opacity: number): string => {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1]
  if (hex === undefined) return color
  return `#${hex}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`
}

