import { location,serviceTag } from "@olai/plugin-api/contracts"
import type { JSX } from "solid-js"
export const name = "files"
export interface FileType {
 readonly making: () => import("./file/making.ts").Making | undefined
 readonly Create: () => JSX.Element
}
export const fileTypes = location<FileType>("files.types")
export const fileState = serviceTag<FileControls>("files.state")

export interface FileControls {
 readonly Delete: (props:{readonly file:string})=>JSX.Element
 readonly New: (props:{readonly making:import("./file/making.ts").Making;readonly create:(file:string)=>Promise<string|null>})=>JSX.Element
 readonly open: (of:import("./file/making.ts").Making["of"])=>void
}


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
