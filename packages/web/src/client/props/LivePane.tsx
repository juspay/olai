/**
 * THE LIVE PANE — a window on a terminal, not a photograph of one.
 *
 * The pane opened as a snapshot: one `screen.text` read, a dashed border, a
 * refetch button that was the only thing that moved it. The human's word
 * (2026-08-26): "when user opens the terminal to look at snapshot, let's live
 * stream it! Why not?" — so it is a window now, and the border is SOLID and the
 * header says `● live`, which is the distinction the snapshot pane's own file
 * promised phase 6 would keep: two panes, two borders, and a reader never has
 * to remember which is which.
 *
 * ## The wall, from the browser's side
 *
 * THIS COMPONENT DOES NOT DIAL PADI AND COULD NOT. What it subscribes to is
 * `@olai/surface`'s own `streams.terminal`, an ordinary member of the same
 * surface every other page reads; the olai SERVER holds padi's `terminalAttach`
 * on the one connection the fleet already rides. Ten tabs watching one terminal
 * are ten subscribers to that member and one attach to padi.
 *
 * ## Why the subscription is UN-ENROLLED
 *
 * `.use()` is the default and it enrols a stream's pending/error into the app's
 * transport-health gate — the thing that draws the Disconnected overlay. A
 * pane's re-attach is normal and self-healing (see below: three ordinary things
 * re-open this stream), so enrolling it would flash an app-wide alarm every
 * time a terminal resized. `@kolu/surface`'s own note names this exact carve-out
 * — "a terminal re-attach ... must stay OUT of the health fact" — and the
 * `unenrolled` spelling at the call site is what keeps a deliberate hand-enrol
 * from ever reading as a forgotten one.
 *
 * ## The four rules, and where each is
 *
 * The rules are `@kolu/padi-client/attach`'s, the policy over them is
 * `./attaching.ts`'s, and this file is the part that needs a DOM: it measures
 * the grid, holds the terminal, runs the deadline timer, and re-opens the
 * stream when a verdict says to. The grid check is here rather than on the
 * server because the grid is the PANE'S OWN measurement — nothing server-side
 * knows how wide this box is.
 */

import { createEffect, createSignal, on, onCleanup, onMount, Show } from "solid-js"

import type { Terminal } from "@xterm/xterm"

import { FONT_FAMILY, getThemeByName } from "terminal-themes"
import { Effect, Fiber, Stream } from "effect"

import { TESTID } from "../testids.ts"
import {
  again,
  type Attaching,
  FIRST_FRAME_MS,
  onEnd,
  onFrame,
  onSilence,
  opening,
  spent,
} from "./attaching.ts"
import { useFleet } from "./fleet.tsx"

