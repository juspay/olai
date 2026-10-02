import { children, onMount, onCleanup, Show, type JSX } from "solid-js"
import { useShown } from "olai-plugin-navigation/routing"

/** State and menu items belong to this owner. Only the visible content shell
 * claims Kobalte's dismissal layer; suspension moves the same items into a
 * hidden host without disposing their confirmation or submenu owners.
 * Pass an accessor into the shell: resolving children while constructing it
 * would rebuild the layer whenever a submenu changes the child list. */
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

/** Kobalte defers list autofocus. Restore afterwards, under the visible shell's
 * owner, while each menu decides which of its own entries should receive focus. */
export function focusMenuAfterMount(element: HTMLElement, shown: () => boolean, target: () => HTMLElement | undefined) {
  onMount(() => {
    const timer = setTimeout(() => {
      if (shown() && element.isConnected) target()?.focus({ preventScroll: true })
    }, 0)
    onCleanup(() => clearTimeout(timer))
  })
}
