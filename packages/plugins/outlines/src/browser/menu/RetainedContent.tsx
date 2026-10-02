import { children, Show, type JSX } from "solid-js"
import { useShown } from "olai-plugin-navigation/routing"

/** State and menu items belong to this owner. Only the visible content shell
 * claims Kobalte's dismissal layer; suspension moves the same items into a
 * hidden host without disposing their confirmation or submenu owners. */
export function RetainedContent(props: {
  readonly children: JSX.Element
  readonly draw: (content: JSX.Element) => JSX.Element
}) {
  const shown = useShown()
  const content = children(() => props.children)
  return <Show when={shown()} fallback={<div style={{ display: "none" }}>{content()}</div>}>
    {props.draw(content())}
  </Show>
}
