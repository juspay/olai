export type ClientPx = number & { readonly space: "client" }
export type DocumentPx = number & { readonly space: "document" }

export const clientPx = (value: number): ClientPx => value as ClientPx

const ZONE_PX = 72

const FASTEST_PX = 14

export const edgeSpeed = (
  y: ClientPx,
  height: number,
  zone: number,
  fastest: number,
): number => {
  const above = zone - y
  const below = y - (height - zone)
  if (above <= 0 && below <= 0) return 0
  const into = Math.min(1, Math.max(above, below) / zone)
  return (above > below ? -1 : 1) * fastest * into
}

export type Report = (x: DocumentPx, y: DocumentPx) => void

export interface EdgeScroll {
  readonly at: (x: ClientPx, y: ClientPx) => void
  readonly stop: () => void
}

export const edgeScrolling = (report: Report): EdgeScroll => {
  const height = document.documentElement.clientHeight
  let atX = clientPx(0)
  let atY = clientPx(0)
  let frame = 0

  const tell = (scrolled: number): void =>
    report((atX + window.scrollX) as DocumentPx, (atY + scrolled) as DocumentPx)

  const step = (): void => {
    frame = 0
    const speed = edgeSpeed(atY, height, ZONE_PX, FASTEST_PX)
    if (speed === 0) return
    const before = window.scrollY
    window.scrollBy({ top: speed, behavior: "instant" })
    const after = window.scrollY
    if (after !== before) tell(after)
    frame = requestAnimationFrame(step)
  }

  return {
    at: (x, y) => {
      atX = x
      atY = y
      tell(window.scrollY)
      if (frame === 0 && edgeSpeed(y, height, ZONE_PX, FASTEST_PX) !== 0) {
        frame = requestAnimationFrame(step)
      }
    },
    stop: () => {
      cancelAnimationFrame(frame)
      frame = 0
    },
  }
}
