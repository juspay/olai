import { children, onMount, onCleanup, Show, type JSX } from "solid-js"
import { useShown } from "olai-plugin-navigation/routing"

export function RetainedContent(props: {
  readonly children: JSX.Element
  readonly draw: (content: () => JSX.Element) => JSX.Element
}) {
  const shown = useShown()
  const content = children(() => props.children)
  return <Show when={shown()} fallback={<div style={{ display: "none" }}>{content()}</div>}>
    {props.draw(content)}
  </Show>
}

/** Kobalte defers its list's autofocus by a timer, so a restore must come after it. */
export function focusMenuAfterMount(element: HTMLElement, shown: () => boolean, target: () => HTMLElement | undefined) {
  onMount(() => {
    const timer = setTimeout(() => {
      if (shown() && element.isConnected) target()?.focus({ preventScroll: true })
    }, 0)
    onCleanup(() => clearTimeout(timer))
  })
}
