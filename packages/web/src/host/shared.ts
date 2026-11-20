/**
 * Written by the ENTRY, before anything mounts: `./main.tsx` imports this
 * module for its side effect, above its first render.
 */

import { REGISTRY } from "@olai/plugin-build/shared"
import * as api from "@olai/plugin-api"
import * as effect from "effect"
import * as solid from "solid-js"
import * as solidWeb from "solid-js/web"

;(globalThis as Record<string, unknown>)[REGISTRY] = {
  "@olai/plugin-api": api,
  effect,
  "solid-js": solid,
  "solid-js/web": solidWeb,
}
