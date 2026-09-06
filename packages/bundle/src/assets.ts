/** Static build contributions are a separate graph: never import this door
 * from a browser or server runtime. Row exports decide which assets exist. */
export interface BuildAssets {
  readonly preloadModules?: ReadonlyArray<{ readonly module: string; readonly priority?: "auto" | "low" | "high" }>
  readonly head?: string
  readonly css?: () => string
  readonly install?: (distDir: string) => void | Promise<void>
}
export { BUILD_ASSETS } from "./assets.generated.ts"
