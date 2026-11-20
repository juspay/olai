import { TESTID as appliance } from "./contracts/appliance-testids.ts"
import { testIds } from "./contracts/testIds.ts"

const CHROME = testIds({
  padi: "padi",
  padiFeed: "padi-feed",
  padiFeedFoot: "padi-feed-foot",
  padiFeedWrench: "padi-feed-wrench",
})

/**
 * `as const` on both halves is
 * load-bearing for the value half: without it the values widen to `string` and
 * a planted value collision compiles clean.
 */
type SharedKey = Extract<keyof typeof appliance, keyof typeof CHROME>
type SharedValue = Extract<
  (typeof appliance)[keyof typeof appliance],
  (typeof CHROME)[keyof typeof CHROME]
>

type Assert<T extends true> = T

type _NoSharedKey = Assert<[SharedKey] extends [never] ? true : SharedKey>
type _NoSharedValue = Assert<[SharedValue] extends [never] ? true : SharedValue>

/** The `as const` is load-bearing rather
 *  than habitual — see the value assertion's measured limit above. */
export const TESTID = { ...appliance, ...CHROME }

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/kolu": OwnedTestIds }
}
