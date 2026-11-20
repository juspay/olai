import { mediaHref } from "@olai/surface"
import { type Accessor, createMemo } from "solid-js"


export const usePointed = (file: Accessor<string>, rev: Accessor<number | undefined>): Accessor<string> => {
  const pointed = createMemo<{ readonly file: string; readonly href: string }>((previous) => {
    const name = file()
    const at = rev()
    if (at === undefined && previous?.file === name) return previous
    const href = mediaHref(name)
    return { file: name, href: at === undefined ? href : `${href}?rev=${String(at)}` }
  })
  return () => pointed().href
}
