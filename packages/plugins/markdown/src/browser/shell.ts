/** A COMPONENT AND NOT THIS ROW, and that is load-bearing: content runs under
 * another layout entirely (`olai-plugin-test-layout`,
 * `alternate_layout.feature`), so a row that waited for the shell would be a
 * row that could not. */

import type { Accessor } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"
import type { Shell } from "olai-plugin-layout/contract"

const provider = heldService<Shell>()

export const holdShell = provider.hold

export const desktop: Accessor<boolean> = () => provider.read()?.desktop() ?? false
