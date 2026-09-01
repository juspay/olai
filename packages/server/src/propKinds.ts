/**
 * THE PROPERTY-KIND VOCABULARY THIS SERVE JUDGES WITH — assembled here, out of
 * the plugins this binary was built with and the ones `--plugins` left on.
 *
 * ## Why the composition root is where this happens
 *
 * `@olai/format` owns seven property kinds and imports no plugin — the registry
 * that knows the plugins imports the format, so the arrow cannot point back
 * (`@olai/format`'s `typing.ts` argues the direction in full). A plugin
 * contributes a KIND, a vault declares it in `_olai/Properties.olai` like any
 * other type, and the table travels DOWN as data. This file is the one place
 * where the two ends are both in hand, which makes it the one place the join
 * can be made — the same move `probesOf` makes one line over in `./serve.ts`.
 *
 * ## THE TWO HALVES ARE NOT ONE, and the difference is a file's verdict
 *
 * `built` is every kind this BINARY knows how to mean and is what a
 * DECLARATION is refused against; `enabled` is what this SERVE is running and
 * is what a VALUE is held to. So a vault that says `{"type":"kolu-terminal"}` while
 * this process runs `--plugins=odu` has written a legal row — its values are
 * plain text, wearing no face, which is the state every vault that never heard
 * of kolu is already in — where `{"type":"banana"}` is a broken declarations
 * file naming every legal word. A file's verdict may not depend on a flag it
 * cannot see, and that split is the whole of how it does not.
 *
 * ## Through `/server` and not the root
 *
 * `@olai/plugin-api`'s root is the MANIFESTS, and a manifest carries a plugin's
 * SolidJS faces — reaching it from a process that renders nothing does not
 * merely cost bytes, it KILLS THE BOOT (`./pluginPolicy.ts` carries the whole
 * incident on the same import). The kinds hang on the SERVER door for exactly
 * that reason, which is also where they are spent: the validator and the write
 * planner.
 */

import type { KindVocabulary } from "@olai/format"
import { enabled, kindsOf, SERVERS } from "@olai/plugin-api/server"

/**
 * The vocabulary, for a serve pinned by `--plugins` — `null` being nobody
 * having said, which means every plugin this binary was built with
 * (`./pluginPolicy.ts`).
 *
 * The return type is `@olai/format`'s and the value is `@olai/plugin-api`'s, which
 * is this line's whole job: neither package names the other, the two shapes are
 * declared structurally at each end, and the agreement is a type error HERE if
 * it ever stops holding. It is the arrangement the registry's own `satisfies`
 * is, one floor down.
 */
export const propKinds = (
  pin: ReadonlyArray<string> | null,
): KindVocabulary => kindsOf(SERVERS, enabled(SERVERS, pin))
