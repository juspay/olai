import type { Accessor } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"
import type { Shell } from "olai-plugin-layout/contract"

const provider = heldService<Shell>()

export const holdShell = provider.hold

export const desktop: Accessor<boolean> = () => provider.read()?.desktop() ?? false
