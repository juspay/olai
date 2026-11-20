import { TESTID } from "olai-plugin-outlines/testids"
import { createContext, type JSX, Show, useContext } from "solid-js"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { MovePicker } from "./MovePicker.tsx"
import { createMoving as createGesture } from "./gesture.ts"
export type { Standing } from "./gesture.ts"

export interface Moving {
  readonly open: (at: { readonly record: string; readonly place: string }) => void
  readonly showing: (key: string) => boolean
  readonly Panel: () => JSX.Element
}

const MovingContext = createContext<Moving>()

export const useMoving = (): Moving => {
  const moving = useContext(MovingContext)
  if (moving === undefined) throw new Error("a move picker outside <Editable>")
  return moving
}

export const MovingProvider = MovingContext.Provider

export const createMoving = (...args: Parameters<typeof createGesture>): Moving => {
  const { open, showing, standing, moved, refusals, saying, query, aim, write, close } = createGesture(...args)
  return {
    open,
    showing,
    Panel: () => (
      <>
        <Show when={standing()?.kind === "picking"}>
          <Show when={moved()}>
            {(at) => (
              <MovePicker
                moved={at()}
                query={query}
                refusals={refusals()}
                // Solid reads a function passed to a setter as an updater, so a
                // signal whose value is a function is set through a wrapper.
                onAimed={aim}
                onWrite={write}
                onClose={close}
              />
            )}
          </Show>
        </Show>
        <Show when={saying.said()}>
          {(message) => (
            <SaidLine
              said={message()}
              class="mt-1 mb-0 text-body leading-snug"
              testid={TESTID.moveSaid}
            />
          )}
        </Show>
      </>
    ),
  }
}
