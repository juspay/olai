declare module "@babel/preset-typescript" {
  import type { ConfigAPI, TransformOptions } from "@babel/core"

  export default function preset(
    api: ConfigAPI,
    options?: Record<string, unknown>,
  ): TransformOptions
}

declare module "babel-preset-solid" {
  import type { ConfigAPI, TransformOptions } from "@babel/core"

  export default function preset(
    api: ConfigAPI,
    options?: {
      readonly generate?: "dom" | "ssr"
      readonly hydratable?: boolean
      readonly delegateEvents?: boolean
      readonly wrapConditionals?: boolean
      readonly contextToCustomElements?: boolean
      readonly builtIns?: ReadonlyArray<string>
      readonly moduleName?: string
    },
  ): TransformOptions
}
