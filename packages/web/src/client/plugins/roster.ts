/**
 * THE REGISTRY, READ AS THE INTERFACE — one line, and the reason it is not
 * three.
 *
 * `@olai/plugins` exports `PLUGINS` as a TUPLE (`as const satisfies
 * ReadonlyArray<OlaiPlugin>`), and that is right where it is declared: a
 * `satisfies` keeps each manifest's own precise type, so a plugin that stopped
 * fitting is a type error on the registry's line with that plugin's NAME on it,
 * which an annotation would have flattened away.
 *
 * It is exactly wrong for a consumer that WALKS it. A tuple of two different
 * object types is a union at `[number]`, and an optional field is only readable
 * off a union where every member declares it — so `plugin.chrome?.Header` does
 * not compile merely because one tenant hangs a readout and the other does not.
 * That is TypeScript being correct about a union and useless about an interface:
 * `chrome` is optional on `OlaiPlugin` precisely so a plugin may omit it, and a
 * walk over the roster is the one place that optionality has to be spendable.
 *
 * So the widening happens ONCE, here, rather than at each of the three walks
 * (`./Chrome.tsx`, `./Mounted.tsx`, `../live/dressings.ts`). Three copies of a
 * type annotation is three places for one of them to be widened differently the
 * day a fourth hook arrives.
 *
 * Nothing is lost by it. The agreement between core and a plugin is proved at
 * the registry's own `satisfies`, upstream of this line and before any consumer
 * exists; what this file does is read the value at the type the interface
 * declares, which is the type every walk below is written against.
 */

import { type OlaiPlugin, PLUGINS } from "@olai/plugins"

/** Every plugin this binary was built with, as the interface. */
export const ROSTER: ReadonlyArray<OlaiPlugin> = PLUGINS