export function LivePane(props: {
  readonly value: string
  /** The kolu theme this terminal was created with — `null` where padi has
   *  none recorded, which the catalog's own fallback answers. */
  readonly themeName: string | null
  readonly onClose: () => void
}) {
  const fleet = useFleet()
  /** THE TERMINAL'S OWN THEME, resolved once and read twice: xterm paints the
   *  glyphs with it, and the wrapper paints the padding around them with its
   *  background — which is what makes the breathing room read as terminal
   *  rather than as a light gutter of chrome (the human, on the second look). */
  const theme = () => getThemeByName(props.themeName ?? undefined)
  const [says, setSays] = createSignal<string>()
  /** Bumped to re-attach. A SIGNAL rather than a call, so the effect below is
   *  the only thing that ever opens a stream — one place a subscription is
   *  born, which is what makes "drop it on cleanup" a fact rather than a rule. */
  const [generation, setGeneration] = createSignal(0)
  let host!: HTMLDivElement
  let term: Terminal | undefined

  /**
   * FIT VISUALLY — the pane's half of "the monitor never claims the grid".
   *
   * The terminal is at the PTY'S size now, which has nothing to do with how
   * wide this box is. So the box does not argue: it scales what it was given
   * down until it fits, `transform` on the terminal element with the origin at
   * the top left, and never up — a terminal enlarged past its natural size
   * would be a monitor asserting a look the terminal does not have.
   *
   * DOWNSCALE RATHER THAN SCROLL, which is a choice and not the only defensible
   * one: a pane in an outline is something you GLANCE at while reading a lane,
   * and a horizontal scrollbar hides exactly the right-hand column an agent's
   * output runs into. Small-and-whole beats crisp-and-cropped for a glance;
   * the day this pane grows a "pop out" it can scroll at full size instead.
   */
  const fitVisually = (): void => {
    // `.xterm-screen` and NOT `.xterm`: the outer element is width:100% of
    // whatever box it is in, so measuring it reads back the room rather than
    // the terminal. The screen is the one element xterm sizes to the GRID —
    // cols x cell width, rows x cell height — which is the size that has to be
    // scaled to fit.
    const screen = host?.querySelector<HTMLElement>(".xterm-screen")
    const room = host?.parentElement
    if (screen === undefined || screen === null || host === undefined || room === null) return
    // Measure the UNSCALED box, and measure the ROOM from the parent — reading
    // either through this element's own inline size would compound each pass
    // into a smaller and smaller terminal.
    screen.style.transform = ""
    host.style.width = ""
    host.style.height = ""
    const naturalWidth = screen.offsetWidth
    const naturalHeight = screen.offsetHeight
    if (naturalWidth <= 0 || naturalHeight <= 0) return
    // SMALLER OF THE TWO, and never above 1. Width is the obvious constraint;
    // height is the one a fifty-row terminal hits first, and a pane that scaled
    // only by width would put the bottom rows below the fold — the cropping
    // this whole approach exists to avoid, arriving from the other axis.
    const scale = Math.min(1, room.clientWidth / naturalWidth, CAP_PX / naturalHeight)
    screen.style.transformOrigin = "top left"
    screen.style.transform = scale < 1 ? `scale(${scale})` : ""
    // A TRANSFORM DOES NOT MOVE LAYOUT, so the box is told what it is showing —
    // BOTH axes. Height alone left a band of dead space to the right of a
    // terminal whose height was the binding constraint, which reads as a broken
    // box rather than as a small one. Sized to the scaled terminal exactly, the
    // pane's own panel is what surrounds it, and that reads as the padding it
    // is.
    host.style.width = `${Math.ceil(naturalWidth * scale)}px`
    host.style.height = `${Math.ceil(naturalHeight * scale)}px`
  }

  onMount(async () => {
    // IMPORTED HERE rather than at the top, and it is the pane's whole weight
    // argument: xterm is a terminal emulator, and a page that draws forty lanes
    // and opens no pane should not have paid for one. A dynamic import puts it
    // in its own chunk, fetched the first time somebody presses a row.
    const { Terminal } = await import("@xterm/xterm")
    const created = new Terminal({
      // READ-ONLY, which is the whole of what this pane is — confirmed as
      // design by the human on the live look: monitoring lives in olai and
      // typing stays in kolu until the actions phase. `disableStdin` is the
      // difference between a window and a session.
      disableStdin: true,
      // KOLU'S OWN THEME, and this is the whole of the theming decision: the
      // catalog is `terminal-themes`, the record carries the name its terminal
      // was created with, and the lookup falls back on its own. olai declares
      // no palette — a terminal that looked different here than in the Dock
      // would be the same drift the row's own extraction exists to prevent, one
      // surface down.
      theme: theme(),
      // ...and kolu's own type. The stack is the catalog's constant rather than
      // a string spelled here, for the reason the palette is.
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZE,
      convertEol: true,
      // The three rendering options kolu's own terminal sets and a reader would
      // notice the absence of. A block cursor while UNFOCUSED especially: this
      // pane is never focused, so xterm's default hollow outline would be the
      // one state a reader of olai always sees and a reader of kolu never does.
      cursorBlink: true,
      cursorInactiveStyle: "block",
      reflowCursorLine: true,
      // NOT `allowProposedApi`, which kolu sets for the serialize and image
      // addons: this pane loads neither, and an option that only unlocks APIs
      // nothing calls is a promise about a surface that does not exist here.
      //
      // The pane is a box in a document, not a full screen: kolu keeps fifty
      // thousand lines because its terminal is the window you work in, and this
      // one has no scrollback reader of its own — a line this pane cannot reach
      // is memory spent to look identical while scrolled to a place it does not
      // go.
      scrollback: 1_000,
    })
    created.open(host)
    term = created
    // NO FIT ADDON. The pane does not size the terminal — it adopts the grid
    // each snapshot names and scales what it was given (see `fitVisually`), so
    // a "make the terminal match this box" addon is the one thing this pane
    // must never do. xterm's own 80x24 default is what it starts at, which is
    // also what most ptys are.
    // THE PANE REFITS ITSELF AND TELLS PADI NOTHING. It used to re-attach on a
    // resize, which only made sense while the attach carried a grid — and that
    // grid was the defect: an attach that carries one RESIZES the shared pty,
    // so a box in a document was reshaping a human's live terminal. The pane
    // observes now, so its own box changing is a fact about this page and
    // nothing padi needs to hear.
    const observer = new ResizeObserver(() => fitVisually())
    observer.observe(host)
    onCleanup(() => {
      observer.disconnect()
      created.dispose()
      term = undefined
    })
    // The terminal exists now, so the first attach can ask at a real grid.
    setGeneration((g) => g + 1)
  })

  /**
   * ONE ATTACH PER GENERATION.
   *
   * `on(generation, …)` rather than a tracked body: the effect must re-run when
   * the generation moves and NOT when anything else it touches does, because
   * re-running is what tears a subscription down and opens another one.
   */
  createEffect(
    on(generation, (g) => {
      if (g === 0 || term === undefined) return
      const watch = fleet.watch
      if (watch === undefined) {
        setSays("this olai is not watching a padi, so there is no terminal to show.")
        return
      }
      let state: Attaching = g === 1 ? opening() : again(carried ?? opening())
      carried = state
      setSays(undefined)

      /** THE DEADLINE. Cleared by the first frame; fired by silence, which is a
       *  failure mode with no event of its own — a stream can open, never fail,
       *  never end and never deliver, and a pane that trusted that would sit
       *  blank over a live agent forever. */
      const deadline = setTimeout(() => {
        act(onSilence(state))
      }, FIRST_FRAME_MS)

      const act = (next: ReturnType<typeof onFrame>["next"]): void => {
        // A STOP IS TERMINAL FOR THE PANE, and this guard is what makes it so.
        // Without it a refusal arrives, the pane says why — and then the same
        // stream ENDS (a refusal is one frame and then the end), which rule 3
        // reads as a recoverable end and re-attaches, six times, before landing
        // on its own budget-spent sentence. The reader would watch a correct
        // answer be replaced by a vaguer one. Found by the e2e, which asserted
        // the words padi gave and got the budget's instead.
        if (halted) return
        switch (next.kind) {
          case "write":
            // THE GRID IS ADOPTED BEFORE THE BYTES ARE WRITTEN, and the order
            // is the whole point: these bytes were wrapped for that size, so a
            // terminal still at the old one would fold them wrong on the way
            // in and nothing afterwards unfolds them.
            if (next.grid !== undefined && term !== undefined) {
              if (term.cols !== next.grid.cols || term.rows !== next.grid.rows) {
                term.resize(next.grid.cols, next.grid.rows)
              }
            }
            if (next.reset) term?.reset()
            term?.write(next.data, () => fitVisually())
            return
          case "reattach":
            setGeneration((was) => was + 1)
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
        Stream.runForEach(watch({ terminal: props.value }), (frame) => {
          clearTimeout(deadline)
          const stepped = onFrame(state, frame)
          state = stepped.state
          carried = state
          act(stepped.next)
          return Effect.void
        }).pipe(
          Effect.andThen(
            // A CLEAN END IS NOT AN EXIT. The stream finishing means padi stopped
            // sending on this attach, which happens for reasons that have nothing
            // to do with the terminal — so it is a re-attach, and the budget in
            // `./attaching.ts` is what keeps a genuinely dead terminal converging.
            Effect.sync(() => {
              clearTimeout(deadline)
              act(onEnd(state))
            }),
          ),
        ),
      )

      onCleanup(() => {
        clearTimeout(deadline)
        void Effect.runPromise(Fiber.interrupt(fiber))
      })
    }),
  )

  /** The attach state ACROSS generations, so the budget is a pane's and not one
   *  subscription's — six attaches that each thought they were the first would
   *  be no budget at all. */
  let carried: Attaching | undefined
  /** Has this pane stopped for good? A refusal is padi's answer to the
   *  question, and asking it again gets the same one — so nothing re-opens a
   *  stream after one, and the sentence a reader is looking at stays the
   *  sentence padi gave. */
  let halted = false

  return (
    <div
      class="olai-live mt-1 mb-1 w-full p-2"
      data-testid={TESTID.terminalPane}
      data-terminal={props.value}
    >
      <div class="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[0.6875rem] text-muted">
        {/* WHAT THIS IS, first and always — the border says it and so does
            this. A live pane does not need an age line: the age of what you are
            looking at is zero, which is the whole difference from the pane this
            replaced. */}
        <span data-testid={TESTID.terminalLive}>● live</span>
        <span class="ml-auto flex gap-2">
          <button
            type="button"
            class="cursor-pointer hover:text-accent"
            title="stop watching"
            onClick={(event) => {
              event.stopPropagation()
              props.onClose()
            }}
          >
            close
          </button>
        </span>
      </div>
      {/* THE SENTENCE, in the reading face, IN PLACE OF the terminal — a pane
          that said why it stopped underneath a frozen screen would be a pane
          claiming to be live while it is not. */}
      <Show
        when={says()}
        fallback={
          <div
            ref={host}
            class="olai-live-screen"
            style={{ "background-color": theme().background ?? "transparent" }}
            data-testid={TESTID.terminalScreen}
            data-state="attached"
          />
        }
      >
        {(said) => (
          <p
            class="text-[0.8125rem] text-muted"
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

/**
 * THE FONT SIZE kolu's own terminal draws at.
 *
 * RESTATED, and it is the only number in this pane that is. Its home is
 * `kolu-common/config`'s `DEFAULT_FONT_SIZE`, and that package cannot be
 * consumed from here: it declares `effect` as `catalog:` — pnpm's
 * workspace-catalog protocol, which resolves only inside kolu's own workspace —
 * and drags sixteen workspace packages behind it for one integer. Filed as a
 * finding against kolu#2217 (the same class as `@kolu/xterm-kit`'s), and the
 * day either lands this constant is deleted and imported.
 *
 * Everything else the pane paints with IS consumed: the palette and the font
 * stack are `terminal-themes`, which is a leaf and hydrates cleanly.
 */
const FONT_SIZE = 14

/**
 * HOW TALL A PANE MAY GET before the terminal inside it is scaled down to fit.
 *
 * A terminal is its whole grid, so a fifty-row one is genuinely tall — and a
 * pane in an outline is something you glance at while reading a lane, not a
 * window you live in. The cap is what keeps a lane from being pushed off the
 * page by a terminal somebody opened to look at for three seconds; the scale is
 * what keeps the whole screen visible inside it rather than cropped to the cap.
 */
const CAP_PX = 420
