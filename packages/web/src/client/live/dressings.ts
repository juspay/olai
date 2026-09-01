/**
 * THE DRESSINGS THIS APP INSTALLS — one walk over the registry, and the ONE
 * module that names them all.
 *
 * The seam (`./seam.ts`) is a table and a lay-out and imports NO dressing; that
 * half of the arrangement is unchanged and is the half that has to keep
 * holding. What changed is where the LIST comes from.
 *
 * ## It used to be two side-effect imports, and why that stopped being right
 *
 * This module was two lines — `import "./kolu-terminal/index.ts"` and
 * `import "./odu-ci/index.ts"` — each reaching a folder inside this package that
 * called `registerLive` at load. The argument written on those folders was that
 * they were "the app's own tree, registering the app's own table", and that was
 * exactly true while they were. They are packages now (`olai-plugin-kolu`,
 * `olai-plugin-odu`), and the same sentence points the other way: a plugin
 * reaching into this app's table would be the import direction the whole
 * extraction exists to make impossible, and a side-effect import with no binding
 * would be that direction told as a lie by an `import "…"`.
 *
 * So the app WALKS THE REGISTRY and registers what each manifest declares. Three
 * things fall out of that, and each is worth more than the two lines it cost:
 *
 *   - **the list is DERIVED.** "Which properties are live in olai" is one walk
 *     over one registry rather than a set of imports somebody has to remember to
 *     add to — and a plugin that grew a dressing needs no edit here at all.
 *   - **no general package names a tenant.** This file spells neither `kolu` nor
 *     `odu` nor `terminal` nor `worktree`; `@olai/plugin-api` is the only package
 *     allowed to, and `packages/plugin-api/src/fence.test.ts` holds that as an
 *     equality rather than as a habit.
 *   - **a DISABLED plugin is still registered here, and that is correct.**
 *     `--plugins` is a fact about the SERVE and this runs at import time in a
 *     browser (`../wire.ts` argues the whole of why). A dressing whose sibling
 *     this serve did not compose draws its face against a member that answers
 *     nothing, which the readout reports as `degraded` naming that member —
 *     visible, and the state a build and a serve that disagree are actually in.
 *
 * A SIDE-EFFECT IMPORT is still what a consumer makes of this module — importing
 * it once means "the app's faces are installed" (`../props/PropsDrawer.tsx` does,
 * and it is the only importer). What is no longer a side effect is the LIST.
 *
 * `../live/duration/` is not part of it, and that is not an omission: the ⏱ chip
 * is a live face with no property key to hang off, so it registers nothing and is
 * drawn by the row instead. Its own header argues that in full, including what
 * moving it onto the table would take.
 */

import { kindWordOf } from "@olai/plugin-api"

import { ROSTER } from "../plugins/roster.ts"

import { registerLive } from "./seam.ts"

for (const plugin of ROSTER) {
  // `dressings` is absent on a plugin that draws no property, which is a whole
  // plugin — the absent arm of every hook on a manifest is the state a machine
  // without the tool already shows, so there is nothing to guard against here.
  for (const dressing of plugin.dressings ?? []) {
    // COMPOSED HERE, by the registry's own function, because a manifest writes
    // its plugin's BARE word and what a declaration says — and therefore what
    // the page's licence carries — is that word prefixed with the plugin's name
    // (`@olai/plugin-api`'s `kindWordOf`). This app composing the prefix for itself
    // would be a second copy of the one rule that makes plugin-owned names
    // unable to collide with each other or to capture a person's own column.
    registerLive(kindWordOf(plugin.name, dressing.kind), dressing, plugin.name)
  }
}
