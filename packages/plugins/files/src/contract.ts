import { location,serviceTag } from "@olai/plugin-api/contracts"
import type { JSX } from "solid-js"
export const name = "files"
/** Each content provider owns its creation interaction; files renders only
 * capabilities which are currently registered. */
export const fileTypes = location<{readonly Create: () => JSX.Element}>("files.types")
export const fileState = serviceTag<FileControls>("files.state")

export interface FileControls {
 readonly Delete: (props:{readonly file:string})=>JSX.Element
 readonly New: (props:{readonly making:import("./file/making.ts").Making;readonly create:(file:string)=>Promise<string|null>})=>JSX.Element
}
export { DeleteFile,holdFileControls,NewFile } from "./controls.tsx"
