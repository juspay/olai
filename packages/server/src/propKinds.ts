/**
 * THE PROPERTY-KIND VOCABULARY THIS SERVE JUDGES WITH — assembled here, out of
 * the plugins this binary was built with and the ones that actually mounted.
 *
 * ## Why the composition root is where this happens
 *
 * `@olai/format` owns seven property kinds and imports no plugin — the registry
 * that knows the plugins imports the format, so the arrow cannot point back
 * (`@olai/format`'s `typing.ts` argues the direction in full). A plugin
 * contributes a KIND, a vault declares it in `_olai/Properties.olai` like any
 * other type, and the table travels DOWN as data. This file is the one place
 * where the two ends are both in hand, which makes it the one place the join
 * can be made.
 *
 * ## THE TWO HALVES ARE NOT ONE, and the difference is a file's verdict
 *
 * `built` is every kind this BINARY knows how to mean and is what a DECLARATION
 * is refused against; `enabled` is what this SERVE is running and is what a
 * VALUE is held to. So a vault that says `{"type":"kolu-terminal"}` while this
 * process runs `--plugins=odu` has written a legal row — its values are plain
 * text, wearing no face, which is the state every vault that never heard of
 * kolu is already in — where `{"type":"banana"}` is a broken declarations file
 * naming every legal word. A file's verdict may not depend on a flag it cannot
 * see, and that split is the whole of how it does not.
 *
 * ## Where the two halves come from now
 *
 * They come from two different places, and that is the shape rather than an
 * asymmetry to tidy. `built` is read off the BUNDLE — every row's module,
 * including the rows this serve disabled, because a disabled row never mounts
 * and its words have to be reachable some other way. `enabled` is read off the
 * live `Kinds` registry, which holds exactly what the fibers that ACTUALLY
 * MOUNTED registered: a plugin that is `PENDING` on a missing service, or that
 * landed in `FAILED` because its `apply` threw, teaches no word — which is
 * right, since `PropKind.admits` is a promise only a plugin that is here can
 * make.
 *
 * ## THE ENABLED HALF FOLLOWS THE FIBERS, and it used to be read once
 *
 * The paragraph here said: *read once, at boot, and that is a phase boundary —
 * the store's codec is built from this table and holds it for the life of the
 * process, so a plugin that unloads mid-serve leaves its word in the codec's
 * `enabled` half until the next boot; the day something can unload one, this is
 * one of the two places that has to learn to move.* The loader surface is that
 * day, and this is the move.
 *
 * `enabled` is a GETTER over the live `Kinds` registry. The codec still holds
 * this one object for the life of the process — nothing about the store changed
 * — and every read of `.enabled` asks the registry as it stands, so a row that
 * leaves takes its words with it and a row that arrives brings them. What a
 * value under a departed kind becomes is what any undeclared key is: plain text,
 * no finding, byte-identical to a vault that never heard of the plugin. That
 * rule needed no amendment; it was already how `built ≠ enabled` read.
 *
 * A GETTER rather than a thunk parameter threaded through `codecFor`, `makeOps`
 * and four format signatures, because the shape those all take is
 * `KindVocabulary` and this IS one — a value with two maps on it, one of which
 * is now answered rather than stored. Nothing downstream learns there are two
 * kinds of vocabulary, which is the same fence every other reading in this file
 * keeps.
 *
 * IT IS AFFORDABLE BECAUSE THE REGISTRY CACHES. `.enabled` is asked wherever a
 * value is held to its declared kind, which is per property drawn;
 * `@olai/effect-cordis`'s `registry` remakes its copy when the table moves and
 * not per read, so between two flips this hands back the same map every time.
 * That was made true in the same lane and for exactly this caller.
 *
 * ## WHAT A LIVE VOCABULARY DOES NOT DO IS RE-JUDGE WHAT IS ALREADY PUBLISHED
 *
 * The reading on the store's ref was validated with the vocabulary in force when
 * it was published, and nothing about a plugin unloading touches a file. So the
 * flip's other half is a re-validation, and it is the composition root's:
 * `./runtime.ts` asks the store to look again once the bundle has settled.
 *
 * `built` DOES NOT MOVE, and that is not an oversight. It is every row's module,
 * including the ones this serve disabled — which is what makes a DECLARATION
 * legal on a machine running only odu — so there is nothing for a flip to change
 * about it. A row that is off was already in it.
 */

import { declaredKinds } from "@olai/bundle/bundle"
import type { KindVocabulary } from "@olai/format"
import type { Plugins } from "@olai/plugin-api/services"
import { Effect } from "effect"

/**
 * The vocabulary, for a runtime whose plugins are already mounted.
 *
 * The return type is `@olai/format`'s and the values are `@olai/bundle`'s and
 * `@olai/plugin-api`'s, which is this function's whole job: none of the three
 * packages names another, the shapes are declared structurally at each end, and
 * the agreement is a type error HERE if it ever stops holding.
 *
 * `null` is a serve with no plugin runtime — `olai surface`, the headless faces,
 * every test that composes none — and it answers the empty vocabulary rather
 * than reading the bundle: a process that mounts no plugin has no business
 * importing every plugin's server module to find out what words it would have
 * taught.
 */
export const propKinds = (plugins: Plugins | null): Effect.Effect<KindVocabulary> =>
  plugins === null
    ? Effect.succeed({ built: new Map(), enabled: new Map() })
    : Effect.map(
      declaredKinds,
      (built) => ({
        built,
        // ASKED, NOT STORED — see the header. The one line in this file that is
        // the loader surface, and the reason the store's codec no longer has to
        // be rebuilt for a plugin to come or go.
        get enabled() {
          return plugins.kinds()
        },
      }),
    )
