import type { Accessor } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"

type Named = { readonly called: Accessor<string | undefined> }

const provider = heldService<Named>()

export const holdDeployment = provider.hold

export const calledApp: Accessor<string | undefined> = () => provider.read()?.called()
