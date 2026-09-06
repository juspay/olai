import { createSignal } from "solid-js"
import type { createDirectory } from "./directory.ts"
export type Directory = ReturnType<typeof createDirectory>
const [directory, setDirectory] = createSignal<Directory>()
export { directory }
export function holdDirectory(value: Directory): () => void {
 setDirectory(value); return () => { if(directory()===value) setDirectory(undefined) }
}
