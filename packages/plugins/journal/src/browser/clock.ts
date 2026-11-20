import { heldService } from "@olai/ui-primitives/held.ts"
import type { Accessor } from "solid-js"
import type { Clocks } from "@olai/plugin-api"

const provider = heldService<Clocks>()

export const holdClocks = provider.hold

export const useToday = (): Accessor<string | undefined> => () => provider.read()?.today()
