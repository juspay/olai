import { REGISTRY } from "@olai/plugin-build/shared"
import * as api from "@olai/plugin-api"
import * as effect from "effect"
import * as solid from "solid-js"
import * as solidWeb from "solid-js/web"

export interface SharedModules {
  readonly "@olai/plugin-api": typeof api
  readonly effect: typeof effect
  readonly "solid-js": typeof solid
  readonly "solid-js/web": typeof solidWeb
}

type Registry = Record<typeof REGISTRY, SharedModules | undefined>

const registry = globalThis as unknown as Registry

export const sharedModules = (): SharedModules | undefined => registry[REGISTRY]

export const installSharedModules = (): SharedModules => {
  const modules: SharedModules = {
    "@olai/plugin-api": api,
    effect,
    "solid-js": solid,
    "solid-js/web": solidWeb,
  }
  registry[REGISTRY] = modules
  return modules
}
