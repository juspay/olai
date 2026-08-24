/**
 * THE URL a page that draws by POINTING points at — the file on the media
 * route, at the revision it is at.
 *
 * Two faces draw that way and a third is about to: a picture is an `<img>`
 * (./Image.tsx) and a `.pdf` is an `<object>` (./Pdf.tsx), each handed the
 * file's own address and left to fetch it. What they share is not the element,
 * it is this one decision, and it was spelled twice before it had a name.
 *
 * THE REVISION IS IN THE URL, which is the whole of what there is to get wrong.
 * This app stays live: a file replaced on disk redraws the page showing it. A
 * `.html` preview gets that for free — its frame is re-pointed and the route
 * answers a page `no-store` (`@olai/server`'s `media.ts`) — but everything else
 * on that route goes through the platform's file engine, which answers with an
 * `ETag` and a `304`, so a re-render with the same `src` is a request the
 * browser never makes. The head is the number that moves exactly when the file
 * does (`../served.tsx`), so the URL changes exactly when the bytes might have
 * and never on a frame that changed nothing else.
 *
 * A QUERY rather than a fragment or a path segment, because it must not change
 * WHICH FILE this names: the route cuts a query before it decodes a path
 * (`@olai/surface`'s `mediaPath`), so `/media/art/shot.png?rev=12` and
 * `/media/art/shot.png` are the same file to the server and two URLs to the
 * cache, which is exactly the split this wants.
 *
 * BEFORE THE FIRST HEAD ARRIVES it is the bare address, and that is not a
 * placeholder: the file is at whatever revision it is at, the browser has
 * nothing cached for it on a first open, and adding a made-up number would
 * only mean a second fetch when the real one landed.
 */

import { mediaHref } from "@olai/surface"
import type { Accessor } from "solid-js"

import { useHead } from "../served.tsx"

export const usePointed = (file: Accessor<string>): Accessor<string> => {
  const rev = useHead(file)
  return () => {
    const at = rev()
    const href = mediaHref(file())
    return at === undefined ? href : `${href}?rev=${String(at)}`
  }
}
