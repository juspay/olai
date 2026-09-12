/** Each content provider owns its creation interaction; files renders only
 * capabilities which are currently registered. */

import { location,serviceTag } from "@olai/plugin-api/contracts"
import type { JSX } from "solid-js"
export const name = "files"
export const fileTypes = location<{readonly Create: () => JSX.Element}>("files.types")
export const fileState = serviceTag<FileControls>("files.state")

export interface FileControls {
 readonly Delete: (props:{readonly file:string})=>JSX.Element
 readonly New: (props:{readonly making:import("./file/making.ts").Making;readonly create:(file:string)=>Promise<string|null>})=>JSX.Element
}
/**
 * ## THE TWO WRAPPERS LEFT THIS DOOR, and the signal behind them went with
 *
 * `DeleteFile` and `NewFile` were exported here over a module signal in
 * `./contracts/controls.tsx`, installed by this row's activation and drawn by
 * `olai-plugin-outlines` and `olai-plugin-markdown` — so the controls crossed
 * two package walls as a module variable and neither consumer declared
 * anything (the audit's §12). {@link fileState} already carried them; each of
 * those rows declares it on a component of its own now and draws the control
 * out of what it was handed.
 */


import type { FileKindKey } from "@olai/plugin-api/file-kinds"
import type { AnyTestId } from "@olai/ui-primitives/testids.ts"
export interface FileKindDrawing {
  readonly by: FileKindKey
  readonly glyph: () => JSX.Element
  readonly noun: string
  readonly article: "a" | "an"
  readonly testid: AnyTestId
}
export const fileKinds = location<FileKindDrawing>("files.kinds", "many", "key")
