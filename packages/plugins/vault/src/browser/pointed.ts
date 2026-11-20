import { mediaHref } from "@olai/surface"
import { type Accessor, createMemo } from "solid-js"

interface Pointed {
  readonly file: string
  readonly href: string
}

const keptWhileRemoved = (
  previous: Pointed | undefined,
  file: string,
  rev: number | undefined,
): previous is Pointed => rev === undefined && previous?.file === file

export const usePointed = (file: Accessor<string>, rev: Accessor<number | undefined>): Accessor<string> => {
  const pointed = createMemo<Pointed>((previous) => {
    const name = file()
    const at = rev()
    if (keptWhileRemoved(previous, name, at)) return previous
    const href = mediaHref(name)
    return { file: name, href: at === undefined ? href : `${href}?rev=${String(at)}` }
  })
  return () => pointed().href
}
