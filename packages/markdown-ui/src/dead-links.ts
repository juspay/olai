import { deadLinkSaid } from "@olai/format"

export interface AuthoredLink {
  readonly path: string
  readonly written: string
  readonly words: string
}

export interface DeadLinkFace {
  readonly dead: boolean
  readonly label: string | undefined
}

const ALIVE: DeadLinkFace = { dead: false, label: undefined }

export const deadLinkFace = (
  link: AuthoredLink,
  served: ReadonlySet<string> | undefined,
): DeadLinkFace => {
  if (served === undefined || served.has(link.path)) return ALIVE
  const warning = deadLinkSaid({ written: link.written, resolved: link.path, suggest: [] })
  return { dead: true, label: link.words === "" ? warning : `${link.words} — ${warning}` }
}

export const nameDeadLinks = (
  within: ParentNode,
  served: ReadonlySet<string> | undefined,
): void => {
  for (const link of within.querySelectorAll<HTMLAnchorElement>("a[data-link-path]")) {
    const face = deadLinkFace({
      path: link.dataset["linkPath"] ?? "",
      written: link.dataset["linkWritten"] ?? "",
      words: (link.textContent ?? "").trim(),
    }, served)
    link.classList.toggle("olai-dead-link", face.dead)
    if (face.dead) link.setAttribute("data-dead", "true")
    else link.removeAttribute("data-dead")
    if (face.label === undefined) link.removeAttribute("aria-label")
    else link.setAttribute("aria-label", face.label)
  }
}
