/**
 * THE MARK A KIND OF FILE WEARS, as the files plugin's declared `fileKinds`
 * location says it — read so a chat about a file can wear its file's own mark
 * wherever the chat is named.
 *
 * Held for chat's activation, which declares the renderer it reads through
 * (`../browser.tsx`). With no renderer nothing is contributed anywhere, and a
 * chat about a file is named without a mark rather than with a guess.
 */
import { forFileClaim } from "@olai/plugin-api/file-kinds"
import type { Locations } from "@olai/plugin-api/contracts"
import { heldService } from "@olai/ui-primitives/held.ts"
import { fileKinds } from "olai-plugin-files/contract"
import type { JSX } from "solid-js"
import type { Place } from "@olai/format"
import { PinMark } from "olai-plugin-navigation/address/Face.tsx"
import type { Routing } from "olai-plugin-navigation/routes"
import { routeOfPlace } from "./agents/place.ts"
import { servedDirectory } from "./vault.ts"

const reader = heldService<Locations["read"]>()

/** Told by `../browser.tsx` for chat's activation. */
export const holdKindReader = reader.hold

/** The mark the kind of file at `path` wears, or `undefined` where nobody
 *  claims the file or no kind plugin draws one. */
export const fileMark = (path: string): (() => JSX.Element) | undefined => {
  const directory = servedDirectory()
  const kind = directory?.kindOf(path)
  if (directory === undefined || kind == null) return undefined
  return forFileClaim(directory.claims().byKind.get(kind), (reader.read()?.(fileKinds) ?? []).map(entry => entry.value))?.glyph
}

/** THE MARK A PLACE WEARS where a chat about it is named: a file its kind's
 *  own, a plugin's page the glyph its route declares, and anything else the
 *  pin every address wears. */
export const placeMark = (routes: Routing, place: Place): (() => JSX.Element) | undefined =>
  place.kind === "file" ? fileMark(place.path)
    : place.kind === "page" ? routes.face(routeOfPlace(routes, place))?.route.glyph ?? PinMark
    : PinMark
